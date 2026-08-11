/**
 * Publication gate: fail if Telegram/social URLs leak into authoritative or public evidence.
 */

import fs from "node:fs/promises";
import path from "node:path";

const BLOCKED = [
  "t.me",
  "telegram.me",
  "telegram.org",
  "instagram.com",
  "facebook.com",
  "fb.com",
  "x.com",
  "twitter.com",
  "linkedin.com",
  "youtube.com",
  "youtu.be",
];

const AUTHORITATIVE_FILES = [
  "data/audit/portal-audit.json",
  "data/units/catalog.json",
  "data/systems/catalog.json",
  "data/documents/catalog.json",
  "data/evidence/provenance-ledger.json",
  "data/evidence/research-review.json",
  "data/evidence/dimension-evidence.json",
  "data/evidence/portal-document-reaudit.json",
];

function blockedUrl(value) {
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    return BLOCKED.some(
      (blocked) => host === blocked || host.endsWith(`.${blocked}`)
    );
  } catch {
    return false;
  }
}

function collectUrls(value, location = "$", out = []) {
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value) && blockedUrl(value)) {
      out.push({ location, url: value });
    }
    return out;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectUrls(item, `${location}[${index}]`, out)
    );
    return out;
  }

  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      collectUrls(item, `${location}.${key}`, out);
    }
  }

  return out;
}

async function jsonFiles(directory) {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => path.join(directory, entry.name));
  } catch {
    return [];
  }
}

const files = [
  ...AUTHORITATIVE_FILES,
  ...(await jsonFiles("public/datasets")),
];

const violations = [];

for (const file of files) {
  try {
    const value = JSON.parse(await fs.readFile(file, "utf8"));
    for (const hit of collectUrls(value)) {
      violations.push({
        file,
        ...hit,
      });
    }
  } catch (error) {
    if (AUTHORITATIVE_FILES.includes(file)) {
      throw new Error(
        `Cannot validate social evidence in ${file}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

if (violations.length) {
  console.error("Blocked social evidence URLs detected:");
  for (const hit of violations.slice(0, 100)) {
    console.error(`- ${hit.file} ${hit.location}: ${hit.url}`);
  }
  throw new Error(
    `Publication blocked: ${violations.length} social-media evidence URL(s) remain.`
  );
}

console.log(
  `social evidence gate: clean | checked ${files.length} authoritative/public JSON files`
);

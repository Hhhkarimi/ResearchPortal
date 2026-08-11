/**
 * Non-destructive link monitor for every published evidence URL.
 * It never guesses a university URL and never turns a network failure into a
 * claim that a service is absent. Output is an operational signal for review.
 */

import fs from "node:fs/promises";
import { createHash } from "node:crypto";

const read = async (path) =>
  JSON.parse(await fs.readFile(path, "utf8"));

const [audits, units, systems, documents, ledger] = await Promise.all([
  read("data/audit/portal-audit.json"),
  read("data/units/catalog.json"),
  read("data/systems/catalog.json"),
  read("data/documents/catalog.json"),
  read("data/evidence/provenance-ledger.json"),
]);

const sources = [];

// Collect portal and portal-evidence URLs.
for (const row of audits) {
  if (row.researchUrl) {
    sources.push({
      url: row.researchUrl,
      slug: row.universitySlug,
      kind: "portal",
    });
  }

  for (const url of row.evidenceUrls || []) {
    sources.push({
      url,
      slug: row.universitySlug,
      kind: "portal-evidence",
    });
  }
}

// Collect URLs from catalogs and provenance records.
for (const [kind, rows] of [
  ["unit", units],
  ["system", systems],
  ["document", documents],
  ["provenance", ledger],
]) {
  for (const row of rows) {
    const url = row.sourceUrl || row.parentUrl || row.url;

    if (url) {
      sources.push({
        url,
        slug: row.universitySlug,
        kind,
        id: row.id,
      });
    }
  }
}

// De-duplicate URLs while preserving every claim referring to them.
const grouped = new Map();

for (const source of sources) {
  try {
    const key = new URL(source.url).toString();

    if (!grouped.has(key)) {
      grouped.set(key, {
        url: key,
        claims: [],
      });
    }

    grouped.get(key).claims.push({
      slug: source.slug,
      kind: source.kind,
      id: source.id,
    });
  } catch (error) {
    console.warn(
      `Skipping invalid URL: ${source.url}`,
      error instanceof Error ? error.message : String(error)
    );
  }
}

const targets = [...grouped.values()];

/**
 * Load the previous crawl result.
 *
 * Older versions may contain an array directly.
 * The current format stores records under:
 *
 * {
 *   schemaVersion,
 *   checkedAt,
 *   uniqueUrls,
 *   claimReferences,
 *   counts,
 *   results: [...]
 * }
 */
const previousFile = await fs
  .readFile("data/generated/site-health.json", "utf8")
  .then(JSON.parse)
  .catch(() => []);

const previous = Array.isArray(previousFile)
  ? previousFile
  : Array.isArray(previousFile?.results)
    ? previousFile.results
    : [];

const previousByUrl = new Map(
  previous
    .filter((item) => item?.url)
    .map((item) => [item.url, item])
);

/**
 * Inspect one URL.
 */
async function inspect(target) {
  const checkedAt = new Date().toISOString();

  try {
    const response = await fetch(target.url, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "IranResearchPortalObservatory/8.1 (+link-monitor)",
        Accept:
          "text/html,application/pdf,application/json;q=0.9,*/*;q=0.5",
      },
      signal: AbortSignal.timeout(18_000),
    });

    const contentType = response.headers.get("content-type");

    const meta = {
      status: response.status,
      ok: response.ok,
      finalUrl: response.url,
      contentType,
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified"),
      contentLength: response.headers.get("content-length"),
    };

    const signature = createHash("sha256")
      .update(JSON.stringify(meta))
      .digest("hex")
      .slice(0, 16);

    const before = previousByUrl.get(target.url);

    return {
      ...target,
      ...meta,
      signature,
      checkedAt,
      change: !before
        ? "new"
        : before.signature !== signature
          ? "changed"
          : "unchanged",
    };
  } catch (error) {
    return {
      ...target,
      status: "network-error",
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : String(error),
      checkedAt,
      change: "check-failed",
    };
  }
}

// Check up to 6 URLs concurrently.
const results = [];
let cursor = 0;

const workers = Array.from(
  {
    length: Math.min(6, targets.length),
  },
  async () => {
    while (cursor < targets.length) {
      const index = cursor++;
      results[index] = await inspect(targets[index]);
    }
  }
);

await Promise.all(workers);

// Summarize changes.
const counts = results.reduce((out, row) => {
  out[row.change] = (out[row.change] || 0) + 1;
  return out;
}, {});

const report = {
  schemaVersion: 1,
  checkedAt: new Date().toISOString(),
  uniqueUrls: targets.length,
  claimReferences: sources.length,
  counts,
  results,
};

// Ensure generated directory exists.
await fs.mkdir("data/generated", {
  recursive: true,
});

// Save complete site-health state.
await fs.writeFile(
  "data/generated/site-health.json",
  JSON.stringify(report, null, 2) + "\n"
);

// Save compact change report.
await fs.writeFile(
  "data/generated/change-report.json",
  JSON.stringify(
    {
      checkedAt: report.checkedAt,

      changed: results.filter(
        (item) => item.change === "changed"
      ),

      failed: results.filter(
        (item) => !item.ok
      ),

      new: results.filter(
        (item) => item.change === "new"
      ),
    },
    null,
    2
  ) + "\n"
);

console.log(
  [
    `monitored ${targets.length} unique URLs`,
    `for ${sources.length} published claims`,
    `changed ${counts.changed || 0}`,
    `new ${counts.new || 0}`,
    `unchanged ${counts.unchanged || 0}`,
    `failed ${results.filter((item) => !item.ok).length}`,
  ].join(" | ")
);

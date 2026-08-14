import fs from "node:fs/promises";

const read = async (file) => JSON.parse(await fs.readFile(file, "utf8"));
const [discovery, docs, summary, actions] = await Promise.all([
  read("data/generated/discovery-evidence.json"),
  read("data/generated/discovered-documents.json"),
  read("data/generated/discovery-summary.json"),
  read("data/generated/crawl-v14-actions.json"),
]);

const VERSION = "14.0-hub-interactive-relations";
for (const [name, value] of [["discovery", discovery], ["documents", docs], ["summary", summary], ["actions", actions]]) {
  if (value.crawlerVersion !== VERSION) throw new Error(`${name} crawlerVersion mismatch: ${value.crawlerVersion}`);
}
if (summary.institutions !== 115) throw new Error(`v14 must complete 115 institutions, got ${summary.institutions}`);
if ((summary.universities || []).length !== 115) throw new Error("v14 university summary must contain 115 rows");
if (Object.prototype.hasOwnProperty.call(summary.dimensionCounts || {}, "informationTechnology")) {
  throw new Error("IT dimension remains in crawler v14 summary");
}
const evidence = discovery.evidence || [];
const references = discovery.references || [];
if (evidence.some((row) => row.dimension === "informationTechnology")) throw new Error("IT evidence remains in crawler v14");
if (references.some((row) => row.dimension === "informationTechnology")) throw new Error("IT reference remains in crawler v14");

const blockedSocial = /(^|\.)((t|telegram)\.me|telegram\.org|instagram\.com|facebook\.com|fb\.com|x\.com|twitter\.com|linkedin\.com|youtube\.com|youtu\.be)$/i;
for (const row of [...evidence, ...references, ...(docs.documents || [])]) {
  try {
    const host = new URL(row.url).hostname.replace(/^www\./, "");
    if (blockedSocial.test(host)) throw new Error(`Social URL leaked into v14: ${row.url}`);
  } catch (error) {
    if (String(error?.message || "").startsWith("Social URL leaked")) throw error;
  }
}

for (const row of references) {
  if (row.entityHint !== "external-service") throw new Error(`Reference must be external-service: ${row.url}`);
  if (row.relationHint !== "links-to") throw new Error(`Reference relation must be links-to: ${row.url}`);
  if (row.countTowardUniversitySystems !== false) throw new Error(`External reference counts as university system: ${row.url}`);
  if (row.countTowardRTPMI !== false) throw new Error(`External reference counts toward RTPMI: ${row.url}`);
}

for (const row of evidence) {
  if (!row.discoveryConfidence || !row.semanticConfidence) {
    throw new Error(`Evidence lacks split confidence: ${row.universitySlug}:${row.url}`);
  }
  if (!row.entityHint || !row.relationHint || !row.ownershipHint) {
    throw new Error(`Evidence lacks semantic hints: ${row.universitySlug}:${row.url}`);
  }
}

const knownExternalHosts = new Set(["shaa.msrt.ir", "emshaa.msrt.ir", "jcr.isc.ac", "sate.atf.gov.ir", "nan.ac", "gigalib.org", "gigalib.ir", "gigapaper.ir", "megapaper.ir"]);
for (const row of evidence) {
  try {
    const host = new URL(row.url).hostname.replace(/^www\./, "");
    if (knownExternalHosts.has(host) || host.endsWith(".msrt.ir") || host.endsWith(".isc.ac")) {
      throw new Error(`Known national/commercial service leaked into university evidence: ${row.url}`);
    }
  } catch (error) {
    if (String(error?.message || "").startsWith("Known national")) throw error;
  }
}

if (!Array.isArray(actions.actions)) throw new Error("v14 action log is invalid");
for (const action of actions.actions) {
  if (!Number.isInteger(action.beforeLinks) && action.beforeLinks !== null) throw new Error("Invalid action beforeLinks");
  if (!Number.isInteger(action.afterLinks) && action.afterLinks !== null) throw new Error("Invalid action afterLinks");
  if (/login|sign in|ورود|ثبت نام|register|submit|ارسال/i.test(String(action.text || ""))) {
    throw new Error(`Unsafe interactive action recorded: ${action.text}`);
  }
}

console.log(
  `crawler v14 validation passed | universities=115 | evidence=${evidence.length} | references=${references.length} | docs=${(docs.documents || []).length} | actions=${actions.actions.length} | IT=0 | social=0`
);

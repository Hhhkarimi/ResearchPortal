import fs from "node:fs";

const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const summary = read("data/statistics/summary.json");
const diff = read("data/statistics/snapshot-diff.json");
const evidence = read("data/evidence/dimension-evidence.json");
const rankings = read("data/statistics/portal-ranking.json");
const publicSummary = read("public/datasets/statistics-summary.json");
const publicDiff = read("public/datasets/statistics-snapshot-diff.json");
const searchIndex = read("data/search/global-index.json");

const fail = (message) => { throw new Error(message); };
if (summary.methodologyVersion !== "RTPMI-4.2-ISC") fail("summary is not RTPMI 4.2");
if (summary.publicEvidenceDimensions !== 7) fail("summary does not expose 7 dimensions");
if (summary.dimensionEvidenceOutcomes !== 805 || evidence.length !== 805) fail("outcome matrix is not 115 × 7");
for (const field of ["dimensions", "reviewDimensions", "reportedReviewDimensions"]) {
  if (Object.keys(summary[field] || {}).length !== 7 || summary[field]?.informationTechnology) fail(`stale summary field: ${field}`);
}
if (rankings.some((row) => row.methodologyVersion !== "RTPMI-4.2-ISC" || row.metrics?.digital || !("systems" in row.metrics))) fail("ranking schema is stale");
if (JSON.stringify(publicSummary) !== JSON.stringify(summary)) fail("public summary differs from source summary");
if (JSON.stringify(publicDiff) !== JSON.stringify(diff)) fail("public snapshot diff differs from source diff");
if (diff.toSnapshot !== summary.snapshotDate || !diff.fromSnapshot) fail("snapshot diff is not reproducible");
const searchKinds = new Set(searchIndex.map((row) => row.kind));
if (!["university", "document", "system", "unit"].every((kind) => searchKinds.has(kind))) fail("global search index is incomplete");
if (searchIndex.some((row) => !row.id || !row.title || !row.href || !row.searchText)) fail("global search index contains an invalid record");

console.log(`v11 observatory validation passed | 115 institutions | ${evidence.length} outcomes | ${rankings.length} ranked | ${diff.fromSnapshot} -> ${diff.toSnapshot}`);

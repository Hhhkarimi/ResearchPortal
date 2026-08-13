import fs from "node:fs/promises";
import path from "node:path";

const read = async (file, fallback = null) => {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
};

const currentDate = process.env.PIPELINE_SNAPSHOT_DATE || "2026-08-12";
const snapshotsRoot = "data/snapshots";
const configuredPrevious = process.env.PIPELINE_PREVIOUS_SNAPSHOT_DATE;
const available = await fs.readdir(snapshotsRoot, {withFileTypes: true}).catch(() => []);
const previousDate = configuredPrevious || available
  .filter((entry) => entry.isDirectory() && entry.name < currentDate)
  .map((entry) => entry.name)
  .sort()
  .at(-1);

if (!previousDate) {
  throw new Error(`No previous snapshot is available before ${currentDate}`);
}

const previousRoot = path.join(snapshotsRoot, previousDate);
const [currentSummary, previousSummary, currentAudit, previousAudit, currentReviews, previousReviews,
  currentDocuments, previousDocuments, currentRanking, previousRanking, changeReport] = await Promise.all([
  read("data/statistics/summary.json"),
  read(path.join(previousRoot, "summary.json")),
  read("data/audit/portal-audit.json", []),
  read(path.join(previousRoot, "portal-audit.json"), []),
  read("data/evidence/research-review.json", []),
  read(path.join(previousRoot, "research-review.json"), []),
  read("data/documents/catalog.json", []),
  read(path.join(previousRoot, "documents-catalog.json"), []),
  read("data/statistics/portal-ranking.json", []),
  read(path.join(previousRoot, "portal-ranking.json"), []),
  read("data/generated/change-report.json", {changed: []}),
]);

const bySlug = (rows) => new Map(rows.map((row) => [row.universitySlug, row]));
const previousAuditBySlug = bySlug(previousAudit);
const previousReviewsBySlug = bySlug(previousReviews);
const previousRankingBySlug = bySlug(previousRanking);
const publicCoverage = (row) => {
  const values = Object.entries(row?.dimensions || {})
    .filter(([dimension]) => dimension !== "informationTechnology")
    .map(([, status]) => status);
  if (!values.length) return null;
  const verified = values.filter((status) => status === "verified").length;
  const observed = values.filter((status) => status === "observed-reference").length;
  return 100 * (verified + 0.5 * observed) / values.length;
};

const coverageAverage = (rows) => {
  const values = rows.map(publicCoverage).filter((value) => value !== null);
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10 : 0;
};

const newDirectPortals = currentAudit.filter((row) =>
  row.portalAuditStatus === "direct-official" &&
  previousAuditBySlug.get(row.universitySlug)?.portalAuditStatus !== "direct-official"
);

const previousDocumentKeys = new Set(previousDocuments.map((row) => row.id || row.url));
const addedDocuments = currentDocuments.filter((row) => !previousDocumentKeys.has(row.id || row.url));

const improvedEvidence = currentReviews
  .map((row) => ({
    universitySlug: row.universitySlug,
    nameFa: row.nameFa,
    before: publicCoverage(previousReviewsBySlug.get(row.universitySlug)),
    after: publicCoverage(row),
  }))
  .filter((row) => row.before !== null && row.after !== null && row.after > row.before)
  .sort((a, b) => (b.after - b.before) - (a.after - a.before));

const scoreChanges = currentRanking
  .map((row) => {
    const previous = previousRankingBySlug.get(row.universitySlug);
    return previous ? {
      universitySlug: row.universitySlug,
      nameFa: row.nameFa,
      before: previous.score,
      after: row.score,
      delta: Math.round((row.score - previous.score) * 10) / 10,
    } : null;
  })
  .filter((row) => row && row.delta !== 0)
  .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

const brokenLinks = [...new Set(
  (changeReport.changed || [])
    .filter((row) => row.ok === false || row.status >= 400)
    .map((row) => row.url)
)];

const previousCoverageAverage = coverageAverage(previousReviews);
const currentCoverageAverage = coverageAverage(currentReviews);

const snapshotDiff = {
  schemaVersion: "1.0.0",
  fromSnapshot: previousDate,
  toSnapshot: currentDate,
  methodologyChanged: previousSummary.methodologyVersion !== currentSummary.methodologyVersion,
  methodology: {before: previousSummary.methodologyVersion, after: currentSummary.methodologyVersion},
  totals: {
    directOfficialPortals: {before: previousSummary.directOfficialPortals, after: currentSummary.directOfficialPortals,
      delta: currentSummary.directOfficialPortals - previousSummary.directOfficialPortals},
    documents: {before: previousSummary.documents, after: currentSummary.documents,
      delta: currentSummary.documents - previousSummary.documents},
    evidenceCoverageAverage: {before: previousCoverageAverage, after: currentCoverageAverage,
      delta: Math.round((currentCoverageAverage - previousCoverageAverage) * 10) / 10},
    ranked: {before: previousSummary.ranked, after: currentSummary.ranked,
      delta: currentSummary.ranked - previousSummary.ranked},
  },
  newDirectPortals: newDirectPortals.map(({universitySlug}) => universitySlug),
  addedDocuments: addedDocuments.length,
  improvedEvidenceInstitutions: improvedEvidence.length,
  brokenLinksDetected: brokenLinks.length,
  rankingChanges: scoreChanges.length,
  highlights: {
    improvedEvidence: improvedEvidence.slice(0, 5),
    scoreChanges: scoreChanges.slice(0, 5),
    brokenLinks: brokenLinks.slice(0, 5),
  },
  interpretation: previousSummary.methodologyVersion !== currentSummary.methodologyVersion
    ? "RTPMI methodology changed between snapshots; score deltas are a rebaseline, not a pure performance change."
    : "Score deltas use the same RTPMI methodology.",
};

await fs.writeFile(
  "data/statistics/snapshot-diff.json",
  JSON.stringify(snapshotDiff, null, 2) + "\n"
);

const currentSnapshotRoot = path.join(snapshotsRoot, currentDate);
await fs.mkdir(currentSnapshotRoot, {recursive: true});
await Promise.all([
  ["data/statistics/summary.json", "summary.json"],
  ["data/statistics/portal-ranking.json", "portal-ranking.json"],
  ["data/audit/portal-audit.json", "portal-audit.json"],
  ["data/evidence/research-review.json", "research-review.json"],
  ["data/documents/catalog.json", "documents-catalog.json"],
].map(([source, target]) => fs.copyFile(source, path.join(currentSnapshotRoot, target))));

console.log(`snapshot diff ${previousDate} -> ${currentDate} | evidence Δ=${snapshotDiff.totals.evidenceCoverageAverage.delta} | improved=${improvedEvidence.length} | broken=${brokenLinks.length}`);

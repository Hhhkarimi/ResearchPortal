import fs from "node:fs/promises";
import {scoreCoverageAdjustment, scoreFindability, scoreIndustryTechnology} from "./rtpmi-scoring-policy.mjs";

const read = async (file) => JSON.parse(await fs.readFile(file, "utf8"));
const write = async (file, value) => fs.writeFile(file, JSON.stringify(value, null, 2) + "\n");

const [isc, audit, matrix, units, systems, documents, referencePages] = await Promise.all([
  read("data/isc/institutions.json"),
  read("data/audit/portal-audit.json"),
  read("data/audit/deep-audit-matrix.json"),
  read("data/units/catalog.json"),
  read("data/systems/catalog.json"),
  read("data/documents/catalog.json"),
  read("data/generated/reference-pages.json"),
]);

const DATE = process.env.PIPELINE_SNAPSHOT_DATE || "2026-08-11";
const METHODOLOGY_VERSION = process.env.PIPELINE_METHODOLOGY_VERSION || "RTPMI-4.2-ISC";
const SCORING_POLICY_VERSION = "entity-cleaning-2.2-coverage-shrinkage-findability";

const weights = {
  documents: 0.20,
  organization: 0.12,
  library: 0.10,
  laboratories: 0.12,
  systems: 0.12,
  industryTech: 0.12,
  dataQuality: 0.12,
  findability: 0.10,
};

const clamp = (value) => Math.max(0, Math.min(100, Math.round(value * 10) / 10));
const ratio = (numerator, denominator) => denominator ? Math.min(1, numerator / denominator) : 0;
const byUniversity = (items, slug) => items.filter((item) => item.universitySlug === slug);
const isVerified = (item) => ["verified", "verified-basic", "direct", "official"].includes(item?.evidence);

const systemReferenceCounts = new Map();
for (const item of referencePages || []) {
  const sourceCatalog = String(item?.sourceCatalog || "");
  if (!(sourceCatalog === "systems" || sourceCatalog === "reaudit:systemsUrls")) continue;
  if (!item?.universitySlug || item?.dimension === "informationTechnology") continue;

  const text = `${item?.title || ""} ${item?.entityType || ""} ${item?.reason || ""}`;
  if (/unit-reference|organizational-unit|administrative|non-research|information-technology/iu.test(text)) continue;
  if (!/سامانه|system|portal|guide-about-system|announcement-about-system|not-proven-system-endpoint/iu.test(text)) continue;

  systemReferenceCounts.set(
    item.universitySlug,
    (systemReferenceCounts.get(item.universitySlug) || 0) + 1
  );
}

function scorePortal(institution, deepAudit, portalAudit) {
  const universityUnits = byUniversity(units, institution.slug).filter(isVerified);
  const universitySystems = byUniversity(systems, institution.slug).filter(isVerified);
  const universityDocuments = byUniversity(documents, institution.slug).filter(isVerified);

  const unitTypes = new Set(universityUnits.map((item) => item.type));
  const systemCategories = new Set(universitySystems.map((item) => item.category));
  const verifiedDimension = (key) => deepAudit.dimensions[key] === "verified";
  const metrics = {};

  if (verifiedDimension("documentsRegulations")) {
    const kinds = new Set(universityDocuments.map((item) => item.type).filter(Boolean));
    const direct = universityDocuments.filter((item) => item.url).length;
    metrics.documents = clamp(
      45 * ratio(kinds.size, 5) +
      30 * ratio(universityDocuments.length, 8) +
      25 * ratio(direct, universityDocuments.length)
    );
  } else {
    metrics.documents = null;
  }

  if (verifiedDimension("organization")) {
    const core = [
      "research", "industry", "technology", "library",
      "laboratory", "publishing", "research-centers", "ethics",
    ];
    const breadth = core.filter((type) => unitTypes.has(type)).length;
    metrics.organization = clamp(45 + 55 * ratio(breadth, 6));
  } else {
    metrics.organization = null;
  }

  metrics.library = verifiedDimension("libraryDocuments")
    ? clamp((unitTypes.has("library") ? 70 : 0) + (systemCategories.has("library") ? 30 : 0))
    : null;

  metrics.laboratories = verifiedDimension("laboratories")
    ? clamp((unitTypes.has("laboratory") ? 70 : 0) + (systemCategories.has("laboratory") ? 30 : 0))
    : null;

  if (verifiedDimension("systemsServices")) {
    const relevant = ["research", "journals", "library", "laboratory", "innovation", "industry", "publishing"];
    const diversity = relevant.filter((category) => systemCategories.has(category)).length;
    const directRelations = universitySystems.filter((item) =>
      ["managed-by-portal", "unit-service", "system-endpoint", "linked-external-system"].includes(item.relation)
    ).length;

    metrics.systems = clamp(
      50 * ratio(diversity, 4) +
      30 * ratio(universitySystems.length, 6) +
      20 * ratio(directRelations, universitySystems.length)
    );
  } else {
    metrics.systems = null;
  }

  metrics.industryTech = scoreIndustryTechnology({
    verified: verifiedDimension("industryTechnology"),
    units: universityUnits,
    systems: universitySystems,
    researchUrl: portalAudit.researchUrl,
  });

  const records = [...universityUnits, ...universitySystems, ...universityDocuments];
  const withSource = records.filter((item) => item.sourceUrl || item.parentUrl || item.url).length;
  const withDate = records.filter((item) => item.lastVerified).length;

  metrics.dataQuality = clamp(
    30 +
    (portalAudit.researchUrl ? 20 : 0) +
    25 * ratio(withSource, records.length) +
    25 * ratio(withDate, records.length)
  );

  metrics.findability = scoreFindability({
    researchUrl: portalAudit.researchUrl,
    units: universityUnits,
    systems: universitySystems,
    documents: universityDocuments,
    systemsStatus: deepAudit.dimensions.systemsServices,
    systemReferenceCount: systemReferenceCounts.get(institution.slug) || 0,
    documentsVerified: verifiedDimension("documentsRegulations"),
  });

  const active = Object.entries(weights).filter(([key]) =>
    metrics[key] !== null && Number.isFinite(metrics[key])
  );

  const totalWeight = active.reduce((sum, [, weight]) => sum + weight, 0);
  const score = clamp(
    active.reduce((sum, [key, weight]) => sum + metrics[key] * weight, 0) / totalWeight
  );

  const activeWeight = Math.round(totalWeight * 100);
  const {coverageAdjustedScore, rankingScore} = scoreCoverageAdjustment({
    score,
    activeWeight,
    neutralPrior: 50,
  });

  const provenance = records.length
    ? 100 * (
        0.5 * ratio(withSource, records.length) +
        0.5 * ratio(withDate, records.length)
      )
    : 50;

  const confidence = clamp(0.72 * deepAudit.auditEvidenceCoverage + 0.28 * provenance);

  return {
    score,
    coverageAdjustedScore,
    rankingScore,
    confidence,
    metrics,
    units: universityUnits.length,
    systems: universitySystems.length,
    documents: universityDocuments.length,
    activeWeight,
    evidenceCoverage: deepAudit.auditEvidenceCoverage,
  };
}

const auditBySlug = new Map(audit.map((item) => [item.universitySlug, item]));
const matrixBySlug = new Map(matrix.map((item) => [item.universitySlug, item]));
const candidates = [];

for (const institution of isc) {
  const portalAudit = auditBySlug.get(institution.slug);
  const deepAudit = matrixBySlug.get(institution.slug);
  if (!portalAudit || !deepAudit) continue;
  if (portalAudit.portalAuditStatus !== "direct-official") continue;
  if (deepAudit.auditEvidenceCoverage < 75) continue;

  const scored = scorePortal(institution, deepAudit, portalAudit);
  if (scored.confidence < 65) continue;

  candidates.push({
    universitySlug: institution.slug,
    nameFa: institution.nameFa,
    iscCategory: institution.category,
    iscRank: institution.iscRank,
    ...scored,
    methodologyVersion: METHODOLOGY_VERSION,
    scoringPolicyVersion: SCORING_POLICY_VERSION,
    snapshotDate: DATE,
  });
}

candidates.sort((a, b) =>
  b.rankingScore - a.rankingScore ||
  b.confidence - a.confidence ||
  b.score - a.score ||
  a.iscRank - b.iscRank
);

candidates.forEach((row, index) => {
  row.rank = index + 1;
});

for (const category of [...new Set(candidates.map((item) => item.iscCategory))]) {
  const rows = candidates.filter((item) => item.iscCategory === category);
  rows.forEach((row, index) => {
    row.portalRankWithinISCClass = index + 1;
    row.rankedPortalsInISCClass = rows.length;
  });
}

await write("data/statistics/portal-ranking.json", candidates);
await write("data/statistics/rtpmi-weights.json", {
  methodologyVersion: METHODOLOGY_VERSION,
  scoringPolicyVersion: SCORING_POLICY_VERSION,
  weights,
  publicEvidenceDimensions: 7,
  missingDataRule: "unresolved dimensions are excluded from the weighted denominator; they reduce confidence/audit coverage rather than becoming zero",
  industryTechnologyRule: "verified industry/technology units establish existence; a dedicated official hub/subdomain is maturity evidence; a side-system is supplementary and not a prerequisite",
  findabilityRule: "existence evidence is separate from direct target findability; system references preserved by cleaning keep the systems share in the denominator even if the cleaned systems dimension becomes unresolved",
  rankingRule: "score remains the active-dimension RTPMI score; coverageAdjustedScore is a strict evidence-backed diagnostic; public rank uses rankingScore, which shrinks unresolved weight toward a neutral prior of 50 instead of treating it as zero",
  rankingGate: {
    portalAuditStatus: "direct-official",
    minimumAuditEvidenceCoverage: 75,
    minimumConfidence: 65,
  },
});

console.log(
  `RTPMI final: ranked ${candidates.length}/115; methodology=${METHODOLOGY_VERSION}; top=${candidates[0]?.nameFa ?? "none"} rankingScore=${candidates[0]?.rankingScore ?? ""} activeScore=${candidates[0]?.score ?? ""}`
);

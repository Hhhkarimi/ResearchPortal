import fs from "node:fs/promises";

const read = async (file) =>
  JSON.parse(await fs.readFile(file, "utf8"));

const write = async (file, value) =>
  fs.writeFile(file, JSON.stringify(value, null, 2) + "\n");

const [
  isc,
  audits,
  reaudit,
  units,
  systems,
  documents,
] = await Promise.all([
  read("data/isc/institutions.json"),
  read("data/audit/portal-audit.json"),
  read("data/evidence/portal-document-reaudit.json"),
  read("data/units/catalog.json"),
  read("data/systems/catalog.json"),
  read("data/documents/catalog.json"),
]);

const DIMENSIONS = [
  "portalIdentity",
  "organization",
  "libraryDocuments",
  "laboratories",
  "industryTechnology",
  "systemsServices",
  "documentsRegulations",
];

const auditBySlug = new Map(
  audits.map((item) => [item.universitySlug, item])
);

const reauditBySlug = new Map(
  reaudit.map((item) => [item.slug, item])
);

const byUniversity = (items, slug) =>
  items.filter((item) => item.universitySlug === slug);

const verified = (item) =>
  ["verified", "verified-basic"].includes(item.evidence);

const state = (ok, observed, restricted) =>
  restricted
    ? "restricted"
    : ok
      ? "verified"
      : observed
        ? "observed-reference"
        : "unresolved";

const matrix = [];

for (const institution of isc) {
  const slug = institution.slug;
  const audit = auditBySlug.get(slug);
  const row = reauditBySlug.get(slug) || {};

  const universityUnits = byUniversity(units, slug).filter(verified);
  const universitySystems = byUniversity(systems, slug).filter(verified);
  const universityDocuments = byUniversity(documents, slug).filter(verified);

  const signals = new Set(audit?.observedSignals || []);
  const types = new Set(universityUnits.map((item) => item.type));
  const systemCategories = new Set(
    universitySystems.map((item) => item.category)
  );

  const restricted = [
    "restricted-public",
    "restricted-official-reference",
    "legacy-restricted",
  ].includes(audit.portalAuditStatus);

  const organizationDirect =
    (row.organizationUrls || []).length > 0 ||
    types.has("research");

  const libraryDirect =
    (row.libraryUrls || []).length > 0 ||
    types.has("library") ||
    systemCategories.has("library");

  const laboratoryDirect =
    (row.laboratoryUrls || []).length > 0 ||
    types.has("laboratory") ||
    systemCategories.has("laboratory");

  const industryDirect =
    (row.industryTechnologyUrls || []).length > 0 ||
    types.has("industry") ||
    types.has("technology") ||
    systemCategories.has("industry") ||
    systemCategories.has("innovation");

  const systemsDirect =
    universitySystems.length > 0 ||
    (row.systemsUrls || []).length > 0;

  const documentsDirect =
    universityDocuments.length > 0 ||
    (row.directDocuments || []).length > 0 ||
    (row.documentIndexUrls || []).length > 0;

  const dimensions = {
    portalIdentity:
      audit.portalAuditStatus === "direct-official"
        ? "verified"
        : restricted
          ? "restricted"
          : !["secondary-reference", "false-positive-blocked"].includes(
              audit.portalAuditStatus
            )
            ? "observed-reference"
            : "unresolved",

    organization: state(
      organizationDirect,
      signals.has("research") || signals.has("structure"),
      restricted
    ),

    libraryDocuments: state(
      libraryDirect,
      signals.has("library"),
      restricted
    ),

    laboratories: state(
      laboratoryDirect,
      signals.has("laboratory"),
      restricted
    ),

    industryTechnology: state(
      industryDirect,
      signals.has("industry") || signals.has("technology"),
      restricted
    ),

    systemsServices: state(
      systemsDirect,
      ["postdoc", "journals", "forms", "systems"].some((signal) =>
        signals.has(signal)
      ),
      restricted
    ),

    documentsRegulations: state(
      documentsDirect,
      signals.has("forms") || signals.has("documents"),
      restricted
    ),
  };

  const resolved = Object.values(dimensions).filter((value) =>
    ["verified", "restricted"].includes(value)
  ).length;

  const observed = Object.values(dimensions).filter(
    (value) => value === "observed-reference"
  ).length;

  const coverage = Math.round(
    (100 * (resolved + 0.5 * observed)) / DIMENSIONS.length
  );

  const deepAuditStatus =
    audit.portalAuditStatus === "direct-official"
      ? coverage >= 75
        ? "deep-audited"
        : "identity-verified-deep-pending"
      : restricted
        ? "restricted-closed"
        : audit.portalAuditStatus === "false-positive-blocked"
          ? "blocked-needs-alternative-discovery"
          : audit.portalAuditStatus === "secondary-reference"
            ? "portal-resolution-pending"
            : "reference-resolved-deep-pending";

  matrix.push({
    universitySlug: slug,
    nameFa: institution.nameFa,
    iscCategory: institution.category,
    iscRank: institution.iscRank,
    auditDate:
      process.env.PIPELINE_SNAPSHOT_DATE ||
      "2026-08-11",
    portalAuditStatus: audit.portalAuditStatus,
    researchUrl: audit.researchUrl || null,
    evidenceUrls: audit.evidenceUrls || [],
    deepAuditStatus,
    dimensions,
    auditEvidenceCoverage: coverage,
    unitsFound: universityUnits.length,
    systemsFound: universitySystems.length,
    documentsFound: universityDocuments.length,
    rankingEligibility:
      audit.portalAuditStatus === "direct-official" && coverage >= 75
        ? "candidate"
        : "unranked-evidence-insufficient",
    interpretation:
      "Audit coverage measures evidence resolution, not portal quality. Missing/unresolved is not scored as zero.",
  });
}

await write(
  "data/audit/deep-audit-matrix.json",
  matrix
);

console.log(
  `deep audit matrix: ${matrix.length}; dimensions=${DIMENSIONS.length}; deep=${
    matrix.filter((item) => item.deepAuditStatus === "deep-audited").length
  }`
);

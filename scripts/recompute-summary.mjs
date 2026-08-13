import fs from "node:fs/promises";

const read = async (file) =>
  JSON.parse(
    await fs.readFile(
      file,
      "utf8"
    )
  );

const [
  isc,
  audit,
  deep,
  rank,
  units,
  systems,
  documents,
  ledger,
  dimensionEvidence,
  reviews,
] = await Promise.all([
  read("data/isc/institutions.json"),
  read("data/audit/portal-audit.json"),
  read("data/audit/deep-audit-matrix.json"),
  read("data/statistics/portal-ranking.json"),
  read("data/units/catalog.json"),
  read("data/systems/catalog.json"),
  read("data/documents/catalog.json"),
  read("data/evidence/provenance-ledger.json"),
  read("data/evidence/dimension-evidence.json"),
  read("data/evidence/research-review.json"),
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

const count = (
  values
) =>
  Object.fromEntries(
    [
      ...new Set(
        values
      ),
    ].map(
      (key) => [
        key,

        values.filter(
          (value) =>
            value === key
        ).length,
      ]
    )
  );

const categories = [
  ...new Set(
    isc.map(
      (item) =>
        item.category
    )
  ),
];

const summary = {
  iscScope:
    isc.length,

  publicEvidenceDimensions:
    DIMENSIONS.length,

  categoryCounts:
    count(
      isc.map(
        (item) =>
          item.category
      )
    ),

  portalStatusCounts:
    count(
      audit.map(
        (item) =>
          item.portalAuditStatus
      )
    ),

  directOfficialPortals:
    audit.filter(
      (item) =>
        item.portalAuditStatus ===
        "direct-official"
    ).length,

  portalResolutionOutcomes:
    audit.length,

  unresolvedPublicPortal:
    audit.filter(
      (item) =>
        item.portalAuditStatus ===
        "unresolved-public-portal"
    ).length,

  ranked:
    rank.length,

  unranked:
    isc.length -
    rank.length,

  rankedByISCCategory:
    Object.fromEntries(
      categories.map(
        (category) => [
          category,

          rank.filter(
            (item) =>
              item.iscCategory ===
              category
          ).length,
        ]
      )
    ),

  deepAuditStatusCounts:
    count(
      deep.map(
        (item) =>
          item.deepAuditStatus
      )
    ),

  deepAuditedByISCCategory:
    Object.fromEntries(
      categories.map(
        (category) => [
          category,

          deep.filter(
            (item) =>
              item.iscCategory ===
                category &&
              item.deepAuditStatus ===
                "deep-audited"
          ).length,
        ]
      )
    ),

  evidenceCoverage: {
    average:
      Math.round(
        (
          10 *
          deep.reduce(
            (
              sum,
              item
            ) =>
              sum +
              item
                .auditEvidenceCoverage,

            0
          )
        ) /
          deep.length
      ) /
      10,

    complete100:
      deep.filter(
        (item) =>
          item
            .auditEvidenceCoverage ===
          100
      ).length,

    gte75:
      deep.filter(
        (item) =>
          item
            .auditEvidenceCoverage >=
          75
      ).length,

    gte50:
      deep.filter(
        (item) =>
          item
            .auditEvidenceCoverage >=
          50
      ).length,
  },

  dimensions:
    Object.fromEntries(
      DIMENSIONS.map(
        (key) => [
          key,

          count(
            deep.map(
              (item) =>
                item
                  .dimensions[
                  key
                ]
            )
          ),
        ]
      )
    ),

  reviewDimensions:
    Object.fromEntries(
      DIMENSIONS.map(
        (key) => [
          key,

          count(
            dimensionEvidence
              .filter(
                (item) =>
                  item.dimension ===
                  key
              )
              .map(
                (item) =>
                  item.status
              )
          ),
        ]
      )
    ),

  reportedReviewDimensions:
    Object.fromEntries(
      DIMENSIONS.map(
        (key) => [
          key,

          count(
            dimensionEvidence
              .filter(
                (item) =>
                  item.dimension ===
                  key
              )
              .map(
                (item) =>
                  item.reportedStatus
              )
          ),
        ]
      )
    ),

  reviewCoverage: {
    average:
      Math.round(
        (
          10 *
          reviews.reduce(
            (
              sum,
              row
            ) =>
              sum +
              row
                .reviewEvidenceCoverage,

            0
          )
        ) /
          reviews.length
      ) /
      10,

    complete100:
      reviews.filter(
        (item) =>
          item
            .reviewEvidenceCoverage ===
          100
      ).length,

    gte75:
      reviews.filter(
        (item) =>
          item
            .reviewEvidenceCoverage >=
          75
      ).length,

    reviewedInstitutions:
      reviews.length,

    dimensionOutcomes:
      dimensionEvidence.length,
  },

  units:
    units.length,

  systems:
    systems.length,

  documents:
    documents.length,

  provenanceRecords:
    ledger.length,

  dimensionEvidenceOutcomes:
    dimensionEvidence.length,

  dimensionEvidenceSources:
    dimensionEvidence.reduce(
      (
        sum,
        row
      ) =>
        sum +
        row.sourceCount,

      0
    ),

  publicationGateDowngrades:
    dimensionEvidence.filter(
      (row) =>
        row
          .publicationAdjustment
    ).length,

  auditPackets:
    isc.length,

  snapshotDate:
    process.env.PIPELINE_SNAPSHOT_DATE ||
    "2026-08-11",

  methodologyVersion:
    process.env.PIPELINE_METHODOLOGY_VERSION ||
    "RTPMI-4.2-ISC",

  disclaimer:
    "RTPMI evaluates public Research & Technology portal maturity, not university research performance. Missing evidence is not scored as zero.",
};

await fs.writeFile(
  "data/statistics/summary.json",

  JSON.stringify(
    summary,
    null,
    2
  ) + "\n"
);

console.log(
  summary
);

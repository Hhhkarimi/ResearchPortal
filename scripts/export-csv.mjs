import fs from "node:fs/promises";

const read = async (
  path
) =>
  JSON.parse(
    await fs.readFile(
      path,
      "utf8"
    )
  );

const esc = (
  value
) => {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  const text =
    Array.isArray(value)
      ? value.join(
          " | "
        )
      : typeof value ===
          "object"
        ? JSON.stringify(
            value
          )
        : String(value);

  return /[",\n]/.test(
    text
  )
    ? `"${text.replaceAll(
        '"',
        '""'
      )}"`
    : text;
};

const csv = (
  rows,
  columns
) =>
  [
    columns.join(","),

    ...rows.map(
      (row) =>
        columns
          .map(
            (column) =>
              esc(
                row[column]
              )
          )
          .join(",")
    ),
  ].join("\n") +
  "\n";

const [
  isc,
  audit,
  deep,
  ranking,
  units,
  systems,
  docs,
  packets,
  dimensionEvidence,
] = await Promise.all([
  read("data/isc/institutions.json"),
  read("data/audit/portal-audit.json"),
  read("data/audit/deep-audit-matrix.json"),
  read("data/statistics/portal-ranking.json"),
  read("data/units/catalog.json"),
  read("data/systems/catalog.json"),
  read("data/documents/catalog.json"),
  read("data/audit/packets-index.json"),
  read("data/evidence/dimension-evidence.json"),
]);

const flatDeep =
  deep.map(
    (item) => ({
      ...item,

      ...Object.fromEntries(
        Object.entries(
          item.dimensions ||
          {}
        ).map(
          (
            [key, value]
          ) => [
            `dimension_${key}`,
            value,
          ]
        )
      ),
    })
  );

const flatRank =
  ranking.map(
    (item) => ({
      ...item,

      ...Object.fromEntries(
        Object.entries(
          item.metrics ||
          {}
        ).map(
          (
            [key, value]
          ) => [
            `metric_${key}`,
            value,
          ]
        )
      ),
    })
  );

const defs = [
  [
    "data/isc/institutions.csv",

    isc,

    [
      "slug",
      "nameFa",
      "category",
      "iscRank",
    ],
  ],

  [
    "data/audit/portal-audit.csv",

    audit,

    [
      "universitySlug",
      "nameFa",
      "iscCategory",
      "iscRank",
      "auditDate",
      "portalAuditStatus",
      "researchUrl",
      "evidenceUrls",
      "note",
      "scoreEligibility",
    ],
  ],

  [
    "data/audit/deep-audit-matrix.csv",

    flatDeep,

    [
      "universitySlug",
      "nameFa",
      "iscCategory",
      "iscRank",
      "portalAuditStatus",
      "deepAuditStatus",
      "auditEvidenceCoverage",
      "unitsFound",
      "systemsFound",
      "documentsFound",
      "rankingEligibility",

      "dimension_portalIdentity",
      "dimension_organization",
      "dimension_libraryDocuments",
      "dimension_laboratories",
      "dimension_industryTechnology",
      "dimension_systemsServices",
      "dimension_documentsRegulations",
    ],
  ],

  [
    "data/statistics/portal-ranking.csv",

    flatRank,

    [
      "rank",
      "universitySlug",
      "nameFa",
      "iscCategory",
      "iscRank",
      "score",
      "confidence",
      "evidenceCoverage",
      "activeWeight",
      "portalRankWithinISCClass",
      "rankedPortalsInISCClass",

      "metric_documents",
      "metric_organization",
      "metric_library",
      "metric_laboratories",
      "metric_systems",
      "metric_industryTech",
      "metric_dataQuality",
      "metric_findability",
    ],
  ],

  [
    "data/units/catalog.csv",

    units,

    [
      "id",
      "universitySlug",
      "nameFa",
      "type",
      "parentUnitId",
      "relationStatus",
      "url",
      "sourceUrl",
      "evidence",
      "lastVerified",
    ],
  ],

  [
    "data/systems/catalog.csv",

    systems,

    [
      "id",
      "universitySlug",
      "nameFa",
      "category",
      "url",
      "relation",
      "sourceUrl",
      "evidence",
      "lastVerified",
    ],
  ],

  [
    "data/documents/catalog.csv",

    docs,

    [
      "id",
      "universitySlug",
      "title",
      "type",
      "topic",
      "url",
      "parentUrl",
      "format",
      "status",
      "evidence",
      "publishedDate",
      "lastVerified",
      "publisherUnit",
      "approvalAuthority",
    ],
  ],

  [
    "data/audit/packets-index.csv",

    packets,

    [
      "slug",
      "nameFa",
      "iscCategory",
      "iscRank",
      "portalAuditStatus",
      "deepAuditStatus",
      "auditEvidenceCoverage",
      "rank",
      "score",
      "confidence",
      "url",
    ],
  ],

  [
    "data/evidence/dimension-evidence.csv",

    dimensionEvidence.map(
      (item) => ({
        ...item,

        sourceUrls:
          item.sources.map(
            (source) =>
              source.url
          ),

        sourceKinds:
          item.sources.map(
            (source) =>
              source.kind
          ),
      })
    ),

    [
      "id",
      "universitySlug",
      "nameFa",
      "iscCategory",
      "iscRank",
      "dimension",
      "status",
      "reportedStatus",
      "publicationAdjustment",
      "reviewOutcome",
      "reviewedAt",
      "sourceCount",
      "sourceKinds",
      "sourceUrls",
      "verificationBasis",
      "missingDataRule",
    ],
  ],
];

await fs.mkdir(
  "public/datasets",
  {
    recursive: true,
  }
);

for (
  const [
    file,
    rows,
    columns,
  ] of defs
) {
  const content =
    csv(
      rows,
      columns
    );

  await fs.writeFile(
    file,
    content
  );

  await fs.writeFile(
    `public/datasets/${
      file
        .split("/")
        .slice(1)
        .join("-")
    }`,

    content
  );
}

console.log(
  `CSV exports built: ${defs.length}`
);

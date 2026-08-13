import fs from "node:fs/promises";

const read = async (file) =>
  JSON.parse(
    await fs.readFile(
      file,
      "utf8"
    )
  );

const write = async (
  file,
  value
) =>
  fs.writeFile(
    file,
    JSON.stringify(
      value,
      null,
      2
    ) + "\n"
  );

const [
  isc,
  audit,
  matrix,
  units,
  systems,
  documents,
] = await Promise.all([
  read(
    "data/isc/institutions.json"
  ),

  read(
    "data/audit/portal-audit.json"
  ),

  read(
    "data/audit/deep-audit-matrix.json"
  ),

  read(
    "data/units/catalog.json"
  ),

  read(
    "data/systems/catalog.json"
  ),

  read(
    "data/documents/catalog.json"
  ),
]);

const DATE =
  "2026-08-11";

const METHODOLOGY_VERSION =
  "RTPMI-4.2-ISC";

const weights = {
  documents:
    0.20,

  organization:
    0.12,

  library:
    0.10,

  laboratories:
    0.12,

  systems:
    0.12,

  industryTech:
    0.12,

  dataQuality:
    0.12,

  findability:
    0.10,
};

const clamp = (
  value
) =>
  Math.max(
    0,
    Math.min(
      100,
      Math.round(
        value * 10
      ) / 10
    )
  );

const ratio = (
  numerator,
  denominator
) =>
  denominator
    ? Math.min(
        1,
        numerator /
          denominator
      )
    : 0;

const byUniversity = (
  items,
  slug
) =>
  items.filter(
    (item) =>
      item.universitySlug ===
      slug
  );

const isVerified = (
  item
) =>
  [
    "verified",
    "verified-basic",
    "direct",
    "official",
  ].includes(
    item?.evidence
  );

function scorePortal(
  institution,
  deepAudit,
  portalAudit
) {
  const universityUnits =
    byUniversity(
      units,
      institution.slug
    ).filter(
      isVerified
    );

  const universitySystems =
    byUniversity(
      systems,
      institution.slug
    ).filter(
      isVerified
    );

  const universityDocuments =
    byUniversity(
      documents,
      institution.slug
    ).filter(
      isVerified
    );

  const unitTypes =
    new Set(
      universityUnits.map(
        (item) =>
          item.type
      )
    );

  const systemCategories =
    new Set(
      universitySystems.map(
        (item) =>
          item.category
      )
    );

  const verifiedDimension = (
    key
  ) =>
    deepAudit
      .dimensions[
        key
      ] ===
    "verified";

  const metrics = {};

  /*
   * Documents.
   */
  if (
    verifiedDimension(
      "documentsRegulations"
    )
  ) {
    const kinds =
      new Set(
        universityDocuments
          .map(
            (item) =>
              item.type
          )
          .filter(Boolean)
      );

    const direct =
      universityDocuments.filter(
        (item) =>
          item.url
      ).length;

    metrics.documents =
      clamp(
        45 *
          ratio(
            kinds.size,
            5
          ) +
        30 *
          ratio(
            universityDocuments.length,
            8
          ) +
        25 *
          ratio(
            direct,
            universityDocuments.length
          )
      );
  } else {
    metrics.documents =
      null;
  }

  /*
   * Organization.
   */
  if (
    verifiedDimension(
      "organization"
    )
  ) {
    const core = [
      "research",
      "industry",
      "technology",
      "library",
      "laboratory",
      "publishing",
      "research-centers",
      "ethics",
    ];

    const breadth =
      core.filter(
        (type) =>
          unitTypes.has(
            type
          )
      ).length;

    metrics.organization =
      clamp(
        45 +
        55 *
          ratio(
            breadth,
            6
          )
      );
  } else {
    metrics.organization =
      null;
  }

  metrics.library =
    verifiedDimension(
      "libraryDocuments"
    )
      ? clamp(
          (
            unitTypes.has(
              "library"
            )
              ? 70
              : 0
          ) +
          (
            systemCategories.has(
              "library"
            )
              ? 30
              : 0
          )
        )
      : null;

  metrics.laboratories =
    verifiedDimension(
      "laboratories"
    )
      ? clamp(
          (
            unitTypes.has(
              "laboratory"
            )
              ? 70
              : 0
          ) +
          (
            systemCategories.has(
              "laboratory"
            )
              ? 30
              : 0
          )
        )
      : null;

  /*
   * Research systems/services.
   *
   * Only research-facing categories participate.
   */
  if (
    verifiedDimension(
      "systemsServices"
    )
  ) {
    const relevant = [
      "research",
      "journals",
      "library",
      "laboratory",
      "innovation",
      "industry",
      "publishing",
    ];

    const diversity =
      relevant.filter(
        (category) =>
          systemCategories.has(
            category
          )
      ).length;

    const directRelations =
      universitySystems.filter(
        (item) =>
          [
            "managed-by-portal",
            "unit-service",
          ].includes(
            item.relation
          )
      ).length;

    metrics.systems =
      clamp(
        50 *
          ratio(
            diversity,
            4
          ) +
        30 *
          ratio(
            universitySystems.length,
            6
          ) +
        20 *
          ratio(
            directRelations,
            universitySystems.length
          )
      );
  } else {
    metrics.systems =
      null;
  }

  /*
   * Industry / technology transfer.
   */
  if (
    verifiedDimension(
      "industryTechnology"
    )
  ) {
    const unitScore =
      (
        unitTypes.has(
          "industry"
        )
          ? 45
          : 0
      ) +
      (
        unitTypes.has(
          "technology"
        )
          ? 45
          : 0
      );

    const systemScore =
      systemCategories.has(
        "industry"
      ) ||
      systemCategories.has(
        "innovation"
      )
        ? 10
        : 0;

    metrics.industryTech =
      clamp(
        unitScore +
        systemScore
      );
  } else {
    metrics.industryTech =
      null;
  }

  /*
   * Provenance / data quality.
   */
  const records = [
    ...universityUnits,
    ...universitySystems,
    ...universityDocuments,
  ];

  const withSource =
    records.filter(
      (item) =>
        item.sourceUrl ||
        item.parentUrl ||
        item.url
    ).length;

  const withDate =
    records.filter(
      (item) =>
        item.lastVerified
    ).length;

  metrics.dataQuality =
    clamp(
      30 +
      (
        portalAudit
          .researchUrl
          ? 20
          : 0
      ) +
      25 *
        ratio(
          withSource,
          records.length
        ) +
      25 *
        ratio(
          withDate,
          records.length
        )
    );

  /*
   * Findability.
   */
  let findabilitySum =
    portalAudit
      .researchUrl
      ? 35
      : 0;

  let findabilityWeight =
    35;

  if (
    universityUnits.length
  ) {
    findabilitySum +=
      25 *
      ratio(
        universityUnits.filter(
          (item) =>
            item.url
        ).length,

        universityUnits.length
      );

    findabilityWeight +=
      25;
  }

  if (
    universitySystems.length
  ) {
    findabilitySum +=
      20 *
      ratio(
        universitySystems.filter(
          (item) =>
            item.url
        ).length,

        universitySystems.length
      );

    findabilityWeight +=
      20;
  }

  if (
    verifiedDimension(
      "documentsRegulations"
    ) &&
    universityDocuments.length
  ) {
    findabilitySum +=
      20 *
      ratio(
        universityDocuments.filter(
          (item) =>
            item.url
        ).length,

        universityDocuments.length
      );

    findabilityWeight +=
      20;
  }

  metrics.findability =
    clamp(
      (
        100 *
        findabilitySum
      ) /
        findabilityWeight
    );

  const active =
    Object.entries(
      weights
    ).filter(
      ([key]) =>
        metrics[key] !==
          null &&
        Number.isFinite(
          metrics[key]
        )
    );

  const totalWeight =
    active.reduce(
      (
        sum,
        [, weight]
      ) =>
        sum +
        weight,

      0
    );

  const score =
    clamp(
      active.reduce(
        (
          sum,
          [key, weight]
        ) =>
          sum +
          metrics[key] *
            weight,

        0
      ) /
        totalWeight
    );

  const provenance =
    records.length
      ? 100 *
        (
          0.5 *
            ratio(
              withSource,
              records.length
            ) +
          0.5 *
            ratio(
              withDate,
              records.length
            )
        )
      : 50;

  const confidence =
    clamp(
      0.72 *
        deepAudit
          .auditEvidenceCoverage +
      0.28 *
        provenance
    );

  return {
    score,
    confidence,
    metrics,

    units:
      universityUnits.length,

    systems:
      universitySystems.length,

    documents:
      universityDocuments.length,

    activeWeight:
      Math.round(
        totalWeight * 100
      ),

    evidenceCoverage:
      deepAudit
        .auditEvidenceCoverage,
  };
}

const auditBySlug =
  new Map(
    audit.map(
      (item) => [
        item.universitySlug,
        item,
      ]
    )
  );

const matrixBySlug =
  new Map(
    matrix.map(
      (item) => [
        item.universitySlug,
        item,
      ]
    )
  );

const candidates = [];

for (
  const institution
  of isc
) {
  const portalAudit =
    auditBySlug.get(
      institution.slug
    );

  const deepAudit =
    matrixBySlug.get(
      institution.slug
    );

  if (
    !portalAudit ||
    !deepAudit
  ) {
    continue;
  }

  if (
    portalAudit
      .portalAuditStatus !==
    "direct-official"
  ) {
    continue;
  }

  if (
    deepAudit
      .auditEvidenceCoverage <
    75
  ) {
    continue;
  }

  const scored =
    scorePortal(
      institution,
      deepAudit,
      portalAudit
    );

  if (
    scored.confidence <
    65
  ) {
    continue;
  }

  candidates.push({
    universitySlug:
      institution.slug,

    nameFa:
      institution.nameFa,

    iscCategory:
      institution.category,

    iscRank:
      institution.iscRank,

    ...scored,

    methodologyVersion:
      METHODOLOGY_VERSION,

    snapshotDate:
      DATE,
  });
}

candidates.sort(
  (a, b) =>
    b.score -
      a.score ||
    b.confidence -
      a.confidence ||
    a.iscRank -
      b.iscRank
);

candidates.forEach(
  (
    row,
    index
  ) => {
    row.rank =
      index + 1;
  }
);

for (
  const category of [
    ...new Set(
      candidates.map(
        (item) =>
          item.iscCategory
      )
    ),
  ]
) {
  const rows =
    candidates.filter(
      (item) =>
        item.iscCategory ===
        category
    );

  rows.forEach(
    (
      row,
      index
    ) => {
      row.portalRankWithinISCClass =
        index + 1;

      row.rankedPortalsInISCClass =
        rows.length;
    }
  );
}

await write(
  "data/statistics/portal-ranking.json",
  candidates
);

await write(
  "data/statistics/rtpmi-weights.json",
  {
    methodologyVersion:
      METHODOLOGY_VERSION,

    weights,

    publicEvidenceDimensions:
      7,

    missingDataRule:
      "unresolved dimensions are excluded from the weighted denominator; they reduce confidence/audit coverage rather than becoming zero",

    rankingGate: {
      portalAuditStatus:
        "direct-official",

      minimumAuditEvidenceCoverage:
        75,

      minimumConfidence:
        65,
    },
  }
);

console.log(
  `RTPMI final: ranked ${candidates.length}/115; methodology=${METHODOLOGY_VERSION}; top=${
    candidates[0]
      ?.nameFa ??
    "none"
  } ${
    candidates[0]
      ?.score ??
    ""
  }`
);

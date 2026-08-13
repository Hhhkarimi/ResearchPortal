import fs from "node:fs/promises";

const read = async (file) =>
  JSON.parse(
    await fs.readFile(
      file,
      "utf8"
    )
  );

const [
  institutions,
  audits,
  units,
  systems,
  documents,
  ledger,
  reviews,
  reaudit,
] = await Promise.all([
  read(
    "data/isc/institutions.json"
  ),

  read(
    "data/audit/portal-audit.json"
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

  read(
    "data/evidence/provenance-ledger.json"
  ),

  read(
    "data/evidence/research-review.json"
  ),

  read(
    "data/evidence/portal-document-reaudit.json"
  ).catch(
    () => []
  ),
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

const UNIT_TYPES = {
  organization:
    new Set([
      "research",
      "research-centers",
      "ethics",
      "publishing",
      "library",
      "laboratory",
      "technology",
      "industry",
    ]),

  libraryDocuments:
    new Set([
      "library",
      "publishing",
    ]),

  laboratories:
    new Set([
      "laboratory",
    ]),

  industryTechnology:
    new Set([
      "technology",
      "industry",
    ]),
};

const SYSTEM_TYPES = {
  libraryDocuments:
    new Set([
      "library",
      "publishing",
      "journals",
    ]),

  laboratories:
    new Set([
      "laboratory",
    ]),

  industryTechnology:
    new Set([
      "industry",
      "innovation",
    ]),

  systemsServices:
    new Set(
      systems.map(
        (item) =>
          item.category
      )
    ),
};

const LABEL_PATTERNS = {
  portalIdentity:
    /پرتال|معاونت|معرفی|صفحه رسمی|منبع رسمی|research|vice/i,

  organization:
    /ساختار|چارت|واحد|مدیریت|organizational|structure|unit/i,

  libraryDocuments:
    /کتابخانه|مرکز اسناد|نشر|مجلات|library|publication|journal/i,

  laboratories:
    /آزمایش|lab/i,

  industryTechnology:
    /صنعت|فناور|نوآور|مالکیت فکری|پارک|industry|innovation|technology|tto|ip/i,

  systemsServices:
    /سامانه|خدمت|نشریات|system|service/i,

  documentsRegulations:
    /فرم|آیین|دستور|شیوه|مقررات|راهنما|form|regulation|document|guideline/i,
};

const STATUS_OUTCOME = {
  verified:
    "evidence-confirmed",

  "observed-reference":
    "reference-only",

  restricted:
    "access-restricted",

  unresolved:
    "no-public-evidence-resolved",
};

const REAUDIT_KEYS = {
  portalIdentity:
    "portalUrls",

  organization:
    "organizationUrls",

  libraryDocuments:
    "libraryUrls",

  laboratories:
    "laboratoryUrls",

  industryTechnology:
    "industryTechnologyUrls",

  systemsServices:
    "systemsUrls",

  documentsRegulations:
    "documentIndexUrls",
};

const TRACKING_PARAMS =
  new Set([
    "fbclid",
    "gclid",
    "yclid",
    "mc_cid",
    "mc_eid",
  ]);

const byUniversity = (
  items,
  slug
) =>
  items.filter(
    (item) =>
      item.universitySlug ===
      slug
  );

const reauditBySlug =
  new Map(
    reaudit.map(
      (item) => [
        item.slug,
        item,
      ]
    )
  );

const urlOf = (
  item
) =>
  item?.sourceUrl ||
  item?.parentUrl ||
  item?.url ||
  null;

function validUrl(
  value
) {
  try {
    return [
      "http:",
      "https:",
    ].includes(
      new URL(
        value
      ).protocol
    );
  } catch {
    return false;
  }
}

function canonicalUrl(
  value
) {
  if (
    !validUrl(value)
  ) {
    return null;
  }

  const url =
    new URL(value);

  url.hash = "";

  url.hostname =
    url.hostname
      .toLowerCase()
      .replace(
        /^www\./,
        ""
      );

  const parts =
    url.pathname
      .split("/")
      .filter(Boolean);

  for (
    let index = 1;
    index < parts.length;
    index++
  ) {
    if (
      /^(page|news|node|article)$/i.test(
        parts[index - 1]
      ) &&
      /^\d+$/.test(
        parts[index]
      )
    ) {
      url.pathname =
        `/${parts
          .slice(
            0,
            index + 1
          )
          .join("/")}`;

      break;
    }
  }

  if (
    url.pathname.length > 1
  ) {
    url.pathname =
      url.pathname.replace(
        /\/+$/,
        ""
      );
  }

  if (
    /^\/(fa|en|ar|fa-ir|en-us)$/i.test(
      url.pathname
    )
  ) {
    url.pathname = "/";
  }

  const params = [
    ...url.searchParams.entries(),
  ]
    .filter(
      ([key]) =>
        !key
          .toLowerCase()
          .startsWith(
            "utm_"
          ) &&
        !TRACKING_PARAMS.has(
          key.toLowerCase()
        )
    )
    .sort(
      (
        [aKey, aValue],
        [bKey, bValue]
      ) =>
        aKey.localeCompare(
          bKey
        ) ||
        aValue.localeCompare(
          bValue
        )
    );

  url.search = "";

  for (
    const [key, value]
    of params
  ) {
    url.searchParams.append(
      key,
      value
    );
  }

  return url.toString();
}

function uniqueSources(
  sources
) {
  const byUrl =
    new Map();

  for (
    const source
    of sources
  ) {
    const key =
      canonicalUrl(
        source.url
      );

    if (!key) {
      continue;
    }

    const current =
      byUrl.get(key);

    if (
      !current ||
      String(
        source.claim ||
        ""
      ).length >
        String(
          current.claim ||
          ""
        ).length
    ) {
      byUrl.set(
        key,
        source
      );
    }
  }

  return [
    ...byUrl.values(),
  ];
}

const records = [];

for (
  const institution
  of institutions
) {
  const slug =
    institution.slug;

  const audit =
    audits.find(
      (item) =>
        item.universitySlug ===
        slug
    );

  const review =
    reviews.find(
      (item) =>
        item.universitySlug ===
        slug
    );

  const universityUnits =
    byUniversity(
      units,
      slug
    );

  const universitySystems =
    byUniversity(
      systems,
      slug
    );

  const universityDocuments =
    byUniversity(
      documents,
      slug
    );

  const universityLedger =
    byUniversity(
      ledger,
      slug
    );

  const reauditRow =
    reauditBySlug.get(
      slug
    );

  for (
    const dimension
    of DIMENSIONS
  ) {
    const sources = [];

    const add = (
      url,
      kind,
      claim,
      id = null,
      extra = {}
    ) => {
      if (
        validUrl(url)
      ) {
        sources.push({
          url,
          kind,
          claim,
          id,
          ...extra,
        });
      }
    };

    if (
      dimension ===
      "portalIdentity"
    ) {
      if (
        audit.researchUrl
      ) {
        add(
          audit.researchUrl,
          "portal-identity",
          "official research/technology portal identity"
        );
      }

      for (
        const url of
          audit.evidenceUrls ||
          []
      ) {
        add(
          url,
          "portal-identity",
          "official portal identity evidence"
        );
      }
    }

    for (
      const url of
        reauditRow?.[
          REAUDIT_KEYS[
            dimension
          ]
        ] ||
        []
    ) {
      add(
        url,
        "portal-document-reaudit",
        `dimension-specific ${dimension} source`
      );
    }

    if (
      dimension ===
      "documentsRegulations"
    ) {
      for (
        const item of
          reauditRow
            ?.directDocuments ||
          []
      ) {
        add(
          item.url,
          "portal-document-reaudit-document",
          item.title
        );
      }
    }

    if (
      dimension ===
        "organization" ||
      UNIT_TYPES[
        dimension
      ]
    ) {
      for (
        const item of
          universityUnits
      ) {
        if (
          dimension ===
            "organization" ||
          UNIT_TYPES[
            dimension
          ].has(
            item.type
          )
        ) {
          add(
            urlOf(item),
            "unit",
            item.nameFa,
            item.id,
            {
              unitType:
                item.type,
            }
          );
        }
      }
    }

    if (
      SYSTEM_TYPES[
        dimension
      ]
    ) {
      for (
        const item of
          universitySystems
      ) {
        if (
          SYSTEM_TYPES[
            dimension
          ].has(
            item.category
          )
        ) {
          add(
            urlOf(item),
            "system",
            item.nameFa,
            item.id,
            {
              systemCategory:
                item.category,
            }
          );
        }
      }
    }

    if (
      dimension ===
      "documentsRegulations"
    ) {
      for (
        const item of
          universityDocuments
      ) {
        add(
          urlOf(item),
          "document",
          item.title,
          item.id
        );
      }
    }

    if (
      dimension ===
      "libraryDocuments"
    ) {
      for (
        const item of
          universityDocuments
      ) {
        if (
          /کتابخانه|مرکز اسناد|نشر|مجله|نشریه|library|publication|journal/i.test(
            item.title
          )
        ) {
          add(
            urlOf(item),
            "document",
            item.title,
            item.id
          );
        }
      }
    }

    if (
      dimension ===
      "systemsServices"
    ) {
      for (
        const item of
          universitySystems
      ) {
        add(
          urlOf(item),
          "system",
          item.nameFa,
          item.id,
          {
            systemCategory:
              item.category,
          }
        );
      }
    }

    for (
      const item of
        universityLedger
    ) {
      const matches =
        (
          dimension ===
            "portalIdentity" &&
          item.entityType ===
            "portal-audit"
        ) ||
        (
          dimension ===
            "systemsServices" &&
          item.entityType ===
            "system"
        ) ||
        (
          dimension ===
            "documentsRegulations" &&
          item.entityType ===
            "document"
        );

      if (matches) {
        add(
          item.sourceUrl,
          "provenance",
          item.claim,
          item.id
        );
      }
    }

    for (
      const source of
        review
          .officialSources ||
        []
    ) {
      if (
        LABEL_PATTERNS[
          dimension
        ].test(
          `${source.label} ${source.url}`
        )
      ) {
        add(
          source.url,
          "research-review-specific",
          source.label,
          null,
          {
            sourceLabel:
              source.label,
          }
        );
      }
    }

    let finalSources =
      uniqueSources(
        sources
      );

    const reportedStatus =
      review
        .reportedDimensions
        ?.[
          dimension
        ] ||
      review
        .dimensions
        ?.[
          dimension
        ] ||
      "unresolved";

    if (
      reportedStatus ===
      "restricted"
    ) {
      for (
        const url of
          audit.evidenceUrls ||
          []
      ) {
        add(
          url,
          "restriction-reference",
          "Official or institutional URL recorded during the restricted access attempt",
          null,
          {
            sourceSpecificity:
              "institution-access",
          }
        );
      }

      finalSources =
        uniqueSources(
          sources
        );
    }

    let status =
      reportedStatus;

    let publicationAdjustment =
      null;

    if (
      status ===
        "verified" &&
      !finalSources.length
    ) {
      status =
        review
          .officialSourceUrls
          ?.length
          ? "observed-reference"
          : "unresolved";

      publicationAdjustment =
        "Downgraded because no dimension-specific public URL was registered.";

      if (
        status ===
        "observed-reference"
      ) {
        for (
          const source of
            review
              .officialSources ||
            []
        ) {
          add(
            source.url,
            "research-review-reference",
            source.label,
            null,
            {
              sourceLabel:
                source.label,

              sourceSpecificity:
                "university-reference",
            }
          );
        }

        finalSources =
          uniqueSources(
            sources
          );
      }
    }

    if (
      status ===
        "restricted" &&
      !finalSources.length
    ) {
      status =
        "unresolved";

      publicationAdjustment =
        "Downgraded because no official attempted URL was registered for the restricted-access claim.";
    }

    records.push({
      id:
        `${slug}:${dimension}`,

      universitySlug:
        slug,

      nameFa:
        institution.nameFa,

      iscCategory:
        institution.category,

      iscRank:
        institution.iscRank,

      dimension,

      status,

      reportedStatus,

      reviewOutcome:
        STATUS_OUTCOME[
          status
        ],

      reviewedAt:
        review.reviewedAt,

      sourceCount:
        finalSources.length,

      sources:
        finalSources,

      publicationAdjustment,

      verificationBasis:
        status ===
        "verified"
          ? "Dimension-specific evidence is registered on an official public surface."

          : status ===
              "observed-reference"
            ? (
                publicationAdjustment ||
                "An official public reference was observed, but direct dimension attribution was not established."
              )

            : status ===
                "restricted"
              ? "An attempted official or institutional URL is registered, but public verification was restricted or blocked."

              : "No sufficient public evidence was resolved in this snapshot; this is not proof of absence.",

      missingDataRule:
        "Unresolved is not absence and is never automatically scored as zero.",
    });
  }
}

const EXPECTED_OUTCOMES =
  institutions.length *
  DIMENSIONS.length;

if (
  records.length !==
  EXPECTED_OUTCOMES
) {
  throw new Error(
    `Expected ${EXPECTED_OUTCOMES} dimension outcomes, got ${records.length}`
  );
}

const publicationReviews =
  reviews.map(
    (review) => {
      const universityRecords =
        records.filter(
          (record) =>
            record.universitySlug ===
            review.universitySlug
        );

      const publishedDimensions =
        Object.fromEntries(
          universityRecords.map(
            (record) => [
              record.dimension,
              record.status,
            ]
          )
        );

      const verified =
        universityRecords.filter(
          (record) =>
            record.status ===
            "verified"
        ).length;

      const observed =
        universityRecords.filter(
          (record) =>
            record.status ===
            "observed-reference"
        ).length;

      return {
        ...review,

        dimensions:
          publishedDimensions,

        reportedDimensions:
          Object.fromEntries(
            universityRecords.map(
              (record) => [
                record.dimension,
                record.reportedStatus,
              ]
            )
          ),

        reportedEvidenceCoverage:
          review
            .reviewEvidenceCoverage,

        reviewEvidenceCoverage:
          Math.round(
            (
              100 *
              (
                verified +
                0.5 *
                  observed
              )
            ) /
              DIMENSIONS.length
          ),

        publicationAdjustedOutcomes:
          universityRecords.filter(
            (record) =>
              record
                .publicationAdjustment
          ).length,
      };
    }
  );

await fs.writeFile(
  "data/evidence/dimension-evidence.json",

  JSON.stringify(
    records,
    null,
    2
  ) + "\n"
);

await fs.writeFile(
  "data/evidence/research-review.json",

  JSON.stringify(
    publicationReviews,
    null,
    2
  ) + "\n"
);

console.log(
  `dimension evidence register: ${records.length} outcomes / ${institutions.length} institutions / ${DIMENSIONS.length} dimensions / ${
    records.filter(
      (record) =>
        record
          .publicationAdjustment
    ).length
  } publication downgrades`
);

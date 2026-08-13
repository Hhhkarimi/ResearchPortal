import fs from "node:fs/promises";

const readJson = async (file) =>
  JSON.parse(await fs.readFile(file, "utf8"));

const writeJson = async (file, value) =>
  fs.writeFile(
    file,
    JSON.stringify(value, null, 2) + "\n"
  );

const FILES = {
  audits: "data/audit/portal-audit.json",
  reviews: "data/evidence/research-review.json",
  reaudit: "data/evidence/portal-document-reaudit.json",
  units: "data/units/catalog.json",
  systems: "data/systems/catalog.json",
  documents: "data/documents/catalog.json",
  discoveryEvidence:
    "data/generated/discovery-evidence.json",
  discoveryDocuments:
    "data/generated/discovered-documents.json",
  discoverySummary:
    "data/generated/discovery-summary.json",
};

const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "yclid",
  "mc_cid",
  "mc_eid",
]);

const GENERIC_TITLES = new Set([
  "",
  "سند",
  "سند پژوهشی",
  "دانلود",
  "دانلود فایل",
  "مشاهده",
  "مشاهده فایل",
  "فایل",
  "لینک",
  "صفحه",
]);

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\u200c/g, " ")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeURIComponentSafe(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function urlObject(value) {
  try {
    const url = new URL(
      String(value ?? "")
    );

    return [
      "http:",
      "https:",
    ].includes(url.protocol)
      ? url
      : null;
  } catch {
    return null;
  }
}

function canonicalUrl(value) {
  const url =
    urlObject(value);

  if (!url) {
    return null;
  }

  url.hash = "";

  url.hostname =
    url.hostname
      .toLowerCase()
      .replace(/^www\./, "");

  /*
   * CMS pages such as:
   *
   * /fa/page/70/title
   * /fa/page/70
   *
   * refer to the same underlying page.
   */
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
          .slice(0, index + 1)
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

  /*
   * Portal root language variants:
   *
   * /
   * /fa
   * /en
   *
   * are treated as one root.
   */
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
          .startsWith("utm_") &&
        !TRACKING_PARAMS.has(
          key.toLowerCase()
        )
    )
    .sort(
      (
        [aKey, aValue],
        [bKey, bValue]
      ) =>
        aKey.localeCompare(bKey) ||
        aValue.localeCompare(bValue)
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

function isInformationTechnologyText(
  value
) {
  const text =
    normalizeText(value);

  if (!text) {
    return false;
  }

  return (
    /فناوری\s*اطلاعات/.test(text) ||
    /فن\s*آوری\s*اطلاعات/.test(text) ||
    /اطلاعات\s*و\s*ارتباطات/.test(text) ||
    /مرکز\s*فاوا/.test(text) ||
    /مدیریت\s*فاوا/.test(text) ||
    /\bفاوا\b/.test(text) ||
    /\binformation\s+technology\b/i.test(
      text
    ) ||
    /\binformation\s+(and\s+)?communications?\s+technology\b/i.test(
      text
    ) ||
    /\bict\b/i.test(text) ||
    /\bit\s+(center|department|office|unit|services?)\b/i.test(
      text
    ) ||
    /\b(center|department|office|unit)\s+of\s+it\b/i.test(
      text
    )
  );
}

function isInformationTechnologyUrl(
  value
) {
  const url =
    urlObject(value);

  if (!url) {
    return false;
  }

  const hostParts =
    url.hostname
      .toLowerCase()
      .replace(/^www\./, "")
      .split(".");

  if (
    hostParts.some(
      (part) =>
        [
          "it",
          "ict",
          "cit",
          "fava",
          "faava",
        ].includes(part)
    )
  ) {
    return true;
  }

  const pathParts =
    url.pathname
      .toLowerCase()
      .split("/")
      .filter(Boolean)
      .map(
        (part) =>
          decodeURIComponentSafe(
            part
          ).replace(
            /[_-]+/g,
            " "
          )
      );

  return (
    pathParts.some(
      (part) =>
        [
          "it",
          "ict",
          "cit",
          "fava",
          "faava",
          "information technology",
          "information and communication technology",
          "information communication technology",
        ].includes(part)
    ) ||
    isInformationTechnologyText(
      decodeURIComponentSafe(
        url.toString()
      )
    )
  );
}

function stripInformationTechnologySentences(
  value
) {
  const text =
    String(
      value ?? ""
    ).trim();

  if (
    !text ||
    !isInformationTechnologyText(
      text
    )
  ) {
    return text;
  }

  return text
    .split(
      /(?<=[.!؟؛])\s+|\s*[؛]\s*/u
    )
    .map(
      (part) =>
        part.trim()
    )
    .filter(Boolean)
    .filter(
      (part) =>
        !isInformationTechnologyText(
          part
        )
    )
    .join(" ")
    .trim();
}

function recordUrls(
  record
) {
  return [
    record?.url,
    record?.sourceUrl,
    record?.parentUrl,
    record?.relationshipEvidenceUrl,
  ].filter(Boolean);
}

function isInformationTechnologyRecord(
  record
) {
  if (
    !record ||
    typeof record !== "object"
  ) {
    return false;
  }

  if (
    record.dimension ===
    "informationTechnology"
  ) {
    return true;
  }

  if (
    normalizeText(
      record.type
    ) === "it"
  ) {
    return true;
  }

  if (
    normalizeText(
      record.category
    ) === "it"
  ) {
    return true;
  }

  const text = [
    record.nameFa,
    record.title,
    record.topic,
    record.label,
    record.claim,
    record.description,
    record.note,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    isInformationTechnologyText(
      text
    ) ||
    recordUrls(record).some(
      isInformationTechnologyUrl
    )
  );
}

function uniqueUrls(
  values
) {
  const map =
    new Map();

  for (
    const value
    of values || []
  ) {
    if (
      !urlObject(value) ||
      isInformationTechnologyUrl(
        value
      )
    ) {
      continue;
    }

    const key =
      canonicalUrl(value);

    if (
      key &&
      !map.has(key)
    ) {
      map.set(
        key,
        value
      );
    }
  }

  return [
    ...map.values(),
  ];
}

function titleOf(
  record
) {
  return String(
    record?.nameFa ||
    record?.title ||
    ""
  ).trim();
}

function quality(
  record
) {
  const title =
    titleOf(record);

  const generic =
    GENERIC_TITLES.has(
      normalizeText(title)
    );

  let score =
    generic
      ? 0
      : Math.min(
          10,
          title.length / 20
        );

  if (
    [
      "verified",
      "verified-basic",
      "direct",
      "official",
    ].includes(
      record?.evidence
    )
  ) {
    score += 8;
  }

  if (
    record?.sourceUrl
  ) {
    score += 4;
  }

  if (
    record?.url
  ) {
    score += 3;
  }

  if (
    record?.lastVerified
  ) {
    score += 2;
  }

  if (
    record?.topic
  ) {
    score += 1;
  }

  if (
    record?.taxonomy
  ) {
    score += 1;
  }

  return score;
}

function mergeRecords(
  existing,
  incoming
) {
  const preferred =
    quality(incoming) >
    quality(existing)
      ? incoming
      : existing;

  const secondary =
    preferred === incoming
      ? existing
      : incoming;

  const merged = {
    ...secondary,
    ...preferred,
  };

  merged.id =
    existing.id ||
    incoming.id;

  const existingTitle =
    titleOf(existing);

  const incomingTitle =
    titleOf(incoming);

  if (
    GENERIC_TITLES.has(
      normalizeText(
        existingTitle
      )
    ) &&
    !GENERIC_TITLES.has(
      normalizeText(
        incomingTitle
      )
    )
  ) {
    if (
      incoming.nameFa
    ) {
      merged.nameFa =
        incoming.nameFa;
    }

    if (
      incoming.title
    ) {
      merged.title =
        incoming.title;
    }
  }

  return merged;
}

function catalogKey(
  record
) {
  const slug =
    record.universitySlug ||
    "unknown";

  const url =
    canonicalUrl(
      record.url ||
      record.sourceUrl ||
      record.parentUrl
    );

  if (url) {
    return `${slug}|url:${url}`;
  }

  return [
    slug,
    "text",
    normalizeText(
      titleOf(record)
    ),
    normalizeText(
      record.type ||
      record.category ||
      record.topic ||
      ""
    ),
  ].join("|");
}

function dedupeCatalog(
  rows
) {
  const map =
    new Map();

  for (
    const row of rows || []
  ) {
    if (
      isInformationTechnologyRecord(
        row
      )
    ) {
      continue;
    }

    const key =
      catalogKey(row);

    if (
      !map.has(key)
    ) {
      map.set(
        key,
        row
      );
    } else {
      map.set(
        key,
        mergeRecords(
          map.get(key),
          row
        )
      );
    }
  }

  return [
    ...map.values(),
  ];
}

function cleanSource(
  source
) {
  if (
    !source ||
    !urlObject(
      source.url
    ) ||
    isInformationTechnologyRecord(
      source
    )
  ) {
    return null;
  }

  return source;
}

function dedupeSources(
  sources
) {
  const map =
    new Map();

  for (
    const source
    of sources || []
  ) {
    const cleaned =
      cleanSource(
        source
      );

    if (!cleaned) {
      continue;
    }

    const key =
      canonicalUrl(
        cleaned.url
      );

    if (!key) {
      continue;
    }

    const current =
      map.get(key);

    if (
      !current ||
      String(
        cleaned.label || ""
      ).length >
        String(
          current.label || ""
        ).length
    ) {
      map.set(
        key,
        cleaned
      );
    }
  }

  return [
    ...map.values(),
  ];
}

function omitInformationTechnologyDimension(
  object
) {
  if (
    !object ||
    typeof object !== "object" ||
    Array.isArray(object)
  ) {
    return object;
  }

  const next = {
    ...object,
  };

  delete next
    .informationTechnology;

  return next;
}

function coverageFromDimensions(
  dimensions
) {
  const values =
    Object.values(
      dimensions || {}
    );

  if (
    !values.length
  ) {
    return 0;
  }

  const verified =
    values.filter(
      (value) =>
        value === "verified"
    ).length;

  const observed =
    values.filter(
      (value) =>
        value ===
        "observed-reference"
    ).length;

  return Math.round(
    (
      100 *
      (
        verified +
        0.5 * observed
      )
    ) /
      values.length
  );
}

const [
  rawAudits,
  rawReviews,
  rawReaudit,
  rawUnits,
  rawSystems,
  rawDocuments,
  rawDiscoveryEvidence,
  rawDiscoveryDocuments,
  rawDiscoverySummary,
] = await Promise.all([
  readJson(
    FILES.audits
  ),

  readJson(
    FILES.reviews
  ),

  readJson(
    FILES.reaudit
  ),

  readJson(
    FILES.units
  ),

  readJson(
    FILES.systems
  ),

  readJson(
    FILES.documents
  ),

  readJson(
    FILES.discoveryEvidence
  ).catch(
    () => ({
      evidence: [],
      portalCandidates: [],
    })
  ),

  readJson(
    FILES.discoveryDocuments
  ).catch(
    () => ({
      documents: [],
    })
  ),

  readJson(
    FILES.discoverySummary
  ).catch(
    () => null
  ),
]);

const audits =
  rawAudits.map(
    (audit) => {
      const researchUrl =
        audit.researchUrl &&
        !isInformationTechnologyUrl(
          audit.researchUrl
        )
          ? audit.researchUrl
          : null;

      return {
        ...audit,

        researchUrl,

        portalAuditStatus:
          audit.portalAuditStatus ===
            "direct-official" &&
          !researchUrl
            ? "official-reference"
            : audit.portalAuditStatus,

        evidenceUrls:
          uniqueUrls(
            audit.evidenceUrls
          ),

        note:
          stripInformationTechnologySentences(
            audit.note
          ),

        observedSignals:
          (
            audit.observedSignals ||
            []
          ).filter(
            (signal) =>
              ![
                "it",
                "it-related",
                "informationtechnology",
                "information-technology",
              ].includes(
                normalizeText(
                  signal
                )
              )
          ),
      };
    }
  );

const reviews =
  rawReviews.map(
    (review) => {
      const dimensions =
        omitInformationTechnologyDimension(
          review.dimensions ||
          {}
        );

      const reportedDimensions =
        omitInformationTechnologyDimension(
          review.reportedDimensions ||
          review.dimensions ||
          {}
        );

      const officialSources =
        dedupeSources(
          review.officialSources ||
          []
        );

      return {
        ...review,

        dimensions,

        reportedDimensions,

        reviewEvidenceCoverage:
          coverageFromDimensions(
            dimensions
          ),

        officialSources,

        officialSourceUrls:
          officialSources.map(
            (source) =>
              source.url
          ),

        reviewNote:
          stripInformationTechnologySentences(
            review.reviewNote
          ),
      };
    }
  );

const reaudit =
  rawReaudit.map(
    (row) => {
      const next = {
        ...row,
      };

      delete next
        .informationTechnologyUrls;

      for (
        const key of [
          "portalUrls",
          "organizationUrls",
          "libraryUrls",
          "laboratoryUrls",
          "industryTechnologyUrls",
          "systemsUrls",
          "documentIndexUrls",
        ]
      ) {
        next[key] =
          uniqueUrls(
            row[key] ||
            []
          );
      }

      const directDocuments =
        new Map();

      for (
        const document
        of row.directDocuments ||
          []
      ) {
        if (
          isInformationTechnologyRecord(
            document
          )
        ) {
          continue;
        }

        const key =
          canonicalUrl(
            document.url
          );

        if (
          !key ||
          directDocuments.has(
            key
          )
        ) {
          continue;
        }

        directDocuments.set(
          key,
          document
        );
      }

      next.directDocuments = [
        ...directDocuments.values(),
      ];

      return next;
    }
  );

const units =
  dedupeCatalog(
    rawUnits
  );

const systems =
  dedupeCatalog(
    rawSystems
  );

const documents =
  dedupeCatalog(
    rawDocuments
  );

const discoveryEvidence = {
  ...rawDiscoveryEvidence,

  constraints:
    rawDiscoveryEvidence
      ?.constraints
      ? {
          ...rawDiscoveryEvidence
            .constraints,

          publicDimensions: 7,
        }
      : rawDiscoveryEvidence
          ?.constraints,

  evidence:
    (
      rawDiscoveryEvidence
        ?.evidence ||
      []
    ).filter(
      (record) =>
        !isInformationTechnologyRecord(
          record
        )
    ),

  portalCandidates:
    (
      rawDiscoveryEvidence
        ?.portalCandidates ||
      []
    ).filter(
      (record) =>
        !isInformationTechnologyRecord(
          record
        )
    ),
};

const discoveryDocuments = {
  ...rawDiscoveryDocuments,

  documents:
    (
      rawDiscoveryDocuments
        ?.documents ||
      []
    ).filter(
      (record) =>
        !isInformationTechnologyRecord(
          record
        )
    ),
};

const discoverySummary =
  rawDiscoverySummary
    ? {
        ...rawDiscoverySummary,

        publicDimensionCount:
          7,

        dimensionCounts:
          Object.fromEntries(
            Object.entries(
              rawDiscoverySummary
                .dimensionCounts ||
              {}
            ).filter(
              ([key]) =>
                key !==
                "informationTechnology"
            )
          ),
      }
    : null;

await Promise.all([
  writeJson(
    FILES.audits,
    audits
  ),

  writeJson(
    FILES.reviews,
    reviews
  ),

  writeJson(
    FILES.reaudit,
    reaudit
  ),

  writeJson(
    FILES.units,
    units
  ),

  writeJson(
    FILES.systems,
    systems
  ),

  writeJson(
    FILES.documents,
    documents
  ),

  writeJson(
    FILES.discoveryEvidence,
    discoveryEvidence
  ),

  writeJson(
    FILES.discoveryDocuments,
    discoveryDocuments
  ),

  ...(
    discoverySummary
      ? [
          writeJson(
            FILES.discoverySummary,
            discoverySummary
          ),
        ]
      : []
  ),
]);

console.log(
  [
    "public normalization complete",

    `audits=${audits.length}`,

    `reviews=${reviews.length}`,

    "dimensions=7",

    `units=${rawUnits.length}->${units.length}`,

    `systems=${rawSystems.length}->${systems.length}`,

    `documents=${rawDocuments.length}->${documents.length}`,

    "it=removed-from-public-model",

    "duplicates=canonicalized",
  ].join(
    " | "
  )
);

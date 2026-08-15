import fs from "node:fs/promises";
import path from "node:path";

import {
  canonicalEntityUrl,
  cleanDocumentTitle,
  inferDocumentTopic,
  inferDocumentType,
  normalizeEntityText,
  validEntityUrl,
} from "./entity-cleaning-policy.mjs";

const FILES = {
  documents: "data/documents/catalog.json",
  report: "data/generated/document-cleaning-report.json",
};

const GENERIC_TITLES = new Set([
  "",
  "دانلود",
  "دانلود فایل",
  "دریافت",
  "دریافت فایل",
  "مشاهده",
  "مشاهده فایل",
  "فایل",
  "سند",
  "سند پژوهشی",
  "پیوست",
  "download",
  "download file",
  "file",
  "document",
  "attachment",
  "click here",
]);

const DOCUMENT_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".rtf",
  ".odt",
  ".ods",
  ".odp",
  ".csv",
  ".txt",
  ".zip",
]);

const MIME_EXTENSION_FAMILIES = [
  {
    extensions: new Set([".pdf"]),
    mime: /application\/pdf/i,
  },
  {
    extensions: new Set([".doc", ".docx"]),
    mime: /application\/(?:msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)/i,
  },
  {
    extensions: new Set([".xls", ".xlsx"]),
    mime: /application\/(?:vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet)/i,
  },
  {
    extensions: new Set([".ppt", ".pptx"]),
    mime: /application\/(?:vnd\.ms-powerpoint|vnd\.openxmlformats-officedocument\.presentationml\.presentation)/i,
  },
  {
    extensions: new Set([".rtf"]),
    mime: /application\/rtf|text\/rtf/i,
  },
  {
    extensions: new Set([".csv"]),
    mime: /text\/csv|application\/csv/i,
  },
  {
    extensions: new Set([".txt"]),
    mime: /text\/plain/i,
  },
  {
    extensions: new Set([".zip"]),
    mime: /application\/(?:zip|x-zip-compressed|octet-stream)/i,
  },
];

const readJson = async (file, fallback) => {
  try {
    return JSON.parse(
      await fs.readFile(
        file,
        "utf8"
      )
    );
  } catch {
    return fallback;
  }
};

const writeJson = async (
  file,
  value
) => {
  await fs.mkdir(
    path.dirname(file),
    {
      recursive: true,
    }
  );

  await fs.writeFile(
    file,
    JSON.stringify(
      value,
      null,
      2
    ) + "\n",
    "utf8"
  );
};

function normalizeSha256(
  value
) {
  const sha =
    String(
      value || ""
    )
      .trim()
      .toLowerCase();

  return /^[a-f0-9]{64}$/.test(
    sha
  )
    ? sha
    : null;
}

function canonicalUrl(
  value
) {
  return canonicalEntityUrl(
    value,
    {
      ignoreLanguage: false,
    }
  );
}

function canonicalTarget(
  record
) {
  return canonicalUrl(
    record?.url ||
    record?.sourceUrl
  );
}

function titleIsGeneric(
  value
) {
  return GENERIC_TITLES.has(
    normalizeEntityText(
      value
    )
  );
}

function titleQuality(
  value
) {
  const title =
    String(
      value || ""
    ).trim();

  const normalized =
    normalizeEntityText(
      title
    );

  if (
    !normalized ||
    titleIsGeneric(
      normalized
    )
  ) {
    return -1000;
  }

  if (
    /^https?:\/\//i.test(
      title
    )
  ) {
    return -800;
  }

  if (
    /^[\d._\-\s]+$/u.test(
      title
    )
  ) {
    return -700;
  }

  if (
    /^[a-f0-9-]{20,}$/i.test(
      title
    )
  ) {
    return -600;
  }

  let score =
    Math.min(
      30,
      title.length / 4
    );

  if (
    /[آ-ی]/u.test(
      title
    )
  ) {
    score += 5;
  }

  if (
    /آیین[\s‌-]*نامه|شیوه[\s‌-]*نامه|دستورالعمل|فرم|پروپوزال|پایان[\s‌-]*نامه|رساله|گرنت|پژوهانه|اخلاق|آزمایشگاه|کتابخانه|صنعت|فناوری|regulation|guideline|form|proposal|thesis|dissertation|grant/iu.test(
      title
    )
  ) {
    score += 8;
  }

  if (
    title.length > 220
  ) {
    score -= 12;
  }

  return score;
}

function recordQuality(
  record
) {
  let score = 0;

  score += Math.max(
    -20,
    Math.min(
      20,
      titleQuality(
        record?.title
      )
    )
  );

  if (
    validEntityUrl(
      record?.url
    )
  ) {
    score += 12;
  }

  if (
    validEntityUrl(
      record?.parentUrl ||
      record?.sourcePage
    )
  ) {
    score += 8;
  }

  if (
    normalizeSha256(
      record?.sha256
    )
  ) {
    score += 12;
  }

  if (
    record?.fileName
  ) {
    score += 4;
  }

  if (
    record?.contentType
  ) {
    score += 3;
  }

  if (
    Number.isFinite(
      Number(
        record?.fileSize ||
        record?.bytes
      )
    )
  ) {
    score += 2;
  }

  if (
    [
      "verified",
      "verified-basic",
      "official",
      "direct",
    ].includes(
      record?.evidence
    )
  ) {
    score += 8;
  }

  if (
    !record?.discoveredBy
  ) {
    score += 3;
  }

  return score;
}

function uniqueUrls(
  values
) {
  const map =
    new Map();

  for (
    const value of
      values || []
  ) {
    if (
      !validEntityUrl(
        value
      )
    ) {
      continue;
    }

    const key =
      canonicalUrl(
        value
      );

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

function bestTitle(
  ...records
) {
  const candidates = [];

  for (
    const record of
      records.filter(Boolean)
  ) {
    const cleaned =
      cleanDocumentTitle(
        record
      );

    for (
      const value of [
        cleaned,
        record.title,
        record.originalTitle,
        record.fileName,
      ]
    ) {
      const text =
        String(
          value || ""
        ).trim();

      if (text) {
        candidates.push(
          text
        );
      }
    }
  }

  candidates.sort(
    (
      a,
      b
    ) =>
      titleQuality(b) -
        titleQuality(a) ||
      a.localeCompare(b)
  );

  return (
    candidates.find(
      (value) =>
        titleQuality(
          value
        ) > -500
    ) ||
    ""
  );
}

function choosePreferred(
  a,
  b
) {
  const aq =
    recordQuality(a);

  const bq =
    recordQuality(b);

  if (
    aq !== bq
  ) {
    return aq > bq
      ? a
      : b;
  }

  const aid =
    String(
      a?.id || ""
    );

  const bid =
    String(
      b?.id || ""
    );

  return (
    aid.localeCompare(
      bid
    ) <= 0
      ? a
      : b
  );
}

function mergeDocuments(
  a,
  b,
  reason,
  events
) {
  const preferred =
    choosePreferred(
      a,
      b
    );

  const secondary =
    preferred === a
      ? b
      : a;

  const targetUrls =
    uniqueUrls([
      preferred.url,
      secondary.url,
      preferred.sourceUrl,
      secondary.sourceUrl,
      ...(
        preferred.alternateUrls ||
        []
      ),
      ...(
        secondary.alternateUrls ||
        []
      ),
    ]);

  const evidenceUrls =
    uniqueUrls([
      preferred.url,
      preferred.sourceUrl,
      preferred.parentUrl,
      preferred.sourcePage,

      secondary.url,
      secondary.sourceUrl,
      secondary.parentUrl,
      secondary.sourcePage,

      ...(
        preferred.evidenceUrls ||
        []
      ),

      ...(
        secondary.evidenceUrls ||
        []
      ),

      ...(
        preferred.alternateUrls ||
        []
      ),

      ...(
        secondary.alternateUrls ||
        []
      ),
    ]);

  const preferredTargetKey =
    canonicalUrl(
      preferred.url ||
      preferred.sourceUrl
    );

  const primaryUrl =
    preferred.url ||
    preferred.sourceUrl ||
    targetUrls[0] ||
    null;

  const primaryKey =
    canonicalUrl(
      primaryUrl
    ) ||
    preferredTargetKey;

  const title =
    bestTitle(
      a,
      b
    );

  const merged = {
    ...secondary,
    ...preferred,

    id:
      preferred.id ||
      secondary.id,

    url:
      primaryUrl,

    sourceUrl:
      preferred.sourceUrl ||
      primaryUrl ||
      secondary.sourceUrl,

    parentUrl:
      preferred.parentUrl ||
      preferred.sourcePage ||
      secondary.parentUrl ||
      secondary.sourcePage ||
      undefined,

    title:
      title ||
      preferred.title ||
      secondary.title,

    evidenceUrls,

    alternateUrls:
      targetUrls.filter(
        (value) =>
          canonicalUrl(
            value
          ) !== primaryKey
      ),
  };

  const sha =
    normalizeSha256(
      preferred.sha256
    ) ||
    normalizeSha256(
      secondary.sha256
    );

  if (sha) {
    merged.sha256 =
      sha;
  }

  if (
    !merged.originalTitle
  ) {
    const original = [
      a.originalTitle,
      b.originalTitle,
      a.title,
      b.title,
    ]
      .map(
        (value) =>
          String(
            value || ""
          ).trim()
      )
      .find(
        (value) =>
          value &&
          value !==
            merged.title
      );

    if (original) {
      merged.originalTitle =
        original;
    }
  }

  merged.type =
    inferDocumentType({
      ...merged,
      title:
        merged.title,
    });

  merged.topic =
    inferDocumentTopic({
      ...merged,
      title:
        merged.title,
    });

  events.push({
    action:
      "merged",

    reason,

    universitySlug:
      merged.universitySlug ||
      null,

    keptId:
      merged.id ||
      null,

    mergedIds: [
      a.id,
      b.id,
    ].filter(Boolean),

    title:
      merged.title ||
      null,

    url:
      merged.url ||
      null,

    sha256:
      merged.sha256 ||
      null,
  });

  return merged;
}

function deduplicate(
  rows,
  keyFor,
  reason,
  events
) {
  const map =
    new Map();

  const passthrough = [];

  for (
    const row of rows
  ) {
    const key =
      keyFor(row);

    if (!key) {
      passthrough.push(
        row
      );

      continue;
    }

    if (
      !map.has(key)
    ) {
      map.set(
        key,
        row
      );

      continue;
    }

    map.set(
      key,
      mergeDocuments(
        map.get(key),
        row,
        reason,
        events
      )
    );
  }

  return [
    ...map.values(),
    ...passthrough,
  ];
}

function extensionOf(
  record
) {
  const candidates = [
    record?.url,
    record?.sourceUrl,
    record?.fileName,
  ].filter(Boolean);

  for (
    const value of
      candidates
  ) {
    try {
      const pathname =
        validEntityUrl(
          value
        )
          ? new URL(
              String(value)
            ).pathname
          : String(value);

      const ext =
        path
          .extname(
            decodeURIComponent(
              pathname
            )
          )
          .toLowerCase();

      if (ext) {
        return ext;
      }
    } catch {
      // Continue with the next candidate.
    }
  }

  return "";
}

function mimeExtensionMismatch(
  record
) {
  const ext =
    extensionOf(
      record
    );

  const mime =
    String(
      record?.contentType ||
      ""
    )
      .trim()
      .toLowerCase();

  if (
    !ext ||
    !mime ||
    !DOCUMENT_EXTENSIONS.has(
      ext
    )
  ) {
    return false;
  }

  if (
    mime ===
    "application/octet-stream"
  ) {
    return false;
  }

  const family =
    MIME_EXTENSION_FAMILIES.find(
      (item) =>
        item.extensions.has(
          ext
        )
    );

  return Boolean(
    family &&
    !family.mime.test(
      mime
    )
  );
}

function normalizeDocument(
  record,
  events,
  warnings
) {
  const next = {
    ...record,
  };

  const cleanedTitle =
    cleanDocumentTitle(
      next
    );

  if (
    cleanedTitle &&
    cleanedTitle !==
      next.title
  ) {
    events.push({
      action:
        "retitled",

      universitySlug:
        next.universitySlug ||
        null,

      id:
        next.id ||
        null,

      from:
        next.title ||
        null,

      to:
        cleanedTitle,
    });

    if (
      next.title &&
      !next.originalTitle
    ) {
      next.originalTitle =
        next.title;
    }

    next.title =
      cleanedTitle;
  }

  next.entityType =
    "document";

  next.dimension =
    "documentsRegulations";

  next.primaryDimension =
    "documentsRegulations";

  next.type =
    inferDocumentType(
      next
    );

  next.topic =
    inferDocumentTopic(
      next
    );

  const sha =
    normalizeSha256(
      next.sha256
    );

  if (sha) {
    next.sha256 =
      sha;
  } else if (
    next.sha256
  ) {
    warnings.push({
      type:
        "invalid-sha256",

      universitySlug:
        next.universitySlug ||
        null,

      id:
        next.id ||
        null,

      value:
        next.sha256,

      url:
        next.url ||
        next.sourceUrl ||
        null,
    });

    delete next.sha256;
  }

  next.evidenceUrls =
    uniqueUrls([
      ...(
        next.evidenceUrls ||
        []
      ),

      next.url,
      next.sourceUrl,
      next.parentUrl,
      next.sourcePage,
    ]);

  next.alternateUrls =
    uniqueUrls(
      next.alternateUrls ||
      []
    ).filter(
      (value) =>
        canonicalUrl(
          value
        ) !==
        canonicalUrl(
          next.url ||
          next.sourceUrl
        )
    );

  if (
    titleIsGeneric(
      next.title
    )
  ) {
    warnings.push({
      type:
        "generic-title",

      universitySlug:
        next.universitySlug ||
        null,

      id:
        next.id ||
        null,

      title:
        next.title ||
        null,

      url:
        next.url ||
        next.sourceUrl ||
        null,
    });
  }

  if (
    !validEntityUrl(
      next.url ||
      next.sourceUrl
    )
  ) {
    warnings.push({
      type:
        "missing-target-url",

      universitySlug:
        next.universitySlug ||
        null,

      id:
        next.id ||
        null,

      title:
        next.title ||
        null,
    });
  }

  if (
    next.discoveredBy ===
      "research-deep-discovery" &&
    !validEntityUrl(
      next.parentUrl ||
      next.sourcePage
    )
  ) {
    warnings.push({
      type:
        "crawler-document-missing-parent-context",

      universitySlug:
        next.universitySlug ||
        null,

      id:
        next.id ||
        null,

      title:
        next.title ||
        null,

      url:
        next.url ||
        next.sourceUrl ||
        null,
    });
  }

  if (
    mimeExtensionMismatch(
      next
    )
  ) {
    warnings.push({
      type:
        "mime-extension-mismatch",

      universitySlug:
        next.universitySlug ||
        null,

      id:
        next.id ||
        null,

      title:
        next.title ||
        null,

      url:
        next.url ||
        next.sourceUrl ||
        null,

      contentType:
        next.contentType ||
        null,

      extension:
        extensionOf(
          next
        ),
    });
  }

  return next;
}

function sortDocuments(
  rows
) {
  return [
    ...rows,
  ].sort(
    (
      a,
      b
    ) =>
      String(
        a.universitySlug ||
        ""
      ).localeCompare(
        String(
          b.universitySlug ||
          ""
        )
      ) ||

      String(
        a.title ||
        ""
      ).localeCompare(
        String(
          b.title ||
          ""
        ),
        "fa"
      ) ||

      String(
        a.id ||
        ""
      ).localeCompare(
        String(
          b.id ||
          ""
        )
      )
  );
}

const rawDocuments =
  await readJson(
    FILES.documents,
    []
  );

if (
  !Array.isArray(
    rawDocuments
  )
) {
  throw new Error(
    "data/documents/catalog.json must contain an array"
  );
}

const events = [];
const warnings = [];

let documents =
  rawDocuments.map(
    (row) =>
      normalizeDocument(
        row,
        events,
        warnings
      )
  );

const beforeUrlDedup =
  documents.length;

documents =
  deduplicate(
    documents,

    (row) => {
      const target =
        canonicalTarget(
          row
        );

      return (
        target &&
        row.universitySlug
      )
        ? `${row.universitySlug}|url:${target}`
        : null;
    },

    "canonical-url",

    events
  );

const urlDuplicatesMerged =
  beforeUrlDedup -
  documents.length;

const beforeHashDedup =
  documents.length;

documents =
  deduplicate(
    documents,

    (row) => {
      const sha =
        normalizeSha256(
          row.sha256
        );

      return (
        sha &&
        row.universitySlug
      )
        ? `${row.universitySlug}|sha256:${sha}`
        : null;
    },

    "sha256",

    events
  );

const hashDuplicatesMerged =
  beforeHashDedup -
  documents.length;

documents =
  documents.map(
    (row) =>
      normalizeDocument(
        row,
        events,
        warnings
      )
  );

documents =
  sortDocuments(
    documents
  );

const genericRemaining =
  documents.filter(
    (row) =>
      titleIsGeneric(
        row.title
      )
  );

const invalidTargetRemaining =
  documents.filter(
    (row) =>
      !validEntityUrl(
        row.url ||
        row.sourceUrl
      )
  );

if (
  genericRemaining.length
) {
  throw new Error(
    `Document cleaning left ${genericRemaining.length} generic title(s); run title recovery before document quality cleaning`
  );
}

if (
  invalidTargetRemaining.length
) {
  throw new Error(
    `Document cleaning left ${invalidTargetRemaining.length} document(s) without a valid target URL`
  );
}

const warningCounts = {};

for (
  const warning of
    warnings
) {
  warningCounts[
    warning.type
  ] =
    (
      warningCounts[
        warning.type
      ] ||
      0
    ) +
    1;
}

const eventCounts = {};

for (
  const event of
    events
) {
  eventCounts[
    event.action
  ] =
    (
      eventCounts[
        event.action
      ] ||
      0
    ) +
    1;
}

const report = {
  schemaVersion: 1,

  policyVersion:
    "document-cleaning-1.0-content-aware-dedup",

  generatedAt:
    new Date()
      .toISOString(),

  policy: {
    scope:
      "Only documents already accepted by research-scope and entity cleaning are processed.",

    canonicalUrlDedup:
      "Duplicate canonical URLs are merged within the same university.",

    contentDedup:
      "Valid SHA-256 matches are merged within the same university; identical national documents linked by different universities remain separate university evidence records.",

    titles:
      "Human-readable titles are preferred; generic titles are not allowed to leave this stage.",

    provenance:
      "Merged records preserve evidence URLs, alternate target URLs, parent/source context and content metadata.",

    metadata:
      "Document type/topic are re-inferred from the final merged record; suspicious metadata is reported rather than silently deleted.",
  },

  counts: {
    before:
      rawDocuments.length,

    after:
      documents.length,

    urlDuplicatesMerged,

    hashDuplicatesMerged,

    totalMerged:
      rawDocuments.length -
      documents.length,

    warnings:
      warnings.length,

    events:
      events.length,
  },

  warningCounts,
  eventCounts,
  warnings,
  events,
};

await Promise.all([
  writeJson(
    FILES.documents,
    documents
  ),

  writeJson(
    FILES.report,
    report
  ),
]);

console.log(
  [
    "document cleaning v1 complete",
    `documents=${rawDocuments.length}->${documents.length}`,
    `urlMerged=${urlDuplicatesMerged}`,
    `sha256Merged=${hashDuplicatesMerged}`,
    `warnings=${warnings.length}`,
  ].join(" | ")
);

for (
  const [
    type,
    count,
  ] of Object
    .entries(
      warningCounts
    )
    .sort()
) {
  console.log(
    `document warning | ${type}=${count}`
  );
}

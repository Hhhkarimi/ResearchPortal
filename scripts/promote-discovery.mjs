/**
 * Promote high-confidence deep-crawl discoveries into the existing evidence model.
 *
 * This script is intentionally conservative:
 * - It never deletes a legitimate non-social verified source just because a crawl missed it.
 * - It removes Telegram/social URLs from published evidence.
 * - It promotes only dimension-specific URLs above a confidence threshold.
 * - It respects the project's special IT organizational-attribution validation rule.
 */

import fs from "node:fs/promises";
import { createHash } from "node:crypto";

const readJson = async (file, fallback) => {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
};

const writeJson = (file, value) =>
  fs.writeFile(file, JSON.stringify(value, null, 2) + "\n");

const thresholdRaw = Number.parseFloat(
  process.env.DISCOVERY_PROMOTE_CONFIDENCE ?? "0.78"
);

const PROMOTE_THRESHOLD = Number.isFinite(thresholdRaw)
  ? Math.min(0.99, Math.max(0.55, thresholdRaw))
  : 0.78;

const SOCIAL_HOSTS = new Set([
  "t.me",
  "telegram.me",
  "telegram.org",
  "instagram.com",
  "facebook.com",
  "fb.com",
  "x.com",
  "twitter.com",
  "linkedin.com",
  "youtube.com",
  "youtu.be",
]);

const DIMENSION_TO_REAUDIT = {
  portalIdentity: "portalUrls",
  organization: "organizationUrls",
  libraryDocuments: "libraryUrls",
  laboratories: "laboratoryUrls",
  industryTechnology: "industryTechnologyUrls",
  informationTechnology: "informationTechnologyUrls",
  systemsServices: "systemsUrls",
  documentsRegulations: "documentIndexUrls",
};

const DIMENSION_LABELS = {
  portalIdentity: "پرتال پژوهش و فناوری",
  organization: "ساختار سازمانی",
  libraryDocuments: "کتابخانه و اسناد",
  laboratories: "آزمایشگاه‌ها",
  industryTechnology: "صنعت و فناوری",
  informationTechnology: "فناوری اطلاعات",
  systemsServices: "سامانه‌ها و خدمات",
  documentsRegulations: "اسناد و مقررات",
};

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\u200c/g, " ")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[^\p{L}\p{N}./:&_-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hostMatches(host, expected) {
  return host === expected || host.endsWith(`.${expected}`);
}

function isBlockedUrl(value) {
  try {
    const host = new URL(value)
      .hostname
      .toLowerCase()
      .replace(/^www\./, "");

    return [...SOCIAL_HOSTS].some((blocked) =>
      hostMatches(host, blocked)
    );
  } catch {
    return true;
  }
}

function validUrl(value) {
  try {
    const url = new URL(value);

    return (
      ["http:", "https:"].includes(url.protocol) &&
      !isBlockedUrl(value)
    );
  } catch {
    return false;
  }
}

function canonicalUrl(value) {
  if (!validUrl(value)) return null;

  const url = new URL(value);

  url.hash = "";
  url.hostname = url.hostname
    .toLowerCase()
    .replace(/^www\./, "");

  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  return url.toString();
}

function uniqueUrls(values) {
  const map = new Map();

  for (const value of values || []) {
    const key = canonicalUrl(value);

    if (key && !map.has(key)) {
      map.set(key, value);
    }
  }

  return [...map.values()];
}

function stableId(prefix, slug, url) {
  const hash = createHash("sha1")
    .update(`${slug}|${canonicalUrl(url) || url}`)
    .digest("hex")
    .slice(0, 12);

  return `${slug}-discovery-${prefix}-${hash}`;
}

function documentType(taxonomy, title = "") {
  const normalized = normalizeText(title);

  if (taxonomy === "regulation/bylaw") {
    return "آیین‌نامه";
  }

  if (taxonomy === "procedure/guideline") {
    return "شیوه‌نامه/دستورالعمل";
  }

  if (taxonomy === "form/template") {
    return "فرم/الگو";
  }

  if (taxonomy === "policy/circular") {
    return "سیاست/بخشنامه";
  }

  if (
    normalized.includes("فرایند") ||
    normalized.includes("فرآیند")
  ) {
    return "فرآیند";
  }

  return "سند";
}

function documentTopic(taxonomy, title = "") {
  if (taxonomy === "research ethics") {
    return "اخلاق پژوهش";
  }

  if (taxonomy === "grants/funding") {
    return "حمایت و گرنت";
  }

  if (taxonomy === "publications/journals") {
    return "انتشارات و نشریات";
  }

  if (taxonomy === "laboratory") {
    return "آزمایشگاه";
  }

  if (taxonomy === "industry/technology/IP") {
    return "صنعت، فناوری و مالکیت فکری";
  }

  if (taxonomy === "postgraduate/research affairs") {
    return "تحصیلات تکمیلی و امور پژوهشی";
  }

  const normalized = normalizeText(title);

  if (normalized.includes("اخلاق")) {
    return "اخلاق پژوهش";
  }

  if (
    ["گرنت", "پژوهانه", "حمایت"].some((x) =>
      normalized.includes(x)
    )
  ) {
    return "حمایت و گرنت";
  }

  if (
    ["نشریه", "مجله", "انتشارات"].some((x) =>
      normalized.includes(x)
    )
  ) {
    return "انتشارات و نشریات";
  }

  if (normalized.includes("آزمایش")) {
    return "آزمایشگاه";
  }

  if (
    [
      "صنعت",
      "فناوری",
      "مالکیت فکری",
      "اختراع",
      "مرکز رشد",
    ].some((x) =>
      normalized.includes(normalizeText(x))
    )
  ) {
    return "صنعت، فناوری و مالکیت فکری";
  }

  if (
    [
      "پایان نامه",
      "پایان‌نامه",
      "رساله",
      "پروپوزال",
    ].some((x) =>
      normalized.includes(normalizeText(x))
    )
  ) {
    return "تحصیلات تکمیلی و امور پژوهشی";
  }

  return "سایر";
}

function cleanCatalogItem(item) {
  const next = { ...item };

  if (
    next.relationshipEvidenceUrl &&
    isBlockedUrl(next.relationshipEvidenceUrl)
  ) {
    delete next.relationshipEvidenceUrl;

    if (
      next.relationStatus ===
      "organizationally-attributed"
    ) {
      next.relationStatus = "observed-reference";
    }
  }

  for (const key of [
    "sourceUrl",
    "parentUrl",
    "url",
  ]) {
    if (next[key] && isBlockedUrl(next[key])) {
      delete next[key];
    }
  }

  if (!next.sourceUrl) {
    const fallback = [
      next.parentUrl,
      next.url,
    ].find(validUrl);

    if (fallback) {
      next.sourceUrl = fallback;
    }
  }

  return [
    next.sourceUrl,
    next.parentUrl,
    next.url,
  ].some(validUrl)
    ? next
    : null;
}

function cleanAudit(audit) {
  const researchUrl = validUrl(audit.researchUrl)
    ? audit.researchUrl
    : null;

  return {
    ...audit,
    researchUrl,
    evidenceUrls: uniqueUrls(
      (audit.evidenceUrls || []).filter(validUrl)
    ),
  };
}

function cleanReview(review) {
  const officialSources = (
    review.officialSources || []
  ).filter((source) =>
    validUrl(source.url)
  );

  return {
    ...review,
    officialSources,
    officialSourceUrls: uniqueUrls(
      officialSources.map(
        (source) => source.url
      )
    ),
  };
}

function cleanReaudit(row) {
  const next = { ...row };

  for (
    const key of Object.values(
      DIMENSION_TO_REAUDIT
    )
  ) {
    next[key] = uniqueUrls(
      (row[key] || []).filter(validUrl)
    );
  }

  next.directDocuments = (
    row.directDocuments || []
  ).filter((item) =>
    validUrl(item.url)
  );

  return next;
}

function unitTypeFor(record) {
  const text = normalizeText(
    `${record.title} ${record.anchorText} ${record.url}`
  );

  if (record.dimension === "organization") {
    return "research";
  }

  if (
    record.dimension ===
    "libraryDocuments"
  ) {
    return "library";
  }

  if (
    record.dimension === "laboratories"
  ) {
    return "laboratory";
  }

  if (
    record.dimension ===
    "informationTechnology"
  ) {
    return "it";
  }

  if (
    record.dimension ===
    "industryTechnology"
  ) {
    return (
      text.includes("صنعت") ||
      text.includes("industry")
    )
      ? "industry"
      : "technology";
  }

  return null;
}

function systemCategoryFor(record) {
  const text = normalizeText(
    `${record.title} ${record.anchorText} ${record.url}`
  );

  if (
    text.includes("نشری") ||
    text.includes("journal")
  ) {
    return "journals";
  }

  if (
    text.includes("آزمایش") ||
    text.includes("laboratory")
  ) {
    return "laboratory";
  }

  if (
    text.includes("کتابخانه") ||
    text.includes("library")
  ) {
    return "library";
  }

  if (
    text.includes("نوآور") ||
    text.includes("innovation")
  ) {
    return "innovation";
  }

  if (
    text.includes("صنعت") ||
    text.includes("industry")
  ) {
    return "industry";
  }

  if (
    text.includes("فناوری اطلاعات") ||
    text.includes(" ict ") ||
    text.endsWith(" ict") ||
    text.includes("it center")
  ) {
    return "it";
  }

  return "research";
}

function displayTitle(record, fallback) {
  const candidate =
    String(record.title || "").trim() ||
    String(
      record.anchorText || ""
    ).trim() ||
    fallback;

  return candidate.slice(0, 240);
}

const [
  institutions,
  rawAudits,
  rawReviews,
  rawReaudit,
  rawUnits,
  rawSystems,
  rawDocuments,
  discoveryEvidenceFile,
  discoveryDocumentsFile,
] = await Promise.all([
  readJson(
    "data/isc/institutions.json",
    []
  ),
  readJson(
    "data/audit/portal-audit.json",
    []
  ),
  readJson(
    "data/evidence/research-review.json",
    []
  ),
  readJson(
    "data/evidence/portal-document-reaudit.json",
    []
  ),
  readJson(
    "data/units/catalog.json",
    []
  ),
  readJson(
    "data/systems/catalog.json",
    []
  ),
  readJson(
    "data/documents/catalog.json",
    []
  ),
  readJson(
    "data/generated/discovery-evidence.json",
    {
      evidence: [],
      portalCandidates: [],
    }
  ),
  readJson(
    "data/generated/discovered-documents.json",
    {
      documents: [],
    }
  ),
]);

const institutionBySlug = new Map(
  institutions.map((item) => [
    item.slug,
    item,
  ])
);

let audits = rawAudits.map(cleanAudit);
let reviews = rawReviews.map(cleanReview);
let reaudit = rawReaudit.map(cleanReaudit);

let units = rawUnits
  .map(cleanCatalogItem)
  .filter(Boolean);

let systems = rawSystems
  .map(cleanCatalogItem)
  .filter(Boolean);

let documents = rawDocuments
  .map(cleanCatalogItem)
  .filter(Boolean);

const evidence = (
  discoveryEvidenceFile?.evidence || []
).filter(
  (record) =>
    record &&
    institutionBySlug.has(
      record.universitySlug
    ) &&
    record.officialDomain === true &&
    Number(record.confidence) >=
      PROMOTE_THRESHOLD &&
    validUrl(record.url)
);

const portalCandidates = (
  discoveryEvidenceFile?.portalCandidates ||
  []
).filter(
  (record) =>
    record &&
    institutionBySlug.has(
      record.universitySlug
    ) &&
    record.officialDomain === true &&
    Number(record.confidence) >=
      PROMOTE_THRESHOLD &&
    validUrl(record.url)
);

const discoveredDocuments = (
  discoveryDocumentsFile?.documents || []
).filter(
  (record) =>
    record &&
    institutionBySlug.has(
      record.universitySlug
    ) &&
    Number(record.confidence) >=
      PROMOTE_THRESHOLD &&
    validUrl(record.url)
);

const evidenceBySlug = new Map();

for (const record of evidence) {
  if (
    !evidenceBySlug.has(
      record.universitySlug
    )
  ) {
    evidenceBySlug.set(
      record.universitySlug,
      []
    );
  }

  evidenceBySlug
    .get(record.universitySlug)
    .push(record);
}

const portalsBySlug = new Map();

for (const record of portalCandidates) {
  if (
    !portalsBySlug.has(
      record.universitySlug
    )
  ) {
    portalsBySlug.set(
      record.universitySlug,
      []
    );
  }

  portalsBySlug
    .get(record.universitySlug)
    .push(record);
}

for (
  const records of portalsBySlug.values()
) {
  records.sort(
    (a, b) =>
      b.confidence - a.confidence ||
      b.score - a.score
  );
}

const docsBySlug = new Map();

for (
  const record of discoveredDocuments
) {
  if (
    !docsBySlug.has(
      record.universitySlug
    )
  ) {
    docsBySlug.set(
      record.universitySlug,
      []
    );
  }

  docsBySlug
    .get(record.universitySlug)
    .push(record);
}

const today = new Date()
  .toISOString()
  .slice(0, 10);

// 1) Merge discovery into the 115-row portal/document re-audit register.

const reauditBySlug = new Map(
  reaudit.map((row) => [
    row.slug,
    row,
  ])
);

for (
  const institution of institutions
) {
  let row = reauditBySlug.get(
    institution.slug
  );

  if (!row) {
    row = {
      row:
        institutions.findIndex(
          (x) =>
            x.slug === institution.slug
        ) + 1,
      slug: institution.slug,
      nameFa: institution.nameFa,
      portalUrls: [],
      organizationUrls: [],
      libraryUrls: [],
      laboratoryUrls: [],
      industryTechnologyUrls: [],
      informationTechnologyUrls: [],
      systemsUrls: [],
      documentIndexUrls: [],
      directDocuments: [],
    };

    reaudit.push(row);

    reauditBySlug.set(
      institution.slug,
      row
    );
  }

  const portalRecords =
    portalsBySlug.get(
      institution.slug
    ) || [];

  row.portalUrls = uniqueUrls([
    ...(row.portalUrls || []),
    ...portalRecords.map(
      (record) => record.url
    ),
  ]);

  const rootUrls = new Set(
    row.portalUrls
      .map(canonicalUrl)
      .filter(Boolean)
  );

  for (
    const record of
      evidenceBySlug.get(
        institution.slug
      ) || []
  ) {
    const key =
      DIMENSION_TO_REAUDIT[
        record.dimension
      ];

    if (
      !key ||
      key === "portalUrls"
    ) {
      continue;
    }

    if (
      rootUrls.has(
        canonicalUrl(record.url)
      )
    ) {
      continue;
    }

    row[key] = uniqueUrls([
      ...(row[key] || []),
      record.url,
    ]);
  }

  const directDocs =
    row.directDocuments || [];

  const directDocIndex = new Map(
    directDocs
      .map((item, index) => [
        canonicalUrl(item.url),
        index,
      ])
      .filter(([key]) =>
        Boolean(key)
      )
  );

  for (
    const record of
      docsBySlug.get(
        institution.slug
      ) || []
  ) {
    const key = canonicalUrl(
      record.url
    );

    if (!key) {
      continue;
    }

    const discovered = {
      title: displayTitle(
        record,
        "سند پژوهشی"
      ),
      url: record.url,
      taxonomy:
        record.taxonomy ||
        "other",
      sha256:
        record.sha256 || null,
      contentType:
        record.contentType ||
        null,
      fileName:
        record.fileName || null,
      bytes:
        record.bytes || null,
      sourcePage: validUrl(
        record.sourcePage
      )
        ? record.sourcePage
        : null,
      discoveredBy:
        "research-deep-discovery",
      lastVerified: today,
    };

    if (
      directDocIndex.has(key)
    ) {
      const index =
        directDocIndex.get(key);

      directDocs[index] = {
        ...directDocs[index],
        ...discovered,
        title:
          directDocs[index].title ||
          discovered.title,
      };

      continue;
    }

    directDocIndex.set(
      key,
      directDocs.length
    );

    directDocs.push(discovered);
  }

  row.directDocuments =
    directDocs;
}

// 2) Promote direct portal candidates into portal-audit and remove all social evidence.

const auditBySlug = new Map(
  audits.map((item) => [
    item.universitySlug,
    item,
  ])
);

for (
  const institution of institutions
) {
  const audit =
    auditBySlug.get(
      institution.slug
    );

  if (!audit) {
    continue;
  }

  const portalRecords =
    portalsBySlug.get(
      institution.slug
    ) || [];

  if (
    !audit.researchUrl &&
    portalRecords.length
  ) {
    audit.researchUrl =
      portalRecords[0].url;
  }

  if (audit.researchUrl) {
    audit.portalAuditStatus =
      "direct-official";
  }

  const newSources = [
    ...portalRecords.map(
      (record) => record.url
    ),
    ...(
      evidenceBySlug.get(
        institution.slug
      ) || []
    ).map(
      (record) => record.url
    ),
    ...(
      docsBySlug.get(
        institution.slug
      ) || []
    ).map(
      (record) => record.url
    ),
  ].filter(validUrl);

  audit.evidenceUrls = uniqueUrls([
    ...(audit.evidenceUrls || []),
    ...newSources,
  ]).slice(0, 60);

  audit.auditDate = today;

  audit.discoveryCrawler = {
    lastRun: today,
    promotedSources:
      newSources.length,
    socialEvidenceRemoved: true,
  };
}

// 3) Add dimension-specific units.
// Existing rows remain authoritative and are deduplicated.

const unitKey = (item) =>
  `${item.universitySlug}|${item.type}|${canonicalUrl(
    item.sourceUrl ||
      item.parentUrl ||
      item.url
  )}`;

const unitKeys = new Set(
  units.map(unitKey)
);

for (const record of evidence) {
  const type = unitTypeFor(record);

  if (!type) {
    continue;
  }

  const sourceUrl =
    record.url;

  const key =
    `${record.universitySlug}|${type}|${canonicalUrl(
      sourceUrl
    )}`;

  if (unitKeys.has(key)) {
    continue;
  }

  const next = {
    // FIX:
    // type is now included in the ID namespace
    // to prevent duplicate entity IDs.
    id: stableId(
      `unit-${type}`,
      record.universitySlug,
      sourceUrl
    ),

    universitySlug:
      record.universitySlug,

    nameFa: displayTitle(
      record,
      DIMENSION_LABELS[
        record.dimension
      ]
    ),

    type,

    evidence: "verified",

    lastVerified: today,

    sourceUrl,

    discoveredBy:
      "research-deep-discovery",

    discoveryConfidence:
      Number(record.confidence),
  };

  if (
    type === "it" &&
    record.researchContext ===
      true &&
    validUrl(record.sourcePage)
  ) {
    next.relationStatus =
      "organizationally-attributed";

    next.relationshipEvidenceUrl =
      record.sourcePage;
  }

  units.push(next);
  unitKeys.add(key);
}

// 4) Add discovered systems/services.

const systemKey = (item) =>
  `${item.universitySlug}|${canonicalUrl(
    item.url ||
      item.sourceUrl
  )}`;

const systemKeys = new Set(
  systems.map(systemKey)
);

for (
  const record of evidence.filter(
    (item) =>
      item.dimension ===
      "systemsServices"
  )
) {
  const key =
    `${record.universitySlug}|${canonicalUrl(
      record.url
    )}`;

  if (systemKeys.has(key)) {
    continue;
  }

  systems.push({
    id: stableId(
      "system",
      record.universitySlug,
      record.url
    ),

    universitySlug:
      record.universitySlug,

    nameFa: displayTitle(
      record,
      "سامانه یا خدمت پژوهشی"
    ),

    category:
      systemCategoryFor(record),

    url: record.url,

    sourceUrl: validUrl(
      record.sourcePage
    )
      ? record.sourcePage
      : record.url,

    relation:
      "research-portal-discovery",

    evidence: "verified",

    lastVerified: today,

    discoveredBy:
      "research-deep-discovery",

    discoveryConfidence:
      Number(record.confidence),
  });

  systemKeys.add(key);
}

// 5) Add direct downloadable documents with hashes/metadata.

const documentKey = (item) =>
  `${item.universitySlug}|${canonicalUrl(
    item.url ||
      item.sourceUrl
  )}`;

const documentIndex = new Map(
  documents.map(
    (item, index) => [
      documentKey(item),
      index,
    ]
  )
);

for (
  const record of discoveredDocuments
) {
  const key =
    `${record.universitySlug}|${canonicalUrl(
      record.url
    )}`;

  const taxonomy =
    record.taxonomy ||
    "other";

  const title = displayTitle(
    record,
    "سند پژوهشی"
  );

  const discovered = {
    universitySlug:
      record.universitySlug,

    title,

    type:
      record.type ||
      documentType(
        taxonomy,
        title
      ),

    topic:
      record.topic ||
      documentTopic(
        taxonomy,
        title
      ),

    taxonomy,

    evidence: "verified",

    status: "active",

    lastVerified: today,

    url: record.url,

    sourceUrl: record.url,

    parentUrl: validUrl(
      record.sourcePage
    )
      ? record.sourcePage
      : undefined,

    sha256:
      record.sha256 ||
      undefined,

    fileName:
      record.fileName ||
      undefined,

    contentType:
      record.contentType ||
      undefined,

    fileSize:
      Number.isFinite(
        record.bytes
      )
        ? record.bytes
        : undefined,

    archivePath:
      record.archivePath ||
      undefined,

    discoveredBy:
      "research-deep-discovery",

    discoveryConfidence:
      Number(record.confidence),
  };

  if (
    documentIndex.has(key)
  ) {
    const index =
      documentIndex.get(key);

    documents[index] = {
      ...documents[index],
      ...discovered,

      id:
        documents[index].id,

      title:
        documents[index].title ||
        discovered.title,

      topic:
        documents[index].topic ||
        discovered.topic,

      type:
        documents[index].type ||
        discovered.type,
    };

    continue;
  }

  documentIndex.set(
    key,
    documents.length
  );

  documents.push({
    id: stableId(
      "document",
      record.universitySlug,
      record.url
    ),
    ...discovered,
  });
}

// 6) Update research-review outcomes conservatively.
// Existing verified outcomes are never downgraded solely due to this crawler.

const reviewBySlug = new Map(
  reviews.map((item) => [
    item.universitySlug,
    item,
  ])
);

const unitBySlug = (slug) =>
  units.filter(
    (item) =>
      item.universitySlug === slug
  );

for (
  const institution of institutions
) {
  const review =
    reviewBySlug.get(
      institution.slug
    );

  const row =
    reauditBySlug.get(
      institution.slug
    );

  if (!review || !row) {
    continue;
  }

  const previousDimensions = {
    ...(review.dimensions || {}),
  };

  const roots = new Set(
    (row.portalUrls || [])
      .map(canonicalUrl)
      .filter(Boolean)
  );

  const hasSpecific = (key) =>
    (row[key] || []).some(
      (url) => {
        const canonical =
          canonicalUrl(url);

        return (
          canonical &&
          !roots.has(canonical)
        );
      }
    );

  const hasValidItRelation =
    unitBySlug(
      institution.slug
    ).some(
      (item) =>
        item.type === "it" &&
        item.relationStatus ===
          "organizationally-attributed" &&
        validUrl(
          item.relationshipEvidenceUrl
        )
    );

  const dimensions = {
    ...previousDimensions,
  };

  if (
    (row.portalUrls || [])
      .length
  ) {
    dimensions.portalIdentity =
      "verified";
  }

  const checks = {
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
  };

  for (
  const [
    dimension,
    key,
  ] of Object.entries(checks)
) {
  const urls =
    row[key] || [];

  const specific =
    hasSpecific(key);

  const onlyPortalRoots =
    urls.length > 0 &&
    urls.every(
      (url) =>
        roots.has(
          canonicalUrl(url)
        )
    );

  /*
   * A real dimension-specific URL can verify the dimension.
   */
  if (specific) {
    dimensions[dimension] =
      "verified";

    continue;
  }

  /*
   * Critical publication rule:
   *
   * If every URL for this dimension is merely one of the
   * portal roots, the portal homepage/root alone must NOT
   * keep the dimension verified.
   *
   * This also corrects stale "verified" outcomes inherited
   * from an earlier promotion cycle.
   */
  if (
    onlyPortalRoots &&
    dimensions[dimension] !==
      "restricted"
  ) {
    dimensions[dimension] =
      "observed-reference";

    continue;
  }

  /*
   * There is some reference, but not enough specific public
   * evidence to promote it to verified.
   */
  if (
    dimensions[dimension] !==
      "verified" &&
    urls.length &&
    dimensions[dimension] !==
      "restricted"
  ) {
    dimensions[dimension] =
      "observed-reference";
  }
}

/*
 * Information Technology has an additional strict rule:
 *
 * verified requires BOTH:
 * 1) a dimension-specific IT URL
 * 2) separately modeled organizational relationship evidence
 */
const itUrls =
  row.informationTechnologyUrls ||
  [];

const hasSpecificIt =
  hasSpecific(
    "informationTechnologyUrls"
  );

if (
  hasValidItRelation &&
  hasSpecificIt
) {
  dimensions.informationTechnology =
    "verified";
} else if (
  itUrls.length &&
  dimensions.informationTechnology !==
    "restricted"
) {
  /*
   * Even if an older cycle marked IT as verified,
   * a root/reference without sufficient organizational
   * attribution must be downgraded.
   */
  dimensions.informationTechnology =
    "observed-reference";
} else if (
  dimensions.informationTechnology ===
    "verified" &&
  !hasValidItRelation
) {
  /*
   * No usable IT reference and no organizational attribution.
   * Do not preserve an invalid historical verified state.
   */
  dimensions.informationTechnology =
    "unresolved";
}

  if (
    (row.directDocuments || [])
      .length ||
    hasSpecific(
      "documentIndexUrls"
    )
  ) {
    dimensions.documentsRegulations =
      "verified";
  } else if (
    dimensions.documentsRegulations !==
      "verified" &&
    (
      row.documentIndexUrls ||
      []
    ).length &&
    dimensions.documentsRegulations !==
      "restricted"
  ) {
    dimensions.documentsRegulations =
      "observed-reference";
  }

  const discoveredSources = [
    ...(
      portalsBySlug.get(
        institution.slug
      ) || []
    ).map((record) => ({
      label:
        "پرتال پژوهش کشف‌شده",
      url: record.url,
    })),

    ...(
      evidenceBySlug.get(
        institution.slug
      ) || []
    ).map((record) => ({
      label:
        `${
          DIMENSION_LABELS[
            record.dimension
          ] ||
          record.dimension
        } — کشف خودکار`,
      url: record.url,
    })),

    ...(
      docsBySlug.get(
        institution.slug
      ) || []
    ).map((record) => ({
      label: displayTitle(
        record,
        "سند پژوهشی"
      ),
      url: record.url,
    })),
  ].filter((source) =>
    validUrl(source.url)
  );

  const sourceMap =
    new Map();

  for (
    const source of [
      ...(review.officialSources ||
        []),
      ...discoveredSources,
    ]
  ) {
    const key =
      canonicalUrl(source.url);

    if (
      key &&
      !sourceMap.has(key)
    ) {
      sourceMap.set(
        key,
        source
      );
    }
  }

  const officialSources = [
    ...sourceMap.values(),
  ].slice(0, 80);

  const statuses =
    Object.values(dimensions);

  const verified =
    statuses.filter(
      (value) =>
        value === "verified"
    ).length;

  const observed =
    statuses.filter(
      (value) =>
        value ===
        "observed-reference"
    ).length;

  review.dimensions =
    dimensions;

  review.reportedDimensions = {
    ...dimensions,
  };

  review.reviewedAt =
    today;

  review.reviewCompletion =
    100;

  review.reviewEvidenceCoverage =
    Math.round(
      (
        100 *
        (
          verified +
          0.5 * observed
        )
      ) /
        8
    );

  review.officialSources =
    officialSources;

  review.officialSourceUrls =
    officialSources.map(
      (source) =>
        source.url
    );

  review.reviewOutcome =
    discoveredSources.length >
    0
      ? "خزش عمیق خودکار پرتال پژوهشی و اسناد رسمی انجام شد"
      : review.reviewOutcome;

  review.reviewNote =
    `خزش عمیق رسمی انجام شد؛ ${discoveredSources.length} شاهد جدید بالاتر از آستانه ${PROMOTE_THRESHOLD.toFixed(
      2
    )} برای انتشار بررسی شد. شبکه‌های اجتماعی از Evidence حذف شده‌اند.`;
}

// Final social cleanup after all merges.

audits = audits.map(cleanAudit);

reviews =
  reviews.map(cleanReview);

reaudit =
  reaudit.map(cleanReaudit);

units = units
  .map(cleanCatalogItem)
  .filter(Boolean);

systems = systems
  .map(cleanCatalogItem)
  .filter(Boolean);

documents = documents
  .map(cleanCatalogItem)
  .filter(Boolean);

// Make every document validator-safe.

documents = documents.map(
  (item) => ({
    ...item,

    topic:
      item.topic ||
      documentTopic(
        item.taxonomy ||
          "other",
        item.title || ""
      ),
  })
);

await fs.mkdir(
  "data/evidence",
  {
    recursive: true,
  }
);

await Promise.all([
  writeJson(
    "data/audit/portal-audit.json",
    audits
  ),

  writeJson(
    "data/evidence/research-review.json",
    reviews
  ),

  writeJson(
    "data/evidence/portal-document-reaudit.json",
    reaudit
  ),

  writeJson(
    "data/units/catalog.json",
    units
  ),

  writeJson(
    "data/systems/catalog.json",
    systems
  ),

  writeJson(
    "data/documents/catalog.json",
    documents
  ),
]);

console.log(
  [
    "discovery promotion complete",

    `threshold=${PROMOTE_THRESHOLD.toFixed(
      2
    )}`,

    `evidence=${evidence.length}`,

    `portals=${portalCandidates.length}`,

    `documents=${discoveredDocuments.length}`,

    `units=${units.length}`,

    `systems=${systems.length}`,

    `catalogDocs=${documents.length}`,

    "socialEvidence=removed",
  ].join(" | ")
);

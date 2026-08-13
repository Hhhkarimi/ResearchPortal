import fs from "node:fs";
import path from "node:path";

const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

const isc = read("data/isc/institutions.json");
const source = read("data/isc/source.json");
const audits = read("data/audit/portal-audit.json");
const deepAudits = read("data/audit/deep-audit-matrix.json");
const rankings = read("data/statistics/portal-ranking.json");
const units = read("data/units/catalog.json");
const systems = read("data/systems/catalog.json");
const documents = read("data/documents/catalog.json");
const packets = read("data/audit/packets-index.json");
const ledger = read("data/evidence/provenance-ledger.json");
const reviews = read("data/evidence/research-review.json");
const dimensionEvidence = read("data/evidence/dimension-evidence.json");
const portalDocumentReaudit = read("data/evidence/portal-document-reaudit.json");

const categories = {
  جامع: 69,
  صنعتی: 24,
  "علوم کشاورزی": 4,
  هنر: 4,
  زیرنظام: 4,
  "دستگاه اجرایی": 10,
};

const dimensions = [
  "portalIdentity",
  "organization",
  "libraryDocuments",
  "laboratories",
  "industryTechnology",
  "systemsServices",
  "documentsRegulations",
];

const statuses = [
  "verified",
  "observed-reference",
  "restricted",
  "unresolved",
];

const EXPECTED_INSTITUTIONS = 115;
const EXPECTED_DIMENSIONS = dimensions.length;
const EXPECTED_DIMENSION_OUTCOMES = EXPECTED_INSTITUTIONS * EXPECTED_DIMENSIONS;
const EXPECTED_RTPMI_VERSION = process.env.PIPELINE_METHODOLOGY_VERSION || "RTPMI-4.2-ISC";

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

function validUrl(value) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function urlObject(value) {
  try {
    const url = new URL(String(value ?? ""));
    return ["http:", "https:"].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

function canonicalUrl(value) {
  const url = urlObject(value);
  if (!url) return null;

  url.hash = "";
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");

  const parts = url.pathname.split("/").filter(Boolean);
  for (let index = 1; index < parts.length; index++) {
    if (
      /^(page|news|node|article)$/i.test(parts[index - 1]) &&
      /^\d+$/.test(parts[index])
    ) {
      url.pathname = `/${parts.slice(0, index + 1).join("/")}`;
      break;
    }
  }

  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  if (/^\/(fa|en|ar|fa-ir|en-us)$/i.test(url.pathname)) {
    url.pathname = "/";
  }

  const params = [...url.searchParams.entries()]
    .filter(
      ([key]) =>
        !key.toLowerCase().startsWith("utm_") &&
        !TRACKING_PARAMS.has(key.toLowerCase())
    )
    .sort(
      ([aKey, aValue], [bKey, bValue]) =>
        aKey.localeCompare(bKey) || aValue.localeCompare(bValue)
    );

  url.search = "";
  for (const [key, value] of params) url.searchParams.append(key, value);

  return url.toString();
}

function isInformationTechnologyText(value) {
  const text = normalizeText(value);
  if (!text) return false;

  return (
    /فناوری\s*اطلاعات/.test(text) ||
    /فن\s*آوری\s*اطلاعات/.test(text) ||
    /اطلاعات\s*و\s*ارتباطات/.test(text) ||
    /مرکز\s*فاوا/.test(text) ||
    /مدیریت\s*فاوا/.test(text) ||
    /\bفاوا\b/.test(text) ||
    /\binformation\s+technology\b/i.test(text) ||
    /\binformation\s+(and\s+)?communications?\s+technology\b/i.test(text) ||
    /\bict\b/i.test(text) ||
    /\bit\s+(center|department|office|unit|services?)\b/i.test(text) ||
    /\b(center|department|office|unit)\s+of\s+it\b/i.test(text)
  );
}

function isInformationTechnologyUrl(value) {
  const url = urlObject(value);
  if (!url) return false;

  const hostParts = url.hostname
    .toLowerCase()
    .replace(/^www\./, "")
    .split(".");

  if (
    hostParts.some((part) =>
      ["it", "ict", "cit", "fava", "faava"].includes(part)
    )
  ) {
    return true;
  }

  const pathParts = url.pathname
    .toLowerCase()
    .split("/")
    .filter(Boolean)
    .map((part) => decodeURIComponentSafe(part).replace(/[_-]+/g, " "));

  return (
    pathParts.some((part) =>
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
    ) || isInformationTechnologyText(decodeURIComponentSafe(url.toString()))
  );
}

function recordUrls(record) {
  return [
    record?.url,
    record?.sourceUrl,
    record?.parentUrl,
    record?.relationshipEvidenceUrl,
  ].filter(Boolean);
}

function isInformationTechnologyRecord(record) {
  if (!record || typeof record !== "object") return false;

  if (record.dimension === "informationTechnology") return true;
  if (normalizeText(record.type) === "it") return true;
  if (normalizeText(record.category) === "it") return true;

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
    isInformationTechnologyText(text) ||
    recordUrls(record).some(isInformationTechnologyUrl)
  );
}

function assertNoDuplicateUrls(label, values) {
  const seen = new Map();

  for (const value of (values || []).filter(Boolean)) {
    if (!validUrl(value)) continue;

    const key = canonicalUrl(value);
    if (!key) continue;

    if (seen.has(key)) {
      throw new Error(
        `Duplicate canonical URL in ${label}: ${value} duplicates ${seen.get(key)}`
      );
    }

    seen.set(key, value);
  }
}

function assertNoInformationTechnologyUrl(label, values) {
  for (const value of (values || []).filter(Boolean)) {
    if (isInformationTechnologyUrl(value)) {
      throw new Error(`IT URL must not be published in ${label}: ${value}`);
    }
  }
}

function titleOf(record) {
  return String(record?.nameFa || record?.title || "").trim();
}

function catalogKey(record) {
  const slug = record?.universitySlug || "unknown";
  const url = canonicalUrl(record?.url || record?.sourceUrl || record?.parentUrl);

  if (url) return `${slug}|url:${url}`;

  return [
    slug,
    "text",
    normalizeText(titleOf(record)),
    normalizeText(record?.type || record?.category || record?.topic || ""),
  ].join("|");
}

function assertNoDuplicateCatalogRecords(label, collection) {
  const seen = new Map();

  for (const record of collection) {
    const key = catalogKey(record);
    if (seen.has(key)) {
      throw new Error(
        `Duplicate canonical record in ${label}: ${record.id} duplicates ${seen.get(key)}`
      );
    }
    seen.set(key, record.id);
  }
}

function assertNoInformationTechnologyRecord(label, collection) {
  for (const record of collection) {
    if (isInformationTechnologyRecord(record)) {
      throw new Error(`IT record must not be published in ${label}: ${record.id ?? "unknown"}`);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Locked ISC scope                                                           */
/* -------------------------------------------------------------------------- */

if (isc.length !== EXPECTED_INSTITUTIONS) {
  throw new Error(`ISC scope must be ${EXPECTED_INSTITUTIONS}, got ${isc.length}`);
}

if (source.publicInstitutions !== EXPECTED_INSTITUTIONS) {
  throw new Error("ISC source metadata count mismatch");
}

for (const [category, expected] of Object.entries(categories)) {
  const actual = isc.filter((item) => item.category === category).length;

  if (actual !== expected) {
    throw new Error(`${category}: ${actual} != ${expected}`);
  }

  if (source.categories?.[category] !== expected) {
    throw new Error(`Source category ${category} mismatch`);
  }
}

const validSlugs = new Set(isc.map((item) => item.slug));
if (validSlugs.size !== EXPECTED_INSTITUTIONS) {
  throw new Error("Duplicate ISC slug");
}

for (const [name, collection] of [
  ["Audit", audits],
  ["Deep audit", deepAudits],
  ["Packet index", packets],
]) {
  if (
    collection.length !== EXPECTED_INSTITUTIONS ||
    new Set(collection.map((item) => item.universitySlug ?? item.slug)).size !==
      EXPECTED_INSTITUTIONS
  ) {
    throw new Error(`${name} must cover unique ${EXPECTED_INSTITUTIONS} ISC institutions`);
  }
}

for (const collection of [audits, deepAudits, units, systems, documents]) {
  for (const item of collection) {
    if (!validSlugs.has(item.universitySlug)) {
      throw new Error(`Record outside ISC: ${item.universitySlug}`);
    }
  }
}

if (audits.some((item) => item.portalAuditStatus === "unresolved-public-portal")) {
  throw new Error("A portal-resolution outcome is still missing");
}

/* -------------------------------------------------------------------------- */
/* Public IT removal                                                          */
/* -------------------------------------------------------------------------- */

if (dimensions.includes("informationTechnology")) {
  throw new Error("Removed IT dimension is still present in public dimension configuration");
}

for (const audit of audits) {
  if (audit.researchUrl && isInformationTechnologyUrl(audit.researchUrl)) {
    throw new Error(`IT research URL must not be published: ${audit.universitySlug}`);
  }

  assertNoInformationTechnologyUrl(
    `portal audit ${audit.universitySlug}`,
    audit.evidenceUrls || []
  );

  assertNoDuplicateUrls(
    `portal audit ${audit.universitySlug}`,
    audit.evidenceUrls || []
  );

  if (
    (audit.observedSignals || []).some((signal) =>
      ["it", "it-related", "informationtechnology", "information-technology"].includes(
        normalizeText(signal)
      )
    )
  ) {
    throw new Error(`IT observed signal must not be published: ${audit.universitySlug}`);
  }
}

assertNoInformationTechnologyRecord("units catalog", units);
assertNoInformationTechnologyRecord("systems catalog", systems);
assertNoInformationTechnologyRecord("documents catalog", documents);
assertNoInformationTechnologyRecord("provenance ledger", ledger);

assertNoDuplicateCatalogRecords("units catalog", units);
assertNoDuplicateCatalogRecords("systems catalog", systems);
assertNoDuplicateCatalogRecords("documents catalog", documents);

/* -------------------------------------------------------------------------- */
/* Audit packets                                                              */
/* -------------------------------------------------------------------------- */

const packetDirectory = "data/audit/packets";
const packetFiles = fs.readdirSync(packetDirectory).filter((file) => file.endsWith(".json"));

if (packetFiles.length !== EXPECTED_INSTITUTIONS) {
  throw new Error(`Expected ${EXPECTED_INSTITUTIONS} packet files, got ${packetFiles.length}`);
}

for (const slug of validSlugs) {
  if (!fs.existsSync(path.join(packetDirectory, `${slug}.json`))) {
    throw new Error(`Missing audit packet: ${slug}`);
  }
}

/* -------------------------------------------------------------------------- */
/* Rankings / RTPMI 4.2                                                       */
/* -------------------------------------------------------------------------- */

const auditsBySlug = new Map(audits.map((item) => [item.universitySlug, item]));
const deepBySlug = new Map(deepAudits.map((item) => [item.universitySlug, item]));

for (const ranking of rankings) {
  if (!validSlugs.has(ranking.universitySlug)) {
    throw new Error(`Rank outside ISC: ${ranking.universitySlug}`);
  }

  if (auditsBySlug.get(ranking.universitySlug)?.portalAuditStatus !== "direct-official") {
    throw new Error(`Rank without direct portal: ${ranking.universitySlug}`);
  }

  if ((deepBySlug.get(ranking.universitySlug)?.auditEvidenceCoverage ?? 0) < 75) {
    throw new Error(`Rank below audit coverage gate: ${ranking.universitySlug}`);
  }

  if (ranking.confidence < 65) {
    throw new Error(`Low-confidence numeric rank: ${ranking.universitySlug}`);
  }

  if (!Number.isFinite(ranking.score) || ranking.score < 0 || ranking.score > 100) {
    throw new Error(`Invalid RTPMI: ${ranking.universitySlug}`);
  }

  if (ranking.methodologyVersion !== EXPECTED_RTPMI_VERSION) {
    throw new Error(
      `Unexpected RTPMI methodology ${ranking.universitySlug}: ${ranking.methodologyVersion}`
    );
  }

  if (Object.prototype.hasOwnProperty.call(ranking.metrics || {}, "digital")) {
    throw new Error(`Legacy digital/IT RTPMI metric remains: ${ranking.universitySlug}`);
  }

  if (!Object.prototype.hasOwnProperty.call(ranking.metrics || {}, "systems")) {
    throw new Error(`RTPMI systems metric is missing: ${ranking.universitySlug}`);
  }

  if (Object.prototype.hasOwnProperty.call(ranking.metrics || {}, "informationTechnology")) {
    throw new Error(`IT RTPMI metric remains: ${ranking.universitySlug}`);
  }
}

/* -------------------------------------------------------------------------- */
/* Catalog integrity                                                          */
/* -------------------------------------------------------------------------- */

for (const item of [...units, ...systems, ...documents]) {
  if (
    ["verified", "verified-basic"].includes(item.evidence) &&
    !item.sourceUrl &&
    !item.parentUrl &&
    !item.url
  ) {
    throw new Error(`Evidence record without provenance URL: ${item.id}`);
  }
}

const catalogIds = [...units, ...systems, ...documents].map((item) => item.id);
if (new Set(catalogIds).size !== catalogIds.length) {
  throw new Error("Duplicate entity id across catalogs");
}

for (const document of documents) {
  if (!document.topic) {
    throw new Error(`Document without topic classification: ${document.id}`);
  }
}

/* -------------------------------------------------------------------------- */
/* Provenance                                                                 */
/* -------------------------------------------------------------------------- */

for (const item of ledger) {
  if (!validSlugs.has(item.universitySlug)) {
    throw new Error(`Provenance outside ISC: ${item.universitySlug}`);
  }

  if (!item.sourceUrl) {
    throw new Error(`Provenance without sourceUrl: ${item.id}`);
  }

  if (!validUrl(item.sourceUrl)) {
    throw new Error(`Invalid provenance URL: ${item.id}`);
  }

  if (isInformationTechnologyUrl(item.sourceUrl)) {
    throw new Error(`IT provenance URL must not be published: ${item.id}`);
  }
}

/* -------------------------------------------------------------------------- */
/* 115 × 7 dimension evidence                                                 */
/* -------------------------------------------------------------------------- */

if (dimensionEvidence.length !== EXPECTED_DIMENSION_OUTCOMES) {
  throw new Error(
    `Dimension evidence must cover ${EXPECTED_DIMENSION_OUTCOMES} outcomes, got ${dimensionEvidence.length}`
  );
}

if (new Set(dimensionEvidence.map((item) => item.id)).size !== EXPECTED_DIMENSION_OUTCOMES) {
  throw new Error("Duplicate dimension evidence id");
}

if (dimensionEvidence.some((item) => item.dimension === "informationTechnology")) {
  throw new Error("Removed IT dimension must not be published");
}

if (reviews.length !== EXPECTED_INSTITUTIONS || new Set(reviews.map((item) => item.universitySlug)).size !== EXPECTED_INSTITUTIONS) {
  throw new Error(`Research review must cover unique ${EXPECTED_INSTITUTIONS} ISC institutions`);
}

for (const review of reviews) {
  if (Object.prototype.hasOwnProperty.call(review.dimensions || {}, "informationTechnology")) {
    throw new Error(`IT review dimension remains: ${review.universitySlug}`);
  }

  if (Object.prototype.hasOwnProperty.call(review.reportedDimensions || {}, "informationTechnology")) {
    throw new Error(`IT reported review dimension remains: ${review.universitySlug}`);
  }

  assertNoInformationTechnologyUrl(
    `research review ${review.universitySlug}`,
    review.officialSourceUrls || []
  );

  assertNoDuplicateUrls(
    `research review ${review.universitySlug}`,
    review.officialSourceUrls || []
  );

  const officialSourceUrls = (review.officialSources || []).map((item) => item.url).filter(Boolean);
  assertNoInformationTechnologyUrl(
    `research review officialSources ${review.universitySlug}`,
    officialSourceUrls
  );
  assertNoDuplicateUrls(
    `research review officialSources ${review.universitySlug}`,
    officialSourceUrls
  );
}

/* -------------------------------------------------------------------------- */
/* Portal/document re-audit                                                   */
/* -------------------------------------------------------------------------- */

if (
  portalDocumentReaudit.length !== EXPECTED_INSTITUTIONS ||
  new Set(portalDocumentReaudit.map((item) => item.slug)).size !== EXPECTED_INSTITUTIONS
) {
  throw new Error(
    `Portal/document re-audit must cover unique ${EXPECTED_INSTITUTIONS} ISC institutions`
  );
}

if (portalDocumentReaudit.find((item) => item.slug === "bojnord")?.portalUrls?.[0] !== "https://vr.ub.ac.ir/") {
  throw new Error("University of Bojnord official R&T portal correction is missing");
}

for (const row of portalDocumentReaudit) {
  if (Object.prototype.hasOwnProperty.call(row, "informationTechnologyUrls")) {
    throw new Error(`IT re-audit field must not be published: ${row.slug}`);
  }

  const arrays = {
    portalUrls: row.portalUrls || [],
    organizationUrls: row.organizationUrls || [],
    libraryUrls: row.libraryUrls || [],
    laboratoryUrls: row.laboratoryUrls || [],
    industryTechnologyUrls: row.industryTechnologyUrls || [],
    systemsUrls: row.systemsUrls || [],
    documentIndexUrls: row.documentIndexUrls || [],
    directDocumentUrls: (row.directDocuments || []).map((item) => item.url).filter(Boolean),
  };

  for (const [key, values] of Object.entries(arrays)) {
    for (const url of values) {
      if (!validUrl(url)) {
        throw new Error(`Invalid re-audit URL ${row.slug}:${key}: ${url}`);
      }
    }

    assertNoInformationTechnologyUrl(`re-audit ${row.slug}:${key}`, values);
    assertNoDuplicateUrls(`re-audit ${row.slug}:${key}`, values);
  }
}

for (const row of portalDocumentReaudit) {
  const review = reviews.find((item) => item.universitySlug === row.slug);
  const roots = new Set((row.portalUrls || []).map(canonicalUrl).filter(Boolean));

  const checks = {
    organization: "organizationUrls",
    libraryDocuments: "libraryUrls",
    laboratories: "laboratoryUrls",
    industryTechnology: "industryTechnologyUrls",
    systemsServices: "systemsUrls",
  };

  for (const [dimension, key] of Object.entries(checks)) {
    const values = row[key] || [];

    if (
      values.length &&
      values.every((url) => roots.has(canonicalUrl(url))) &&
      review?.dimensions?.[dimension] === "verified"
    ) {
      throw new Error(`Portal root incorrectly promoted to verified ${row.slug}:${dimension}`);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Per-university evidence consistency                                        */
/* -------------------------------------------------------------------------- */

for (const slug of validSlugs) {
  const rows = dimensionEvidence.filter((item) => item.universitySlug === slug);
  const review = reviews.find((item) => item.universitySlug === slug);

  if (
    rows.length !== EXPECTED_DIMENSIONS ||
    new Set(rows.map((item) => item.dimension)).size !== EXPECTED_DIMENSIONS
  ) {
    throw new Error(`Dimension evidence incomplete for ${slug}`);
  }

  if (
    !review ||
    Object.keys(review.dimensions || {}).length !== EXPECTED_DIMENSIONS ||
    Object.keys(review.reportedDimensions || {}).length !== EXPECTED_DIMENSIONS ||
    review.reviewCompletion !== 100
  ) {
    throw new Error(`Review incomplete for ${slug}`);
  }

  for (const row of rows) {
    if (!dimensions.includes(row.dimension)) {
      throw new Error(`Invalid dimension ${row.id}`);
    }

    if (!statuses.includes(row.status) || !statuses.includes(row.reportedStatus)) {
      throw new Error(`Invalid evidence status ${row.id}`);
    }

    if (review.dimensions[row.dimension] !== row.status) {
      throw new Error(`Review/register status mismatch ${row.id}`);
    }

    if (row.sourceCount !== row.sources.length) {
      throw new Error(`Source count mismatch ${row.id}`);
    }

    const sourceUrls = row.sources.map((item) => item.url).filter(Boolean);

    for (const item of row.sources) {
      if (!validUrl(item.url)) {
        throw new Error(`Invalid dimension evidence URL ${row.id}`);
      }

      if (isInformationTechnologyRecord(item)) {
        throw new Error(`IT dimension source must not be published ${row.id}: ${item.url}`);
      }
    }

    assertNoDuplicateUrls(`dimension evidence ${row.id}`, sourceUrls);
    assertNoInformationTechnologyUrl(`dimension evidence ${row.id}`, sourceUrls);

    if (
      row.status === "verified" &&
      !row.sources.some((item) => item.kind !== "research-review-reference")
    ) {
      throw new Error(`Verified dimension without dimension-specific source ${row.id}`);
    }

    if (row.status === "verified" && row.publicationAdjustment) {
      throw new Error(`Adjusted outcome cannot remain verified ${row.id}`);
    }

    if (row.status === "restricted" && !row.sources.length) {
      throw new Error(`Restricted outcome without attempted official URL ${row.id}`);
    }
  }

  const verified = rows.filter((item) => item.status === "verified").length;
  const observed = rows.filter((item) => item.status === "observed-reference").length;
  const expectedCoverage = Math.round(
    (100 * (verified + 0.5 * observed)) / EXPECTED_DIMENSIONS
  );

  if (review.reviewEvidenceCoverage !== expectedCoverage) {
    throw new Error(
      `Evidence coverage mismatch ${slug}: ${review.reviewEvidenceCoverage} != ${expectedCoverage}`
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Deep audit consistency                                                     */
/* -------------------------------------------------------------------------- */

for (const row of deepAudits) {
  if (Object.prototype.hasOwnProperty.call(row.dimensions || {}, "informationTechnology")) {
    throw new Error(`IT deep-audit dimension remains: ${row.universitySlug}`);
  }

  if (Object.keys(row.dimensions || {}).length !== EXPECTED_DIMENSIONS) {
    throw new Error(`Deep-audit dimension count mismatch: ${row.universitySlug}`);
  }

  for (const dimension of dimensions) {
    if (!statuses.includes(row.dimensions?.[dimension])) {
      throw new Error(`Invalid deep-audit status ${row.universitySlug}:${dimension}`);
    }
  }

  const resolved = Object.values(row.dimensions).filter((value) =>
    ["verified", "restricted"].includes(value)
  ).length;
  const observed = Object.values(row.dimensions).filter(
    (value) => value === "observed-reference"
  ).length;
  const expectedCoverage = Math.round(
    (100 * (resolved + 0.5 * observed)) / EXPECTED_DIMENSIONS
  );

  if (row.auditEvidenceCoverage !== expectedCoverage) {
    throw new Error(
      `Deep-audit coverage mismatch ${row.universitySlug}: ${row.auditEvidenceCoverage} != ${expectedCoverage}`
    );
  }
}

/* -------------------------------------------------------------------------- */
/* CSV/public-output guards                                                   */
/* -------------------------------------------------------------------------- */

const requiredCsv = [
  "data/isc/institutions.csv",
  "data/audit/portal-audit.csv",
  "data/audit/deep-audit-matrix.csv",
  "data/audit/packets-index.csv",
  "data/statistics/portal-ranking.csv",
  "data/units/catalog.csv",
  "data/systems/catalog.csv",
  "data/documents/catalog.csv",
  "data/evidence/dimension-evidence.csv",
];

for (const file of requiredCsv) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing CSV export: ${file}`);
  }
}

const deepCsvHeader = fs.readFileSync("data/audit/deep-audit-matrix.csv", "utf8").split(/\r?\n/, 1)[0];
if (deepCsvHeader.includes("dimension_informationTechnology")) {
  throw new Error("Legacy IT dimension column remains in deep-audit CSV");
}

const rankingCsvHeader = fs.readFileSync("data/statistics/portal-ranking.csv", "utf8").split(/\r?\n/, 1)[0];
if (rankingCsvHeader.includes("metric_digital")) {
  throw new Error("Legacy digital/IT metric column remains in ranking CSV");
}
if (!rankingCsvHeader.includes("metric_systems")) {
  throw new Error("RTPMI systems metric column is missing from ranking CSV");
}

const publicDimensionFile = "public/datasets/evidence-dimension-evidence.json";
if (fs.existsSync(publicDimensionFile)) {
  const publicDimensions = read(publicDimensionFile);

  if (publicDimensions.length !== EXPECTED_DIMENSION_OUTCOMES) {
    throw new Error(
      `Published dimension dataset must contain ${EXPECTED_DIMENSION_OUTCOMES} outcomes, got ${publicDimensions.length}`
    );
  }

  if (publicDimensions.some((item) => item.dimension === "informationTechnology")) {
    throw new Error("IT dimension remains in published dimension dataset");
  }
}

const statusCounts = Object.fromEntries(
  statuses.map((status) => [
    status,
    dimensionEvidence.filter((item) => item.status === status).length,
  ])
);

console.log(
  `ISC 115/115 | research review 115/115 | dimension outcomes ${EXPECTED_DIMENSION_OUTCOMES}/${EXPECTED_DIMENSION_OUTCOMES} | dimensions ${EXPECTED_DIMENSIONS} | evidence ${JSON.stringify(statusCounts)} | packets 115/115 | ranked ${rankings.length} | unranked ${EXPECTED_INSTITUTIONS - rankings.length} | units ${units.length} | systems ${systems.length} | docs ${documents.length} | provenance ${ledger.length} | IT removed | canonical duplicates blocked`
);

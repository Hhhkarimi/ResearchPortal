import fs from "node:fs/promises";

import {
  classifyCatalogRecord,
  logicalEntityKey,
  normalizeEntityText,
} from "./entity-cleaning-policy.mjs";

const readJson = async (file, fallback) => {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
};

const [units, systems, documents, reaudit, references, report] = await Promise.all([
  readJson("data/units/catalog.json", []),
  readJson("data/systems/catalog.json", []),
  readJson("data/documents/catalog.json", []),
  readJson("data/evidence/portal-document-reaudit.json", []),
  readJson("data/generated/reference-pages.json", []),
  readJson("data/generated/entity-cleaning-report.json", null),
]);

const failures = [];

function validateCatalog(rows, kind, allowedEntityTypes) {
  const seen = new Map();

  for (const row of rows) {
    const classification = classifyCatalogRecord(row, kind);

    if (!classification.keep) {
      failures.push(`${kind}: leaked ${classification.entityType} | ${row.universitySlug} | ${row.nameFa || row.title || row.url || row.id}`);
    }

    if (!allowedEntityTypes.includes(row.entityType)) {
      failures.push(`${kind}: invalid entityType=${row.entityType || "missing"} | ${row.universitySlug} | ${row.id}`);
    }

    const key = logicalEntityKey(row);
    if (seen.has(key)) {
      failures.push(`${kind}: logical duplicate | ${key} | ${seen.get(key)} <> ${row.id}`);
    } else {
      seen.set(key, row.id);
    }
  }
}

validateCatalog(units, "units", ["unit"]);
validateCatalog(systems, "systems", ["system", "external-system"]);
validateCatalog(documents, "documents", ["document"]);

for (const row of reaudit) {
  if ("informationTechnologyUrls" in row) {
    failures.push(`reaudit: informationTechnologyUrls still present | ${row.slug}`);
  }

  for (const item of row.documentIndexTopics || []) {
    if (!item.url || !item.topicDimension || item.topicDimension === "documentsRegulations") {
      failures.push(`reaudit: invalid documentIndexTopics | ${row.slug} | ${JSON.stringify(item)}`);
    }
  }
}

const badUnitTitle =
  /^(?:فرم|آیین[\s‌-]*نامه|آئین[\s‌-]*نامه|شیوه[\s‌-]*نامه|دستورالعمل|اطلاعیه|خبر|وبینار|رونمایی|تور\s*مجازی|شرایط\s*تسویه|جامعه\s*کاربران|کارکنان|همکاران|معرفی\s*مدیر)|کتابخانه\s*2\.0|ثنا/iu;

for (const unit of units) {
  const title = normalizeEntityText(unit.nameFa || unit.title);
  let decodedUnitUrl = [unit.url, unit.sourceUrl, unit.parentUrl].filter(Boolean).join(" ");
  try { decodedUnitUrl = decodeURIComponent(decodedUnitUrl); } catch {}
  if (unit.discoveredBy === "research-deep-discovery" && /\/(?:همه[-_\s‌]*اخبار|اخبار|خبرها|رویدادها|news|article|event|announcement)(?:\/|\?|$)/iu.test(decodedUnitUrl)) {
    failures.push(`units: news/content path survived cleaning | ${unit.universitySlug} | ${unit.nameFa || unit.title || unit.id}`);
  }
  if (!title) {
    failures.push(`units: display label missing | ${unit.universitySlug} | ${unit.id}`);
  }
  if (badUnitTitle.test(title)) {
    failures.push(`units: content/service page leaked as unit | ${unit.universitySlug} | ${unit.nameFa || unit.title}`);
  }
  if (/کتابخانه\s*مرکزی.*کتابخانه\s*مرکزی/iu.test(title)) {
    failures.push(`units: repeated central-library display label | ${unit.universitySlug} | ${unit.nameFa || unit.title}`);
  }
  if (/کتابخانه\s*مرکزی.*(?:معاونت\s*پژوهش\s*و\s*فناوری\s*)?(?:فارسی|english)\s*$/iu.test(title)) {
    failures.push(`units: site/language chrome remained in display label | ${unit.universitySlug} | ${unit.nameFa || unit.title}`);
  }
}

const badSystemTitle =
  /راهنما.*سامانه|مشاهده.*در\s*سامانه|اطلاعیه.*سامانه|پژوهشکده.*سامانه|پیشخوان.*اداری.*مالی|سامانه\s*منابع\s*انسانی|شرکت\s*سامانه\s*ساز|\bguide.*system\b|\bannouncement.*system\b/iu;

for (const system of systems) {
  const title = normalizeEntityText(system.nameFa || system.title);
  let systemHost = null;
  try { systemHost = new URL(String(system.url || "")).hostname.toLowerCase().replace(/^www\./, ""); } catch {}
  const forbiddenExternalSystemHost = systemHost && (
    systemHost === "msrt.ir" || systemHost.endsWith(".msrt.ir") ||
    systemHost === "isc.ac" || systemHost.endsWith(".isc.ac") ||
    ["sate.atf.gov.ir", "nan.ac", "gigalib.org", "gigalib.ir", "gigapaper.ir", "megapaper.ir"].includes(systemHost)
  );
  const forbiddenExternalSystemBrand = /گیگا[\s\u200c-]*لیب|گیگا[\s\u200c-]*پیپر|مگا[\s\u200c-]*پیپر|مگاپیپر|\bgiga[\s-]*lib\b|\bgiga[\s-]*paper\b|\bmega[\s-]*paper\b/iu.test(title);
  if (forbiddenExternalSystemHost || forbiddenExternalSystemBrand || system.relation === "national-related-system") {
    failures.push(`systems: shared external service counted as university system | ${system.universitySlug} | ${system.nameFa || system.title || system.url}`);
  }
  if (!system.url) {
    failures.push(`systems: endpoint URL missing | ${system.universitySlug} | ${system.nameFa || system.title}`);
  }
  if (badSystemTitle.test(title)) {
    failures.push(`systems: non-research/non-endpoint page leaked as system | ${system.universitySlug} | ${system.nameFa || system.title}`);
  }
}

const sameHostContentSystem =
  /\/(?:organizational-structure|research-and-technology|units?|management|about|page|pages|news|article|announcement|announcements|guide|guides|forms?|regulations?)(?:\/|[?#]|$)/iu;

function hostOf(value) {
  try { return new URL(String(value || "")).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return null; }
}

const MULTI_LABEL_PUBLIC_SUFFIXES = new Set([
  "ac.ir", "gov.ir", "org.ir", "co.ir", "net.ir", "sch.ir", "id.ir",
  "ac.uk", "co.uk", "org.uk", "gov.uk",
]);

function institutionalDomain(value) {
  const host = hostOf(value);
  if (!host) return null;
  const parts = host.split(".").filter(Boolean);
  if (parts.length < 2) return parts.join(".") || null;
  const lastTwo = parts.slice(-2).join(".");
  return MULTI_LABEL_PUBLIC_SUFFIXES.has(lastTwo) && parts.length >= 3
    ? parts.slice(-3).join(".")
    : lastTwo;
}

function sameInstitutionDomain(a, b) {
  const ad = institutionalDomain(a);
  const bd = institutionalDomain(b);
  return Boolean(ad && bd && ad === bd);
}

for (const system of systems) {
  if (system.entityType === "external-system" && system.url && (system.sourceUrl || system.parentUrl) && sameInstitutionDomain(system.url, system.sourceUrl || system.parentUrl)) {
    failures.push(`systems: university subdomain mislabeled external-system | ${system.universitySlug} | ${system.url}`);
  }
  if (system.entityType === "system" && system.ownershipScope && system.ownershipScope !== "university") {
    failures.push(`systems: internal system has non-university ownership scope | ${system.universitySlug} | ${system.url || system.nameFa}`);
  }
  const targetHost = hostOf(system.url);
  const sourceHost = hostOf(system.sourceUrl || system.parentUrl);
  const sameHost = targetHost && sourceHost && targetHost === sourceHost;
  const appLike = /\/(?:login|signin|sign-in|auth|oauth|app|apps|application|dashboard|panel|portal|sso)(?:\/|[?#]|$)/iu.test(String(system.url || ""));
  let decodedTarget = String(system.url || "");
  try { decodedTarget = decodeURIComponent(decodedTarget); } catch {}
  if (sameHost && sameHostContentSystem.test(decodedTarget) && !appLike && !["unit-service", "managed-by-portal", "system-endpoint"].includes(system.relation)) {
    failures.push(`systems: same-host content page leaked as endpoint | ${system.universitySlug} | ${system.nameFa || system.title}`);
  }

  for (const alt of system.alternateUrls || []) {
    const altHost = hostOf(alt);
    if (!altHost) {
      failures.push(`systems: invalid alternateUrl | ${system.universitySlug} | ${alt}`);
      continue;
    }
    if (sourceHost && altHost === sourceHost && String(alt).replace(/\/+$/, "") === `https://${sourceHost}`) {
      failures.push(`systems: source/root URL leaked into alternateUrls | ${system.universitySlug} | ${alt}`);
    }
  }
}

const genericDocumentTitle = new Set([
  "", "دانلود", "دانلود فایل", "دریافت فایل", "مشاهده فایل",
  "فایل", "سند", "سند پژوهشی", "download", "download file", "file", "document",
]);

for (const document of documents) {
  if (genericDocumentTitle.has(normalizeEntityText(document.title))) {
    failures.push(`documents: generic title remained | ${document.universitySlug} | ${document.id}`);
  }
  if (document.primaryDimension && document.primaryDimension !== "documentsRegulations") {
    failures.push(`documents: invalid primaryDimension | ${document.universitySlug} | ${document.id} | ${document.primaryDimension}`);
  }
}

for (const ref of references) {
  if (ref.entityType === "document-index") {
    if ((ref.primaryDimension || ref.dimension) !== "documentsRegulations") {
      failures.push(`references: document-index escaped documentsRegulations | ${ref.universitySlug} | ${ref.url}`);
    }
  }
}

for (const ref of references) {
  let refHost = null;
  try { refHost = new URL(String(ref.url || "")).hostname.toLowerCase().replace(/^www\./, ""); } catch {}
  const knownExternalReference = refHost && (
    refHost === "msrt.ir" || refHost.endsWith(".msrt.ir") ||
    refHost === "isc.ac" || refHost.endsWith(".isc.ac") ||
    ["sate.atf.gov.ir", "nan.ac", "gigalib.org", "gigalib.ir", "gigapaper.ir", "megapaper.ir"].includes(refHost)
  );
  if (knownExternalReference || ref.ownershipScope === "commercial-external" || ref.ownershipScope === "national-shared" || ref.ownershipScope === "ministry-national") {
    if (ref.entityType !== "external-service" || ref.relation !== "links-to") {
      failures.push(`references: external-service ownership classification invalid | ${ref.universitySlug} | ${JSON.stringify(ref)}`);
    }
    if (ref.countTowardUniversitySystems !== false || ref.countTowardRTPMI !== false) {
      failures.push(`references: external service must not count toward university systems/RTPMI | ${ref.universitySlug} | ${ref.url}`);
    }
  }
  if (["shaa.msrt.ir", "emshaa.msrt.ir"].includes(refHost) && ref.dimension !== "laboratories") {
    failures.push(`references: SHAA must remain laboratory-context evidence | ${ref.universitySlug} | ${ref.url}`);
  }
}

const lorestanSystemLeaks = systems.filter((item) =>
  item.universitySlug === "lorestan" &&
  /راهنمای\s*سامانه[\s‌-]*های\s*کتابخانه\s*مرکزی|مشاهده\s*پژوهانه.*سامانه\s*گلستان|راهنمای\s*استفاده\s*از\s*گرنت.*سامانه\s*گلستان|سامانه\s*ثبت\s*اختراع/iu.test(String(item.nameFa || item.title || ""))
);
for (const item of lorestanSystemLeaks) {
  failures.push(`lorestan golden case: non-endpoint remained in systems | ${item.nameFa || item.title}`);
}

const lorestanCentralLibraries = units.filter((item) =>
  item.universitySlug === "lorestan" &&
  /کتابخانه\s*مرکزی|central\s+library/iu.test(String(item.nameFa || item.title || ""))
);
if (lorestanCentralLibraries.length > 1) {
  failures.push(`lorestan golden case: central library was not logically merged | count=${lorestanCentralLibraries.length}`);
}

const knownUnitLeakPatterns = [
  ["arak", /%da%a9%d8%aa%d8%a7%d8%a8%d8%ae%d8%a7%d9%86%d9%87/iu],
  ["semnan", /برگ\s*افتخار.*کتابخانه\s*مرکزی/iu],
  ["tehran", /گزارش\s*خبرگزاری.*کتابخانه\s*مرکزی/iu],
];
for (const [slug, pattern] of knownUnitLeakPatterns) {
  for (const unit of units.filter((item) => item.universitySlug === slug)) {
    if (pattern.test(String(unit.nameFa || unit.title || ""))) {
      failures.push(`golden unit leak remained | ${slug} | ${unit.nameFa || unit.title}`);
    }
  }
}

const tehranCentralLibraries = units.filter((item) =>
  item.universitySlug === "tehran" &&
  /کتابخانه\s*مرکزی|central\s+library/iu.test(String(item.nameFa || item.title || ""))
);
if (tehranCentralLibraries.length > 1) {
  failures.push(`tehran golden case: central library was not logically merged | count=${tehranCentralLibraries.length}`);
}

if (!report) failures.push("entity cleaning report is missing");
if (report?.schemaVersion !== 2) failures.push(`entity cleaning report schemaVersion must be 2, got ${report?.schemaVersion}`);
if (report?.policyVersion !== "entity-cleaning-2.2.6-institutional-domain-ownership") failures.push(`unexpected cleaning policy version: ${report?.policyVersion}`);
if (!references.length) failures.push("reference-pages is empty; cleaning stage probably did not run");

if (failures.length) {
  throw new Error([
    `Entity catalog validation v2.2.6 failed: ${failures.length}`,
    ...failures.slice(0, 100),
  ].join("\n"));
}

console.log([
  "entity catalog validation v2.2.6 passed",
  `units=${units.length}`,
  `systems=${systems.length}`,
  `documents=${documents.length}`,
  `references=${references.length}`,
  `reaudit=${reaudit.length}`,
  "lorestan-golden-guards=passed",
].join(" | "));

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

const [
  units,
  systems,
  documents,
  reaudit,
  references,
  report,
] = await Promise.all([
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
      failures.push(
        `${kind}: leaked ${classification.entityType} | ${row.universitySlug} | ${row.nameFa || row.title || row.url || row.id}`
      );
    }

    if (!allowedEntityTypes.includes(row.entityType)) {
      failures.push(
        `${kind}: invalid entityType=${row.entityType || "missing"} | ${row.universitySlug} | ${row.id}`
      );
    }

    const key = logicalEntityKey(row);
    if (seen.has(key)) {
      failures.push(
        `${kind}: logical duplicate | ${key} | ${seen.get(key)} <> ${row.id}`
      );
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
    failures.push(
      `reaudit: informationTechnologyUrls still present | ${row.slug}`
    );
  }
}

const badSystemTitle =
  /راهنما.*سامانه|مشاهده.*در\s*سامانه|اطلاعیه.*سامانه|\bguide.*system\b|\bannouncement.*system\b/iu;

for (const system of systems) {
  const title = normalizeEntityText(system.nameFa || system.title);
  if (badSystemTitle.test(title) && system.discoveredBy === "research-deep-discovery") {
    failures.push(
      `systems: guide/announcement leaked as system | ${system.universitySlug} | ${system.nameFa || system.title}`
    );
  }
}

const genericDocumentTitle = new Set([
  "", "دانلود", "دانلود فایل", "دریافت فایل",
  "مشاهده فایل", "فایل", "سند", "سند پژوهشی",
  "download", "download file", "file", "document",
]);

for (const document of documents) {
  if (genericDocumentTitle.has(normalizeEntityText(document.title))) {
    failures.push(
      `documents: generic title remained | ${document.universitySlug} | ${document.id}`
    );
  }
}

const lorestanSystemLeaks = systems.filter(
  (item) =>
    item.universitySlug === "lorestan" &&
    /راهنمای\s*سامانه[\s‌-]*های\s*کتابخانه\s*مرکزی|مشاهده\s*پژوهانه.*سامانه\s*گلستان|راهنمای\s*استفاده\s*از\s*گرنت.*سامانه\s*گلستان/iu.test(
      String(item.nameFa || item.title || "")
    )
);

for (const item of lorestanSystemLeaks) {
  failures.push(
    `lorestan golden case: non-system page remained in systems | ${item.nameFa || item.title}`
  );
}

if (!report) {
  failures.push("entity cleaning report is missing");
}

if (!references.length) {
  failures.push("reference-pages is empty; cleaning stage probably did not run");
}

if (failures.length) {
  throw new Error(
    [
      `Entity catalog validation failed: ${failures.length}`,
      ...failures.slice(0, 80),
    ].join("\n")
  );
}

console.log(
  [
    "entity catalog validation passed",
    `units=${units.length}`,
    `systems=${systems.length}`,
    `documents=${documents.length}`,
    `references=${references.length}`,
    `reaudit=${reaudit.length}`,
    "lorestan-golden-guards=passed",
  ].join(" | ")
);

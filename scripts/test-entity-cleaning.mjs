import assert from "node:assert/strict";

import {
  classifyCatalogRecord,
  enrichCatalogRecord,
  inferDimension,
} from "./entity-cleaning-policy.mjs";

const cases = [
  {
    name: "Lorestan library guide is not a research system",
    kind: "systems",
    record: {
      universitySlug: "lorestan",
      nameFa: "دانشگاه لرستان راهنمای سامانه های کتابخانه مرکزی",
      category: "library",
      url: "https://research.lu.ac.ir/واحدها/کتابخانه/راهنمای-سامانه-های-کتابخانه-مرکزی/",
      sourceUrl: "https://research.lu.ac.ir/",
      relation: "research-portal-discovery",
      discoveredBy: "research-deep-discovery",
    },
    keep: false,
    entityType: "guide",
    dimension: "libraryDocuments",
  },
  {
    name: "Lorestan Golestan grant guide is not a system",
    kind: "systems",
    record: {
      universitySlug: "lorestan",
      nameFa: "راهنمای استفاده از گرنت در سامانه گلستان | اطلاعیه های معاونت پژوهش و فناوری",
      category: "research",
      url: "https://research.lu.ac.ir/اطلاعیه-ها/راهنمای-استفاده-از-گرنت-در-سامانه-گلستان/",
      sourceUrl: "https://research.lu.ac.ir/",
      relation: "research-portal-discovery",
      discoveredBy: "research-deep-discovery",
    },
    keep: false,
    entityType: "announcement",
  },
  {
    name: "Trusted external scientometrics endpoint remains a system",
    kind: "systems",
    record: {
      universitySlug: "kharazmi",
      nameFa: "سامانه علم‌سنجی",
      category: "research",
      url: "https://scimet.khu.ac.ir/",
      sourceUrl: "https://research.khu.ac.ir/",
      relation: "unit-service",
      evidence: "verified",
    },
    keep: true,
    entityType: "external-system",
  },
  {
    name: "Forms and regulations collection is reference page, not document",
    kind: "documents",
    record: {
      universitySlug: "lorestan",
      title: "فرم‌ها و آیین‌نامه‌ها",
      url: "https://research.lu.ac.ir/ساختار-سازمانی/فرم-ها-و-آیین-نامه-ها/",
      discoveredBy: "research-deep-discovery",
    },
    keep: false,
    entityType: "document-index",
  },
  {
    name: "Direct PDF remains document",
    kind: "documents",
    record: {
      universitySlug: "lorestan",
      title: "دانلود فایل",
      url: "https://research.lu.ac.ir/files/research-grant-guideline.pdf",
      fileName: "research-grant-guideline.pdf",
      contentType: "application/pdf",
      discoveredBy: "research-deep-discovery",
    },
    keep: true,
    entityType: "document",
  },
  {
    name: "Library page does not stay in organization dimension",
    dimensionOnly: true,
    record: {
      universitySlug: "lorestan",
      nameFa: "کتابخانه مرکزی",
      url: "https://research.lu.ac.ir/واحدها/کتابخانه/",
    },
    dimension: "libraryDocuments",
  },
];

for (const test of cases) {
  if (test.dimensionOnly) {
    const dimension = inferDimension(test.record, "organization");
    assert.equal(dimension, test.dimension, test.name);
    console.log(`PASS | ${test.name} | dimension=${dimension}`);
    continue;
  }

  const result = classifyCatalogRecord(test.record, test.kind);
  assert.equal(result.keep, test.keep, `${test.name}: keep`);
  assert.equal(result.entityType, test.entityType, `${test.name}: entityType`);
  if (test.dimension) {
    assert.equal(result.dimension, test.dimension, `${test.name}: dimension`);
  }

  const suffix = result.keep
    ? ` | ${JSON.stringify(enrichCatalogRecord(test.record, test.kind, result))}`
    : "";

  console.log(
    `PASS | ${test.name} | keep=${result.keep} | entityType=${result.entityType} | dimension=${result.dimension}${suffix}`
  );
}

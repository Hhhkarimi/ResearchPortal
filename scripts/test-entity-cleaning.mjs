import assert from "node:assert/strict";

import {
  classifyCatalogRecord,
  enrichCatalogRecord,
  inferDimension,
  logicalEntityKey,
  mergeLogicalRecords,
} from "./entity-cleaning-policy.mjs";
import {scoreCoverageAdjustment, scoreFindability, scoreIndustryTechnology} from "./rtpmi-scoring-policy.mjs";

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
    name: "Research institute whose title contains system is not a system endpoint",
    kind: "systems",
    record: {
      universitySlug: "amirkabir",
      nameFa: "پژوهشکده سامانه ها و مکانیزم های صنعتی پیشرفته",
      url: "https://aism.aut.ac.ir/",
      sourceUrl: "https://aut.ac.ir/",
      relation: "research-portal-discovery",
      discoveredBy: "research-deep-discovery",
    },
    keep: false,
    entityType: "unit-reference",
  },
  {
    name: "Administrative financial dashboard is not a research system",
    kind: "systems",
    record: {
      universitySlug: "vali-asr-rafsanjan",
      nameFa: "پیشخوان برنامه های اداری و مالی",
      url: "https://bam.vru.ac.ir/",
      sourceUrl: "https://vru.ac.ir/",
      relation: "research-portal-discovery",
      discoveredBy: "research-deep-discovery",
    },
    keep: false,
  },
  {
    name: "Lorestan patent registration CMS page is not a system endpoint",
    kind: "systems",
    record: {
      universitySlug: "lorestan",
      nameFa: "Lorestan University Patent Registration System",
      category: "innovation",
      url: "https://research.lu.ac.ir/en/research-and-technology/organizational-structure/research-affairs-management/patent-registration-system/",
      sourceUrl: "https://research.lu.ac.ir/ساختار-سازمانی/مدیریت-امور-پژوهشی/نحوه-ثبت-اختراع/سامانه-ثبت-اختراع/",
      relation: "research-portal-discovery",
      evidence: "verified",
      discoveredBy: "research-deep-discovery",
    },
    keep: false,
    entityType: "service-page",
  },
  {
    name: "Same-host research login application can remain a system endpoint",
    kind: "systems",
    record: {
      universitySlug: "example",
      nameFa: "سامانه مدیریت طرح های پژوهشی",
      category: "research",
      url: "https://research.example.ac.ir/app/login",
      sourceUrl: "https://research.example.ac.ir/سامانه-های-پژوهشی/",
      relation: "research-portal-discovery",
      evidence: "verified",
      discoveredBy: "research-deep-discovery",
    },
    keep: true,
    entityType: "system",
  },
  {
    name: "System label without target endpoint stays reference-only",
    kind: "systems",
    record: {
      universitySlug: "allameh",
      nameFa: "سامانه اخلاق در پژوهش",
      sourceUrl: "https://research.atu.ac.ir/fa",
      evidence: "verified",
    },
    keep: false,
  },
  {
    name: "Library portal endpoint on a university subdomain stays an internal system",
    kind: "systems",
    record: {
      universitySlug: "sirjan-technology",
      nameFa: "كتابخانه دانشگاه صنعتي سيرجان",
      url: "https://lib.sirjantech.ac.ir/DL/SPortal/",
      sourceUrl: "https://sirjantech.ac.ir/",
      relation: "research-portal-discovery",
      discoveredBy: "research-deep-discovery",
    },
    keep: true,
    entityType: "system",
    ownershipScope: "university",
  },
  {
    name: "Trusted scientometrics subdomain remains an internal university system",
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
    entityType: "system",
    ownershipScope: "university",
  },
  {
    name: "Semnan research subdomain is university-owned, not external",
    kind: "systems",
    record: {
      universitySlug: "semnan",
      nameFa: "سامانه مدیریت پژوهانه",
      category: "research",
      url: "https://sampad.semnan.ac.ir/",
      sourceUrl: "https://research.semnan.ac.ir/",
      relation: "unit-service",
      evidence: "verified",
    },
    keep: true,
    entityType: "system",
    relation: "unit-service",
    ownershipScope: "university",
  },
  {
    name: "Different institutional domain can remain external-specific",
    kind: "systems",
    record: {
      universitySlug: "example",
      nameFa: "سامانه پژوهشی اختصاصی برون‌میزبان",
      category: "research",
      url: "https://research-app.vendor-example.com/login",
      sourceUrl: "https://research.example.ac.ir/",
      relation: "linked-external-system",
      evidence: "verified",
    },
    keep: true,
    entityType: "external-system",
    relation: "linked-external-system",
    ownershipScope: "external-specific",
  },
  {
    name: "Allameh curriculum form is not a library unit",
    kind: "units",
    record: {
      universitySlug: "allameh",
      nameFa: "فرم درخواست تدوین سرفصل دروس برای اعضای هیئت علمی",
      type: "library",
      sourceUrl: "https://library.atu.ac.ir/fa/form/489",
      discoveredBy: "research-deep-discovery",
    },
    keep: false,
  },
  {
    name: "Library virtual tour is not a unit",
    kind: "units",
    record: {
      universitySlug: "allameh",
      nameFa: "تور مجازی کتابخانه مرکزی دانشگاه علامه طباطبایی",
      type: "library",
      sourceUrl: "https://library.atu.ac.ir/virtual360/",
      discoveredBy: "research-deep-discovery",
    },
    keep: false,
  },
  {
    name: "Library settlement instructions are not a unit",
    kind: "units",
    record: {
      universitySlug: "allameh",
      nameFa: "شرایط تسویه‌حساب و تحویل غیرحضوری پایان‌نامه/ رساله به کتابخانه مرکزی و مرکز اسناد",
      type: "library",
      sourceUrl: "https://library.atu.ac.ir/fa/page/10877/x",
      discoveredBy: "research-deep-discovery",
    },
    keep: false,
  },
  {
    name: "Actual Lorestan industry management stays a unit",
    kind: "units",
    record: {
      universitySlug: "lorestan",
      nameFa: "دانشگاه لرستان مدیریت ارتباط با جامعه و صنعت",
      type: "industry",
      sourceUrl: "https://industry.lu.ac.ir/",
      discoveredBy: "research-deep-discovery",
    },
    keep: true,
    entityType: "unit",
  },
  {
    name: "Actual Lorestan central library stays a unit",
    kind: "units",
    record: {
      universitySlug: "lorestan",
      nameFa: "دانشگاه لرستان کتابخانه مرکزی",
      type: "library",
      sourceUrl: "https://research.lu.ac.ir/واحدها/کتابخانه/",
      discoveredBy: "research-deep-discovery",
    },
    keep: true,
    entityType: "unit",
  },
  {
    name: "Forms and regulations collection stays documentsRegulations with industry topic",
    kind: "documents",
    record: {
      universitySlug: "lorestan",
      title: "فرم‌ها و آیین‌نامه‌های ارتباط با صنعت",
      url: "https://industry.lu.ac.ir/فرمها/",
      discoveredBy: "research-deep-discovery",
    },
    keep: false,
    entityType: "document-index",
    dimension: "documentsRegulations",
    topicDimension: "industryTechnology",
  },
  {
    name: "SHAA is a ministry national service, not a university system",
    kind: "systems",
    record: {
      universitySlug: "lorestan",
      nameFa: "شبکه آزمایشگاه‌های علمی ایران (شاعا)",
      category: "laboratory",
      url: "https://shaa.msrt.ir/",
      sourceUrl: "https://research.lu.ac.ir/واحدها/آزمایشگاه-مرکزی/",
      relation: "national-related-system",
      evidence: "verified",
      discoveredBy: "research-deep-discovery",
    },
    keep: false,
    entityType: "external-service",
    dimension: "laboratories",
    relation: "links-to",
    ownershipScope: "ministry-national",
    countTowardUniversitySystems: false,
    countTowardRTPMI: false,
  },
  {
    name: "National-related system relation never counts as a university system",
    kind: "systems",
    record: {
      universitySlug: "example",
      nameFa: "سامانه ملی پژوهشی",
      category: "research",
      url: "https://national.example.gov.ir/login",
      sourceUrl: "https://research.example.ac.ir/",
      relation: "national-related-system",
      evidence: "verified",
    },
    keep: false,
    entityType: "external-service",
    relation: "links-to",
    countTowardUniversitySystems: false,
    countTowardRTPMI: false,
  },
  {
    name: "MegaPaper is an external literature provider, not a university system",
    kind: "systems",
    record: {
      universitySlug: "shahed",
      nameFa: "سامانه تأمین مدارک علمی مگاپیپر",
      category: "library",
      url: "https://megapaper.ir/",
      sourceUrl: "https://library.shahed.ac.ir/",
      relation: "linked-from-portal",
      evidence: "verified",
    },
    keep: false,
    entityType: "external-service",
    dimension: "libraryDocuments",
    relation: "links-to",
    ownershipScope: "commercial-external",
    countTowardUniversitySystems: false,
    countTowardRTPMI: false,
  },
  {
    name: "GigaLib is an external literature provider, not a university system",
    kind: "systems",
    record: {
      universitySlug: "example",
      nameFa: "گیگالیب",
      category: "library",
      url: "https://gigalib.org/ip/",
      sourceUrl: "https://library.example.ac.ir/",
      relation: "linked-external-system",
      evidence: "verified",
    },
    keep: false,
    entityType: "external-service",
    dimension: "libraryDocuments",
    relation: "links-to",
    ownershipScope: "commercial-external",
    countTowardUniversitySystems: false,
    countTowardRTPMI: false,
  },
  {
    name: "GigaPaper brand fallback is external even if the exact provider host changes",
    kind: "systems",
    record: {
      universitySlug: "example",
      nameFa: "سامانه گیگاپیپر",
      category: "library",
      url: "https://papers.example-provider.ir/login",
      sourceUrl: "https://library.example.ac.ir/",
      relation: "linked-from-portal",
      evidence: "verified",
    },
    keep: false,
    entityType: "external-service",
    dimension: "libraryDocuments",
    relation: "links-to",
    ownershipScope: "commercial-external",
    countTowardUniversitySystems: false,
    countTowardRTPMI: false,
  },
  {
    name: "MSRT host cannot count as a university system even without national relation",
    kind: "systems",
    record: {
      universitySlug: "iust",
      nameFa: "سامانه ساجد",
      category: "research",
      url: "https://sajed.msrt.ir/",
      sourceUrl: "https://research.iust.ac.ir/",
      relation: "linked-external-system",
      evidence: "verified",
    },
    keep: false,
    entityType: "external-service",
    relation: "links-to",
    ownershipScope: "ministry-national",
    countTowardUniversitySystems: false,
    countTowardRTPMI: false,
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
    dimension: "documentsRegulations",
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
  if (test.entityType) assert.equal(result.entityType, test.entityType, `${test.name}: entityType`);
  if (test.dimension) assert.equal(result.dimension, test.dimension, `${test.name}: dimension`);
  if (test.topicDimension) assert.equal(result.topicDimension, test.topicDimension, `${test.name}: topicDimension`);
  if (test.relation) assert.equal(result.relation, test.relation, `${test.name}: relation`);
  if (test.ownershipScope) assert.equal(result.ownershipScope, test.ownershipScope, `${test.name}: ownershipScope`);
  if (Object.prototype.hasOwnProperty.call(test, "countTowardUniversitySystems")) {
    assert.equal(result.countTowardUniversitySystems, test.countTowardUniversitySystems, `${test.name}: countTowardUniversitySystems`);
  }
  if (Object.prototype.hasOwnProperty.call(test, "countTowardRTPMI")) {
    assert.equal(result.countTowardRTPMI, test.countTowardRTPMI, `${test.name}: countTowardRTPMI`);
  }

  const suffix = result.keep
    ? ` | ${JSON.stringify(enrichCatalogRecord(test.record, test.kind, result))}`
    : "";
  console.log(`PASS | ${test.name} | keep=${result.keep} | entityType=${result.entityType} | dimension=${result.dimension} | topic=${result.topicDimension ?? "-"}${suffix}`);
}

const faLibrary = enrichCatalogRecord({
  id: "lorestan-fa-lib",
  universitySlug: "lorestan",
  nameFa: "دانشگاه لرستان کتابخانه مرکزی",
  type: "library",
  sourceUrl: "https://research.lu.ac.ir/واحدها/کتابخانه/",
  evidence: "verified",
  discoveredBy: "research-deep-discovery",
}, "units", classifyCatalogRecord({
  universitySlug: "lorestan",
  nameFa: "دانشگاه لرستان کتابخانه مرکزی",
  type: "library",
  sourceUrl: "https://research.lu.ac.ir/واحدها/کتابخانه/",
  evidence: "verified",
  discoveredBy: "research-deep-discovery",
}, "units"));

const enLibrary = enrichCatalogRecord({
  id: "lorestan-en-lib",
  universitySlug: "lorestan",
  nameFa: "Lorestan University Central Library",
  type: "library",
  sourceUrl: "https://research.lu.ac.ir/en/research-and-technology/units/central-library/",
  evidence: "verified",
  discoveredBy: "research-deep-discovery",
}, "units", classifyCatalogRecord({
  universitySlug: "lorestan",
  nameFa: "Lorestan University Central Library",
  type: "library",
  sourceUrl: "https://research.lu.ac.ir/en/research-and-technology/units/central-library/",
  evidence: "verified",
  discoveredBy: "research-deep-discovery",
}, "units"));

assert.equal(logicalEntityKey(faLibrary), logicalEntityKey(enLibrary), "FA/EN central library logical key");
const mergedLibrary = mergeLogicalRecords(faLibrary, enLibrary);
assert.ok(mergedLibrary.evidenceUrls.length >= 2, "FA/EN merged library preserves evidence URLs");
console.log(`PASS | bilingual central library merges | evidenceUrls=${mergedLibrary.evidenceUrls.length}`);

const systemA = {
  id: "sys-a",
  universitySlug: "example",
  nameFa: "سامانه پژوهشی",
  entityType: "external-system",
  url: "https://ris.example.ac.ir/login",
  sourceUrl: "https://research.example.ac.ir/",
  evidence: "verified",
};
const systemB = {
  id: "sys-b",
  universitySlug: "example",
  nameFa: "Research Information System",
  entityType: "external-system",
  url: "https://ris.example.ac.ir/en/login",
  sourceUrl: "https://research.example.ac.ir/systems/",
  evidence: "verified",
};
const mergedSystem = mergeLogicalRecords(systemA, systemB);
assert.ok(!mergedSystem.alternateUrls.includes("https://research.example.ac.ir/"), "system source/root must not leak into alternateUrls");
assert.ok(mergedSystem.evidenceUrls.includes("https://research.example.ac.ir/"), "system source/root remains provenance evidence");
console.log(`PASS | system alternateUrls contain entity targets only | alternateUrls=${mergedSystem.alternateUrls.length}`);

const lorestanIndustryScore = scoreIndustryTechnology({
  verified: true,
  researchUrl: "https://research.lu.ac.ir/",
  units: [{
    type: "industry",
    sourceUrl: "https://industry.lu.ac.ir/",
  }],
  systems: [],
});
assert.equal(lorestanIndustryScore, 75, "dedicated Lorestan industry hub score");
console.log(`PASS | dedicated industry hub is not stuck at 45 | score=${lorestanIndustryScore}`);

const lorestanFindability = scoreFindability({
  researchUrl: "https://research.lu.ac.ir/",
  units: Array.from({length: 6}, (_, index) => ({sourceUrl: `https://research.lu.ac.ir/unit/${index + 1}`})),
  systems: [],
  documents: Array.from({length: 8}, (_, index) => ({url: `https://research.lu.ac.ir/doc/${index + 1}.pdf`})),
  systemsStatus: "unresolved",
  systemReferenceCount: 4,
  documentsVerified: true,
});
assert.equal(lorestanFindability, 80, "preserved system references without endpoint should reduce findability even when cleaned state is unresolved");
console.log(`PASS | preserved system reference gap reduces findability | score=${lorestanFindability}`);

const noSystemEvidenceFindability = scoreFindability({
  researchUrl: "https://research.example.ac.ir/",
  units: [{sourceUrl: "https://research.example.ac.ir/unit"}],
  systems: [],
  documents: [{url: "https://research.example.ac.ir/doc.pdf"}],
  systemsStatus: "unresolved",
  documentsVerified: true,
});
assert.equal(noSystemEvidenceFindability, 100, "unresolved/non-evidenced system dimension should not be treated as a findability failure");
console.log(`PASS | no system evidence is not a findability penalty | score=${noSystemEvidenceFindability}`);

const publishingWithoutName = {
  id: "lorestan-publishing-legacy",
  universitySlug: "lorestan",
  type: "publishing",
  evidence: "verified",
  sourceUrl: "https://research.lu.ac.ir/%D9%88%D8%A7%D8%AD%D8%AF%D9%87%D8%A7/%D8%A7%D9%86%D8%AA%D8%B4%D8%A7%D8%B1%D8%A7%D8%AA-%D9%85%D8%B1%DA%A9%D8%B2%DB%8C/",
  entityType: "unit",
};
const publishingWithWeakName = {
  id: "lorestan-publishing-alt",
  universitySlug: "lorestan",
  nameFa: "",
  type: "publishing",
  evidence: "verified",
  sourceUrl: "https://research.lu.ac.ir/en/research-and-technology/units/central-publications/",
  entityType: "unit",
};
const mergedPublishing = mergeLogicalRecords(publishingWithoutName, publishingWithWeakName);
assert.ok(String(mergedPublishing.nameFa || "").trim(), "logical merge must retain or recover a display label");
assert.match(mergedPublishing.nameFa, /انتشارات|publications?/iu, "publishing display label should describe the entity");
console.log(`PASS | logical merge preserves/reconstructs display label | name=${mergedPublishing.nameFa}`);

const percentEncodedLibrary = {
  id: "arak-library-encoded",
  universitySlug: "arak",
  nameFa: "%DA%A9%D8%AA%D8%A7%D8%A8%D8%AE%D8%A7%D9%86%D9%87%20%D9%85%D8%B1%DA%A9%D8%B2%DB%8C%20%D9%88%20%D9%85%D8%B1%DA%A9%D8%B2%20%D8%A7%D8%B3%D9%86%D8%A7%D8%AF",
  type: "library",
  evidence: "verified",
  sourceUrl: "https://library.araku.ac.ir/",
  discoveredBy: "research-deep-discovery",
};
const percentEncodedClassification = classifyCatalogRecord(percentEncodedLibrary, "units");
assert.equal(percentEncodedClassification.keep, true, "percent-encoded organizational identity should decode before classification");
const normalizedEncodedLibrary = mergeLogicalRecords(
  enrichCatalogRecord(percentEncodedLibrary, "units", percentEncodedClassification),
  enrichCatalogRecord(percentEncodedLibrary, "units", percentEncodedClassification)
);
assert.match(normalizedEncodedLibrary.nameFa, /کتابخانه\s*مرکزی/iu, "percent-encoded unit label should be decoded");
assert.doesNotMatch(normalizedEncodedLibrary.nameFa, /%[0-9a-f]{2}/iu, "encoded display label must not survive");
console.log(`PASS | percent-encoded unit identity is normalized | name=${normalizedEncodedLibrary.nameFa}`);

const canonicalSemnanLibrary = {
  id: "semnan-lib",
  universitySlug: "semnan",
  nameFa: "کتابخانه مرکزی و مرکز اسناد دانشگاه سمنان",
  type: "library",
  evidence: "verified",
  sourceUrl: "https://library.semnan.ac.ir/",
  entityType: "unit",
};
const semnanNewsAboutLibrary = {
  id: "semnan-news",
  universitySlug: "semnan",
  nameFa: "برگ افتخار دیگری برای دانشگاه سمنان: قرارگرفتن کتابخانه مرکزی و مرکز اسناد دانشگاه برای چندمین سال متوالی در زمره 10 درصد کتابخانه های برتر کشور",
  type: "library",
  evidence: "verified",
  sourceUrl: "https://semnan.ac.ir/news/library-top-ten",
  entityType: "unit",
};
const mergedSemnanLibrary = mergeLogicalRecords(canonicalSemnanLibrary, semnanNewsAboutLibrary);
assert.match(mergedSemnanLibrary.nameFa, /^کتابخانه\s*مرکزی/iu, "news headline must not replace canonical library identity");
console.log(`PASS | unit merge prefers organizational identity over news headline | name=${mergedSemnanLibrary.nameFa}`);

const tehranCuratedLibrary = {
  id: "tehran-1",
  universitySlug: "tehran",
  nameFa: "کتابخانه مرکزی و مرکز اسناد دانشگاه تهران",
  type: "library",
  evidence: "verified",
  sourceUrl: "https://library.ut.ac.ir/",
  entityType: "unit",
};
const tehranDiscoveredLibrary = {
  id: "tehran-discovered",
  universitySlug: "tehran",
  nameFa: "دانشگاه تهران کتابخانه مرکزی و مرکز اسناد",
  type: "library",
  evidence: "verified",
  sourceUrl: "https://research.ut.ac.ir/library/",
  entityType: "unit",
};
assert.equal(logicalEntityKey(tehranCuratedLibrary), logicalEntityKey(tehranDiscoveredLibrary), "Tehran central-library aliases must share one logical key");
const mergedTehranLibrary = mergeLogicalRecords(tehranCuratedLibrary, tehranDiscoveredLibrary);
assert.match(mergedTehranLibrary.nameFa, /کتابخانه\s*مرکزی/iu, "Tehran merged library keeps canonical identity");
console.log(`PASS | Tehran central library aliases collapse to one logical entity | key=${logicalEntityKey(mergedTehranLibrary)}`);

const coverageAdjustment = scoreCoverageAdjustment({score: 87.8, activeWeight: 88, neutralPrior: 50});
assert.equal(coverageAdjustment.coverageAdjustedScore, 77.3, "strict coverage-adjusted score");
assert.equal(coverageAdjustment.rankingScore, 83.3, "neutral-prior ranking shrinkage");
console.log(`PASS | unresolved weight cannot inflate public rank | strict=${coverageAdjustment.coverageAdjustedScore} | ranking=${coverageAdjustment.rankingScore}`);


const semnanPersianNewsPath = {
  id: "semnan-persian-news-path",
  universitySlug: "semnan",
  nameFa: "کتابخانه مرکزی و مرکز اسناد دانشگاه سمنان",
  type: "library",
  evidence: "verified",
  sourceUrl: "https://lib.semnan.ac.ir/%D9%87%D9%85%D9%87-%D8%A7%D8%AE%D8%A8%D8%A7%D8%B1/%DA%A9%D8%A7%D8%B1%DA%AF%D8%A7%D9%87-%D8%A2%D9%85%D9%88%D8%B2%D8%B4%DB%8C",
  discoveredBy: "research-deep-discovery",
};
const semnanPersianNewsClassification = classifyCatalogRecord(semnanPersianNewsPath, "units");
assert.equal(semnanPersianNewsClassification.keep, false, "Persian news-path evidence must not survive as a unit");
console.log(`PASS | Persian news path cannot survive as unit | entityType=${semnanPersianNewsClassification.entityType}`);

const arakRepeatedLibrary = {
  id: "arak-repeat",
  universitySlug: "arak",
  nameFa: "کتابخانه مرکزی و مرکز اسناد و اطلاع‌رسانی کتابخانه مرکزی و مرکز اسناد",
  type: "library",
  evidence: "verified",
  sourceUrl: "https://araku.ac.ir/web/library/home/",
  entityType: "unit",
};
const normalizedArakRepeatedLibrary = mergeLogicalRecords(arakRepeatedLibrary, arakRepeatedLibrary);
assert.equal(normalizedArakRepeatedLibrary.nameFa, "کتابخانه مرکزی و مرکز اسناد و اطلاع‌رسانی", "repeated central-library label must canonicalize");
console.log(`PASS | repeated central-library label canonicalized | name=${normalizedArakRepeatedLibrary.nameFa}`);

const tehranChromeLibrary = {
  id: "tehran-chrome",
  universitySlug: "tehran",
  nameFa: "کتابخانه مرکزی و مرکز اسناد معاونت پژوهش و فناوری فارسی",
  type: "library",
  evidence: "verified",
  sourceUrl: "https://research.ut.ac.ir/fa/page/4483/library",
  entityType: "unit",
};
const normalizedTehranChromeLibrary = mergeLogicalRecords(tehranChromeLibrary, tehranChromeLibrary);
assert.equal(normalizedTehranChromeLibrary.nameFa, "کتابخانه مرکزی و مرکز اسناد", "site/language chrome must be removed from central-library label");
console.log(`PASS | unit display chrome stripped | name=${normalizedTehranChromeLibrary.nameFa}`);

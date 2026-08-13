import path from "node:path";

const DOC_EXTS = new Set([
  ".pdf", ".doc", ".docx", ".xls", ".xlsx",
  ".ppt", ".pptx", ".rtf", ".odt", ".ods",
  ".odp", ".csv", ".txt", ".zip",
]);

const DOC_MIME =
  /application\/(?:pdf|msword|vnd\.openxmlformats|vnd\.ms-|rtf|vnd\.oasis\.opendocument|zip)|text\/csv/i;

const IT_TEXT =
  /فناوری\s*اطلاعات|فن\s*آوری\s*اطلاعات|اطلاعات\s*و\s*ارتباطات|\bفاوا\b|\binformation\s+technology\b|\binformation\s+(?:and\s+)?communications?\s+technology\b|\bict\b|\bit\s+(?:center|department|office|unit|services?)\b/iu;

const GUIDE_TEXT =
  /راهنما|نحوه\s*(?:استفاده|درخواست|ثبت)|آموزش\s*(?:استفاده|سامانه)|دستور\s*کار|\bguide(?:line)?s?\b|\bhow[\s-]*to\b|\binstruction(?:s)?\b|\bmanual\b/iu;

const ANNOUNCEMENT_TEXT =
  /اطلاعیه|اخبار|خبر|رویداد|فراخوان|اعلامیه|\bannouncement(?:s)?\b|\bnews\b|\bevent\b|\bcall\s+for\b/iu;

const DOCUMENT_INDEX_TEXT =
  /فرم[\s‌-]*(?:ها|های)|آیین[\s‌-]*نامه[\s‌-]*(?:ها|های)|شیوه[\s‌-]*نامه[\s‌-]*(?:ها|های)|دستورالعمل[\s‌-]*(?:ها|های)|اسناد\s*و\s*مقررات|فرم\s*و\s*آیین[\s‌-]*نامه|forms?\s*(?:and|&)\s*regulations?|regulations?\s*(?:and|&)\s*forms?|document(?:s)?\s*(?:center|index|archive)|downloads?/iu;

const SPECIFIC_DOCUMENT_TEXT =
  /آیین[\s‌-]*نامه|شیوه[\s‌-]*نامه|دستورالعمل|بخشنامه|فرم|الگو|سیاست|ضوابط|فرآیند|فرایند|پروپوزال|پایان[\s‌-]*نامه|رساله|اخلاق\s*پژوهش|گرنت|پژوهانه|\bregulation\b|\bbylaw\b|\bguideline\b|\bprocedure\b|\bform\b|\btemplate\b|\bpolicy\b|\bproposal\b|\bthesis\b|\bdissertation\b|\bgrant\b/iu;

const UNIT_NOUN_TEXT =
  /معاونت|مدیریت|اداره|دفتر|مرکز|کتابخانه|آزمایشگاه|پژوهشکده|پژوهشگاه|مرکز\s*رشد|ارتباط\s*با\s*صنعت|جامعه\s*و\s*صنعت|انتقال\s*فناوری|مالکیت\s*فکری|انتشارات|نشریات|کمیته\s*اخلاق|\bvice[\s-]*chancellor\b|\bdepartment\b|\boffice\b|\bcenter\b|\bcentre\b|\blibrary\b|\blaborator(?:y|ies)\b|\bincubator\b|\btechnology\s+transfer\b|\bindustry\s+liaison\b|\bpublishing\b|\bresearch\s+center\b/iu;

const STRUCTURE_HUB_TEXT =
  /ساختار\s*سازمانی|چارت\s*سازمانی|ساختار\s*معاونت|واحدهای\s*معاونت|معرفی\s*واحدها|\borganizational\s+structure\b|\borganisation\s+structure\b|\bresearch\s+units\b/iu;

const SYSTEM_TEXT =
  /سامانه|پرتال\s*(?:نشریات|علمی|پژوهشی)|پایگاه\s*(?:نشریات|اطلاعات\s*پژوهشی)|علم[\s‌-]*سنجی|\bsystem\b|\bportal\b|\bplatform\b|\bapplication\b|\bservice\b/iu;

const SYSTEM_HOST_TOKENS = new Set([
  "ris", "scimet", "sima", "sampad", "thesis",
  "journals", "journal", "press", "book", "conf",
  "centrallab", "lab", "researchinfo", "rms", "rmis",
]);

const DIMENSION_PATTERNS = [
  ["libraryDocuments", /کتابخانه|مرکز\s*اسناد|منابع\s*علمی|\blibrary\b|\bdocument\s+center\b/iu],
  ["laboratories", /آزمایشگاه|شبکه\s*آزمایشگاهی|تجهیزات\s*پژوهشی|\blaborator(?:y|ies)\b|\bcentral\s+lab\b/iu],
  ["industryTechnology", /ارتباط\s*با\s*صنعت|جامعه\s*و\s*صنعت|صنعت\s*و\s*جامعه|انتقال\s*فناوری|نوآور|مالکیت\s*فکری|اختراع|مرکز\s*رشد|دانش[\s‌-]*بنیان|\bindustry\b|\btechnology\s+transfer\b|\binnovation\b|\bpatent\b|\bintellectual\s+property\b|\bincubator\b/iu],
  ["documentsRegulations", /آیین[\s‌-]*نامه|شیوه[\s‌-]*نامه|دستورالعمل|فرم|مقررات|اسناد|\bregulation\b|\bbylaw\b|\bguideline\b|\bform\b|\bdocuments?\b/iu],
  ["systemsServices", SYSTEM_TEXT],
  ["organization", /ساختار\s*سازمانی|مدیریت\s*پژوهش|امور\s*پژوهشی|معاونت\s*پژوهش|\borganizational\s+structure\b|\bresearch\s+management\b|\bresearch\s+affairs\b/iu],
];

const CONCEPT_PATTERNS = [
  ["patent-registration", /ثبت\s*اختراع|\bpatent\s+registration\b/iu],
  ["golestan", /گلستان|\bgolestan\b/iu],
  ["central-library-systems", /سامانه[\s‌-]*های\s*کتابخانه\s*مرکزی|central\s+library\s+systems?/iu],
  ["central-laboratory", /آزمایشگاه\s*مرکزی|central\s+laborator(?:y|ies)|central\s+lab/iu],
  ["research-information-system", /سامانه\s*اطلاعات\s*پژوهشی|research\s+information\s+system|\bris\b/iu],
  ["scientometrics", /علم[\s‌-]*سنجی|\bscimet\b|\bscientometric/iu],
  ["journals", /نشریات|مجلات\s*علمی|\bjournals?\b/iu],
  ["publishing", /انتشارات|\bpublishing\b|\bpress\b/iu],
  ["research-grant", /پژوهانه|گرنت|\bresearch\s+grant\b/iu],
  ["ethics", /اخلاق\s*پژوهش|\bresearch\s+ethics\b/iu],
];

const GENERIC_TITLES = new Set([
  "", "دانلود", "دانلود فایل", "دریافت فایل",
  "مشاهده", "مشاهده فایل", "فایل", "سند",
  "سند پژوهشی", "پیوست", "download", "download file",
  "file", "document", "attachment", "click here",
]);

export function normalizeEntityText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\u200c/g, " ")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ۀ/g, "ه")
    .replace(/[\u064B-\u065F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeSafe(value) {
  try {
    return decodeURIComponent(String(value ?? ""));
  } catch {
    return String(value ?? "");
  }
}

export function semanticEntityText(record) {
  if (!record || typeof record !== "object") {
    return normalizeEntityText(record);
  }

  return normalizeEntityText([
    record.nameFa,
    record.title,
    record.originalTitle,
    record.label,
    record.anchorText,
    record.claim,
    record.description,
    record.note,
    record.type,
    record.category,
    record.topic,
    record.taxonomy,
    record.relation,
    record.fileName,
    decodeSafe(record.url),
    decodeSafe(record.sourceUrl),
    decodeSafe(record.parentUrl),
    decodeSafe(record.sourcePage),
  ].filter(Boolean).join(" "));
}

export function validEntityUrl(value) {
  try {
    const url = new URL(String(value ?? ""));
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

export function canonicalEntityUrl(value, {ignoreLanguage = false} = {}) {
  if (!validEntityUrl(value)) {
    return null;
  }

  const url = new URL(String(value));
  url.hash = "";
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");

  let parts = url.pathname
    .split("/")
    .filter(Boolean)
    .map((part) => decodeSafe(part));

  if (ignoreLanguage && parts.length && /^(?:fa|en|ar|fa-ir|en-us)$/i.test(parts[0])) {
    parts = parts.slice(1);
  }

  for (let index = 1; index < parts.length; index++) {
    if (/^(?:page|news|node|article)$/i.test(parts[index - 1]) && /^\d+$/.test(parts[index])) {
      parts = parts.slice(0, index + 1);
      break;
    }
  }

  url.pathname = `/${parts.map((part) => encodeURIComponent(part)).join("/")}`;
  if (url.pathname !== "/") {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  const params = [...url.searchParams.entries()]
    .filter(([key]) => !key.toLowerCase().startsWith("utm_") &&
      !["fbclid", "gclid", "yclid", "mc_cid", "mc_eid"].includes(key.toLowerCase()))
    .sort(([ak, av], [bk, bv]) => ak.localeCompare(bk) || av.localeCompare(bv));

  url.search = "";
  for (const [key, item] of params) {
    url.searchParams.append(key, item);
  }

  return url.toString();
}

export function directDocument(record) {
  const candidates = [
    record?.url,
    record?.sourceUrl,
    record?.fileName,
  ].filter(Boolean);

  if (DOC_MIME.test(String(record?.contentType || ""))) {
    return true;
  }

  return candidates.some((value) => {
    try {
      const pathname = validEntityUrl(value)
        ? new URL(String(value)).pathname
        : String(value);
      return DOC_EXTS.has(path.extname(decodeSafe(pathname)).toLowerCase());
    } catch {
      return false;
    }
  });
}

function sameHost(a, b) {
  try {
    return new URL(a).hostname.toLowerCase().replace(/^www\./, "") ===
      new URL(b).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return false;
  }
}

function systemHostSignal(value) {
  try {
    const host = new URL(String(value ?? ""))
      .hostname
      .toLowerCase()
      .replace(/^www\./, "");
    return host.split(".").some((part) => SYSTEM_HOST_TOKENS.has(part));
  } catch {
    return false;
  }
}

export function inferDimension(record, fallback = null) {
  const text = semanticEntityText(record);

  if (IT_TEXT.test(text)) {
    return "informationTechnology";
  }

  for (const [dimension, pattern] of DIMENSION_PATTERNS) {
    if (pattern.test(text)) {
      return dimension;
    }
  }

  return fallback;
}

export function inferUnitType(record) {
  const text = semanticEntityText(record);

  if (/کتابخانه|مرکز\s*اسناد|\blibrary\b/iu.test(text)) return "library";
  if (/آزمایشگاه|\blaborator(?:y|ies)\b|\bcentral\s+lab\b/iu.test(text)) return "laboratory";
  if (/ارتباط\s*با\s*صنعت|جامعه\s*و\s*صنعت|\bindustry\b/iu.test(text)) return "industry";
  if (/انتقال\s*فناوری|نوآور|مرکز\s*رشد|مالکیت\s*فکری|اختراع|\btechnology\s+transfer\b|\binnovation\b|\bincubator\b|\bpatent\b/iu.test(text)) return "technology";
  if (/اخلاق\s*پژوهش|\bresearch\s+ethics\b/iu.test(text)) return "ethics";
  if (/انتشارات|نشریات|\bpublishing\b|\bpublication\b/iu.test(text)) return "publishing";
  if (/پژوهشکده|مرکز\s*تحقیقات|مرکز\s*پژوهش|\bresearch\s+(?:center|centre|institute)\b/iu.test(text)) return "research-centers";
  if (/معاونت\s*پژوهش|مدیریت\s*(?:امور\s*)?پژوهش|اداره\s*پژوهش|دفتر\s*پژوهش|\bresearch\s+(?:management|affairs|office)\b|\bvice[\s-]*chancellor\s+for\s+research\b/iu.test(text)) return "research";

  return null;
}

export function inferSystemCategory(record) {
  const text = semanticEntityText(record);

  if (/نشری|مجله|\bjournal/iu.test(text)) return "journals";
  if (/انتشارات|\bpublishing\b|\bpress\b/iu.test(text)) return "publishing";
  if (/کتابخانه|منابع\s*علمی|\blibrary\b/iu.test(text)) return "library";
  if (/آزمایشگاه|\blaborator(?:y|ies)\b|\bcentral\s+lab\b/iu.test(text)) return "laboratory";
  if (/صنعت|\bindustry\b/iu.test(text)) return "industry";
  if (/نوآور|انتقال\s*فناوری|مالکیت\s*فکری|اختراع|\binnovation\b|\btechnology\s+transfer\b|\bpatent\b/iu.test(text)) return "innovation";
  return "research";
}

export function inferDocumentType(record) {
  const text = semanticEntityText(record);

  if (/آیین[\s‌-]*نامه|\bregulation\b|\bbylaw\b/iu.test(text)) return "آیین‌نامه";
  if (/شیوه[\s‌-]*نامه|دستورالعمل|\bguideline\b|\bprocedure\b/iu.test(text)) return "شیوه‌نامه/دستورالعمل";
  if (/فرم|الگو|\bform\b|\btemplate\b/iu.test(text)) return "فرم/الگو";
  if (/بخشنامه|سیاست|\bpolicy\b|\bcircular\b/iu.test(text)) return "سیاست/بخشنامه";
  if (/فرآیند|فرایند|\bworkflow\b|\bprocess\b/iu.test(text)) return "فرآیند";
  return String(record?.type || "سند");
}

export function inferDocumentTopic(record) {
  const text = semanticEntityText(record);

  if (/اخلاق\s*پژوهش|\bresearch\s+ethics\b/iu.test(text)) return "اخلاق پژوهش";
  if (/پایان[\s‌-]*نامه|رساله|\bthesis\b|\bdissertation\b/iu.test(text)) return "پایان‌نامه و رساله";
  if (/آزمایشگاه|تجهیزات\s*پژوهشی|\blaborator/iu.test(text)) return "آزمایشگاه و تجهیزات پژوهشی";
  if (/کتابخانه|منابع\s*علمی|springer|ieee|irandoc|\bsid\b|scopus|proquest/iu.test(text)) return "کتابخانه و منابع علمی";
  if (/نشری|مجله|انتشارات|\bjournal\b|\bpublication\b/iu.test(text)) return "انتشارات و نشریات";
  if (/صنعت|فناور|نوآور|مالکیت\s*فکری|اختراع|مرکز\s*رشد|\bindustry\b|\btechnology\b|\binnovation\b|\bpatent\b/iu.test(text)) return "صنعت، فناوری و مالکیت فکری";
  if (/گرنت|پژوهانه|طرح\s*(?:پژوهشی|تحقیقاتی)|پروپوزال|\bgrant\b|\bproposal\b/iu.test(text)) return "طرح‌ها، گرنت و پژوهانه";
  if (SPECIFIC_DOCUMENT_TEXT.test(text)) return "اسناد و مقررات پژوهشی";

  const current = String(record?.topic || "").trim();
  return current && current !== "سایر" ? current : "سایر اسناد پژوهشی";
}

function filenameTitle(record) {
  const explicit = String(record?.fileName || "").trim();
  let name = explicit;

  if (!name && validEntityUrl(record?.url)) {
    try {
      name = decodeSafe(new URL(record.url).pathname.split("/").filter(Boolean).at(-1) || "");
    } catch {}
  }

  name = name
    .replace(/\.(?:pdf|docx?|xlsx?|pptx?|rtf|odt|ods|odp|csv|txt|zip)$/i, "")
    .replace(/[_+]+/g, " ")
    .replace(/-{2,}/g, " ")
    .trim();

  if (!name || /^[\d._ -]+$/.test(name)) {
    return "";
  }

  const tokens = {
    pajohesh: "پژوهش",
    pajoheshi: "پژوهشی",
    tajhizat: "تجهیزات",
    rahnama: "راهنما",
    jostejo: "جستجو",
    ketabkhaneh: "کتابخانه",
    library: "کتابخانه",
    akhlaq: "اخلاق",
    proposal: "پروپوزال",
    thesis: "پایان‌نامه",
    dissertation: "رساله",
    regulation: "آیین‌نامه",
    guideline: "راهنما",
    form: "فرم",
    grant: "گرنت",
  };

  const mapped = name.split(/\s+/).map((part) => tokens[part.toLowerCase()] || part).join(" ");
  return mapped.replace(/راهنما\s+جستجو/g, "راهنمای جستجو").trim();
}

export function cleanDocumentTitle(record) {
  const original = String(record?.title || record?.nameFa || "").trim();
  const normalized = normalizeEntityText(original);

  if (GENERIC_TITLES.has(normalized) || !original) {
    return filenameTitle(record) || "سند پژوهشی";
  }

  return original
    .replace(/\s*\|\s*(?:معاونت|دانشگاه|research and technology deputy).*$/iu, "")
    .trim();
}

function actualSystemEndpoint(record) {
  const curated = !record?.discoveredBy;
  const trustedRelation = [
    "unit-service",
    "managed-by-portal",
    "national-related-system",
  ].includes(record?.relation);

  const target = record?.url;
  const source = record?.sourceUrl || record?.parentUrl || record?.sourcePage;

  const externalTarget =
    validEntityUrl(target) &&
    validEntityUrl(source) &&
    !sameHost(target, source);

  return Boolean(
    trustedRelation ||
    systemHostSignal(target) ||
    externalTarget ||
    (curated && SYSTEM_TEXT.test(semanticEntityText(record)))
  );
}

export function classifyCatalogRecord(record, catalogKind) {
  const text = semanticEntityText(record);
  const it = IT_TEXT.test(text) || record?.dimension === "informationTechnology" ||
    normalizeEntityText(record?.type) === "it" ||
    normalizeEntityText(record?.category) === "it" ||
    normalizeEntityText(record?.category) === "it-linked";

  if (it) {
    return {
      keep: false,
      entityType: "excluded-it",
      dimension: "informationTechnology",
      relation: "excluded",
      reason: "information-technology-out-of-public-scope",
      disposition: "quarantine",
    };
  }

  const guide = GUIDE_TEXT.test(text);
  const announcement = ANNOUNCEMENT_TEXT.test(text);
  const docIndex = DOCUMENT_INDEX_TEXT.test(text) && !directDocument(record);
  const inferredDimension = inferDimension(record, null);

  if (catalogKind === "documents") {
    if (directDocument(record)) {
      return {
        keep: true,
        entityType: "document",
        dimension: "documentsRegulations",
        relation: "direct-resource",
        reason: "direct-downloadable-document",
        disposition: "catalog",
      };
    }

    if (docIndex) {
      return {
        keep: false,
        entityType: "document-index",
        dimension: "documentsRegulations",
        relation: "contains-documents",
        reason: "collection-page-not-a-document",
        disposition: "reference",
      };
    }

    if (announcement) {
      return {
        keep: false,
        entityType: "announcement",
        dimension: inferredDimension || "documentsRegulations",
        relation: "mentions-resource",
        reason: "announcement-not-a-document",
        disposition: "reference",
      };
    }

    if (guide && !SPECIFIC_DOCUMENT_TEXT.test(text)) {
      return {
        keep: false,
        entityType: "guide",
        dimension: inferredDimension || "documentsRegulations",
        relation: "guide-for",
        reason: "guide-page-not-a-document",
        disposition: "reference",
      };
    }

    if (SPECIFIC_DOCUMENT_TEXT.test(text)) {
      return {
        keep: true,
        entityType: "document",
        dimension: "documentsRegulations",
        relation: "document-landing-page",
        reason: "specific-document-landing-page",
        disposition: "catalog",
      };
    }

    return {
      keep: false,
      entityType: "service-page",
      dimension: inferredDimension || "documentsRegulations",
      relation: "reference-only",
      reason: "generic-page-not-a-document",
      disposition: "reference",
    };
  }

  if (catalogKind === "systems") {
    if (announcement) {
      return {
        keep: false,
        entityType: "announcement",
        dimension: inferredDimension || "systemsServices",
        relation: "mentions-system",
        reason: "announcement-about-system-not-system",
        disposition: "reference",
      };
    }

    if (guide) {
      return {
        keep: false,
        entityType: "guide",
        dimension: inferredDimension || "systemsServices",
        relation: "guide-for-system",
        reason: "guide-about-system-not-system",
        disposition: "reference",
      };
    }

    if (!actualSystemEndpoint(record)) {
      return {
        keep: false,
        entityType: "service-page",
        dimension: inferredDimension || "systemsServices",
        relation: "mentions-system",
        reason: "crawler-page-is-not-proven-system-endpoint",
        disposition: "reference",
      };
    }

    const external =
      validEntityUrl(record?.url) &&
      validEntityUrl(record?.sourceUrl) &&
      !sameHost(record.url, record.sourceUrl);

    return {
      keep: true,
      entityType: external ? "external-system" : "system",
      dimension: "systemsServices",
      relation: record?.relation || (external ? "linked-external-system" : "system-endpoint"),
      reason: external ? "proven-external-system-endpoint" : "proven-system-endpoint",
      disposition: "catalog",
    };
  }

  if (catalogKind === "units") {
    if (docIndex || guide || announcement || directDocument(record)) {
      return {
        keep: false,
        entityType: docIndex
          ? "document-index"
          : guide
            ? "guide"
            : announcement
              ? "announcement"
              : "document",
        dimension: inferredDimension || "organization",
        relation: "reference-only",
        reason: "page-is-not-an-organizational-unit",
        disposition: "reference",
      };
    }

    if (STRUCTURE_HUB_TEXT.test(text)) {
      return {
        keep: false,
        entityType: "organization-hub",
        dimension: "organization",
        relation: "contains-units",
        reason: "structure-page-not-a-unit",
        disposition: "reference",
      };
    }

    const inferredType = inferUnitType(record);
    const curated = !record?.discoveredBy;

    if (!inferredType && !(curated && record?.type)) {
      return {
        keep: false,
        entityType: "service-page",
        dimension: inferredDimension || "organization",
        relation: "reference-only",
        reason: "organizational-unit-not-proven",
        disposition: "reference",
      };
    }

    if (!curated && !UNIT_NOUN_TEXT.test(text)) {
      return {
        keep: false,
        entityType: "service-page",
        dimension: inferredDimension || "organization",
        relation: "reference-only",
        reason: "crawler-page-lacks-unit-identity",
        disposition: "reference",
      };
    }

    return {
      keep: true,
      entityType: "unit",
      dimension: inferredDimension || "organization",
      relation: record?.relation || "organizational-unit",
      reason: "organizational-unit",
      disposition: "catalog",
    };
  }

  throw new Error(`Unknown catalog kind: ${catalogKind}`);
}

export function conceptKey(record) {
  const text = semanticEntityText(record);

  for (const [key, pattern] of CONCEPT_PATTERNS) {
    if (pattern.test(text)) {
      return key;
    }
  }

  return null;
}

export function logicalEntityKey(record) {
  const slug = record?.universitySlug || "unknown";
  const entityType = record?.entityType || "entity";
  const concept = conceptKey(record);

  if (concept && ["unit", "system", "external-system"].includes(entityType)) {
    return `${slug}|${entityType}|concept:${concept}`;
  }

  const target = canonicalEntityUrl(
    record?.url || record?.sourceUrl || record?.parentUrl,
    {ignoreLanguage: true}
  );

  if (target) {
    return `${slug}|${entityType}|url:${target}`;
  }

  return `${slug}|${entityType}|text:${normalizeEntityText(
    record?.nameFa || record?.title || ""
  )}`;
}

function quality(record) {
  let score = 0;
  const title = String(record?.nameFa || record?.title || "").trim();
  if (title && !GENERIC_TITLES.has(normalizeEntityText(title))) score += Math.min(12, title.length / 12);
  if (record?.url) score += 7;
  if (record?.sourceUrl) score += 4;
  if (record?.lastVerified) score += 3;
  if (["verified", "verified-basic", "official", "direct"].includes(record?.evidence)) score += 8;
  if (!record?.discoveredBy) score += 3;
  return score;
}

export function mergeLogicalRecords(existing, incoming) {
  const preferred = quality(incoming) > quality(existing) ? incoming : existing;
  const secondary = preferred === incoming ? existing : incoming;

  const targetUrls = [
    existing.url,
    incoming.url,
    ...(existing.alternateUrls || []),
    ...(incoming.alternateUrls || []),
  ].filter(validEntityUrl);

  const urlMap = new Map();
  for (const item of targetUrls) {
    const key = canonicalEntityUrl(item);
    if (key && !urlMap.has(key)) urlMap.set(key, item);
  }

  const merged = {
    ...secondary,
    ...preferred,
    id: existing.id || incoming.id,
    alternateUrls: [...urlMap.values()].filter((item) => item !== preferred.url),
  };

  if (existing.originalTitle || incoming.originalTitle) {
    merged.originalTitle = existing.originalTitle || incoming.originalTitle;
  }

  return merged;
}

export function enrichCatalogRecord(record, catalogKind, classification) {
  const next = {
    ...record,
    entityType: classification.entityType,
    dimension: classification.dimension,
    relation: classification.relation,
    cleaningReason: classification.reason,
  };

  if (catalogKind === "units") {
    next.type = inferUnitType(record) || record.type || "research";
  } else if (catalogKind === "systems") {
    next.category = inferSystemCategory(record);
  } else if (catalogKind === "documents") {
    const cleanedTitle = cleanDocumentTitle(record);
    const originalTitle = String(record?.title || record?.nameFa || "").trim();

    if (cleanedTitle !== originalTitle && originalTitle) {
      next.originalTitle = record.originalTitle || originalTitle;
    }

    next.title = cleanedTitle;
    next.type = inferDocumentType({...record, title: cleanedTitle});
    next.topic = inferDocumentTopic({...record, title: cleanedTitle});
  }

  return next;
}

export function classifyReauditReference(url, originalDimension, matchedRecord = null) {
  const record = matchedRecord || {url};
  const text = semanticEntityText(record);

  if (IT_TEXT.test(text)) {
    return {
      keep: false,
      dimension: "informationTechnology",
      entityType: "excluded-it",
      reason: "information-technology-out-of-public-scope",
    };
  }

  const inferred = inferDimension(record, originalDimension);

  if (originalDimension === "systemsServices") {
    if (GUIDE_TEXT.test(text) || ANNOUNCEMENT_TEXT.test(text)) {
      return {
        keep: false,
        dimension: inferred,
        entityType: GUIDE_TEXT.test(text) ? "guide" : "announcement",
        reason: "reference-about-system-not-system-endpoint",
      };
    }

    if (matchedRecord) {
      const result = classifyCatalogRecord(matchedRecord, "systems");
      if (!result.keep) {
        return {
          keep: false,
          dimension: result.dimension,
          entityType: result.entityType,
          reason: result.reason,
        };
      }
    } else if (!systemHostSignal(url) && !/\b(?:system|سامانه)\b/iu.test(text)) {
      return {
        keep: false,
        dimension: inferred,
        entityType: "service-page",
        reason: "system-endpoint-unproven",
      };
    }
  }

  return {
    keep: true,
    dimension: inferred,
    entityType:
      originalDimension === "documentsRegulations" && DOCUMENT_INDEX_TEXT.test(text)
        ? "document-index"
        : "dimension-reference",
    reason: inferred !== originalDimension
      ? "dimension-reclassified-from-url-context"
      : "dimension-reference-kept",
  };
}

export const REAUDIT_DIMENSION_KEYS = {
  organization: "organizationUrls",
  libraryDocuments: "libraryUrls",
  laboratories: "laboratoryUrls",
  industryTechnology: "industryTechnologyUrls",
  systemsServices: "systemsUrls",
  documentsRegulations: "documentIndexUrls",
};

export const REAUDIT_KEY_DIMENSIONS = Object.fromEntries(
  Object.entries(REAUDIT_DIMENSION_KEYS).map(([dimension, key]) => [key, dimension])
);

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
  /اطلاعیه|اخبار|خبر|رویداد|فراخوان|اعلامیه|رونمایی|وبینار|نشست|برگزاری|منصوب\s*شد|انتصاب|\bannouncement(?:s)?\b|\bnews\b|\bevent\b|\bwebinar\b|\bcall\s+for\b|\bappointed\b|\blaunch(?:ed)?\b/iu;

const DOCUMENT_INDEX_TEXT =
  /فرم[\s‌-]*(?:ها|های)|آیین[\s‌-]*نامه[\s‌-]*(?:ها|های)|آئین[\s‌-]*نامه[\s‌-]*(?:ها|های)|شیوه[\s‌-]*نامه[\s‌-]*(?:ها|های)|دستورالعمل[\s‌-]*(?:ها|های)|اسناد\s*و\s*مقررات|فرم\s*و\s*آیین[\s‌-]*نامه|forms?\s*(?:and|&)\s*regulations?|regulations?\s*(?:and|&)\s*forms?|document(?:s)?\s*(?:center|index|archive)|downloads?/iu;

const SPECIFIC_DOCUMENT_TEXT =
  /آیین[\s‌-]*نامه|آئین[\s‌-]*نامه|شیوه[\s‌-]*نامه|دستورالعمل|بخشنامه|فرم|الگو|سیاست|ضوابط|فرآیند|فرایند|پروپوزال|پایان[\s‌-]*نامه|رساله|اخلاق\s*پژوهش|گرنت|پژوهانه|\bregulation\b|\bbylaw\b|\bguideline\b|\bprocedure\b|\bform\b|\btemplate\b|\bpolicy\b|\bproposal\b|\bthesis\b|\bdissertation\b|\bgrant\b/iu;

const STRUCTURE_HUB_TEXT =
  /ساختار\s*سازمانی|چارت\s*سازمانی|ساختار\s*معاونت|واحدهای\s*معاونت|واحدهای\s*پژوهشی(?:\s*و\s*فناوری)?|معرفی\s*واحدها|\borganizational\s+structure\b|\borganisation\s+structure\b|\bresearch\s+units\b/iu;

const UNIT_PROFILE_TEXT =
  /^(?:معرفی|درباره|کارکنان|همکاران|اعضا|ریاست|مدیر|مدیریت\s*کنندگان|تماس\s*با|اطلاعات\s*تماس)(?:\s|$|[-–—|])|\b(?:staff|employees|people|team|about|contact|director|head)\b/iu;

const SERVICE_INFO_TEXT =
  /جامعه\s*کاربران|تور\s*مجازی|ساعت\s*کار|شرایط\s*تسویه|تسویه\s*حساب|تحویل\s*غیرحضوری|ارائه\s*خدمات|خدمات\s*دهی|خدمات\s*کاربران|رزرو|نوبت|گالری|تصاویر|پرسش(?:‌|\s)*های\s*متداول|پیوندهای\s*مفید|پایگاه[‌\s-]*های\s*اطلاعاتی|کتابخانه\s*دیجیتال|مهارت\s*افزایی|کتابخانه\s*2\.0|ثنا|\bvirtual\s+tour\b|\bopening\s+hours\b|\buser\s+community\b|\bservice(?:s)?\b|\bfaq\b|\bgallery\b/iu;

const UNIT_IDENTITY_START =
  /^(?:دانشگاه\s+[^|–—-]{2,80}\s+)?(?:معاونت|مدیریت|اداره|دفتر|مرکز|کتابخانه|آزمایشگاه|پژوهشکده|پژوهشگاه|گروه|کمیته|انتشارات|مرکز\s*رشد|پارک\s*علم\s*و\s*فناوری)(?:\s|$|[-–—|])|^(?:[a-z .'-]+\s+university\s+)?(?:vice[\s-]*chancell(?:or|ery)|department|office|center|centre|central\s+library|central\s+laborator(?:y|ies)|research\s+(?:center|centre|institute)|industry\s+liaison|technology\s+transfer|incubator|central\s+publications?|publishing|library|laborator(?:y|ies))\b/iu;

const SHORT_UNIT_IDENTITY =
  /^(?:ارتباط\s*با\s*(?:جامعه\s*و\s*)?صنعت|جامعه\s*و\s*صنعت|انتقال\s*فناوری|مالکیت\s*فکری|اخلاق\s*پژوهش|نشریات|انتشارات|کتابخانه\s*مرکزی|آزمایشگاه\s*مرکزی|امور\s*پژوهشی)$/iu;

const UNIT_PATH_NEGATIVE =
  /\/(?:news|article|event|announcement|form|forms|regulation|regulations|download|downloads|virtual|gallery|print|همه[-_\s‌]*اخبار|اخبار|خبرها|رویدادها)(?:\/|\?|$)|\/w\//iu;

const SYSTEM_TEXT =
  /سامانه|پرتال|پایگاه\s*(?:نشریات|اطلاعات\s*پژوهشی)|علم[\s‌-]*سنجی|\bsystem\b|\bs?portal\b|\bplatform\b|\bapplication\b/iu;

const RESEARCH_SYSTEM_CONTEXT =
  /پژوهش|پژوهانه|گرنت|طرح\s*پژوهشی|مقاله|مقالات|اطلاعات\s*علمی|اعضای\s*هی[أا]ت\s*علمی|نشری|مجله|انتشارات|کتابخانه|منابع\s*علمی|آزمایشگاه|صنعت|جامعه\s*و\s*صنعت|فناور|نوآور|کارآفرین|اختراع|مالکیت\s*فکری|اخلاق\s*پژوهش|علم[\s‌-]*سنج|پایان[\s‌-]*نامه|رساله|همایش|\bresearch\b|\bgrant\b|\barticle(?:s)?\b|\bscientific\s+information\b|\bfaculty\s+(?:profile|information)\b|\bjournal\b|\bpublishing\b|\blibrary\b|\blaborator(?:y|ies)\b|\bindustry\b|\binnovation\b|\bpatent\b|\bethics\b|\bscientometric\b|\bscimet\b|\bthesis\b|\bdissertation\b|\bconference\b/iu;

const NON_RESEARCH_SYSTEM_CONTEXT =
  /منابع\s*انسانی|اداری\s*و\s*مالی|امور\s*مالی|اتوماسیون\s*اداری|حضور\s*و\s*غیاب|حقوق\s*و\s*دستمزد|پیشخوان\s*برنامه[‌\s]*های\s*اداری|سامانه\s*آموزشی|معاونت\s*آموزشی|امور\s*دانشجویی|ثبت\s*نام\s*دانشجو|\bhuman\s+resources?\b|\badministrative\b|\bfinancial\b|\bpayroll\b|\battendance\b|\bstudent\s+affairs\b|\beducation(?:al)?\s+system\b|\berp\b/iu;

const ORGANIZATIONAL_NOT_SYSTEM =
  /پژوهشکده|پژوهشگاه|دانشکده|مرکز\s*پژوهشی|مرکز\s*تحقیق|موسسه\s*پژوهشی|مؤسسه\s*پژوهشی|شرکت\s*سامانه\s*ساز|\bresearch\s+institute\b|\bresearch\s+center\b|\bresearch\s+centre\b|\bfaculty\b|\bschool\b|\binstitute\b/iu;

const SYSTEM_HOST_TOKENS = new Set([
  "ris", "scimet", "sima", "sampad", "thesis", "journals", "journal",
  "press", "book", "conf", "centrallab", "lab", "researchinfo", "rms",
  "rmis", "sajed", "sate", "samad", "ethics", "patent",
]);

// A generic research portal host (for example research.example.ac.ir) is not, by
// itself, evidence that a page is a system endpoint. Same-host crawler pages need
// an application-like path or a trusted semantic relation.
const SYSTEM_APPLICATION_PATH =
  /\/(?:login|signin|sign-in|auth|oauth|app|apps|application|dashboard|panel|portal|sso)(?:\/|[?#]|$)|[?&](?:app|module|service|system|portal)=/iu;

const CONTENT_PAGE_PATH =
  /\/(?:organizational-structure|research-and-technology|units?|management|about|page|pages|news|article|announcement|announcements|guide|guides|how-to|instructions?|forms?|regulations?|downloads?)(?:\/|[?#]|$)/iu;

// Shared national/ministry and third-party research-access services may be
// linked from a university portal, but they are not university systems. They are
// preserved as external-service references and never contribute to university
// system counts or RTPMI. The rule is ownership-based, not just title-based.
const EXTERNAL_RESEARCH_SERVICE_HOSTS = new Map([
  ["shaa.msrt.ir", {
    serviceId: "shaa",
    dimension: "laboratories",
    ownerType: "ministry",
    ownershipScope: "ministry-national",
  }],
  ["emshaa.msrt.ir", {
    serviceId: "shaa",
    dimension: "laboratories",
    ownerType: "ministry",
    ownershipScope: "ministry-national",
  }],
  ["sajed.msrt.ir", {
    serviceId: "sajed",
    dimension: null,
    ownerType: "ministry",
    ownershipScope: "ministry-national",
  }],
  ["mapfa.msrt.ir", {
    serviceId: "mapfa",
    dimension: null,
    ownerType: "ministry",
    ownershipScope: "ministry-national",
  }],
  ["sate.atf.gov.ir", {
    serviceId: "sate",
    dimension: null,
    ownerType: "national-agency",
    ownershipScope: "national-shared",
  }],
  ["jcr.isc.ac", {
    serviceId: "isc-jcr",
    dimension: "libraryDocuments",
    ownerType: "national-index",
    ownershipScope: "national-shared",
  }],
  ["nan.ac", {
    serviceId: "nan",
    dimension: null,
    ownerType: "national-platform",
    ownershipScope: "national-shared",
  }],
  ["gigalib.org", {
    serviceId: "gigalib",
    dimension: "libraryDocuments",
    ownerType: "external-provider",
    ownershipScope: "commercial-external",
  }],
  ["gigalib.ir", {
    serviceId: "gigalib",
    dimension: "libraryDocuments",
    ownerType: "external-provider",
    ownershipScope: "commercial-external",
  }],
  ["gigapaper.ir", {
    serviceId: "gigapaper",
    dimension: "libraryDocuments",
    ownerType: "external-provider",
    ownershipScope: "commercial-external",
  }],
  ["megapaper.ir", {
    serviceId: "megapaper",
    dimension: "libraryDocuments",
    ownerType: "external-provider",
    ownershipScope: "commercial-external",
  }],
]);

const EXTERNAL_RESEARCH_SERVICE_TEXT =
  /گیگا[\s\u200c-]*لیب|گیگا[\s\u200c-]*پیپر|مگا[\s\u200c-]*پیپر|مگاپیپر|\bgiga[\s-]*lib\b|\bgiga[\s-]*paper\b|\bmega[\s-]*paper\b/iu;

function sharedExternalService(record) {
  const target = record?.url;
  let host = null;
  try {
    host = new URL(String(target ?? "")).hostname.toLowerCase().replace(/^www\./, "");
  } catch {}

  if (host && EXTERNAL_RESEARCH_SERVICE_HOSTS.has(host)) {
    return EXTERNAL_RESEARCH_SERVICE_HOSTS.get(host);
  }

  // Ministry/ISC domains are categorically outside university ownership even if
  // a legacy row lost its national-related-system relation.
  if (host && (host === "msrt.ir" || host.endsWith(".msrt.ir"))) {
    return {
      serviceId: null,
      dimension: null,
      ownerType: "ministry",
      ownershipScope: "ministry-national",
    };
  }
  if (host && (host === "isc.ac" || host.endsWith(".isc.ac"))) {
    return {
      serviceId: null,
      dimension: "libraryDocuments",
      ownerType: "national-index",
      ownershipScope: "national-shared",
    };
  }

  if (record?.relation === "national-related-system") {
    return {
      serviceId: null,
      dimension: null,
      ownerType: "national-shared",
      ownershipScope: "national-shared",
    };
  }

  const brandText = [record?.nameFa, record?.title, record?.label, target]
    .filter(Boolean)
    .join(" ");
  if (EXTERNAL_RESEARCH_SERVICE_TEXT.test(brandText)) {
    return {
      serviceId: null,
      dimension: "libraryDocuments",
      ownerType: "external-provider",
      ownershipScope: "commercial-external",
    };
  }

  return null;
}

const DIMENSION_PATTERNS = [
  ["libraryDocuments", /کتابخانه|مرکز\s*اسناد|منابع\s*علمی|\blibrary\b|\bdocument\s+center\b/iu],
  ["laboratories", /آزمایشگاه|شبکه\s*آزمایشگاهی|تجهیزات\s*پژوهشی|\blaborator(?:y|ies)\b|\bcentral\s+lab\b/iu],
  ["industryTechnology", /ارتباط\s*با\s*صنعت|جامعه\s*و\s*صنعت|صنعت\s*و\s*جامعه|انتقال\s*فناوری|نوآور|مالکیت\s*فکری|اختراع|مرکز\s*رشد|دانش[\s‌-]*بنیان|\bindustry\b|\btechnology\s+transfer\b|\binnovation\b|\bpatent\b|\bintellectual\s+property\b|\bincubator\b/iu],
  ["documentsRegulations", /آیین[\s‌-]*نامه|شیوه[\s‌-]*نامه|دستورالعمل|فرم|مقررات|اسناد|\bregulation\b|\bbylaw\b|\bguideline\b|\bform\b|\bdocuments?\b/iu],
  ["systemsServices", SYSTEM_TEXT],
  ["organization", /ساختار\s*سازمانی|مدیریت\s*پژوهش|امور\s*پژوهشی|معاونت\s*پژوهش|\borganizational\s+structure\b|\bresearch\s+management\b|\bresearch\s+affairs\b/iu],
];

const UNIT_CONCEPT_PATTERNS = [
  ["central-library", /کتابخانه\s*مرکزی(?:\s*و\s*مرکز\s*اسناد)?|central\s+library(?:\s+and\s+document\s+center)?/iu],
  ["central-laboratory", /آزمایشگاه\s*مرکزی|central\s+laborator(?:y|ies)|central\s+lab/iu],
  ["central-publications", /انتشارات\s*مرکزی|central\s+publications?|central\s+publishing/iu],
  ["research-affairs-management", /مدیریت\s*امور\s*پژوهشی|research\s+affairs\s+management/iu],
  ["research-vice-chancellery", /معاونت\s*پژوهش(?:\s*و\s*فناوری)?$|research\s+and\s+technology\s+vice[\s-]*chancell(?:or|ery)/iu],
  ["industry-liaison-group", /گروه.*(?:کارآفرینی|ارتباط).*صنعت|industry\s+liaison\s+group/iu],
  ["industry-liaison-management", /مدیریت.*(?:ارتباط).*صنعت|industry\s+liaison\s+management/iu],
  ["technology-transfer-office", /دفتر\s*انتقال\s*فناوری|technology\s+transfer\s+office/iu],
  ["research-ethics", /کمیته\s*اخلاق\s*(?:در\s*)?پژوهش|research\s+ethics\s+committee/iu],
];

const SYSTEM_CONCEPT_PATTERNS = [
  ["research-information-system", /سامانه\s*اطلاعات\s*پژوهشی|research\s+information\s+system|\bris\b/iu],
  ["scientometrics", /علم[\s‌-]*سنجی|\bscimet\b|\bscientometric/iu],
  ["journals", /سامانه\s*(?:مدیریت\s*)?نشریات|پایگاه\s*نشریات|\bjournals?\b/iu],
  ["publishing", /سامانه\s*انتشارات|\bpublishing\s+system\b|\bpress\b/iu],
  ["research-grant", /سامانه.*(?:پژوهانه|گرنت)|(?:پژوهانه|گرنت).*سامانه|research\s+grant\s+system/iu],
  ["ethics", /سامانه\s*اخلاق|research\s+ethics\s+(?:system|portal)/iu],
  ["patent-registration", /سامانه\s*ثبت\s*اختراع|patent\s+registration\s+system/iu],
  ["central-lab-system", /سامانه\s*آزمایشگاه\s*مرکزی|central\s+lab(?:oratory)?\s+system/iu],
];

const GENERIC_TITLES = new Set([
  "", "دانلود", "دانلود فایل", "دریافت فایل", "مشاهده", "مشاهده فایل",
  "فایل", "سند", "سند پژوهشی", "پیوست", "download", "download file",
  "file", "document", "attachment", "click here",
]);

function decodeRepeated(value, rounds = 3) {
  let current = String(value ?? "");
  for (let index = 0; index < rounds; index++) {
    if (!/%[0-9a-f]{2}/i.test(current)) break;
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      current = decoded;
    } catch {
      break;
    }
  }
  return current;
}

export function normalizeEntityText(value) {
  return decodeRepeated(value)
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
  return decodeRepeated(value);
}

function titleText(record) {
  const explicit = record?.nameFa || record?.title || record?.label || "";
  const fallback = explicit || decodePathLabel(record?.url || record?.sourceUrl || record?.parentUrl) || "";
  return normalizeEntityText(fallback);
}

function semanticContentText(record) {
  if (!record || typeof record !== "object") return normalizeEntityText(record);
  return normalizeEntityText([
    record.nameFa,
    record.title,
    record.originalTitle,
    record.label,
    record.anchorText,
    record.claim,
    record.description,
    record.note,
    record.fileName,
    decodeSafe(record.url),
    decodeSafe(record.sourceUrl),
    decodeSafe(record.parentUrl),
    decodeSafe(record.sourcePage),
  ].filter(Boolean).join(" "));
}

function identityTitle(record) {
  let text = titleText(record);
  text = text.replace(/^(?:صفحه\s*اصلی|خانه|home)\s*[-–—|:]\s*/iu, "");
  text = text.replace(/\s*[-–—|:]\s*(?:صفحه\s*اصلی|خانه|home)$/iu, "");
  text = text.replace(/^دانشگاه\s+[^|–—-]{2,80}?\s+(?=(?:معاونت|مدیریت|اداره|دفتر|مرکز|کتابخانه|آزمایشگاه|پژوهشکده|پژوهشگاه|گروه|کمیته|انتشارات|معرفی|کارکنان))/iu, "");
  text = text.replace(/^[a-z .'-]+?\s+university\s+(?=(?:vice|department|office|center|centre|central|research|industry|technology|incubator|publishing|library|laborator|about|staff|employees))/iu, "");

  const segments = text.split(/\s+[-–—|:]\s+/u).map((item) => item.trim()).filter(Boolean);
  for (let index = segments.length - 1; index > 0; index -= 1) {
    if (UNIT_IDENTITY_START.test(segments[index]) || SHORT_UNIT_IDENTITY.test(segments[index])) {
      return segments[index];
    }
  }

  return text.trim();
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
  if (!validEntityUrl(value)) return null;

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
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");

  const params = [...url.searchParams.entries()]
    .filter(([key]) => !key.toLowerCase().startsWith("utm_") &&
      !["fbclid", "gclid", "yclid", "mc_cid", "mc_eid"].includes(key.toLowerCase()))
    .sort(([ak, av], [bk, bv]) => ak.localeCompare(bk) || av.localeCompare(bv));

  url.search = "";
  for (const [key, item] of params) url.searchParams.append(key, item);

  return url.toString();
}

function canonicalHost(value) {
  try {
    return new URL(String(value ?? "")).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function directDocument(record) {
  const candidates = [record?.url, record?.sourceUrl, record?.fileName].filter(Boolean);

  if (DOC_MIME.test(String(record?.contentType || ""))) return true;

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
  const ah = canonicalHost(a);
  const bh = canonicalHost(b);
  return Boolean(ah && bh && ah === bh);
}

const MULTI_LABEL_PUBLIC_SUFFIXES = new Set([
  "ac.ir", "gov.ir", "org.ir", "co.ir", "net.ir", "sch.ir", "id.ir",
  "ac.uk", "co.uk", "org.uk", "gov.uk",
]);

function institutionalDomainFromHost(host) {
  if (!host) return null;
  const parts = String(host).toLowerCase().replace(/^www\./, "").split(".").filter(Boolean);
  if (parts.length < 2) return parts.join(".") || null;

  const lastTwo = parts.slice(-2).join(".");
  if (MULTI_LABEL_PUBLIC_SUFFIXES.has(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return lastTwo;
}

function sameInstitutionDomain(a, b) {
  const ah = canonicalHost(a);
  const bh = canonicalHost(b);
  const ad = institutionalDomainFromHost(ah);
  const bd = institutionalDomainFromHost(bh);
  return Boolean(ad && bd && ad === bd);
}

function systemHostSignal(value) {
  try {
    const host = canonicalHost(value);
    if (!host) return false;
    return host.split(".").some((part) => SYSTEM_HOST_TOKENS.has(part));
  } catch {
    return false;
  }
}

function urlPathText(record) {
  return normalizeEntityText([
    decodeSafe(record?.url),
    decodeSafe(record?.sourceUrl),
    decodeSafe(record?.parentUrl),
  ].filter(Boolean).join(" "));
}

export function inferDimension(record, fallback = null) {
  const text = semanticContentText(record);

  if (IT_TEXT.test(text)) return "informationTechnology";

  for (const [dimension, pattern] of DIMENSION_PATTERNS) {
    if (pattern.test(text)) return dimension;
  }

  return fallback;
}

export function inferTopicDimension(record, fallback = null) {
  const text = semanticContentText(record);

  if (IT_TEXT.test(text)) return "informationTechnology";
  if (/کتابخانه|مرکز\s*اسناد|منابع\s*علمی|\blibrary\b|\bdocument\s+center\b/iu.test(text)) return "libraryDocuments";
  if (/آزمایشگاه|شبکه\s*آزمایشگاهی|تجهیزات\s*پژوهشی|\blaborator(?:y|ies)\b|\bcentral\s+lab\b/iu.test(text)) return "laboratories";
  if (/ارتباط\s*با\s*صنعت|جامعه\s*و\s*صنعت|صنعت\s*و\s*جامعه|انتقال\s*فناوری|نوآور|مالکیت\s*فکری|اختراع|مرکز\s*رشد|دانش[\s‌-]*بنیان|\bindustry\b|\btechnology\s+transfer\b|\binnovation\b|\bpatent\b|\bintellectual\s+property\b|\bincubator\b/iu.test(text)) return "industryTechnology";
  if (SYSTEM_TEXT.test(text) && RESEARCH_SYSTEM_CONTEXT.test(text)) return "systemsServices";
  if (/ساختار\s*سازمانی|مدیریت\s*پژوهش|امور\s*پژوهشی|معاونت\s*پژوهش|\borganizational\s+structure\b|\bresearch\s+management\b|\bresearch\s+affairs\b/iu.test(text)) return "organization";

  return fallback;
}

export function inferUnitType(record) {
  const text = semanticContentText(record);

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
  const text = semanticContentText(record);

  if (/نشری|مجله|\bjournal/iu.test(text)) return "journals";
  if (/انتشارات|\bpublishing\b|\bpress\b/iu.test(text)) return "publishing";
  if (/کتابخانه|منابع\s*علمی|\blibrary\b/iu.test(text)) return "library";
  if (/آزمایشگاه|\blaborator(?:y|ies)\b|\bcentral\s+lab\b/iu.test(text)) return "laboratory";
  if (/صنعت|\bindustry\b/iu.test(text)) return "industry";
  if (/نوآور|انتقال\s*فناوری|مالکیت\s*فکری|اختراع|\binnovation\b|\btechnology\s+transfer\b|\bpatent\b/iu.test(text)) return "innovation";
  return "research";
}

export function inferDocumentType(record) {
  const text = semanticContentText(record);

  if (/آیین[\s‌-]*نامه|\bregulation\b|\bbylaw\b/iu.test(text)) return "آیین‌نامه";
  if (/شیوه[\s‌-]*نامه|دستورالعمل|\bguideline\b|\bprocedure\b/iu.test(text)) return "شیوه‌نامه/دستورالعمل";
  if (/فرم|الگو|\bform\b|\btemplate\b/iu.test(text)) return "فرم/الگو";
  if (/بخشنامه|سیاست|\bpolicy\b|\bcircular\b/iu.test(text)) return "سیاست/بخشنامه";
  if (/فرآیند|فرایند|\bworkflow\b|\bprocess\b/iu.test(text)) return "فرآیند";
  return String(record?.type || "سند");
}

export function inferDocumentTopic(record) {
  const text = semanticContentText(record);

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

  if (!name || /^[\d._ -]+$/.test(name)) return "";

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

  return name
    .split(/\s+/)
    .map((part) => tokens[part.toLowerCase()] || part)
    .join(" ")
    .replace(/راهنما\s+جستجو/g, "راهنمای جستجو")
    .trim();
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

function isStrongUnitIdentity(record) {
  const rawTitle = titleText(record);
  const title = identityTitle(record);
  if (!title) return false;

  if (UNIT_PROFILE_TEXT.test(rawTitle) || UNIT_PROFILE_TEXT.test(title) || SERVICE_INFO_TEXT.test(rawTitle) || SERVICE_INFO_TEXT.test(title)) return false;
  if (ANNOUNCEMENT_TEXT.test(rawTitle) || SPECIFIC_DOCUMENT_TEXT.test(rawTitle) || GUIDE_TEXT.test(rawTitle)) return false;

  const source = String(record?.sourceUrl || record?.url || "");
  if (UNIT_PATH_NEGATIVE.test(source) && !UNIT_IDENTITY_START.test(title)) return false;

  if (UNIT_IDENTITY_START.test(title)) return true;
  if (title.length <= 85 && SHORT_UNIT_IDENTITY.test(title)) return true;

  return false;
}

function actualSystemEndpoint(record) {
  const text = semanticContentText(record);
  const title = titleText(record);
  const target = record?.url;
  const source = record?.sourceUrl || record?.parentUrl || record?.sourcePage;
  const trustedRelation = [
    "unit-service",
    "managed-by-portal",
    "system-endpoint",
    "linked-external-system",
  ].includes(record?.relation);

  if (!validEntityUrl(target)) return false;
  if (IT_TEXT.test(text)) return false;
  if (ORGANIZATIONAL_NOT_SYSTEM.test(title)) return false;

  const researchContext = RESEARCH_SYSTEM_CONTEXT.test(text);
  const adminContext = NON_RESEARCH_SYSTEM_CONTEXT.test(text);
  if (adminContext && !researchContext) return false;

  const hostSignal = systemHostSignal(target);
  const targetSystemSignal = SYSTEM_TEXT.test(decodeSafe(target));
  const explicitSystemTitle = SYSTEM_TEXT.test(title);
  const externalTarget = validEntityUrl(source) && !sameHost(target, source);
  const appLikePath = SYSTEM_APPLICATION_PATH.test(String(target));
  const contentLikePath = CONTENT_PAGE_PATH.test(decodeSafe(String(target)));

  // Curated/trusted relations may prove an endpoint, but still require research
  // context and at least one endpoint-like signal.
  if (trustedRelation && researchContext && (hostSignal || appLikePath || externalTarget || targetSystemSignal)) {
    return true;
  }

  // Dedicated subdomains such as scimet.*, journals.*, ris.* are strong endpoint
  // evidence when the surrounding context is research-facing.
  if (hostSignal && researchContext && (explicitSystemTitle || targetSystemSignal || externalTarget || appLikePath)) {
    return true;
  }

  // External targets linked from an official research page can be accepted when
  // their title/URL is explicitly system-like.
  if (externalTarget && researchContext && !adminContext && (explicitSystemTitle || targetSystemSignal || appLikePath)) {
    return true;
  }

  // Same-host pages discovered by the crawler are the risky case. A title that
  // merely says “system” is not enough. Require an application/login path and do
  // not accept ordinary CMS/content routes. This blocks Lorestan's patent page.
  if (!externalTarget && researchContext && appLikePath && !contentLikePath && (explicitSystemTitle || targetSystemSignal)) {
    return true;
  }

  return false;
}

function baseClassification(fields = {}) {
  return {
    topicDimension: null,
    primaryDimension: fields.dimension || null,
    ...fields,
  };
}

export function classifyCatalogRecord(record, catalogKind) {
  const fullText = semanticEntityText(record);
  const text = semanticContentText(record);
  const title = titleText(record);
  const identity = identityTitle(record);
  const it = IT_TEXT.test(fullText) || record?.dimension === "informationTechnology" ||
    normalizeEntityText(record?.type) === "it" ||
    normalizeEntityText(record?.category) === "it" ||
    normalizeEntityText(record?.category) === "it-linked";

  if (it) {
    return baseClassification({
      keep: false,
      entityType: "excluded-it",
      dimension: "informationTechnology",
      relation: "excluded",
      reason: "information-technology-out-of-public-scope",
      disposition: "quarantine",
    });
  }

  const guide = GUIDE_TEXT.test(title);
  const announcement = ANNOUNCEMENT_TEXT.test(title);
  const docIndex = DOCUMENT_INDEX_TEXT.test(title) && !directDocument(record);
  const inferredDimension = inferDimension(record, null);
  const topicDimension = inferTopicDimension(record, null);

  if (catalogKind === "documents") {
    if (directDocument(record)) {
      return baseClassification({
        keep: true,
        entityType: "document",
        dimension: "documentsRegulations",
        primaryDimension: "documentsRegulations",
        topicDimension,
        relation: "direct-resource",
        reason: "direct-downloadable-document",
        disposition: "catalog",
      });
    }

    if (docIndex) {
      return baseClassification({
        keep: false,
        entityType: "document-index",
        dimension: "documentsRegulations",
        primaryDimension: "documentsRegulations",
        topicDimension,
        relation: "contains-documents",
        reason: "collection-page-not-a-document",
        disposition: "reference",
      });
    }

    if (announcement) {
      return baseClassification({
        keep: false,
        entityType: "announcement",
        dimension: "documentsRegulations",
        primaryDimension: "documentsRegulations",
        topicDimension,
        relation: "mentions-resource",
        reason: "announcement-not-a-document",
        disposition: "reference",
      });
    }

    if (guide && !SPECIFIC_DOCUMENT_TEXT.test(title)) {
      return baseClassification({
        keep: false,
        entityType: "guide",
        dimension: "documentsRegulations",
        primaryDimension: "documentsRegulations",
        topicDimension,
        relation: "guide-for",
        reason: "guide-page-not-a-document",
        disposition: "reference",
      });
    }

    if (SPECIFIC_DOCUMENT_TEXT.test(title)) {
      return baseClassification({
        keep: true,
        entityType: "document",
        dimension: "documentsRegulations",
        primaryDimension: "documentsRegulations",
        topicDimension,
        relation: "document-landing-page",
        reason: "specific-document-landing-page",
        disposition: "catalog",
      });
    }

    return baseClassification({
      keep: false,
      entityType: "service-page",
      dimension: "documentsRegulations",
      primaryDimension: "documentsRegulations",
      topicDimension,
      relation: "reference-only",
      reason: "generic-page-not-a-document",
      disposition: "reference",
    });
  }

  if (catalogKind === "systems") {
    const sharedService = sharedExternalService(record);
    if (sharedService) {
      const sharedDimension = sharedService.dimension || topicDimension || inferredDimension || "systemsServices";
      return baseClassification({
        keep: false,
        entityType: "external-service",
        dimension: sharedDimension,
        primaryDimension: sharedDimension,
        topicDimension: null,
        relation: "links-to",
        reason: sharedService.serviceId === "shaa"
          ? "msrt-shaa-national-service-not-university-system"
          : sharedService.ownershipScope === "commercial-external"
            ? "third-party-research-access-service-not-university-system"
            : "national-shared-service-not-university-system",
        disposition: "reference",
        serviceId: sharedService.serviceId,
        ownerType: sharedService.ownerType,
        ownershipScope: sharedService.ownershipScope,
        countTowardUniversitySystems: false,
        countTowardRTPMI: false,
      });
    }

    if (announcement) {
      return baseClassification({
        keep: false,
        entityType: "announcement",
        dimension: inferredDimension || "systemsServices",
        relation: "mentions-system",
        reason: "announcement-about-system-not-system",
        disposition: "reference",
      });
    }

    if (guide) {
      return baseClassification({
        keep: false,
        entityType: "guide",
        dimension: inferredDimension || "systemsServices",
        relation: "guide-for-system",
        reason: "guide-about-system-not-system",
        disposition: "reference",
      });
    }

    if (ORGANIZATIONAL_NOT_SYSTEM.test(title)) {
      return baseClassification({
        keep: false,
        entityType: "unit-reference",
        dimension: inferTopicDimension(record, inferredDimension || "organization"),
        relation: "reference-only",
        reason: "organizational-entity-not-system-endpoint",
        disposition: "reference",
      });
    }

    if (NON_RESEARCH_SYSTEM_CONTEXT.test(text) && !RESEARCH_SYSTEM_CONTEXT.test(text)) {
      return baseClassification({
        keep: false,
        entityType: "non-research-system",
        dimension: "systemsServices",
        relation: "reference-only",
        reason: "general-administrative-system-out-of-research-scope",
        disposition: "reference",
      });
    }

    if (!actualSystemEndpoint(record)) {
      return baseClassification({
        keep: false,
        entityType: "service-page",
        dimension: inferredDimension || "systemsServices",
        relation: "mentions-system",
        reason: "system-endpoint-not-proven-by-research-context",
        disposition: "reference",
      });
    }

    // Different subdomains of the same institutional domain are still university-
    // owned. For example research.semnan.ac.ir -> sampad.semnan.ac.ir is an
    // internal university system, not an external system. Ownership is decided
    // at the registrable institutional-domain level, not by exact hostname.
    const external = validEntityUrl(record?.url) &&
      validEntityUrl(record?.sourceUrl) &&
      !sameInstitutionDomain(record.url, record.sourceUrl);

    const internalRelations = new Set([
      "unit-service",
      "managed-by-portal",
      "system-endpoint",
    ]);
    const semanticRelation = external
      ? (record?.relation === "linked-external-system" ? record.relation : "linked-external-system")
      : (internalRelations.has(record?.relation) ? record.relation : "system-endpoint");

    return baseClassification({
      keep: true,
      entityType: external ? "external-system" : "system",
      ownershipScope: external ? "external-specific" : "university",
      dimension: "systemsServices",
      relation: semanticRelation,
      reason: external ? "proven-research-external-system-endpoint" : "proven-university-system-endpoint",
      disposition: "catalog",
    });
  }

  if (catalogKind === "units") {
    const unitTargetText = normalizeEntityText([record?.url, record?.sourceUrl, record?.parentUrl].filter(Boolean).map(decodeSafe).join(" "));
    if (record?.discoveredBy && UNIT_PATH_NEGATIVE.test(unitTargetText)) {
      return baseClassification({
        keep: false,
        entityType: ANNOUNCEMENT_TEXT.test(title) ? "announcement" : "service-page",
        dimension: topicDimension || inferredDimension || "organization",
        relation: "reference-only",
        reason: "content-or-news-path-not-an-organizational-unit",
        disposition: "reference",
      });
    }

    if (directDocument(record)) {
      return baseClassification({
        keep: false,
        entityType: "document",
        dimension: "documentsRegulations",
        primaryDimension: "documentsRegulations",
        topicDimension,
        relation: "reference-only",
        reason: "downloadable-resource-not-an-organizational-unit",
        disposition: "reference",
      });
    }

    if (docIndex) {
      return baseClassification({
        keep: false,
        entityType: "document-index",
        dimension: "documentsRegulations",
        primaryDimension: "documentsRegulations",
        topicDimension,
        relation: "contains-documents",
        reason: "document-index-not-an-organizational-unit",
        disposition: "reference",
      });
    }

    if (guide || announcement || SERVICE_INFO_TEXT.test(title) || SERVICE_INFO_TEXT.test(identity) || UNIT_PROFILE_TEXT.test(title) || UNIT_PROFILE_TEXT.test(identity)) {
      const entityType = guide
        ? "guide"
        : announcement
          ? "announcement"
          : (UNIT_PROFILE_TEXT.test(title) || UNIT_PROFILE_TEXT.test(identity))
            ? "unit-profile"
            : "service-page";

      return baseClassification({
        keep: false,
        entityType,
        dimension: topicDimension || inferredDimension || "organization",
        relation: entityType === "unit-profile" ? "describes-unit" : "reference-only",
        reason: entityType === "unit-profile"
          ? "unit-profile-or-people-page-not-a-unit"
          : "content-page-not-an-organizational-unit",
        disposition: "reference",
      });
    }

    if (STRUCTURE_HUB_TEXT.test(identity)) {
      return baseClassification({
        keep: false,
        entityType: "organization-hub",
        dimension: "organization",
        relation: "contains-units",
        reason: "structure-page-not-a-unit",
        disposition: "reference",
      });
    }

    const inferredType = inferUnitType(record);
    const curated = !record?.discoveredBy;
    const strongIdentity = isStrongUnitIdentity(record);

    if (!inferredType && !(curated && record?.type && strongIdentity)) {
      return baseClassification({
        keep: false,
        entityType: "service-page",
        dimension: topicDimension || inferredDimension || "organization",
        relation: "reference-only",
        reason: "organizational-unit-not-proven",
        disposition: "reference",
      });
    }

    if (!strongIdentity) {
      return baseClassification({
        keep: false,
        entityType: "service-page",
        dimension: topicDimension || inferredDimension || "organization",
        relation: "reference-only",
        reason: "page-mentions-unit-but-lacks-unit-identity",
        disposition: "reference",
      });
    }

    return baseClassification({
      keep: true,
      entityType: "unit",
      dimension: inferredDimension === "documentsRegulations"
        ? (topicDimension || "organization")
        : (inferredDimension || "organization"),
      relation: record?.relation || "organizational-unit",
      reason: "organizational-unit-identity-proven",
      disposition: "catalog",
    });
  }

  throw new Error(`Unknown catalog kind: ${catalogKind}`);
}

function unitConceptKey(record) {
  const text = identityTitle(record);
  for (const [key, pattern] of UNIT_CONCEPT_PATTERNS) {
    if (pattern.test(text)) return key;
  }
  return null;
}

function systemConceptKey(record) {
  const text = semanticContentText(record);
  for (const [key, pattern] of SYSTEM_CONCEPT_PATTERNS) {
    if (pattern.test(text)) return key;
  }
  return null;
}

export function logicalEntityKey(record) {
  const slug = record?.universitySlug || "unknown";
  const entityType = record?.entityType || "entity";

  if (entityType === "unit") {
    const concept = unitConceptKey(record);
    if (concept) return `${slug}|unit|concept:${concept}`;

    const compactIdentity = identityTitle(record)
      .replace(/\s*[-–—|:]\s*دانشگاه.*$/iu, "")
      .replace(/\s+/g, " ")
      .trim();
    if (compactIdentity && compactIdentity.length <= 120) {
      return `${slug}|unit|type:${record?.type || "unknown"}|text:${compactIdentity}`;
    }
  }

  if (["system", "external-system"].includes(entityType)) {
    const concept = systemConceptKey(record);
    const host = canonicalHost(record?.url);
    if (concept && host) return `${slug}|system|concept:${concept}|host:${host}`;
    if (concept) return `${slug}|system|concept:${concept}`;
  }

  const target = canonicalEntityUrl(
    record?.url || record?.sourceUrl || record?.parentUrl,
    {ignoreLanguage: true}
  );

  if (target) return `${slug}|${entityType}|url:${target}`;

  return `${slug}|${entityType}|text:${normalizeEntityText(record?.nameFa || record?.title || "")}`;
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

function decodePathLabel(value) {
  if (!validEntityUrl(value)) return null;

  try {
    const url = new URL(String(value));
    const parts = url.pathname
      .split("/")
      .filter(Boolean)
      .map((part) => decodeSafe(part).replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim())
      .filter((part) =>
        part &&
        !/^(?:fa|en|ar|fa-ir|en-us|research|research-and-technology|page|pages|units?|unit|management|organizational-structure)$/i.test(part) &&
        !/^\d+$/.test(part)
      );

    const label = parts.at(-1) || null;
    if (!label || label.length < 3 || label.length > 160) return null;
    return label;
  } catch {
    return null;
  }
}

function normalizeDisplayLabel(value) {
  return decodeRepeated(String(value || ""))
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalUnitDisplayLabel(value) {
  let label = normalizeDisplayLabel(value);
  if (!label) return label;

  // Strip common site/language chrome that sometimes becomes part of crawler titles.
  label = label
    .replace(/\s*[|–—-]\s*(?:معاونت\s*پژوهش\s*و\s*فناوری(?:\s*دانشگاه[^|–—-]*)?|research\s+(?:and\s+)?technology[^|–—-]*|فارسی|english)\s*$/iu, "")
    .replace(/\s+(?:فارسی|english)\s*$/iu, "")
    .trim();

  const n = normalizeEntityText(label);

  // Canonicalize high-value logical unit concepts. This avoids labels such as
  // "کتابخانه مرکزی ... کتابخانه مرکزی ..." after merging multiple evidence pages.
  if (/کتابخانه\s*مرکزی(?:\s*و\s*مرکز\s*اسناد)?|central\s+library/iu.test(n)) {
    const hasInfo = /اطلاع[‌\s-]*رسانی/iu.test(n);
    const hasDocs = /مرکز\s*اسناد/iu.test(n);
    return hasInfo
      ? "کتابخانه مرکزی و مرکز اسناد و اطلاع‌رسانی"
      : hasDocs
        ? "کتابخانه مرکزی و مرکز اسناد"
        : "کتابخانه مرکزی";
  }
  if (/آزمایشگاه\s*مرکزی|central\s+(?:laboratory|lab)/iu.test(n)) return "آزمایشگاه مرکزی";
  if (/انتشارات\s*مرکزی|central\s+(?:publications?|publishing)/iu.test(n)) return "انتشارات مرکزی";

  return label;
}

function displayLabelQuality(value, entityType = null) {
  const label = normalizeDisplayLabel(value);
  if (!label) return -Infinity;

  const normalized = normalizeEntityText(label);
  if (!normalized || GENERIC_TITLES.has(normalized)) return -Infinity;
  if (/^https?:\/\//i.test(label) || /%(?:[0-9a-f]{2})/i.test(label)) return -Infinity;

  let score = Math.min(18, label.length / 8);
  if (/[آ-ی]/u.test(label)) score += 2;
  if (/کتابخانه|آزمایشگاه|انتشارات|پژوهش|صنعت|فناوری|مرکز|مدیریت|اداره|دفتر|سامانه|library|laborator|publishing|research|industry|technology|system/iu.test(label)) score += 4;
  if (/[|]/.test(label)) score -= 1;

  // For logical units, prefer a compact organizational identity and strongly
  // reject news/service/profile labels even when they are longer. This prevents
  // a merged news page from replacing the canonical Central Library name.
  if (entityType === "unit") {
    if (UNIT_IDENTITY_START.test(normalized) || SHORT_UNIT_IDENTITY.test(normalized)) score += 18;
    if (ANNOUNCEMENT_TEXT.test(normalized) || GUIDE_TEXT.test(normalized) ||
        SERVICE_INFO_TEXT.test(normalized) || UNIT_PROFILE_TEXT.test(normalized) ||
        DOCUMENT_INDEX_TEXT.test(normalized)) score -= 40;
    if (normalized.length > 140) score -= 18;
  }

  return score;
}

function bestEntityDisplayLabel(...records) {
  const candidates = [];
  const entityType = records.find(Boolean)?.entityType || null;

  for (const record of records.filter(Boolean)) {
    for (const value of [record.nameFa, record.title, record.originalTitle, record.label]) {
      const normalized = normalizeDisplayLabel(value);
      if (normalized) candidates.push(normalized);
    }

    for (const value of [record.url, record.sourceUrl, record.parentUrl]) {
      const derived = decodePathLabel(value);
      const normalized = normalizeDisplayLabel(derived);
      if (normalized) candidates.push(normalized);
    }
  }

  candidates.sort((a, b) =>
    displayLabelQuality(b, entityType) - displayLabelQuality(a, entityType)
  );
  const best = candidates.find((value) =>
    Number.isFinite(displayLabelQuality(value, entityType))
  ) || null;
  return entityType === "unit" && best ? canonicalUnitDisplayLabel(best) : best;
}

function evidenceUrlsOf(record) {
  return [
    record?.url,
    record?.sourceUrl,
    record?.parentUrl,
    ...(record?.evidenceUrls || []),
    ...(record?.alternateUrls || []),
  ].filter(validEntityUrl);
}

function entityTargetUrlsOf(record) {
  if (!record || typeof record !== "object") return [];

  // Systems must have an explicit target URL. Their source/parent pages are
  // provenance only and must never leak into alternateUrls.
  if (["system", "external-system"].includes(record.entityType)) {
    const sourceKey = canonicalEntityUrl(record.sourceUrl || record.parentUrl);
    return [record.url, ...(record.alternateUrls || [])]
      .filter(validEntityUrl)
      .filter((value) => {
        const key = canonicalEntityUrl(value);
        if (!key || key === sourceKey) return false;
        try {
          const url = new URL(value);
          if (url.pathname === "/" && !url.search && !url.hash) return false;
        } catch {
          return false;
        }
        return true;
      });
  }

  // Unit catalogs historically store the actual unit page in sourceUrl. Treat it
  // as an entity target only for units, so bilingual unit pages can still merge.
  if (record.entityType === "unit") {
    return [record.url || record.sourceUrl, ...(record.alternateUrls || [])].filter(validEntityUrl);
  }

  return [record.url, ...(record.alternateUrls || [])].filter(validEntityUrl);
}

export function mergeLogicalRecords(existing, incoming) {
  const preferred = quality(incoming) > quality(existing) ? incoming : existing;
  const secondary = preferred === incoming ? existing : incoming;

  const evidenceMap = new Map();
  for (const item of [...evidenceUrlsOf(existing), ...evidenceUrlsOf(incoming)]) {
    const key = canonicalEntityUrl(item);
    if (key && !evidenceMap.has(key)) evidenceMap.set(key, item);
  }

  const targetMap = new Map();
  for (const item of [...entityTargetUrlsOf(existing), ...entityTargetUrlsOf(incoming)]) {
    const key = canonicalEntityUrl(item);
    if (key && !targetMap.has(key)) targetMap.set(key, item);
  }

  const evidenceUrls = [...evidenceMap.values()];
  const preferredTarget = preferred.url || (preferred.entityType === "unit" ? preferred.sourceUrl : null);
  const preferredTargetKey = canonicalEntityUrl(preferredTarget);

  const merged = {
    ...secondary,
    ...preferred,
    id: existing.id || incoming.id,
    evidenceUrls,
    alternateUrls: [...targetMap.entries()]
      .filter(([key]) => key !== preferredTargetKey)
      .map(([, value]) => value),
  };

  const displayLabel = bestEntityDisplayLabel(existing, incoming, merged);
  if (["unit", "system", "external-system"].includes(merged.entityType) && displayLabel) {
    merged.nameFa = displayLabel;
  } else if (merged.entityType === "document" && displayLabel && !String(merged.title || "").trim()) {
    merged.title = displayLabel;
  }

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

  if (classification.primaryDimension) next.primaryDimension = classification.primaryDimension;
  if (classification.topicDimension && classification.topicDimension !== "informationTechnology") {
    next.topicDimension = classification.topicDimension;
  }
  if (classification.ownershipScope) next.ownershipScope = classification.ownershipScope;
  if (Object.prototype.hasOwnProperty.call(classification, "countTowardUniversitySystems")) {
    next.countTowardUniversitySystems = classification.countTowardUniversitySystems;
  }
  if (Object.prototype.hasOwnProperty.call(classification, "countTowardRTPMI")) {
    next.countTowardRTPMI = classification.countTowardRTPMI;
  }

  if (catalogKind === "units") {
    next.type = inferUnitType(record) || record.type || "research";
    if (!String(next.nameFa || next.title || "").trim()) {
      const fallbackLabel = bestEntityDisplayLabel(record);
      if (fallbackLabel) next.nameFa = fallbackLabel;
    }
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
      primaryDimension: "informationTechnology",
      topicDimension: null,
      entityType: "excluded-it",
      reason: "information-technology-out-of-public-scope",
    };
  }

  const docClassification = classifyCatalogRecord(record, "documents");
  const isDocumentLike = ["document", "document-index"].includes(docClassification.entityType);

  if (isDocumentLike) {
    if (originalDimension === "documentsRegulations") {
      return {
        keep: true,
        dimension: "documentsRegulations",
        primaryDimension: "documentsRegulations",
        topicDimension: docClassification.topicDimension,
        entityType: docClassification.entityType,
        reason: "document-reference-kept-in-documents-regulations",
      };
    }

    return {
      keep: false,
      dimension: "documentsRegulations",
      primaryDimension: "documentsRegulations",
      topicDimension: docClassification.topicDimension,
      entityType: docClassification.entityType,
      reason: "document-reference-routed-to-documents-regulations",
    };
  }

  const inferred = inferTopicDimension(record, inferDimension(record, originalDimension));

  if (originalDimension === "systemsServices") {
    if (GUIDE_TEXT.test(titleText(record)) || ANNOUNCEMENT_TEXT.test(titleText(record))) {
      return {
        keep: false,
        dimension: inferred,
        primaryDimension: inferred,
        topicDimension: null,
        entityType: GUIDE_TEXT.test(titleText(record)) ? "guide" : "announcement",
        reason: "reference-about-system-not-system-endpoint",
      };
    }

    if (matchedRecord) {
      const result = classifyCatalogRecord(matchedRecord, "systems");
      if (!result.keep) {
        return {
          keep: false,
          dimension: result.dimension,
          primaryDimension: result.dimension,
          topicDimension: result.topicDimension,
          entityType: result.entityType,
          reason: result.reason,
        };
      }
    } else if (!systemHostSignal(url) || !RESEARCH_SYSTEM_CONTEXT.test(text)) {
      return {
        keep: false,
        dimension: inferred,
        primaryDimension: inferred,
        topicDimension: null,
        entityType: "service-page",
        reason: "research-system-endpoint-unproven",
      };
    }
  }

  return {
    keep: true,
    dimension: inferred || originalDimension,
    primaryDimension: inferred || originalDimension,
    topicDimension: null,
    entityType: "dimension-reference",
    reason: inferred && inferred !== originalDimension
      ? "dimension-reclassified-from-semantic-context"
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

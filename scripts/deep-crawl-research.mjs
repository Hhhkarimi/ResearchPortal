/**
 * Multi-hub deep crawler for official Iranian university research portals.
 *
 * Document mode: metadata-only.
 * - Never archives PDF/DOCX/XLSX/etc bodies on the runner.
 * - Uses HEAD, with a Range GET fallback, to verify document metadata.
 * - Enriches vague labels such as "دانلود فایل" from table rows, cards,
 *   nearby headings, Content-Disposition filenames, and page context.
 */
import fs from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CRAWLER_VERSION =
  "13.0-smart-title-checkpoint";

const readJson = async (file, fallback) => {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
};

const intEnv = (name, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) => {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

const floatEnv = (name, fallback, min = 0, max = 1) => {
  const n = Number.parseFloat(process.env[name] ?? "");
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

const CONFIG = {
  maxDepth: intEnv("CRAWL_MAX_DEPTH", 6, 1, 8),
  maxPagesPerUniversity: intEnv("CRAWL_MAX_PAGES_PER_UNIVERSITY", 90, 10, 250),
  maxPagesPerHub: intEnv("CRAWL_MAX_PAGES_PER_HUB", 35, 5, 100),
  maxResearchHubs: intEnv("CRAWL_MAX_RESEARCH_HUBS", 12, 1, 40),
  maxDocumentsPerUniversity: intEnv("CRAWL_MAX_DOCUMENTS_PER_UNIVERSITY", 100, 1, 300),
  pageTimeoutMs: intEnv("CRAWL_PAGE_TIMEOUT_MS", 12_000, 2_000, 60_000),
  documentTimeoutMs: intEnv("CRAWL_DOCUMENT_TIMEOUT_MS", 15_000, 3_000, 60_000),
  browserTimeoutMs: intEnv("CRAWL_BROWSER_TIMEOUT_MS", 25_000, 3_000, 90_000),
  pageConcurrency: intEnv("CRAWL_PAGE_CONCURRENCY", 3, 1, 10),
  universityConcurrency: intEnv("CRAWL_UNIVERSITY_CONCURRENCY", 3, 1, 12),
  maxHtmlBytes: intEnv(
    "CRAWL_MAX_HTML_BYTES",
    3_500_000,
    100_000,
    12_000_000
  ),

  useBrowserFallback:
    (
      process.env
        .CRAWL_USE_BROWSER_FALLBACK ??
      "1"
    ) !== "0",

  discoveryThreshold: floatEnv(
    "CRAWL_DISCOVERY_THRESHOLD",
    0.62,
    0.2,
    1
  ),

  checkpointIntervalMs: intEnv(
    "CRAWL_CHECKPOINT_INTERVAL_MS",
    1_800_000,
    60_000,
    7_200_000
  ),

  checkpointDir:
    path.resolve(
      process.env
        .CRAWL_CHECKPOINT_DIR ||
      "data/crawl-checkpoints"
    ),

  checkpointPush:
    (
      process.env
        .CRAWL_CHECKPOINT_PUSH ??
      "1"
    ) !== "0",

  checkpointReset:
    (
      process.env
        .CRAWL_CHECKPOINT_RESET ??
      "0"
    ) === "1",
};

const SOCIAL_HOSTS = [
  "t.me", "telegram.me", "telegram.org", "instagram.com", "facebook.com",
  "fb.com", "x.com", "twitter.com", "linkedin.com", "youtube.com", "youtu.be",
];

const DOC_EXTS = new Set([
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".rtf", ".odt", ".ods", ".odp", ".zip",
]);

const ASSET_EXTS = new Set([
  ".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
  ".ico", ".woff", ".woff2", ".ttf", ".eot", ".map",
]);

const DOC_MIME_HINTS = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats",
  "application/vnd.ms-",
  "application/rtf",
  "application/vnd.oasis.opendocument",
  "application/zip",
  "application/octet-stream",
];

const NEGATIVE = [
  "اخبار", "خبر", "رویداد", "تقویم", "آموزش", "پذیرش", "دانشجو", "ثبت نام",
  "news", "event", "calendar", "admission", "education", "undergraduate", "login", "ورود",
];

const PORTAL_KEYWORDS = [
  "معاونت پژوهشی", "معاونت پژوهش", "معاونت پژوهش و فناوری", "پژوهش و فناوری",
  "امور پژوهشی", "مدیریت پژوهش", "پرتال پژوهش", "research affairs",
  "research deputy", "vice chancellor for research", "vice-chancellor for research",
  "research and technology", "research & technology", "office of research", "research", "vpr",
];

const HUB_KEYWORDS = [
  "مدیریت پژوهشی", "مدیریت پژوهش", "مدیریت امور پژوهشی", "امور پژوهشی",
  "دفتر پژوهش", "اداره پژوهش", "معاونت پژوهشی", "معاونت پژوهش",
  "معاونت پژوهش و فناوری", "پژوهش و فناوری", "مدیریت فناوری",
  "ارتباط با صنعت", "جامعه و صنعت", "صنعت و جامعه", "آزمایشگاه مرکزی",
  "شبکه آزمایشگاهی", "کتابخانه مرکزی", "مرکز اسناد", "فرایندهای پژوهشی",
  "فرآیندهای پژوهشی", "فرم های پژوهشی", "فرم‌های پژوهشی",
  "research management", "research administration", "research affairs", "research office",
  "office of research", "vice chancellor for research", "research and technology",
  "technology transfer", "industry liaison", "central laboratory", "central library",
  "/web/mrt/", "/mrt/", "/research/", "/research-affairs/", "/research-management/",
  "/researchoffice/", "/vpr/",
];

const DIMENSIONS = {
  organization: {
    labelFa: "ساختار سازمانی",
    keywords: [
      "ساختار سازمانی", "چارت سازمانی", "ساختار معاونت", "مدیریت پژوهش",
      "مدیریت پژوهشی", "مدیریت امور پژوهشی", "کارشناسان پژوهش", "کارکنان معاونت",
      "واحدهای پژوهشی", "مدیران معاونت", "organizational structure", "research units",
      "research management", "departments", "staff",
    ],
  },
  libraryDocuments: {
    labelFa: "کتابخانه و اسناد",
    keywords: [
      "کتابخانه", "کتابخانه مرکزی", "مرکز اسناد", "انتشارات", "نشریات علمی",
      "مجلات علمی", "library", "central library", "document center", "publication", "journals",
    ],
  },
  laboratories: {
    labelFa: "آزمایشگاه‌ها",
    keywords: [
      "آزمایشگاه", "آزمایشگاه مرکزی", "شبکه آزمایشگاهی", "کارگاه پژوهشی",
      "laboratory", "laboratories", "central lab", "lab network", "research lab",
    ],
  },
  industryTechnology: {
    labelFa: "صنعت و فناوری",
    keywords: [
      "ارتباط با صنعت", "جامعه و صنعت", "صنعت و جامعه", "فناوری و نوآوری",
      "انتقال فناوری", "مالکیت فکری", "مرکز رشد", "شرکت دانش بنیان", "شرکت دانش‌بنیان",
      "کارآفرینی", "نوآوری", "industry", "technology transfer", "innovation",
      "intellectual property", "incubator", "tto",
    ],
  },
  informationTechnology: {
    labelFa: "فناوری اطلاعات",
    keywords: [
      "فناوری اطلاعات", "فناوری اطلاعات و ارتباطات", "مرکز فناوری اطلاعات",
      "مرکز کامپیوتر", "خدمات فناوری اطلاعات", "information technology",
      "computer center", "ict center", "it center", "ict",
    ],
  },
  systemsServices: {
    labelFa: "سامانه‌ها و خدمات",
    keywords: [
      "سامانه", "سامانه ها", "سامانه‌ها", "خدمات الکترونیکی", "خدمات پژوهشی",
      "پژوهشیار", "علم سنجی", "علم‌سنجی", "پایان نامه", "پایان‌نامه", "نشریات",
      "system", "systems", "service", "services", "research system", "journals system",
      "thesis system",
    ],
  },
  documentsRegulations: {
    labelFa: "اسناد و مقررات",
    keywords: [
      "آیین نامه", "آیین‌نامه", "شیوه نامه", "شیوه‌نامه", "دستورالعمل", "بخشنامه",
      "مقررات", "فرایند", "فرآیند", "فرایندها", "فرآیندها", "فرم", "فرم ها", "فرم‌ها",
      "دانلود فرم", "راهنما", "ضوابط", "سیاست", "اسناد", "مستندات", "regulation",
      "bylaw", "guideline", "procedure", "process", "workflow", "policy", "circular",
      "forms", "documents", "download",
    ],
  },
};

const DOC_KEYWORDS = [
  ...DIMENSIONS.documentsRegulations.keywords,
  "گرنت", "پژوهانه", "طرح پژوهشی", "پروپوزال", "پایان نامه", "پایان‌نامه", "رساله",
  "اخلاق پژوهش", "فرصت مطالعاتی", "قرارداد پژوهشی", "مالکیت فکری",
  "research grant", "research proposal", "thesis", "dissertation", "research ethics",
  "research contract",
];

const GENERIC_DOCUMENT_LABELS = [
  "دانلود", "دانلود فایل", "دانلود pdf", "دانلود word", "دانلود ورد",
  "دریافت", "دریافت فایل", "دریافت pdf", "دریافت word", "دریافت ورد",
  "فایل", "فایل پیوست", "پیوست", "پیوست فایل", "مشاهده", "مشاهده فایل",
  "مشاهده پیوست", "اینجا", "اینجا کلیک کنید", "کلیک کنید", "برای دانلود کلیک کنید",
  "pdf", "word", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "download", "download file", "view", "view file", "attachment", "click here", "file",
];

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\u200c/g, " ")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ۀ/g, "ه")
    .replace(/[\u064B-\u065F]/g, "")
    .replace(/[^\p{L}\p{N}./:&?=_-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const N_PORTAL = PORTAL_KEYWORDS.map(normalizeText);
const N_HUB = HUB_KEYWORDS.map(normalizeText);
const N_DOC = DOC_KEYWORDS.map(normalizeText);
const N_GENERIC_DOC = new Set(GENERIC_DOCUMENT_LABELS.map(normalizeText));

const N_DIMS = Object.fromEntries(
  Object.entries(DIMENSIONS).map(
    ([key, value]) => [
      key,
      value.keywords.map(normalizeText),
    ]
  )
);

const stripWww = (host) =>
  String(host)
    .toLowerCase()
    .replace(/^www\./, "");

const hostMatches = (host, expected) =>
  host === expected ||
  host.endsWith(`.${expected}`);

const isBlockedHost = (host) =>
  SOCIAL_HOSTS.some(
    (expected) =>
      hostMatches(
        stripWww(host),
        expected
      )
  );

function isUnsafeHost(host) {
  const value = stripWww(host);

  if (
    value === "localhost" ||
    value.endsWith(".localhost") ||
    value.endsWith(".local") ||
    value.endsWith(".internal")
  ) {
    return true;
  }

  if (
    !value.includes(".") &&
    net.isIP(value) === 0
  ) {
    return true;
  }

  if (!net.isIP(value)) {
    return false;
  }

  return (
    value.startsWith("10.") ||
    value.startsWith("127.") ||
    value.startsWith("169.254.") ||
    value.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(value) ||
    value === "::1" ||
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    value.startsWith("fe80:")
  );
}

function safeHttpUrl(value, base) {
  try {
    const url = base
      ? new URL(value, base)
      : new URL(value);

    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    if (
      isBlockedHost(url.hostname) ||
      isUnsafeHost(url.hostname)
    ) {
      return null;
    }

    url.hash = "";

    for (
      const key of
        [...url.searchParams.keys()]
    ) {
      if (
        key.toLowerCase().startsWith("utm_") ||
        [
          "fbclid",
          "gclid",
          "mc_cid",
          "mc_eid",
        ].includes(key.toLowerCase())
      ) {
        url.searchParams.delete(key);
      }
    }

    return url;
  } catch {
    return null;
  }
}

function canonicalUrl(value) {
  const url = safeHttpUrl(value);

  if (!url) {
    return null;
  }

  url.hostname =
    stripWww(url.hostname);

  if (url.pathname.length > 1) {
    url.pathname =
      url.pathname.replace(/\/+$/, "");
  }

  return url.toString();
}

function baseDomain(host) {
  const value =
    stripWww(host);

  if (net.isIP(value)) {
    return value;
  }

  const parts =
    value
      .split(".")
      .filter(Boolean);

  if (parts.length <= 2) {
    return value;
  }

  if (
    [
      ".ac.ir",
      ".gov.ir",
      ".org.ir",
      ".co.ir",
      ".id.ir",
      ".sch.ir",
    ].some(
      (suffix) =>
        value.endsWith(suffix)
    )
  ) {
    return parts
      .slice(-3)
      .join(".");
  }

  return parts
    .slice(-2)
    .join(".");
}

function isInstitutionUrl(value, bases) {
  const url =
    safeHttpUrl(value);

  return Boolean(
    url &&
    bases.has(
      baseDomain(url.hostname)
    )
  );
}

function decodeURIComponentSafe(value) {
  try {
    return decodeURIComponent(
      String(value)
    );
  } catch {
    return String(value);
  }
}

function countHits(text, words) {
  const normalized =
    normalizeText(text);

  return words.reduce(
    (count, word) =>
      count +
      (
        word &&
        normalized.includes(word)
          ? 1
          : 0
      ),
    0
  );
}

function weightedSignal(
  {
    anchor = "",
    url = "",
    title = "",
    body = "",
  },
  words
) {
  const anchorHits =
    countHits(anchor, words);

  const urlHits =
    countHits(
      decodeURIComponentSafe(url),
      words
    );

  const titleHits =
    countHits(title, words);

  const bodyHits =
    countHits(
      String(body).slice(0, 18_000),
      words
    );

  return {
    anchorHits,
    urlHits,
    titleHits,
    bodyHits,

    score:
      Math.min(anchorHits, 3) * 5 +
      Math.min(urlHits, 3) * 4 +
      Math.min(titleHits, 3) * 4 +
      Math.min(bodyHits, 3),
  };
}

const portalSignal = (context) =>
  weightedSignal(
    context,
    N_PORTAL
  );

const hubSignal = (context) =>
  weightedSignal(
    context,
    N_HUB
  );

const dimensionSignals = (context) =>
  Object.fromEntries(
    Object.entries(N_DIMS).map(
      ([key, words]) => [
        key,
        weightedSignal(
          context,
          words
        ),
      ]
    )
  );

const confidence = (
  score,
  floor = 0.5
) =>
  Math.max(
    floor,
    Math.min(
      0.99,
      floor + score / 38
    )
  );

const hasNegative = (text) =>
  NEGATIVE.some(
    (word) =>
      normalizeText(text).includes(
        normalizeText(word)
      )
  );

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(
      /&#x([0-9a-f]+);/gi,
      (_, hex) =>
        String.fromCodePoint(
          parseInt(hex, 16)
        )
    )
    .replace(
      /&#(\d+);/g,
      (_, number) =>
        String.fromCodePoint(
          parseInt(number, 10)
        )
    );
}

function stripTags(value) {
  return decodeHtml(
    String(value ?? "")
      .replace(
        /<script\b[\s\S]*?<\/script>/gi,
        " "
      )
      .replace(
        /<style\b[\s\S]*?<\/style>/gi,
        " "
      )
      .replace(
        /<noscript\b[\s\S]*?<\/noscript>/gi,
        " "
      )
      .replace(
        /<!--[\s\S]*?-->/g,
        " "
      )
      .replace(
        /<[^>]+>/g,
        " "
      )
  )
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(
  value,
  max = 500
) {
  return stripTags(value)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

const extractTitle = (html) => {
  const match =
    String(html).match(
      /<title\b[^>]*>([\s\S]*?)<\/title>/i
    );

  return match
    ? compactText(match[1], 300)
    : "";
};

function attr(attrs, name) {
  const escaped =
    name.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

  const quoted =
    attrs.match(
      new RegExp(
        `\\b${escaped}\\s*=\\s*(["'])([\\s\\S]*?)\\1`,
        "i"
      )
    );

  if (quoted) {
    return decodeHtml(
      quoted[2].trim()
    );
  }

  const unquoted =
    attrs.match(
      new RegExp(
        `\\b${escaped}\\s*=\\s*([^\\s>]+)`,
        "i"
      )
    );

  return unquoted
    ? decodeHtml(
        unquoted[1].trim()
      )
    : "";
}

function isGenericDocumentLabel(value) {
  const normalized =
    normalizeText(value);

  if (!normalized) {
    return true;
  }

  if (
    N_GENERIC_DOC.has(normalized)
  ) {
    return true;
  }

  if (
    /^(?:pdf|word|docx?|xlsx?|pptx?|فایل|پیوست)(?:\s*\d+)?$/i
      .test(normalized)
  ) {
    return true;
  }

  if (
    /^(?:دانلود|دریافت|مشاهده)(?:\s+(?:فایل|پیوست|pdf|word|ورد))?$/i
      .test(normalized)
  ) {
    return true;
  }

  if (
    /^(?:download|view)(?:\s+(?:file|attachment|pdf|word))?$/i
      .test(normalized)
  ) {
    return true;
  }

  return false;
}

function stripGenericDocumentNoise(value) {
  let text =
    compactText(value, 360);

  text =
    text
      .replace(
        /(?:برای\s+)?دانلود(?:\s+(?:فایل|پیوست|pdf|word|ورد))?/gi,
        " "
      )
      .replace(
        /دریافت(?:\s+(?:فایل|پیوست|pdf|word|ورد))?/gi,
        " "
      )
      .replace(
        /مشاهده(?:\s+(?:فایل|پیوست))?/gi,
        " "
      )
      .replace(
        /اینجا\s+کلیک\s+کنید|کلیک\s+کنید/gi,
        " "
      )
      .replace(
        /\b(?:download|view|click here|attachment)\b/gi,
        " "
      )
      .replace(
        /\b(?:pdf|docx?|xlsx?|pptx?|word)\b/gi,
        " "
      )
      .replace(
        /[|•·»«]+/g,
        " "
      )
      .replace(/\s+/g, " ")
      .trim();

  return text;
}

function isUsefulDocumentTitle(value) {
  const text =
    stripGenericDocumentNoise(value);

  if (
    !text ||
    isGenericDocumentLabel(text)
  ) {
    return false;
  }

  if (
    /^https?:\/\//i.test(text)
  ) {
    return false;
  }

  if (
    /^[\d._-]+$/.test(text)
  ) {
    return false;
  }

  const letters =
    text.match(/\p{L}/gu)
      ?.length ??
    0;

  return (
    letters >= 3 &&
    text.length >= 4 &&
    text.length <= 300
  );
}

function findLastTagBlock(
  source,
  anchorIndex,
  tag,
  maxBefore = 6000,
  maxAfter = 6000
) {
  const lower =
    source.toLowerCase();

  const openNeedle =
    `<${tag}`;

  const closeNeedle =
    `</${tag}>`;

  const open =
    lower.lastIndexOf(
      openNeedle,
      anchorIndex
    );

  if (
    open < 0 ||
    anchorIndex - open >
      maxBefore
  ) {
    return null;
  }

  const close =
    lower.indexOf(
      closeNeedle,
      anchorIndex
    );

  if (
    close < 0 ||
    close - anchorIndex >
      maxAfter
  ) {
    return null;
  }

  return source.slice(
    open,
    close +
      closeNeedle.length
  );
}

function extractNearestHeading(
  source,
  anchorIndex
) {
  const start =
    Math.max(
      0,
      anchorIndex - 6000
    );

  const before =
    source.slice(
      start,
      anchorIndex
    );

  const regex =
    /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;

  let match;
  let last = "";

  while (
    (
      match =
        regex.exec(before)
    )
  ) {
    const text =
      compactText(
        match[2],
        240
      );

    if (text) {
      last = text;
    }
  }

  return last;
}

function extractCardLikeContext(
  source,
  anchorIndex
) {
  const start =
    Math.max(
      0,
      anchorIndex - 5000
    );

  const before =
    source.slice(
      start,
      anchorIndex
    );

  const regex =
    /<(div|section|article)\b([^>]*)>/gi;

  let match;
  let best = null;

  while (
    (
      match =
        regex.exec(before)
    )
  ) {
    const attrs =
      match[2] ||
      "";

    const marker =
      `${attr(attrs, "class")} ${attr(attrs, "id")}`;

    if (
      !/(?:card|panel|document|download|file|attachment|item|box|content|regulation|form|row)/i
        .test(marker)
    ) {
      continue;
    }

    best = {
      tag:
        match[1]
          .toLowerCase(),

      absoluteOpen:
        start +
        match.index,
    };
  }

  if (!best) {
    return null;
  }

  const lower =
    source.toLowerCase();

  const closeNeedle =
    `</${best.tag}>`;

  const close =
    lower.indexOf(
      closeNeedle,
      anchorIndex
    );

  if (
    close < 0 ||
    close - anchorIndex >
      7000
  ) {
    return null;
  }

  return source.slice(
    best.absoluteOpen,
    close +
      closeNeedle.length
  );
}

function extractAnchorContext(
  source,
  matchStart,
  matchEnd,
  attrs,
  innerHtml
) {
  const rawAnchorText =
    compactText(
      innerHtml,
      500
    );

  const titleAttr =
    compactText(
      attr(attrs, "title"),
      300
    );

  const ariaLabel =
    compactText(
      attr(attrs, "aria-label"),
      300
    );

  const dataTitle =
    compactText(
      attr(attrs, "data-title"),
      300
    );

  const downloadName =
    compactText(
      attr(attrs, "download"),
      200
    );

  const sectionHeading =
    extractNearestHeading(
      source,
      matchStart
    );

  let contextText = "";
  let contextKind = "";

  const row =
    findLastTagBlock(
      source,
      matchStart,
      "tr",
      5000,
      5000
    );

  if (row) {
    contextText =
      compactText(
        row,
        600
      );

    contextKind =
      "table-row";
  }

  if (!contextText) {
    const listItem =
      findLastTagBlock(
        source,
        matchStart,
        "li",
        4500,
        4500
      );

    if (listItem) {
      contextText =
        compactText(
          listItem,
          520
        );

      contextKind =
        "list-item";
    }
  }

  if (!contextText) {
    const article =
      findLastTagBlock(
        source,
        matchStart,
        "article",
        6000,
        6000
      );

    if (article) {
      contextText =
        compactText(
          article,
          600
        );

      contextKind =
        "article";
    }
  }

  if (!contextText) {
    const card =
      extractCardLikeContext(
        source,
        matchStart
      );

    if (card) {
      contextText =
        compactText(
          card,
          600
        );

      contextKind =
        "card";
    }
  }

  if (!contextText) {
    const nearby =
      source.slice(
        Math.max(
          0,
          matchStart - 700
        ),

        Math.min(
          source.length,
          matchEnd + 500
        )
      );

    contextText =
      compactText(
        nearby,
        420
      );

    contextKind =
      "nearby-text";
  }

  return {
    rawAnchorText,
    titleAttr,
    ariaLabel,
    dataTitle,
    downloadName,
    contextText,
    contextKind,
    sectionHeading,
  };
}

function addLink(
  output,
  seen,
  value,
  pageUrl,
  extra = {}
) {
  const url =
    safeHttpUrl(
      value,
      pageUrl
    );

  if (!url) {
    return;
  }

  if (
    ASSET_EXTS.has(
      path
        .extname(
          url.pathname
        )
        .toLowerCase()
    )
  ) {
    return;
  }

  const key =
    canonicalUrl(
      url.toString()
    ) ||
    url.toString();

  if (
    seen.has(key)
  ) {
    return;
  }

  seen.add(key);

  output.push({
    url:
      url.toString(),

    anchorText:
      extra.anchorText ||
      "",

    title:
      extra.title ||
      "",

    rawAnchorText:
      extra.rawAnchorText ||
      extra.anchorText ||
      "",

    titleAttr:
      extra.titleAttr ||
      "",

    ariaLabel:
      extra.ariaLabel ||
      "",

    dataTitle:
      extra.dataTitle ||
      "",

    downloadName:
      extra.downloadName ||
      "",

    contextText:
      extra.contextText ||
      "",

    contextKind:
      extra.contextKind ||
      "",

    sectionHeading:
      extra.sectionHeading ||
      "",

    discoveryKind:
      extra.discoveryKind ||
      "html",
  });
}

function extractLinks(
  html,
  pageUrl
) {
  const output = [];
  const seen =
    new Set();

  const source =
    String(
      html ?? ""
    );

  let match;

  const anchorRegex =
    /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;

  while (
    (
      match =
        anchorRegex.exec(
          source
        )
    )
  ) {
    const attrs =
      match[1];

    const href =
      attr(
        attrs,
        "href"
      );

    if (!href) {
      continue;
    }

    const context =
      extractAnchorContext(
        source,
        match.index,
        anchorRegex.lastIndex,
        attrs,
        match[2]
      );

    addLink(
      output,
      seen,
      href,
      pageUrl,
      {
        anchorText:
          context
            .rawAnchorText,

        title:
          context.titleAttr ||
          context.ariaLabel ||
          context.dataTitle,

        ...context,

        discoveryKind:
          "anchor",
      }
    );
  }

  const iframeRegex =
    /<iframe\b([^>]*)>/gi;

  while (
    (
      match =
        iframeRegex.exec(
          source
        )
    )
  ) {
    const value =
      attr(
        match[1],
        "src"
      );

    const title =
      compactText(
        attr(
          match[1],
          "title"
        ),
        300
      );

    if (value) {
      addLink(
        output,
        seen,
        value,
        pageUrl,
        {
          anchorText:
            title,

          title,

          rawAnchorText:
            title,

          discoveryKind:
            "iframe",
        }
      );
    }
  }

  const clickableRegex =
    /<(button|div|li|span)\b([^>]*)>([\s\S]*?)<\/\1>/gi;

  while (
    (
      match =
        clickableRegex.exec(
          source
        )
    )
  ) {
    const attrs =
      match[2];

    const text =
      compactText(
        match[3],
        500
      );

    const values = [
      attr(
        attrs,
        "data-href"
      ),

      attr(
        attrs,
        "data-url"
      ),

      attr(
        attrs,
        "data-link"
      ),

      attr(
        attrs,
        "data-target-url"
      ),
    ].filter(Boolean);

    const onclick =
      attr(
        attrs,
        "onclick"
      );

    if (onclick) {
      const value =
        onclick.match(
          /(?:location(?:\.href)?|window\.location)\s*=\s*["']([^"']+)["']/i
        )?.[1] ||

        onclick.match(
          /(?:open|navigate|goTo|goto)\s*\(\s*["']([^"']+)["']/i
        )?.[1];

      if (value) {
        values.push(value);
      }
    }

    for (
      const value of values
    ) {
      addLink(
        output,
        seen,
        value,
        pageUrl,
        {
          anchorText:
            text,

          rawAnchorText:
            text,

          title:
            compactText(
              attr(
                attrs,
                "title"
              ),
              300
            ),

          titleAttr:
            compactText(
              attr(
                attrs,
                "title"
              ),
              300
            ),

          ariaLabel:
            compactText(
              attr(
                attrs,
                "aria-label"
              ),
              300
            ),

          contextText:
            text,

          contextKind:
            "click-target",

          discoveryKind:
            "click-target",
        }
      );
    }
  }

  const javascript =
    decodeHtml(source)
      .replace(
        /\\\//g,
        "/"
      );

  const embeddedRegex =
    /["'`]((?:https?:\/\/|\/)[^"'`<>\s]{2,800})["'`]/gi;

  while (
    (
      match =
        embeddedRegex.exec(
          javascript
        )
    )
  ) {
    const url =
      safeHttpUrl(
        match[1],
        pageUrl
      );

    if (
      !url ||
      ASSET_EXTS.has(
        path
          .extname(
            url.pathname
          )
          .toLowerCase()
      )
    ) {
      continue;
    }

    const context = {
      anchor: "",
      url:
        url.toString(),
      title: "",
      body: "",
    };

    const dimensions =
      dimensionSignals(
        context
      );

    const dimensionMax =
      Math.max(
        0,
        ...Object
          .values(
            dimensions
          )
          .map(
            (signal) =>
              signal.score
          )
      );

    if (
      !DOC_EXTS.has(
        path
          .extname(
            url.pathname
          )
          .toLowerCase()
      ) &&

      portalSignal(
        context
      ).score < 4 &&

      hubSignal(
        context
      ).score < 4 &&

      dimensionMax < 4
    ) {
      continue;
    }

    addLink(
      output,
      seen,
      url.toString(),
      pageUrl,
      {
        discoveryKind:
          "embedded-url",
      }
    );
  }

  return output;
}

const isHtml = (
  contentType
) => {
  const value =
    String(
      contentType ?? ""
    ).toLowerCase();

  return (
    !value ||
    value.includes(
      "text/html"
    ) ||
    value.includes(
      "application/xhtml+xml"
    )
  );
};

const looksDocMime = (
  contentType
) =>
  DOC_MIME_HINTS.some(
    (hint) =>
      String(
        contentType ?? ""
      )
        .toLowerCase()
        .includes(hint)
  );

function extOf(value) {
  const url =
    safeHttpUrl(value);

  if (!url) {
    return "";
  }

  const extension =
    path
      .extname(
        url.pathname
      )
      .toLowerCase();

  return DOC_EXTS.has(
    extension
  )
    ? extension
    : "";
}

const looksDocLink = (
  link
) =>
  Boolean(
    extOf(link.url)
  ) ||

  countHits(
    `${link.anchorText} ${link.title} ${link.contextText} ${link.sectionHeading} ${decodeURIComponentSafe(link.url)}`,
    N_DOC
  ) > 0;

async function readLimited(
  response,
  max
) {
  const declared =
    Number.parseInt(
      response.headers.get(
        "content-length"
      ) || "",
      10
    );

  if (
    Number.isFinite(
      declared
    ) &&
    declared > max
  ) {
    throw new Error(
      `response-too-large:${declared}`
    );
  }

  if (!response.body) {
    const buffer =
      Buffer.from(
        await response
          .arrayBuffer()
      );

    if (
      buffer.length > max
    ) {
      throw new Error(
        `response-too-large:${buffer.length}`
      );
    }

    return buffer;
  }

  const reader =
    response.body
      .getReader();

  const chunks = [];

  let total = 0;

  try {
    while (true) {
      const {
        value,
        done,
      } =
        await reader.read();

      if (done) {
        break;
      }

      const chunk =
        Buffer.from(value);

      total +=
        chunk.length;

      if (
        total > max
      ) {
        await reader.cancel();

        throw new Error(
          `response-too-large:${total}`
        );
      }

      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock?.();
  }

  return Buffer.concat(
    chunks
  );
}

const headers = {
  "User-Agent":
    "IranResearchPortalObservatory/12.2 (+multi-hub-smart-document-metadata)",

  Accept:
    "text/html,application/xhtml+xml,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,*/*;q=0.4",

  "Accept-Language":
    "fa-IR,fa;q=0.9,en;q=0.5",
};

function responseMetadata(
  response
) {
  const contentRange =
    response.headers.get(
      "content-range"
    ) || "";

  const totalFromRange =
    contentRange.match(
      /\/(\d+)\s*$/
    )?.[1];

  const rawLength =
    totalFromRange ||
    response.headers.get(
      "content-length"
    ) ||
    "";

  const contentLength =
    Number.parseInt(
      rawLength,
      10
    );

  return {
    finalUrl:
      response.url,

    status:
      response.status,

    ok:
      response.ok,

    contentType:
      response.headers.get(
        "content-type"
      ) || "",

    contentLength:
      Number.isFinite(
        contentLength
      )
        ? contentLength
        : null,

    headers: {
      contentDisposition:
        response.headers.get(
          "content-disposition"
        ),

      etag:
        response.headers.get(
          "etag"
        ),

      lastModified:
        response.headers.get(
          "last-modified"
        ),

      acceptRanges:
        response.headers.get(
          "accept-ranges"
        ),
    },
  };
}

async function fetchResource(
  url,
  timeout,
  max
) {
  const response =
    await fetch(
      url,
      {
        redirect:
          "follow",

        headers,

        signal:
          AbortSignal.timeout(
            timeout
          ),
      }
    );

  const buffer =
    await readLimited(
      response,
      max
    );

  return {
    ...responseMetadata(
      response
    ),

    buffer,
  };
}

async function fetchPageResource(
  url,
  timeout,
  max
) {
  const response =
    await fetch(
      url,
      {
        redirect:
          "follow",

        headers,

        signal:
          AbortSignal.timeout(
            timeout
          ),
      }
    );

  const metadata =
    responseMetadata(
      response
    );

  if (
    !isHtml(
      metadata.contentType
    )
  ) {
    try {
      await response
        .body
        ?.cancel();
    } catch {}

    return {
      ...metadata,
      buffer:
        Buffer.alloc(0),
    };
  }

  const buffer =
    await readLimited(
      response,
      max
    );

  return {
    ...metadata,
    buffer,
  };
}

async function probeDocument(
  url
) {
  const request =
    async (
      method,
      extraHeaders = {}
    ) => {
      const response =
        await fetch(
          url,
          {
            method,
            redirect:
              "follow",

            headers: {
              ...headers,
              ...extraHeaders,
            },

            signal:
              AbortSignal.timeout(
                CONFIG
                  .documentTimeoutMs
              ),
          }
        );

      const metadata =
        responseMetadata(
          response
        );

      try {
        await response
          .body
          ?.cancel();
      } catch {}

      return metadata;
    };

  try {
    const head =
      await request(
        "HEAD"
      );

    if (
      head.ok &&
      ![
        405,
        501,
      ].includes(
        head.status
      )
    ) {
      return head;
    }
  } catch {}

  return request(
    "GET",
    {
      Range:
        "bytes=0-0",
    }
  );
}

async function findBrowser() {
  if (
    !CONFIG
      .useBrowserFallback
  ) {
    return null;
  }

  const candidates = [
    process.env
      .CRAWL_BROWSER_PATH,

    process.env
      .PROGRAMFILES &&
      path.join(
        process.env
          .PROGRAMFILES,
        "Microsoft",
        "Edge",
        "Application",
        "msedge.exe"
      ),

    process.env[
      "PROGRAMFILES(X86)"
    ] &&
      path.join(
        process.env[
          "PROGRAMFILES(X86)"
        ],
        "Microsoft",
        "Edge",
        "Application",
        "msedge.exe"
      ),

    process.env
      .PROGRAMFILES &&
      path.join(
        process.env
          .PROGRAMFILES,
        "Google",
        "Chrome",
        "Application",
        "chrome.exe"
      ),

    process.env
      .LOCALAPPDATA &&
      path.join(
        process.env
          .LOCALAPPDATA,
        "Google",
        "Chrome",
        "Application",
        "chrome.exe"
      ),

    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);

  for (
    const candidate of
      candidates
  ) {
    try {
      await fs.access(
        candidate
      );

      return candidate;
    } catch {}
  }

  return null;
}

const BROWSER_PATH =
  await findBrowser();

async function render(url) {
  if (!BROWSER_PATH) {
    return null;
  }

  try {
    const {
      stdout,
    } =
      await execFileAsync(
        BROWSER_PATH,

        [
          "--headless=new",
          "--disable-gpu",
          "--disable-extensions",
          "--disable-background-networking",
          "--no-first-run",
          "--no-default-browser-check",
          "--virtual-time-budget=5000",
          "--dump-dom",
          url,
        ],

        {
          timeout:
            CONFIG
              .browserTimeoutMs,

          maxBuffer:
            10_000_000,

          windowsHide:
            true,
        }
      );

    return stdout || null;
  } catch {
    return null;
  }
}

const robotsCache =
  new Map();

function parseRobots(text) {
  const disallow = [];
  const sitemaps = [];

  let applies = false;

  for (
    const raw of
      String(text)
        .split(/\r?\n/)
  ) {
    const line =
      raw
        .replace(
          /#.*$/,
          ""
        )
        .trim();

    if (!line) {
      continue;
    }

    const [
      keyRaw,
      ...rest
    ] =
      line.split(":");

    const key =
      keyRaw
        .trim()
        .toLowerCase();

    const value =
      rest
        .join(":")
        .trim();

    if (
      key ===
      "user-agent"
    ) {
      applies =
        value === "*";
    } else if (
      key ===
        "disallow" &&
      applies &&
      value
    ) {
      disallow.push(
        value
      );
    } else if (
      key ===
        "sitemap" &&
      value
    ) {
      sitemaps.push(
        value
      );
    }
  }

  return {
    disallow,
    sitemaps,
  };
}

async function getRobots(url) {
  const parsed =
    safeHttpUrl(url);

  if (!parsed) {
    return {
      disallow: [],
      sitemaps: [],
    };
  }

  if (
    robotsCache.has(
      parsed.origin
    )
  ) {
    return robotsCache.get(
      parsed.origin
    );
  }

  const promise =
    (
      async () => {
        try {
          const response =
            await fetchResource(
              new URL(
                "/robots.txt",
                parsed.origin
              ).toString(),
              5000,
              300_000
            );

          return response.ok
            ? parseRobots(
                response
                  .buffer
                  .toString("utf8")
              )
            : {
                disallow: [],
                sitemaps: [],
              };
        } catch {
          return {
            disallow: [],
            sitemaps: [],
          };
        }
      }
    )();

  robotsCache.set(
    parsed.origin,
    promise
  );

  return promise;
}

async function allowedByRobots(url) {
  const parsed =
    safeHttpUrl(url);

  if (!parsed) {
    return false;
  }

  const robots =
    await getRobots(url);

  const target =
    `${parsed.pathname}${parsed.search}`;

  return (
    !robots
      .disallow
      .includes("/") &&

    !robots
      .disallow
      .some(
        (pattern) =>
          pattern !== "/" &&
          pattern &&
          target.startsWith(
            pattern
          )
      )
  );
}

function parseSitemap(text) {
  const output = [];

  const regex =
    /<loc\b[^>]*>([\s\S]*?)<\/loc>/gi;

  let match;

  while (
    (
      match =
        regex.exec(
          String(text)
        )
    )
  ) {
    const url =
      safeHttpUrl(
        stripTags(
          match[1]
        )
      );

    if (url) {
      output.push(
        url.toString()
      );
    }
  }

  return output;
}

async function sitemapCandidates(
  seedUrl,
  bases
) {
  const seed =
    safeHttpUrl(
      seedUrl
    );

  if (!seed) {
    return [];
  }

  const robots =
    await getRobots(
      seedUrl
    );

  const queue = [
    ...robots.sitemaps,
  ];

  if (
    !queue.length
  ) {
    queue.push(
      new URL(
        "/sitemap.xml",
        seed.origin
      ).toString()
    );
  }

  const seen =
    new Set();

  const output =
    new Set();

  while (
    queue.length &&
    seen.size < 8
  ) {
    const sitemap =
      queue.shift();

    const key =
      canonicalUrl(
        sitemap
      ) ||
      sitemap;

    if (
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);

    try {
      const response =
        await fetchResource(
          sitemap,
          8000,
          3_000_000
        );

      if (!response.ok) {
        continue;
      }

      for (
        const value of
          parseSitemap(
            response
              .buffer
              .toString("utf8")
          ).slice(
            0,
            1000
          )
      ) {
        const url =
          safeHttpUrl(
            value
          );

        if (
          !url ||
          !isInstitutionUrl(
            value,
            bases
          )
        ) {
          continue;
        }

        if (
          url.pathname
            .toLowerCase()
            .endsWith(".xml")
        ) {
          if (
            seen.size +
              queue.length <
            8
          ) {
            queue.push(
              value
            );
          }

          continue;
        }

        const context = {
          anchor: "",
          url:
            value,
          title: "",
          body: "",
        };

        const dimensions =
          dimensionSignals(
            context
          );

        const dimensionMax =
          Math.max(
            0,
            ...Object
              .values(
                dimensions
              )
              .map(
                (signal) =>
                  signal.score
              )
          );

        if (
          portalSignal(
            context
          ).score >= 4 ||

          hubSignal(
            context
          ).score >= 4 ||

          dimensionMax >= 4 ||

          extOf(value)
        ) {
          output.add(value);
        }
      }
    } catch {}
  }

  return [
    ...output,
  ].slice(
    0,
    400
  );
}

function priority(
  link,
  research
) {
  const context = {
    anchor:
      `${link.anchorText} ${link.title} ${link.contextText} ${link.sectionHeading}`,

    url:
      link.url,

    title: "",
    body: "",
  };

  const dimensions =
    dimensionSignals(
      context
    );

  const dimensionMax =
    Math.max(
      0,
      ...Object
        .values(
          dimensions
        )
        .map(
          (signal) =>
            signal.score
        )
    );

  return (
    portalSignal(
      context
    ).score * 3 +

    hubSignal(
      context
    ).score * 5 +

    dimensionMax * 2 +

    (
      looksDocLink(link)
        ? 18
        : 0
    ) +

    (
      research
        ? 12
        : 0
    ) +

    (
      hasNegative(
        context.anchor
      )
        ? -12
        : 0
    )
  );
}

function shouldQueue(
  link,
  research,
  depth,
  isHub = false
) {
  if (
    depth >
    CONFIG.maxDepth
  ) {
    return false;
  }

  const context = {
    anchor:
      `${link.anchorText} ${link.title} ${link.contextText} ${link.sectionHeading}`,

    url:
      link.url,

    title: "",
    body: "",
  };

  const dimensions =
    dimensionSignals(
      context
    );

  const dimensionMax =
    Math.max(
      0,
      ...Object
        .values(
          dimensions
        )
        .map(
          (signal) =>
            signal.score
        )
    );

  return (
    isHub ||

    hubSignal(
      context
    ).score >= 4 ||

    portalSignal(
      context
    ).score >= 4 ||

    dimensionMax >= 5 ||

    (
      research &&
      !hasNegative(
        context.anchor
      )
    )
  );
}

function taxonomy(text) {
  const normalized =
    normalizeText(text);

  const groups = [
    [
      "research ethics",
      [
        "اخلاق پژوهش",
        "کمیته اخلاق",
        "research ethics",
      ],
    ],

    [
      "grants/funding",
      [
        "گرنت",
        "پژوهانه",
        "حمایت",
        "grant",
        "funding",
      ],
    ],

    [
      "industry/technology/IP",
      [
        "ارتباط با صنعت",
        "فناوری",
        "مالکیت فکری",
        "اختراع",
        "مرکز رشد",
        "industry",
        "technology",
        "intellectual property",
      ],
    ],

    [
      "laboratory",
      [
        "آزمایشگاه",
        "laboratory",
        "lab",
      ],
    ],

    [
      "publications/journals",
      [
        "نشریه",
        "مجله",
        "انتشارات",
        "journal",
        "publication",
      ],
    ],

    [
      "postgraduate/research affairs",
      [
        "پایان نامه",
        "پایان‌نامه",
        "رساله",
        "پروپوزال",
        "تحصیلات تکمیلی",
        "thesis",
        "dissertation",
        "proposal",
      ],
    ],

    [
      "regulation/bylaw",
      [
        "آیین نامه",
        "آیین‌نامه",
        "مقررات",
        "ضوابط",
        "regulation",
        "bylaw",
      ],
    ],

    [
      "procedure/guideline",
      [
        "شیوه نامه",
        "شیوه‌نامه",
        "دستورالعمل",
        "فرایند",
        "فرآیند",
        "راهنما",
        "guideline",
        "procedure",
        "process",
      ],
    ],

    [
      "form/template",
      [
        "فرم",
        "الگو",
        "form",
        "template",
      ],
    ],

    [
      "policy/circular",
      [
        "بخشنامه",
        "سیاست",
        "ابلاغ",
        "policy",
        "circular",
      ],
    ],
  ];

  for (
    const [
      name,
      words,
    ] of groups
  ) {
    if (
      words.some(
        (word) =>
          normalized.includes(
            normalizeText(word)
          )
      )
    ) {
      return name;
    }
  }

  return "other";
}

function docType(
  taxonomyValue,
  title
) {
  const normalized =
    normalizeText(title);

  if (
    taxonomyValue ===
    "regulation/bylaw"
  ) {
    return "آیین‌نامه";
  }

  if (
    taxonomyValue ===
    "procedure/guideline"
  ) {
    return "شیوه‌نامه/دستورالعمل";
  }

  if (
    taxonomyValue ===
    "form/template"
  ) {
    return "فرم/الگو";
  }

  if (
    taxonomyValue ===
    "policy/circular"
  ) {
    return "سیاست/بخشنامه";
  }

  if (
    normalized.includes(
      "فرایند"
    ) ||
    normalized.includes(
      "فرآیند"
    )
  ) {
    return "فرآیند";
  }

  return "سند";
}

function docTopic(
  taxonomyValue,
  title
) {
  if (
    taxonomyValue ===
    "research ethics"
  ) {
    return "اخلاق پژوهش";
  }

  if (
    taxonomyValue ===
    "grants/funding"
  ) {
    return "حمایت و گرنت";
  }

  if (
    taxonomyValue ===
    "publications/journals"
  ) {
    return "انتشارات و نشریات";
  }

  if (
    taxonomyValue ===
    "laboratory"
  ) {
    return "آزمایشگاه";
  }

  if (
    taxonomyValue ===
    "industry/technology/IP"
  ) {
    return "صنعت، فناوری و مالکیت فکری";
  }

  if (
    taxonomyValue ===
    "postgraduate/research affairs"
  ) {
    return "تحصیلات تکمیلی و امور پژوهشی";
  }

  const normalized =
    normalizeText(title);

  if (
    normalized.includes(
      "اخلاق"
    )
  ) {
    return "اخلاق پژوهش";
  }

  if (
    [
      "گرنت",
      "پژوهانه",
      "حمایت",
    ].some(
      (value) =>
        normalized.includes(
          normalizeText(value)
        )
    )
  ) {
    return "حمایت و گرنت";
  }

  if (
    [
      "نشریه",
      "مجله",
      "انتشارات",
    ].some(
      (value) =>
        normalized.includes(
          normalizeText(value)
        )
    )
  ) {
    return "انتشارات و نشریات";
  }

  if (
    normalized.includes(
      "آزمایش"
    )
  ) {
    return "آزمایشگاه";
  }

  if (
    [
      "صنعت",
      "فناوری",
      "مالکیت فکری",
      "اختراع",
      "مرکز رشد",
    ].some(
      (value) =>
        normalized.includes(
          normalizeText(value)
        )
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
    ].some(
      (value) =>
        normalized.includes(
          normalizeText(value)
        )
    )
  ) {
    return "تحصیلات تکمیلی و امور پژوهشی";
  }

  return "سایر";
}

function filename(
  response,
  url
) {
  const disposition =
    response
      .headers
      .contentDisposition ||
    "";

  const encoded =
    disposition.match(
      /filename\*\s*=\s*UTF-8''([^;]+)/i
    )?.[1];

  if (encoded) {
    try {
      return decodeURIComponent(
        encoded.replace(
          /^["']|["']$/g,
          ""
        )
      );
    } catch {}
  }

  const plain =
    disposition.match(
      /filename\s*=\s*["']?([^;"']+)/i
    )?.[1];

  if (plain) {
    return plain.trim();
  }

  const parsed =
    safeHttpUrl(url);

  return parsed
    ? decodeURIComponentSafe(
        path.basename(
          parsed.pathname
        )
      ) ||
      "document"
    : "document";
}

function safeFilename(value) {
  return String(
    value ||
    "document"
  )
    .replace(
      /[<>:"/\\|?*\u0000-\u001F]/g,
      "_"
    )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180) ||
    "document";
}

function filenameStem(value) {
  const text =
    safeFilename(value)
      .replace(
        /\.(?:pdf|docx?|xlsx?|pptx?|rtf|odt|ods|odp|zip)$/i,
        ""
      );

  return stripGenericDocumentNoise(
    decodeURIComponentSafe(
      text.replace(
        /[_-]+/g,
        " "
      )
    )
  );
}

function bestDocumentTitle(
  candidate,
  metadataFileName = ""
) {
  const options = [];

  const add = (
    value,
    source,
    score
  ) => {
    const cleaned =
      stripGenericDocumentNoise(
        value
      );

    if (
      !isUsefulDocumentTitle(
        cleaned
      )
    ) {
      return;
    }

    let adjusted =
      score;

    if (
      countHits(
        cleaned,
        N_DOC
      ) > 0
    ) {
      adjusted += 8;
    }

    if (
      cleaned.length > 220
    ) {
      adjusted -= 18;
    } else if (
      cleaned.length > 150
    ) {
      adjusted -= 8;
    }

    options.push({
      value:
        cleaned.slice(
          0,
          260
        ),

      source,

      score:
        adjusted,
    });
  };

  if (
    !isGenericDocumentLabel(
      candidate.rawAnchorText ||
      candidate.anchorText
    )
  ) {
    add(
      candidate.rawAnchorText ||
        candidate.anchorText,

      "anchor-text",

      122
    );
  }

  add(
    candidate.ariaLabel,
    "aria-label",
    118
  );

  add(
    candidate.titleAttr ||
      candidate.title,
    "link-title",
    116
  );

  add(
    candidate.dataTitle,
    "data-title",
    116
  );

  const contextBase =
    candidate.contextKind ===
      "table-row"
      ? 132

      : [
          "card",
          "article",
          "list-item",
        ].includes(
          candidate.contextKind
        )
        ? 126
        : 92;

  add(
    candidate.contextText,
    candidate.contextKind ||
      "context",
    contextBase
  );

  add(
    candidate.downloadName,
    "download-attribute",
    102
  );

  add(
    filenameStem(
      metadataFileName
    ),
    "content-disposition-filename",
    104
  );

  const urlName =
    safeHttpUrl(
      candidate.url
    )?.pathname;

  if (urlName) {
    add(
      filenameStem(
        path.basename(
          urlName
        )
      ),
      "url-filename",
      82
    );
  }

  add(
    candidate.sectionHeading,
    "section-heading",
    78
  );

  add(
    candidate.sourcePageTitle,
    "source-page-title",
    56
  );

  options.sort(
    (
      left,
      right
    ) =>
      right.score -
        left.score ||

      left.value.length -
        right.value.length
  );

  const best =
    options[0];

  if (!best) {
    return {
      title:
        "سند پژوهشی",

      titleSource:
        "unresolved",

      titleConfidence:
        0.35,
    };
  }

  const titleConfidence =
    best.score >= 128
      ? 0.98

      : best.score >= 118
      ? 0.95

      : best.score >= 104
      ? 0.91

      : best.score >= 90
      ? 0.84

      : best.score >= 75
      ? 0.72

      : 0.58;

  return {
    title:
      best.value,

    titleSource:
      best.source,

    titleConfidence,
  };
}

function addDoc(
  map,
  candidate
) {
  const key =
    canonicalUrl(
      candidate.url
    );

  if (!key) {
    return;
  }

  const score = (
    item
  ) =>
    (
      item
        .researchContext
        ? 20
        : 0
    ) +

    (
      item
        .discoveryPath
        ?.length ||
      0
    ) +

    countHits(
      `${item.anchorText} ${item.title} ${item.contextText} ${item.sectionHeading} ${item.url}`,
      N_DOC
    ) *
      4 +

    (
      isUsefulDocumentTitle(
        item.contextText
      )
        ? 12
        : 0
    ) +

    (
      isUsefulDocumentTitle(
        item.rawAnchorText
      ) &&
      !isGenericDocumentLabel(
        item.rawAnchorText
      )
        ? 10
        : 0
    );

  const previous =
    map.get(key);

  if (
    !previous ||
    score(candidate) >
      score(previous)
  ) {
    map.set(
      key,
      candidate
    );
  }
}

const evidenceKey = (
  record
) =>
  `${record.universitySlug}|${record.dimension}|${canonicalUrl(record.url)}`;

async function collectDocument(
  candidate,
  university
) {
  const contextText = [
    candidate.rawAnchorText,
    candidate.anchorText,
    candidate.title,
    candidate.ariaLabel,
    candidate.contextText,
    candidate.sectionHeading,
    candidate.sourcePageTitle,
    candidate.sourcePage,
    candidate.url,
  ]
    .filter(Boolean)
    .join(" ");

  const hits =
    countHits(
      contextText,
      N_DOC
    );

  const extension =
    extOf(
      candidate.url
    );

  if (
    !extension &&
    !hits
  ) {
    return null;
  }

  try {
    const response =
      await probeDocument(
        candidate.url
      );

    const final =
      safeHttpUrl(
        response.finalUrl
      );

    if (
      !final ||
      isBlockedHost(
        final.hostname
      ) ||
      isUnsafeHost(
        final.hostname
      )
    ) {
      return null;
    }

    const finalExtension =
      extOf(
        response.finalUrl
      );

    const isDocument =
      Boolean(
        extension ||
        finalExtension
      ) ||
      looksDocMime(
        response.contentType
      );

    if (
      !isDocument ||

      (
        isHtml(
          response.contentType
        ) &&
        !extension &&
        !finalExtension
      )
    ) {
      return null;
    }

    let fileName =
      safeFilename(
        filename(
          response,
          response.finalUrl
        )
      );

    if (
      !path.extname(
        fileName
      ) &&
      (
        finalExtension ||
        extension
      )
    ) {
      fileName +=
        finalExtension ||
        extension;
    }

    const smart =
      bestDocumentTitle(
        candidate,
        fileName
      );

    const taxonomyValue =
      taxonomy(
        `${smart.title} ${candidate.contextText} ${candidate.sectionHeading} ${candidate.sourcePageTitle} ${fileName} ${candidate.url}`
      );

    return {
      universitySlug:
        university.slug,

      nameFa:
        university.nameFa,

      title:
        smart.title,

      titleSource:
        smart.titleSource,

      titleConfidence:
        smart.titleConfidence,

      rawAnchorText:
        candidate.rawAnchorText ||
        candidate.anchorText ||
        "",

      contextText:
        candidate.contextText ||
        "",

      contextKind:
        candidate.contextKind ||
        "",

      sectionHeading:
        candidate.sectionHeading ||
        "",

      url:
        response.finalUrl,

      sourcePage:
        candidate.sourcePage,

      sourcePageTitle:
        candidate.sourcePageTitle ||
        "",

      anchorText:
        candidate.anchorText ||
        "",

      depth:
        candidate.depth,

      discoveryPath:
        candidate.discoveryPath ||
        [
          candidate.sourcePage,
          response.finalUrl,
        ].filter(Boolean),

      fileName,

      extension:
        (
          finalExtension ||
          extension ||
          path.extname(
            fileName
          )
        ).toLowerCase(),

      contentType:
        response.contentType ||
        null,

      bytes:
        response.contentLength,

      contentLength:
        response.contentLength,

      etag:
        response.headers
          .etag ||
        null,

      lastModified:
        response.headers
          .lastModified ||
        null,

      sha256:
        null,

      archivePath:
        null,

      downloaded:
        false,

      storageMode:
        "metadata-only",

      metadataVerified:
        response.ok,

      status:
        response.status,

      taxonomy:
        taxonomyValue,

      type:
        docType(
          taxonomyValue,
          smart.title
        ),

      topic:
        docTopic(
          taxonomyValue,
          smart.title
        ),

      confidence:
        Math.min(
          0.99,

          0.54 +

          (
            extension ||
            finalExtension
              ? 0.10
              : 0
          ) +

          Math.min(
            hits,
            3
          ) *
            0.09 +

          (
            candidate
              .linkedFromInstitution
              ? 0.07
              : 0
          ) +

          (
            candidate
              .researchContext
              ? 0.14
              : 0
          ) +

          (
            smart
              .titleConfidence >=
              0.9
              ? 0.04
              : 0
          )
        ),

      discoveredAt:
        new Date()
          .toISOString(),
    };
  } catch (
    error
  ) {
    const fallbackName =
      filenameStem(
        path.basename(
          safeHttpUrl(
            candidate.url
          )?.pathname ||
          ""
        )
      );

    const smart =
      bestDocumentTitle(
        candidate,
        fallbackName
      );

    const taxonomyValue =
      taxonomy(
        `${smart.title} ${candidate.contextText} ${candidate.sectionHeading} ${candidate.sourcePageTitle} ${candidate.url}`
      );

    return {
      universitySlug:
        university.slug,

      nameFa:
        university.nameFa,

      title:
        smart.title,

      titleSource:
        smart.titleSource,

      titleConfidence:
        smart.titleConfidence,

      rawAnchorText:
        candidate.rawAnchorText ||
        candidate.anchorText ||
        "",

      contextText:
        candidate.contextText ||
        "",

      contextKind:
        candidate.contextKind ||
        "",

      sectionHeading:
        candidate.sectionHeading ||
        "",

      url:
        candidate.url,

      sourcePage:
        candidate.sourcePage,

      sourcePageTitle:
        candidate.sourcePageTitle ||
        "",

      anchorText:
        candidate.anchorText ||
        "",

      depth:
        candidate.depth,

      discoveryPath:
        candidate.discoveryPath ||
        [
          candidate.sourcePage,
          candidate.url,
        ].filter(Boolean),

      extension,

      sha256:
        null,

      archivePath:
        null,

      downloaded:
        false,

      storageMode:
        "metadata-only",

      metadataVerified:
        false,

      error:
        error instanceof Error
          ? error.message
          : String(error),

      taxonomy:
        taxonomyValue,

      type:
        docType(
          taxonomyValue,
          smart.title
        ),

      topic:
        docTopic(
          taxonomyValue,
          smart.title
        ),

      confidence:
        Math.min(
          0.9,

          0.46 +

          (
            extension
              ? 0.10
              : 0
          ) +

          Math.min(
            hits,
            3
          ) *
            0.09 +

          (
            candidate
              .researchContext
              ? 0.12
              : 0
          ) +

          (
            smart
              .titleConfidence >=
              0.9
              ? 0.03
              : 0
          )
        ),

      discoveredAt:
        new Date()
          .toISOString(),
    };
  }
}

async function crawlUniversity(
  university,
  audit,
  reaudit
) {
  const seeds = [];

  const seedSeen =
    new Set();

  const addSeed = (
    value,
    researchContext,
    priorityValue,
    sourceKind
  ) => {
    const url =
      safeHttpUrl(
        value
      );

    const key =
      url &&
      canonicalUrl(
        url.toString()
      );

    if (
      !url ||
      !key ||
      seedSeen.has(key)
    ) {
      return;
    }

    seedSeen.add(key);

    seeds.push({
      url:
        url.toString(),

      depth:
        0,

      priority:
        priorityValue,

      researchContext,

      anchorText:
        "",

      from:
        null,

      sourceKind,

      hubRoot:
        [
          "known-portal",
          "research-url",
        ].includes(
          sourceKind
        )
          ? key
          : null,

      discoveryPath: [
        url.toString(),
      ],
    });
  };

  for (
    const value of
      reaudit?.portalUrls ||
      []
  ) {
    addSeed(
      value,
      true,
      130,
      "known-portal"
    );
  }

  if (
    audit?.researchUrl
  ) {
    addSeed(
      audit.researchUrl,
      true,
      125,
      "research-url"
    );
  }

  addSeed(
    university
      .officialWebsite,
    false,
    90,
    "official-website"
  );

  for (
    const key of
      [
        "organizationUrls",
        "libraryUrls",
        "laboratoryUrls",
        "industryTechnologyUrls",
        "informationTechnologyUrls",
        "systemsUrls",
        "documentIndexUrls",
      ]
  ) {
    for (
      const value of
        (
          reaudit?.[key] ||
          []
        ).slice(
          0,
          2
        )
    ) {
      addSeed(
        value,
        true,
        105,
        `known-${key}`
      );
    }
  }

  if (!seeds.length) {
    return {
      slug:
        university.slug,

      nameFa:
        university.nameFa,

      pageCount:
        0,

      evidence:
        [],

      documents:
        [],

      portalCandidates:
        [],

      researchHubs:
        0,

      failures: [
        {
          url:
            null,

          reason:
            "no-official-seed",
        },
      ],
    };
  }

  const bases =
    new Set(
      seeds
        .map(
          (seed) =>
            safeHttpUrl(
              seed.url
            )
        )
        .filter(Boolean)
        .map(
          (url) =>
            baseDomain(
              url.hostname
            )
        )
    );

  for (
    const key of
      [
        "organizationUrls",
        "libraryUrls",
        "laboratoryUrls",
        "industryTechnologyUrls",
        "informationTechnologyUrls",
        "systemsUrls",
        "documentIndexUrls",
      ]
  ) {
    for (
      const value of
        reaudit?.[key] ||
        []
    ) {
      const parsed =
        safeHttpUrl(
          value
        );

      if (parsed) {
        bases.add(
          baseDomain(
            parsed.hostname
          )
        );
      }
    }
  }

  const queue = [
    ...seeds,
  ];

  const queued =
    new Set(
      seeds
        .map(
          (seed) =>
            canonicalUrl(
              seed.url
            )
        )
        .filter(Boolean)
    );

  const visited =
    new Set();

  const evidence =
    new Map();

  const documents =
    new Map();

  const portals =
    new Map();

  const failures = [];

  const hubs =
    new Set(
      seeds
        .filter(
          (seed) =>
            [
              "known-portal",
              "research-url",
            ].includes(
              seed.sourceKind
            )
        )
        .map(
          (seed) =>
            canonicalUrl(
              seed.url
            )
        )
        .filter(Boolean)
    );

  const hubCounts =
    new Map();

  const origins =
    new Set();

  let pages = 0;

  let browserPages =
    0;

  let lastHeartbeat =
    Date.now();

  console.log(
    `[${university.slug}] crawl started | seeds=${seeds.length} | hubs=${hubs.size}`
  );

  const addSitemaps =
    async (
      seed
    ) => {
      const parsed =
        safeHttpUrl(
          seed.url
        );

      if (
        !parsed ||
        origins.has(
          parsed.origin
        )
      ) {
        return;
      }

      origins.add(
        parsed.origin
      );

      try {
        const candidates =
          await sitemapCandidates(
            seed.url,
            bases
          );

        for (
          const value of
            candidates
        ) {
          const key =
            canonicalUrl(
              value
            );

          if (
            !key ||
            queued.has(key) ||
            visited.has(key)
          ) {
            continue;
          }

          if (
            extOf(value)
          ) {
            addDoc(
              documents,
              {
                url:
                  value,

                anchorText:
                  "",

                rawAnchorText:
                  "",

                title:
                  "",

                sourcePage:
                  seed.url,

                sourcePageTitle:
                  "",

                depth:
                  1,

                linkedFromInstitution:
                  true,

                researchContext:
                  seed
                    .researchContext,

                contextText:
                  seed
                    .sectionHeading ||
                  "",

                contextKind:
                  "sitemap",

                sectionHeading:
                  "",

                discoveryPath:
                  [
                    ...(
                      seed
                        .discoveryPath ||
                      [
                        seed.url,
                      ]
                    ),

                    value,
                  ].slice(
                    -16
                  ),
              }
            );

            continue;
          }

          const isHub =
            hubSignal({
              anchor:
                "",

              url:
                value,

              title:
                "",

              body:
                "",
            }).score >=
              4 &&

            hubs.size <
              CONFIG
                .maxResearchHubs;

          if (isHub) {
            hubs.add(
              key
            );
          }

          queued.add(
            key
          );

          queue.push({
            url:
              value,

            depth:
              isHub
                ? 0
                : 1,

            priority:
              isHub
                ? 125

                : seed
                    .researchContext
                  ? 65
                  : 45,

            researchContext:
              seed
                .researchContext ||
              isHub,

            anchorText:
              "",

            from:
              seed.url,

            sourceKind:
              isHub
                ? "research-hub-sitemap"
                : "sitemap",

            hubRoot:
              isHub
                ? key
                : seed
                    .hubRoot,

            discoveryPath:
              [
                ...(
                  seed
                    .discoveryPath ||
                  [
                    seed.url,
                  ]
                ),

                value,
              ].slice(
                -16
              ),
          });
        }
      } catch {}
    };

  for (
    const seed of
      seeds
  ) {
    await addSitemaps(
      seed
    );
  }

  while (
    queue.length &&

    visited.size <
      CONFIG
        .maxPagesPerUniversity
  ) {
    if (
      Date.now() -
        lastHeartbeat >=
      30_000
    ) {
      console.log(
        [
          `[${university.slug}] working`,

          `pages=${pages}`,

          `visited=${visited.size}`,

          `queue=${queue.length}`,

          `hubs=${hubs.size}`,

          `docs=${documents.size}`,

          `evidence=${evidence.size}`,

          `portals=${portals.size}`,

          `failures=${failures.length}`,
        ].join(
          " | "
        )
      );

      lastHeartbeat =
        Date.now();
    }

    queue.sort(
      (
        left,
        right
      ) =>
        right.priority -
          left.priority ||

        left.depth -
          right.depth
    );

    const batch = [];

    while (
      queue.length &&

      batch.length <
        CONFIG
          .pageConcurrency &&

      visited.size +
          batch.length <
        CONFIG
          .maxPagesPerUniversity
    ) {
      const item =
        queue.shift();

      const key =
        canonicalUrl(
          item.url
        );

      if (
        !key ||
        visited.has(key)
      ) {
        continue;
      }

      if (
        item.hubRoot &&

        (
          hubCounts.get(
            item.hubRoot
          ) ||
          0
        ) >=
          CONFIG
            .maxPagesPerHub
      ) {
        continue;
      }

      visited.add(
        key
      );

      batch.push(
        item
      );
    }

    if (!batch.length) {
      continue;
    }

    const outcomes =
      await Promise.all(
        batch.map(
          async (
            item
          ) => {
            if (
              !(
                await allowedByRobots(
                  item.url
                )
              )
            ) {
              return {
                item,

                skip:
                  "robots-disallow",
              };
            }

            try {
              return {
                item,

                res:
                  await fetchPageResource(
                    item.url,

                    CONFIG
                      .pageTimeoutMs,

                    CONFIG
                      .maxHtmlBytes
                  ),
              };
            } catch (
              error
            ) {
              return {
                item,

                error:
                  error instanceof
                  Error
                    ? error.message
                    : String(error),
              };
            }
          }
        )
      );

    for (
      const outcome of
        outcomes
    ) {
      const item =
        outcome.item;

      if (
        outcome.skip
      ) {
        failures.push({
          url:
            item.url,

          reason:
            outcome.skip,
        });

        continue;
      }

      if (
        outcome.error
      ) {
        failures.push({
          url:
            item.url,

          reason:
            outcome.error,
        });

        continue;
      }

      const response =
        outcome.res;

      const final =
        safeHttpUrl(
          response.finalUrl
        );

      if (
        !final ||
        !isInstitutionUrl(
          final.toString(),
          bases
        )
      ) {
        continue;
      }

      await addSitemaps({
        ...item,

        url:
          final.toString(),

        discoveryPath:
          [
            ...(
              item
                .discoveryPath ||
              []
            ),

            final.toString(),
          ].slice(
            -16
          ),
      });

      if (
        !isHtml(
          response.contentType
        )
      ) {
        if (
          looksDocMime(
            response.contentType
          ) ||
          extOf(
            response.finalUrl
          )
        ) {
          addDoc(
            documents,
            {
              url:
                response
                  .finalUrl,

              anchorText:
                item.anchorText,

              rawAnchorText:
                item.anchorText,

              title:
                "",

              sourcePage:
                item.from ||
                item.url,

              sourcePageTitle:
                "",

              depth:
                item.depth,

              linkedFromInstitution:
                true,

              researchContext:
                item
                  .researchContext,

              contextText:
                "",

              contextKind:
                "direct-response",

              sectionHeading:
                "",

              discoveryPath:
                item
                  .discoveryPath ||
                [
                  item.url,
                ],
            }
          );
        }

        continue;
      }

      if (!response.ok) {
        failures.push({
          url:
            item.url,

          status:
            response.status,

          reason:
            "http-error",
        });

        continue;
      }

      pages++;

      if (
        item.hubRoot
      ) {
        hubCounts.set(
          item.hubRoot,

          (
            hubCounts.get(
              item.hubRoot
            ) ||
            0
          ) +
            1
        );
      }

      let html =
        response
          .buffer
          .toString(
            "utf8"
          );

      let links =
        extractLinks(
          html,
          response.finalUrl
        );

      const preContext = {
        anchor:
          item.anchorText,

        url:
          response.finalUrl,

        title:
          "",

        body:
          "",
      };

      if (
        BROWSER_PATH &&

        CONFIG
          .useBrowserFallback &&

        (
          item.sourceKind ===
            "known-portal" ||

          item.sourceKind ===
            "research-url" ||

          String(
            item.sourceKind ||
              ""
          ).startsWith(
            "research-hub"
          ) ||

          (
            item
              .researchContext &&

            item.depth <=
              2 &&

            links.length <
              16
          ) ||

          portalSignal(
            preContext
          ).score >=
            4 ||

          hubSignal(
            preContext
          ).score >=
            4 ||

          (
            links.length <
              6 &&

            item.depth <=
              3
          )
        )
      ) {
        const rendered =
          await render(
            response
              .finalUrl
          );

        if (rendered) {
          const renderedLinks =
            extractLinks(
              rendered,
              response
                .finalUrl
            );

          if (
            renderedLinks.length >
            links.length
          ) {
            html =
              rendered;

            links =
              renderedLinks;

            browserPages++;
          }
        }
      }

      const pageTitle =
        extractTitle(
          html
        );

      const body =
        stripTags(
          html
        ).slice(
          0,
          45_000
        );

      const pageContext = {
        anchor:
          item.anchorText,

        url:
          response.finalUrl,

        title:
          pageTitle,

        body,
      };

      const portal =
        portalSignal(
          pageContext
        );

      const hub =
        hubSignal(
          pageContext
        );

      const research =
        item
          .researchContext ||

        portal.score >=
          8 ||

        hub.score >=
          8 ||

        item.sourceKind ===
          "known-portal" ||

        item.sourceKind ===
          "research-url" ||

        String(
          item.sourceKind ||
            ""
        ).startsWith(
          "research-hub"
        );

      if (
        portal.score >=
          8 &&

        (
          portal.anchorHits ||
          portal.urlHits ||
          portal.titleHits
        )
      ) {
        const key =
          canonicalUrl(
            response.finalUrl
          );

        const candidate = {
          universitySlug:
            university.slug,

          nameFa:
            university.nameFa,

          url:
            response.finalUrl,

          sourcePage:
            item.from,

          anchorText:
            item.anchorText,

          title:
            pageTitle,

          depth:
            item.depth,

          score:
            portal.score,

          confidence:
            confidence(
              portal.score,
              0.64
            ),

          officialDomain:
            true,

          kind:
            "portal",

          discoveryPath:
            item
              .discoveryPath ||
            [
              response.finalUrl,
            ],

          discoveredAt:
            new Date()
              .toISOString(),
        };

        const previous =
          portals.get(
            key
          );

        if (
          !previous ||
          candidate.score >
            previous.score
        ) {
          portals.set(
            key,
            candidate
          );
        }
      }

      for (
        const [
          dimension,
          signal,
        ] of Object.entries(
          dimensionSignals(
            pageContext
          )
        )
      ) {
        if (
          !(
            signal
              .anchorHits ||

            signal
              .urlHits ||

            signal
              .titleHits
          ) ||

          signal.score <
            5
        ) {
          continue;
        }

        const record = {
          universitySlug:
            university.slug,

          nameFa:
            university.nameFa,

          dimension,

          labelFa:
            DIMENSIONS[
              dimension
            ].labelFa,

          url:
            response.finalUrl,

          sourcePage:
            item.from ||
            response
              .finalUrl,

          anchorText:
            item.anchorText,

          title:
            pageTitle,

          depth:
            item.depth,

          score:
            signal.score,

          confidence:
            confidence(
              signal.score,
              0.58
            ),

          officialDomain:
            true,

          researchContext:
            research,

          kind:
            "page",

          discoveryPath:
            item
              .discoveryPath ||
            [
              response.finalUrl,
            ],

          discoveredAt:
            new Date()
              .toISOString(),
        };

        if (
          record.confidence >=
          CONFIG
            .discoveryThreshold
        ) {
          const key =
            evidenceKey(
              record
            );

          const previous =
            evidence.get(
              key
            );

          if (
            !previous ||
            record.score >
              previous.score
          ) {
            evidence.set(
              key,
              record
            );
          }
        }
      }

      for (
        const link of
          links
      ) {
        const parsed =
          safeHttpUrl(
            link.url
          );

        if (!parsed) {
          continue;
        }

        const chain =
          [
            ...(
              item
                .discoveryPath ||
              [
                response
                  .finalUrl,
              ]
            ),

            parsed.toString(),
          ].slice(
            -16
          );

        if (
          looksDocLink(
            link
          )
        ) {
          const hits =
            countHits(
              `${link.anchorText} ${link.title} ${link.contextText} ${link.sectionHeading} ${decodeURIComponentSafe(link.url)}`,
              N_DOC
            );

          if (
            research ||
            hits > 0
          ) {
            addDoc(
              documents,
              {
                url:
                  parsed.toString(),

                anchorText:
                  link.anchorText,

                rawAnchorText:
                  link.rawAnchorText ||
                  link.anchorText,

                title:
                  link.title,

                titleAttr:
                  link.titleAttr,

                ariaLabel:
                  link.ariaLabel,

                dataTitle:
                  link.dataTitle,

                downloadName:
                  link.downloadName,

                contextText:
                  link.contextText,

                contextKind:
                  link.contextKind,

                sectionHeading:
                  link.sectionHeading,

                sourcePage:
                  response.finalUrl,

                sourcePageTitle:
                  pageTitle,

                depth:
                  item.depth +
                  1,

                linkedFromInstitution:
                  true,

                researchContext:
                  research,

                discoveryPath:
                  chain,
              }
            );
          }
        }

        if (
          !isInstitutionUrl(
            parsed.toString(),
            bases
          ) ||
          extOf(
            parsed.toString()
          )
        ) {
          continue;
        }

        const key =
          canonicalUrl(
            parsed.toString()
          );

        if (
          !key ||
          visited.has(key) ||
          queued.has(key)
        ) {
          continue;
        }

        const linkContext = {
          anchor:
            `${link.anchorText} ${link.title} ${link.contextText} ${link.sectionHeading}`,

          url:
            link.url,

          title:
            "",

          body:
            "",
        };

        const candidateHub =
          hubSignal(
            linkContext
          ).score >=
          4;

        let newHub =
          false;

        if (
          candidateHub &&
          !hubs.has(key) &&
          hubs.size <
            CONFIG
              .maxResearchHubs
        ) {
          hubs.add(
            key
          );

          newHub =
            true;
        }

        const depth =
          newHub
            ? 0
            : item.depth +
              1;

        if (
          !shouldQueue(
            link,
            research ||
              newHub,
            depth,
            newHub
          )
        ) {
          continue;
        }

        queued.add(
          key
        );

        queue.push({
          url:
            parsed.toString(),

          depth,

          priority:
            priority(
              link,
              research
            ) +
            (
              newHub
                ? 70
                : 0
            ),

          researchContext:
            research ||
            newHub ||
            portalSignal(
              linkContext
            ).score >=
              5,

          anchorText:
            link.anchorText ||
            link.title,

          from:
            response
              .finalUrl,

          sourceKind:
            newHub
              ? (
                  link
                    .discoveryKind ===
                  "embedded-url"
                    ? "research-hub-embedded"
                    : "research-hub"
                )

              : (
                  link
                    .discoveryKind ===
                  "embedded-url"
                    ? "embedded-url"
                    : "link"
                ),

          hubRoot:
            newHub
              ? key
              : item
                  .hubRoot,

          discoveryPath:
            chain,
        });
      }
    }
  }

  const ranked =
    [
      ...documents.values(),
    ]
      .map(
        (
          candidate
        ) => ({
          ...candidate,

          rank:
            (
              extOf(
                candidate.url
              )
                ? 8
                : 0
            ) +

            (
              candidate
                .researchContext
                ? 12
                : 0
            ) +

            countHits(
              `${candidate.anchorText} ${candidate.title} ${candidate.contextText} ${candidate.sectionHeading} ${candidate.url}`,
              N_DOC
            ) *
              5 +

            (
              isUsefulDocumentTitle(
                candidate.contextText
              )
                ? 8
                : 0
            ),
        })
      )

      .sort(
        (
          left,
          right
        ) =>
          right.rank -
          left.rank
      )

      .slice(
        0,
        CONFIG
          .maxDocumentsPerUniversity
      );

  const collectedDocuments =
    [];

  for (
    let index = 0;

    index <
    ranked.length;

    index +=
      CONFIG
        .pageConcurrency
  ) {
    const results =
      await Promise.all(
        ranked
          .slice(
            index,
            index +
              CONFIG
                .pageConcurrency
          )
          .map(
            (
              candidate
            ) =>
              collectDocument(
                candidate,
                university
              )
          )
      );

    for (
      const result of
        results
    ) {
      if (result) {
        collectedDocuments.push(
          result
        );
      }
    }
  }

  return {
    slug:
      university.slug,

    nameFa:
      university.nameFa,

    officialWebsite:
      university
        .officialWebsite ||
      null,

    existingResearchUrl:
      audit?.researchUrl ||
      null,

    pageCount:
      pages,

    visitedCount:
      visited.size,

    browserFallbackPages:
      browserPages,

    researchHubs:
      hubs.size,

    evidence:
      [
        ...evidence.values(),
      ].sort(
        (
          left,
          right
        ) =>
          right.confidence -
            left.confidence ||

          right.score -
            left.score
      ),

    documents:
      collectedDocuments.sort(
        (
          left,
          right
        ) =>
          right.confidence -
          left.confidence
      ),

    portalCandidates:
      [
        ...portals.values(),
      ].sort(
        (
          left,
          right
        ) =>
          right.confidence -
            left.confidence ||

          right.score -
            left.score
      ),

    failures,
  };
}

const [
  institutions,
  audits,
  reaudit,
] =
  await Promise.all([
    readJson(
      "data/isc/institutions.json",
      []
    ),

    readJson(
      "data/audit/portal-audit.json",
      []
    ),

    readJson(
      "data/evidence/portal-document-reaudit.json",
      []
    ),
  ]);

if (
  !Array.isArray(
    institutions
  ) ||
  institutions.length !==
    115
) {
  throw new Error(
    `Expected 115 institutions with officialWebsite seeds, got ${
      Array.isArray(
        institutions
      )
        ? institutions.length
        : "invalid data"
    }`
  );
}

const auditsBySlug =
  new Map(
    (
      audits ||
      []
    ).map(
      (
        item
      ) => [
        item.universitySlug,
        item,
      ]
    )
  );

const reauditBySlug =
  new Map(
    (
      reaudit ||
      []
    ).map(
      (
        item
      ) => [
        item.slug,
        item,
      ]
    )
  );

await fs.mkdir(
  "data/generated",
  {
    recursive: true,
  }
);

/*
 * ==========================================================
 * CHECKPOINT / RESUME
 * ==========================================================
 *
 * Granularity:
 *   one checkpoint per COMPLETED university.
 *
 * Therefore:
 * - finished universities are never crawled again after restart;
 * - an interrupted run repeats only universities that were still
 *   actively crawling at the moment of interruption;
 * - with universityConcurrency=3, normally at most 3 universities
 *   can be repeated.
 *
 * Checkpoints are pushed to GitHub every 30 minutes.
 */

const CHECKPOINT_SCHEMA_VERSION =
  1;

const CHECKPOINT_MANIFEST =
  path.join(
    CONFIG.checkpointDir,
    "manifest.json"
  );

/*
 * Do NOT hash every timestamp / generatedAt field from the datasets.
 *
 * Only crawl-relevant seed data is included so running prepare:data
 * again does not accidentally invalidate a valid partial crawl.
 */
const checkpointSeedShape = {
  crawlerVersion:
    CRAWLER_VERSION,

  checkpointSchemaVersion:
    CHECKPOINT_SCHEMA_VERSION,

  crawlConfig: {
    maxDepth:
      CONFIG.maxDepth,

    maxPagesPerUniversity:
      CONFIG
        .maxPagesPerUniversity,

    maxPagesPerHub:
      CONFIG.maxPagesPerHub,

    maxResearchHubs:
      CONFIG.maxResearchHubs,

    maxDocumentsPerUniversity:
      CONFIG
        .maxDocumentsPerUniversity,

    pageTimeoutMs:
      CONFIG.pageTimeoutMs,

    documentTimeoutMs:
      CONFIG
        .documentTimeoutMs,

    browserTimeoutMs:
      CONFIG
        .browserTimeoutMs,

    pageConcurrency:
      CONFIG.pageConcurrency,

    universityConcurrency:
      CONFIG
        .universityConcurrency,

    discoveryThreshold:
      CONFIG
        .discoveryThreshold,
  },

  institutions:
    institutions.map(
      (
        item
      ) => ({
        slug:
          item.slug,

        officialWebsite:
          item
            .officialWebsite ||
          null,
      })
    ),

  audits:
    (
      audits ||
      []
    ).map(
      (
        item
      ) => ({
        universitySlug:
          item.universitySlug,

        researchUrl:
          item.researchUrl ||
          null,
      })
    ),

  reaudit:
    (
      reaudit ||
      []
    ).map(
      (
        item
      ) => ({
        slug:
          item.slug,

        portalUrls:
          item.portalUrls ||
          [],

        organizationUrls:
          item
            .organizationUrls ||
          [],

        libraryUrls:
          item.libraryUrls ||
          [],

        laboratoryUrls:
          item
            .laboratoryUrls ||
          [],

        industryTechnologyUrls:
          item
            .industryTechnologyUrls ||
          [],

        informationTechnologyUrls:
          item
            .informationTechnologyUrls ||
          [],

        systemsUrls:
          item.systemsUrls ||
          [],

        documentIndexUrls:
          item
            .documentIndexUrls ||
          [],
      })
    ),
};

const checkpointFingerprint =
  createHash(
    "sha256"
  )
    .update(
      JSON.stringify(
        checkpointSeedShape
      )
    )
    .digest(
      "hex"
    );

let checkpointStartedAt =
  new Date()
    .toISOString();

let checkpointDirty =
  false;

/*
 * All checkpoint writes and git checkpoint publishes are serialized.
 *
 * This prevents git from reading a checkpoint file while another
 * worker is writing it.
 */
let checkpointChain =
  Promise.resolve();

function withCheckpointLock(
  task
) {
  const run =
    checkpointChain.then(
      task,
      task
    );

  checkpointChain =
    run.catch(
      () => {}
    );

  return run;
}

async function atomicWriteJson(
  file,
  value
) {
  await fs.mkdir(
    path.dirname(
      file
    ),
    {
      recursive: true,
    }
  );

  const temp =
    `${file}.tmp-${process.pid}-${Date.now()}`;

  await fs.writeFile(
    temp,

    JSON.stringify(
      value,
      null,
      2
    ) + "\n",

    "utf8"
  );

  await fs.rm(
    file,
    {
      force: true,
    }
  ).catch(
    () => {}
  );

  await fs.rename(
    temp,
    file
  );
}

async function resetCheckpointDirectory(
  reason
) {
  await fs.rm(
    CONFIG.checkpointDir,
    {
      recursive: true,
      force: true,
    }
  );

  await fs.mkdir(
    CONFIG.checkpointDir,
    {
      recursive: true,
    }
  );

  checkpointStartedAt =
    new Date()
      .toISOString();

  checkpointDirty =
    true;

  console.log(
    `[checkpoint] reset | reason=${reason}`
  );
}

/*
 * Final result slots.
 *
 * Existing completed checkpoints will be inserted here before
 * new crawling starts.
 */
const results =
  new Array(
    institutions.length
  );

const completedSlugs =
  new Set();

function checkpointManifestObject() {
  return {
    schemaVersion:
      CHECKPOINT_SCHEMA_VERSION,

    crawlerVersion:
      CRAWLER_VERSION,

    fingerprint:
      checkpointFingerprint,

    startedAt:
      checkpointStartedAt,

    updatedAt:
      new Date()
        .toISOString(),

    totalUniversities:
      institutions.length,

    completedUniversities:
      completedSlugs.size,

    completedSlugs:
      institutions
        .map(
          (
            item
          ) =>
            item.slug
        )
        .filter(
          (
            slug
          ) =>
            completedSlugs
              .has(
                slug
              )
        ),

    cycleComplete:
      completedSlugs.size ===
      institutions.length,

    checkpointGranularity:
      "completed-university",

    checkpointIntervalMs:
      CONFIG
        .checkpointIntervalMs,
  };
}

async function writeCheckpointManifest() {
  await atomicWriteJson(
    CHECKPOINT_MANIFEST,
    checkpointManifestObject()
  );
}

async function saveUniversityCheckpoint(
  index,
  result
) {
  return withCheckpointLock(
    async () => {
      const university =
        institutions[
          index
        ];

      const payload = {
        schemaVersion:
          CHECKPOINT_SCHEMA_VERSION,

        crawlerVersion:
          CRAWLER_VERSION,

        fingerprint:
          checkpointFingerprint,

        completed:
          true,

        completedAt:
          new Date()
            .toISOString(),

        index,

        slug:
          university.slug,

        result,
      };

      await atomicWriteJson(
        path.join(
          CONFIG.checkpointDir,
          `${university.slug}.json`
        ),

        payload
      );

      results[
        index
      ] =
        result;

      completedSlugs.add(
        university.slug
      );

      checkpointDirty =
        true;

      await writeCheckpointManifest();

      console.log(
        `[checkpoint] saved ${university.slug} | completed=${completedSlugs.size}/${institutions.length}`
      );
    }
  );
}

async function loadExistingCheckpoints() {
  await fs.mkdir(
    CONFIG.checkpointDir,
    {
      recursive: true,
    }
  );

  /*
   * Manual emergency reset.
   */
  if (
    CONFIG
      .checkpointReset
  ) {
    await resetCheckpointDirectory(
      "CRAWL_CHECKPOINT_RESET=1"
    );

    await writeCheckpointManifest();

    return;
  }

  const manifest =
    await readJson(
      CHECKPOINT_MANIFEST,
      null
    );

  /*
   * First crawl cycle.
   */
  if (!manifest) {
    await writeCheckpointManifest();

    checkpointDirty =
      true;

    return;
  }

  /*
   * If crawl logic/config/seeds changed, old partial crawl must
   * not silently mix with the new crawl.
   */
  if (
    manifest
      .schemaVersion !==
      CHECKPOINT_SCHEMA_VERSION ||

    manifest
      .crawlerVersion !==
      CRAWLER_VERSION ||

    manifest
      .fingerprint !==
      checkpointFingerprint
  ) {
    await resetCheckpointDirectory(
      "fingerprint-or-version-changed"
    );

    await writeCheckpointManifest();

    return;
  }

  checkpointStartedAt =
    manifest.startedAt ||
    checkpointStartedAt;

  /*
   * Load each completed university.
   */
  for (
    let index = 0;
    index <
    institutions.length;
    index++
  ) {
    const university =
      institutions[
        index
      ];

    const checkpoint =
      await readJson(
        path.join(
          CONFIG.checkpointDir,
          `${university.slug}.json`
        ),

        null
      );

    if (
      !checkpoint ||

      checkpoint
        .schemaVersion !==
        CHECKPOINT_SCHEMA_VERSION ||

      checkpoint
        .crawlerVersion !==
        CRAWLER_VERSION ||

      checkpoint
        .fingerprint !==
        checkpointFingerprint ||

      checkpoint
        .completed !==
        true ||

      checkpoint.slug !==
        university.slug ||

      checkpoint
        .result
        ?.slug !==
        university.slug
    ) {
      continue;
    }

    results[
      index
    ] =
      checkpoint.result;

    completedSlugs.add(
      university.slug
    );
  }

  console.log(
    [
      "[checkpoint] resume",

      `completed=${completedSlugs.size}/${institutions.length}`,

      `remaining=${institutions.length - completedSlugs.size}`,
    ].join(
      " | "
    )
  );

  await writeCheckpointManifest();
}

/*
 * ==========================================================
 * PERIODIC GIT PUBLISH
 * ==========================================================
 */

async function gitExec(
  args
) {
  const {
    stdout = "",
    stderr = "",
  } =
    await execFileAsync(
      "git",
      args,
      {
        cwd:
          process.cwd(),

        windowsHide:
          true,

        maxBuffer:
          4_000_000,
      }
    );

  return {
    stdout:
      String(
        stdout
      ),

    stderr:
      String(
        stderr
      ),
  };
}

async function publishCheckpoints(
  reason =
    "interval"
) {
  if (
    !CONFIG
      .checkpointPush
  ) {
    return;
  }

  /*
   * Hold the same lock used by checkpoint writers.
   *
   * A university can keep crawling in another worker, but completed
   * checkpoint files are not modified while git is staging them.
   */
  return withCheckpointLock(
    async () => {
      if (
        !checkpointDirty
      ) {
        console.log(
          `[checkpoint] publish skipped | reason=${reason} | no-new-checkpoints`
        );

        return;
      }

      await writeCheckpointManifest();

      try {
        await gitExec([
          "config",
          "user.name",
          "github-actions[bot]",
        ]);

        await gitExec([
          "config",
          "user.email",
          "41898282+github-actions[bot]@users.noreply.github.com",
        ]);

        /*
         * Very important:
         *
         * Stage ONLY checkpoint files here.
         *
         * Do not publish incomplete authoritative datasets.
         */
        await gitExec([
          "add",
          "-A",
          "--",
          "data/crawl-checkpoints",
        ]);

        const staged =
          await gitExec([
            "diff",
            "--cached",
            "--name-only",
            "--",
            "data/crawl-checkpoints",
          ]);

        if (
          !staged
            .stdout
            .trim()
        ) {
          checkpointDirty =
            false;

          console.log(
            `[checkpoint] publish skipped | reason=${reason} | nothing-staged`
          );

          return;
        }

        const message =
          `chore(crawl): checkpoint ${completedSlugs.size}/${institutions.length} [skip ci]`;

        await gitExec([
          "commit",
          "-m",
          message,
        ]);

        /*
         * In normal operation concurrency prevents another crawl
         * from modifying main simultaneously.
         *
         * pull --rebase also makes manual repository changes safer.
         */
        await gitExec([
          "pull",
          "--rebase",
          "origin",
          "main",
        ]);

        await gitExec([
          "push",
          "origin",
          "HEAD:main",
        ]);

        checkpointDirty =
          false;

        console.log(
          [
            "[checkpoint] pushed",

            `reason=${reason}`,

            `completed=${completedSlugs.size}/${institutions.length}`,
          ].join(
            " | "
          )
        );
      } catch (
        error
      ) {
        /*
         * A failed checkpoint push must NOT kill the crawl.
         *
         * Keep checkpointDirty=true so the next 30-minute cycle
         * retries the push.
         */
        checkpointDirty =
          true;

        console.warn(
          `[checkpoint] push failed | reason=${reason}:`,

          error instanceof
          Error
            ? error.message
            : String(
                error
              )
        );
      }
    }
  );
}

/*
 * Restore previous work before assigning university jobs.
 */
await loadExistingCheckpoints();

const pendingIndices =
  institutions
    .map(
      (
        _,
        index
      ) =>
        index
    )
    .filter(
      (
        index
      ) =>
        !completedSlugs
          .has(
            institutions[
              index
            ].slug
          )
    );

console.log(
  [
    "[checkpoint] crawl plan",

    `alreadyDone=${completedSlugs.size}`,

    `pending=${pendingIndices.length}`,

    `total=${institutions.length}`,
  ].join(
    " | "
  )
);

let pendingCursor =
  0;

let shuttingDown =
  false;

/*
 * Every 30 minutes:
 *
 * commit + push only completed university checkpoint files.
 */
const checkpointTimer =
  setInterval(
    () => {
      void publishCheckpoints(
        "30-minute-interval"
      );
    },

    CONFIG
      .checkpointIntervalMs
  );

/*
 * Do not let this timer alone keep Node alive after work completes.
 */
checkpointTimer
  .unref?.();

/*
 * GitHub Actions cancellation / runner stop.
 *
 * Best-effort final checkpoint push.
 */
async function handleTermination(
  signal
) {
  if (
    shuttingDown
  ) {
    return;
  }

  shuttingDown =
    true;

  console.warn(
    `[checkpoint] received ${signal}; attempting final checkpoint push...`
  );

  try {
    await publishCheckpoints(
      `signal-${signal}`
    );
  } catch {}

  process.exit(
    signal ===
      "SIGINT"
      ? 130
      : 143
  );
}

process.once(
  "SIGINT",
  () => {
    void handleTermination(
      "SIGINT"
    );
  }
);

process.once(
  "SIGTERM",
  () => {
    void handleTermination(
      "SIGTERM"
    );
  }
);

/*
 * ==========================================================
 * UNIVERSITY WORKERS
 * ==========================================================
 */

const workers =
  Array.from(
    {
      length:
        Math.min(
          CONFIG
            .universityConcurrency,

          Math.max(
            1,
            pendingIndices.length
          )
        ),
    },

    async () => {
      while (
        pendingCursor <
        pendingIndices.length
      ) {
        const index =
          pendingIndices[
            pendingCursor++
          ];

        const university =
          institutions[
            index
          ];

        const started =
          Date.now();

        try {
          const result =
            await crawlUniversity(
              university,

              auditsBySlug.get(
                university.slug
              ),

              reauditBySlug.get(
                university.slug
              )
            );

          const completedResult = {
            ...result,

            elapsedMs:
              Date.now() -
              started,
          };

          /*
           * Save checkpoint immediately when the university finishes.
           */
          await saveUniversityCheckpoint(
            index,
            completedResult
          );

          console.log(
            [
              `[${index + 1}/${institutions.length}] ${university.slug}`,

              `pages=${result.pageCount}`,

              `evidence=${result.evidence.length}`,

              `docs=${result.documents.length}`,

              `portalCandidates=${result.portalCandidates.length}`,

              `hubs=${result.researchHubs || 0}`,

              `failures=${result.failures.length}`,
            ].join(
              " | "
            )
          );
        } catch (
          error
        ) {
          /*
           * Do NOT checkpoint a top-level failed university.
           *
           * It will automatically be retried on the next run.
           */
          console.warn(
            `[${index + 1}/${institutions.length}] ${university.slug} failed and will be retried on the next run:`,

            error instanceof
            Error
              ? error.message
              : String(
                  error
                )
          );
        }
      }
    }
  );

await Promise.all(
  workers
);

clearInterval(
  checkpointTimer
);

/*
 * Push everything completed even if 30-minute timer has not fired yet.
 *
 * At this exact point generated final datasets have NOT yet been
 * rewritten, therefore git working tree is safe for pull --rebase.
 */
await publishCheckpoints(
  "crawl-workers-finished"
);

/*
 * If any university had a top-level failure, stop here.
 *
 * Existing completed checkpoints are already safely pushed.
 * Next run will resume and retry only missing universities.
 */
const missing =
  institutions.filter(
    (
      _,
      index
    ) =>
      !results[
        index
      ]
  );

if (
  missing.length
) {
  await writeCheckpointManifest();

  await publishCheckpoints(
    "incomplete-crawl"
  );

  throw new Error(
    `Crawl incomplete: ${missing.length} universities have no completed checkpoint: ${
      missing
        .slice(
          0,
          20
        )
        .map(
          (
            item
          ) =>
            item.slug
        )
        .join(", ")
    }${
      missing.length >
      20
        ? ", ..."
        : ""
    }`
  );
}

/*
 * ==========================================================
 * ALL 115 ARE NOW COMPLETE
 * ==========================================================
 *
 * Only now do we build the authoritative discovery outputs.
 */

const allEvidence =
  results.flatMap(
    (
      result
    ) =>
      result.evidence ||
      []
  );

const allDocuments =
  results.flatMap(
    (
      result
    ) =>
      result.documents ||
      []
  );

const allPortals =
  results.flatMap(
    (
      result
    ) =>
      result
        .portalCandidates ||
      []
  );

const dimensionCounts =
  Object.fromEntries(
    Object.keys(
      DIMENSIONS
    ).map(
      (
        dimension
      ) => [
        dimension,

        allEvidence.filter(
          (
            record
          ) =>
            record
              .dimension ===
            dimension
        ).length,
      ]
    )
  );

const evidenceOutput = {
  schemaVersion:
    1,

  generatedAt:
    new Date()
      .toISOString(),

  crawler:
    "research-multi-hub-deep-discovery",

  constraints: {
    maxDepth:
      CONFIG.maxDepth,

    maxPagesPerUniversity:
      CONFIG
        .maxPagesPerUniversity,

    maxPagesPerHub:
      CONFIG
        .maxPagesPerHub,

    maxResearchHubs:
      CONFIG
        .maxResearchHubs,

    maxDocumentsPerUniversity:
      CONFIG
        .maxDocumentsPerUniversity,

    researchHubDepthReset:
      true,

    embeddedCmsUrlDiscovery:
      true,

    multiOriginSitemaps:
      true,

    documentMode:
      "metadata-only",

    smartDocumentTitles:
      true,

    checkpointResume:
      true,

    checkpointGranularity:
      "completed-university",

    checkpointIntervalMs:
      CONFIG
        .checkpointIntervalMs,

    pageTimeoutMs:
      CONFIG.pageTimeoutMs,

    socialEvidenceBlocked:
      [
        ...SOCIAL_HOSTS,
      ].sort(),

    browserFallbackAvailable:
      Boolean(
        BROWSER_PATH
      ),
  },

  evidence:
    allEvidence,

  portalCandidates:
    allPortals,
};

const docsOutput = {
  schemaVersion:
    1,

  generatedAt:
    new Date()
      .toISOString(),

  storageMode:
    "metadata-only",

  documentBodiesStored:
    false,

  smartDocumentTitles:
    true,

  verification:
    "HEAD with Range GET fallback; response body cancelled",

  documents:
    allDocuments,
};

const summary = {
  schemaVersion:
    1,

  generatedAt:
    new Date()
      .toISOString(),

  institutions:
    institutions.length,

  institutionsWithPages:
    results.filter(
      (
        result
      ) =>
        result.pageCount >
        0
    ).length,

  pagesFetched:
    results.reduce(
      (
        sum,
        result
      ) =>
        sum +
        (
          result
            .pageCount ||
          0
        ),

      0
    ),

  browserFallbackPages:
    results.reduce(
      (
        sum,
        result
      ) =>
        sum +
        (
          result
            .browserFallbackPages ||
          0
        ),

      0
    ),

  researchHubs:
    results.reduce(
      (
        sum,
        result
      ) =>
        sum +
        (
          result
            .researchHubs ||
          0
        ),

      0
    ),

  evidenceRecords:
    allEvidence.length,

  portalCandidates:
    allPortals.length,

  documentsDiscovered:
    allDocuments.length,

  documentsMetadataVerified:
    allDocuments.filter(
      (
        document
      ) =>
        document
          .metadataVerified
    ).length,

  documentsWithSmartTitle:
    allDocuments.filter(
      (
        document
      ) =>
        document
          .titleSource &&

        document
          .titleSource !==
          "unresolved"
    ).length,

  documentsDownloaded:
    0,

  documentBodiesStored:
    false,

  checkpointResume:
    true,

  checkpointFingerprint,

  dimensionCounts,

  failures:
    results.reduce(
      (
        sum,
        result
      ) =>
        sum +
        (
          result
            .failures
            ?.length ||
          0
        ),

      0
    ),

  universities:
    results.map(
      (
        result
      ) => ({
        slug:
          result.slug,

        nameFa:
          result.nameFa,

        pages:
          result
            .pageCount ||
          0,

        evidence:
          result
            .evidence
            ?.length ||
          0,

        documents:
          result
            .documents
            ?.length ||
          0,

        portalCandidates:
          result
            .portalCandidates
            ?.length ||
          0,

        researchHubs:
          result
            .researchHubs ||
          0,

        failures:
          result
            .failures
            ?.length ||
          0,

        elapsedMs:
          result
            .elapsedMs ||
          0,
      })
    ),
};

await Promise.all([
  fs.writeFile(
    "data/generated/discovery-evidence.json",

    JSON.stringify(
      evidenceOutput,
      null,
      2
    ) + "\n"
  ),

  fs.writeFile(
    "data/generated/discovered-documents.json",

    JSON.stringify(
      docsOutput,
      null,
      2
    ) + "\n"
  ),

  fs.writeFile(
    "data/generated/discovery-summary.json",

    JSON.stringify(
      summary,
      null,
      2
    ) + "\n"
  ),
]);

console.log(
  [
    "deep discovery complete",

    `universities=${institutions.length}`,

    `pages=${summary.pagesFetched}`,

    `evidence=${allEvidence.length}`,

    `documents=${allDocuments.length}`,

    `hubs=${summary.researchHubs}`,

    `metadataVerified=${summary.documentsMetadataVerified}`,

    `smartTitles=${summary.documentsWithSmartTitle}`,

    `checkpoint=115/${institutions.length}`,

    "downloaded=0",

    `browser=${
      BROWSER_PATH
        ? path.basename(
            BROWSER_PATH
          )
        : "static-only"
    }`,
  ].join(
    " | "
  )
);

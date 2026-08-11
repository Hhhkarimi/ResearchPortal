/**
 * Research Portal Deep Discovery Crawler
 *
 * - Uses only Node.js built-ins (no npm dependency changes).
 * - Starts from officialWebsite/researchUrl/known portal roots.
 * - Follows relevant internal links with a bounded priority crawl.
 * - Uses local Edge/Chrome --dump-dom as an optional JS-render fallback.
 * - Discovers dimension-specific evidence and downloadable research documents.
 * - Downloads related files to a persistent folder OUTSIDE the git worktree.
 * - Never treats a network failure as evidence of absence.
 * - Rejects Telegram and other social-media URLs as authoritative evidence.
 */

import fs from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const readJson = async (file, fallback = null) => {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
};

const intEnv = (name, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) => {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
};

const floatEnv = (name, fallback, min = 0, max = 1) => {
  const value = Number.parseFloat(process.env[name] ?? "");
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
};

const CONFIG = {
  maxDepth: intEnv("CRAWL_MAX_DEPTH", 3, 1, 6),
  maxPagesPerUniversity: intEnv("CRAWL_MAX_PAGES_PER_UNIVERSITY", 40, 5, 250),
  maxDocumentsPerUniversity: intEnv("CRAWL_MAX_DOCUMENTS_PER_UNIVERSITY", 60, 1, 300),
  pageTimeoutMs: intEnv("CRAWL_PAGE_TIMEOUT_MS", 10_000, 2_000, 60_000),
  documentTimeoutMs: intEnv("CRAWL_DOCUMENT_TIMEOUT_MS", 20_000, 3_000, 120_000),
  pageConcurrency: intEnv("CRAWL_PAGE_CONCURRENCY", 3, 1, 10),
  universityConcurrency: intEnv("CRAWL_UNIVERSITY_CONCURRENCY", 4, 1, 12),
  maxHtmlBytes: intEnv("CRAWL_MAX_HTML_BYTES", 2_500_000, 100_000, 10_000_000),
  maxDocumentBytes: intEnv("CRAWL_MAX_DOCUMENT_BYTES", 26_214_400, 100_000, 200_000_000),
  useBrowserFallback: (process.env.CRAWL_USE_BROWSER_FALLBACK ?? "1") !== "0",
  browserTimeoutMs: intEnv("CRAWL_BROWSER_TIMEOUT_MS", 18_000, 3_000, 90_000),
  discoveryThreshold: floatEnv("CRAWL_DISCOVERY_THRESHOLD", 0.62, 0.2, 1),
  documentDir:
    process.env.CRAWL_DOCUMENT_DIR ||
    path.resolve("runtime-crawl", "documents"),
};

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
  ".zip",
]);

const DOCUMENT_MIME_HINTS = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats",
  "application/vnd.ms-",
  "application/rtf",
  "application/vnd.oasis.opendocument",
  "application/zip",
  "application/octet-stream",
];

const NEGATIVE_NAV_WORDS = [
  "اخبار",
  "خبر",
  "رویداد",
  "تقویم",
  "آموزش",
  "پذیرش",
  "دانشجو",
  "ثبت نام",
  "news",
  "event",
  "calendar",
  "admission",
  "education",
  "undergraduate",
  "login",
  "ورود",
];

const PORTAL_KEYWORDS = [
  "معاونت پژوهشی",
  "معاونت پژوهش",
  "معاونت پژوهش و فناوری",
  "پژوهش و فناوری",
  "امور پژوهشی",
  "مدیریت پژوهش",
  "پرتال پژوهش",
  "research affairs",
  "research deputy",
  "vice chancellor for research",
  "vice-chancellor for research",
  "research and technology",
  "research & technology",
  "office of research",
  "research",
  "vpr",
];

const DIMENSIONS = {
  organization: {
    labelFa: "ساختار سازمانی",
    keywords: [
      "ساختار سازمانی",
      "چارت سازمانی",
      "ساختار معاونت",
      "مدیریت پژوهش",
      "مدیریت امور پژوهشی",
      "کارشناسان پژوهش",
      "کارکنان معاونت",
      "واحدهای پژوهشی",
      "مدیران معاونت",
      "معرفی معاونت",
      "organizational structure",
      "organization structure",
      "research units",
      "managements",
      "departments",
      "staff",
      "people",
      "about research",
    ],
  },
  libraryDocuments: {
    labelFa: "کتابخانه و اسناد",
    keywords: [
      "کتابخانه",
      "کتابخانه مرکزی",
      "مرکز اسناد",
      "اسناد علمی",
      "انتشارات",
      "نشر دانشگاهی",
      "نشریات علمی",
      "مجلات علمی",
      "library",
      "central library",
      "document center",
      "documentation center",
      "publication",
      "publisher",
      "journals",
    ],
  },
  laboratories: {
    labelFa: "آزمایشگاه‌ها",
    keywords: [
      "آزمایشگاه",
      "آزمایشگاه مرکزی",
      "شبکه آزمایشگاهی",
      "آزمایشگاه ها",
      "آزمایشگاه‌ها",
      "کارگاه پژوهشی",
      "laboratory",
      "laboratories",
      "central lab",
      "lab network",
      "research lab",
    ],
  },
  industryTechnology: {
    labelFa: "صنعت و فناوری",
    keywords: [
      "ارتباط با صنعت",
      "جامعه و صنعت",
      "صنعت و جامعه",
      "فناوری و نوآوری",
      "انتقال فناوری",
      "مالکیت فکری",
      "مرکز رشد",
      "شرکت دانش بنیان",
      "شرکت دانش‌بنیان",
      "کارآفرینی",
      "نوآوری",
      "industry",
      "technology transfer",
      "innovation",
      "intellectual property",
      "incubator",
      "knowledge based",
      "tto",
    ],
  },
  informationTechnology: {
    labelFa: "فناوری اطلاعات",
    keywords: [
      "فناوری اطلاعات",
      "فناوری اطلاعات و ارتباطات",
      "مرکز فناوری اطلاعات",
      "مرکز کامپیوتر",
      "خدمات فناوری اطلاعات",
      "information technology",
      "information and communication technology",
      "computer center",
      "ict center",
      "it center",
      "ict",
    ],
  },
  systemsServices: {
    labelFa: "سامانه‌ها و خدمات",
    keywords: [
      "سامانه",
      "سامانه ها",
      "سامانه‌ها",
      "خدمات الکترونیکی",
      "خدمات پژوهشی",
      "پژوهشیار",
      "علم سنجی",
      "علم‌سنجی",
      "پایان نامه",
      "پایان‌نامه",
      "نشریات",
      "system",
      "systems",
      "service",
      "services",
      "portal service",
      "research system",
      "journals system",
      "thesis system",
    ],
  },
  documentsRegulations: {
    labelFa: "اسناد و مقررات",
    keywords: [
      "آیین نامه",
      "آیین‌نامه",
      "شیوه نامه",
      "شیوه‌نامه",
      "دستورالعمل",
      "بخشنامه",
      "مقررات",
      "فرم",
      "فرم ها",
      "فرم‌ها",
      "دانلود فرم",
      "راهنما",
      "ضوابط",
      "سیاست",
      "اسناد",
      "مستندات",
      "regulation",
      "regulations",
      "bylaw",
      "guideline",
      "procedure",
      "policy",
      "circular",
      "forms",
      "documents",
      "download",
    ],
  },
};

const DOCUMENT_KEYWORDS = [
  ...DIMENSIONS.documentsRegulations.keywords,
  "گرنت",
  "پژوهانه",
  "طرح پژوهشی",
  "پروپوزال",
  "پایان نامه",
  "پایان‌نامه",
  "رساله",
  "اخلاق پژوهش",
  "فرصت مطالعاتی",
  "قرارداد پژوهشی",
  "مالکیت فکری",
  "research grant",
  "research proposal",
  "thesis",
  "dissertation",
  "research ethics",
  "research contract",
];

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\u200c/g, " ")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ۀ/g, "ه")
    .replace(/[\u064B-\u065F]/g, "")
    .replace(/[^\p{L}\p{N}./:&_-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const normalizedPortalKeywords = PORTAL_KEYWORDS.map(normalizeText);
const normalizedDocumentKeywords = DOCUMENT_KEYWORDS.map(normalizeText);
const normalizedDimensionKeywords = Object.fromEntries(
  Object.entries(DIMENSIONS).map(([key, value]) => [
    key,
    value.keywords.map(normalizeText),
  ])
);

function hostMatches(host, expected) {
  return host === expected || host.endsWith(`.${expected}`);
}

function stripWww(host) {
  return String(host).toLowerCase().replace(/^www\./, "");
}

function isBlockedHost(host) {
  const normalized = stripWww(host);
  return [...SOCIAL_HOSTS].some((blocked) => hostMatches(normalized, blocked));
}

function isUnsafeHost(host) {
  const normalized = stripWww(host);
  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal")
  ) {
    return true;
  }

  if (!normalized.includes(".") && net.isIP(normalized) === 0) {
    return true;
  }

  if (net.isIP(normalized)) {
    return (
      normalized.startsWith("10.") ||
      normalized.startsWith("127.") ||
      normalized.startsWith("169.254.") ||
      normalized.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(normalized) ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:")
    );
  }

  return false;
}

function safeHttpUrl(value, base = undefined) {
  try {
    const url = base ? new URL(value, base) : new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (isBlockedHost(url.hostname) || isUnsafeHost(url.hostname)) return null;
    url.hash = "";

    for (const key of [...url.searchParams.keys()]) {
      if (
        key.toLowerCase().startsWith("utm_") ||
        ["fbclid", "gclid", "mc_cid", "mc_eid"].includes(key.toLowerCase())
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
  if (!url) return null;
  url.hostname = stripWww(url.hostname);
  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }
  return url.toString();
}

function baseDomain(host) {
  const normalized = stripWww(host);
  if (net.isIP(normalized)) return normalized;
  const labels = normalized.split(".").filter(Boolean);
  if (labels.length <= 2) return normalized;

  const iranSecondLevel = [
    ".ac.ir",
    ".gov.ir",
    ".org.ir",
    ".co.ir",
    ".id.ir",
    ".sch.ir",
  ];

  if (iranSecondLevel.some((suffix) => normalized.endsWith(suffix))) {
    return labels.slice(-3).join(".");
  }

  return labels.slice(-2).join(".");
}

function isInstitutionUrl(value, allowedBases) {
  const url = safeHttpUrl(value);
  if (!url) return false;
  const base = baseDomain(url.hostname);
  return allowedBases.has(base);
}

function countKeywordHits(text, keywords) {
  const normalized = normalizeText(text);
  if (!normalized) return 0;
  let count = 0;
  for (const keyword of keywords) {
    if (keyword && normalized.includes(keyword)) count += 1;
  }
  return count;
}

function weightedSignal({ anchor = "", url = "", title = "", body = "" }, keywords) {
  const anchorHits = countKeywordHits(anchor, keywords);
  const urlHits = countKeywordHits(decodeURIComponentSafe(url), keywords);
  const titleHits = countKeywordHits(title, keywords);
  const bodyHits = countKeywordHits(String(body).slice(0, 18_000), keywords);

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

function decodeURIComponentSafe(value) {
  try {
    return decodeURIComponent(String(value));
  } catch {
    return String(value);
  }
}

function portalSignal(context) {
  return weightedSignal(context, normalizedPortalKeywords);
}

function dimensionSignals(context) {
  return Object.fromEntries(
    Object.entries(normalizedDimensionKeywords).map(([dimension, keywords]) => [
      dimension,
      weightedSignal(context, keywords),
    ])
  );
}

function signalConfidence(score, floor = 0.5) {
  return Math.max(floor, Math.min(0.99, floor + score / 38));
}

function hasNegativeNavigationSignal(text) {
  const normalized = normalizeText(text);
  return NEGATIVE_NAV_WORDS.some((word) =>
    normalized.includes(normalizeText(word))
  );
}

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, number) =>
      String.fromCodePoint(Number.parseInt(number, 10))
    );
}

function stripTags(value) {
  return decodeHtml(
    String(value ?? "")
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html) {
  const match = String(html).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripTags(match[1]).slice(0, 300) : "";
}

function attributeValue(attributes, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const quoted = attributes.match(
    new RegExp(`\\b${escaped}\\s*=\\s*([\"'])([\\s\\S]*?)\\1`, "i")
  );
  if (quoted) return decodeHtml(quoted[2].trim());

  const unquoted = attributes.match(
    new RegExp(`\\b${escaped}\\s*=\\s*([^\\s>]+)`, "i")
  );
  return unquoted ? decodeHtml(unquoted[1].trim()) : "";
}

function extractLinks(html, pageUrl) {
  const links = [];
  const seen = new Set();
  const anchorRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorRegex.exec(String(html)))) {
    const attributes = match[1];
    const href = attributeValue(attributes, "href");
    if (!href) continue;

    const url = safeHttpUrl(href, pageUrl);
    if (!url) continue;

    const key = canonicalUrl(url.toString()) || url.toString();
    if (seen.has(key)) continue;
    seen.add(key);

    const anchorText = stripTags(match[2]).slice(0, 500);
    const title = attributeValue(attributes, "title").slice(0, 300);

    links.push({
      url: url.toString(),
      anchorText,
      title,
    });
  }

  // Some CMS templates expose useful destinations in iframes.
  const iframeRegex = /<iframe\b([^>]*)>/gi;
  while ((match = iframeRegex.exec(String(html)))) {
    const src = attributeValue(match[1], "src");
    if (!src) continue;
    const url = safeHttpUrl(src, pageUrl);
    if (!url) continue;
    const key = canonicalUrl(url.toString()) || url.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({
      url: url.toString(),
      anchorText: attributeValue(match[1], "title"),
      title: attributeValue(match[1], "title"),
    });
  }

  // JS-heavy university CMS menus sometimes keep the destination on buttons
  // or generic elements instead of <a href>. Treat these as click targets.
  const clickableRegex = /<(button|div|li|span)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  while ((match = clickableRegex.exec(String(html)))) {
    const attributes = match[2];
    const text = stripTags(match[3]).slice(0, 500);
    const candidates = [
      attributeValue(attributes, "data-href"),
      attributeValue(attributes, "data-url"),
      attributeValue(attributes, "data-link"),
    ].filter(Boolean);

    const onclick = attributeValue(attributes, "onclick");
    if (onclick) {
      const clickUrl =
        onclick.match(/(?:location(?:\.href)?|window\.location)\s*=\s*["']([^"']+)["']/i)?.[1] ||
        onclick.match(/(?:open|navigate)\s*\(\s*["']([^"']+)["']/i)?.[1];
      if (clickUrl) candidates.push(clickUrl);
    }

    for (const candidate of candidates) {
      const url = safeHttpUrl(candidate, pageUrl);
      if (!url) continue;
      const key = canonicalUrl(url.toString()) || url.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({
        url: url.toString(),
        anchorText: text,
        title: attributeValue(attributes, "title"),
      });
    }
  }

  return links;
}

function isHtmlContentType(contentType) {
  const value = String(contentType ?? "").toLowerCase();
  return (
    !value ||
    value.includes("text/html") ||
    value.includes("application/xhtml+xml")
  );
}

function looksLikeDocumentContentType(contentType) {
  const value = String(contentType ?? "").toLowerCase();
  return DOCUMENT_MIME_HINTS.some((hint) => value.includes(hint));
}

function extensionOfUrl(value) {
  const url = safeHttpUrl(value);
  if (!url) return "";
  const extension = path.extname(url.pathname).toLowerCase();
  return DOCUMENT_EXTENSIONS.has(extension) ? extension : "";
}

function looksLikeDocumentLink(link) {
  if (extensionOfUrl(link.url)) return true;
  const context = `${link.anchorText} ${link.title} ${decodeURIComponentSafe(link.url)}`;
  return countKeywordHits(context, normalizedDocumentKeywords) > 0;
}

async function readBodyLimited(response, maxBytes) {
  const declared = Number.parseInt(response.headers.get("content-length") || "", 10);
  if (Number.isFinite(declared) && declared > maxBytes) {
    const error = new Error(`response-too-large:${declared}`);
    error.code = "RESPONSE_TOO_LARGE";
    throw error;
  }

  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) {
      const error = new Error(`response-too-large:${buffer.length}`);
      error.code = "RESPONSE_TOO_LARGE";
      throw error;
    }
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      total += chunk.length;
      if (total > maxBytes) {
        await reader.cancel();
        const error = new Error(`response-too-large:${total}`);
        error.code = "RESPONSE_TOO_LARGE";
        throw error;
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock?.();
  }

  return Buffer.concat(chunks);
}

const fetchHeaders = {
  "User-Agent":
    "IranResearchPortalObservatory/11.0 (+research-discovery; evidence-crawler)",
  Accept:
    "text/html,application/xhtml+xml,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,*/*;q=0.4",
  "Accept-Language": "fa-IR,fa;q=0.9,en;q=0.5",
};

async function fetchResource(url, timeoutMs, maxBytes) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: fetchHeaders,
    signal: AbortSignal.timeout(timeoutMs),
  });

  const contentType = response.headers.get("content-type") || "";
  const buffer = await readBodyLimited(response, maxBytes);

  return {
    requestedUrl: url,
    finalUrl: response.url,
    status: response.status,
    ok: response.ok,
    contentType,
    contentLength: buffer.length,
    buffer,
    headers: {
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified"),
      contentDisposition: response.headers.get("content-disposition"),
    },
  };
}

async function findBrowser() {
  if (!CONFIG.useBrowserFallback) return null;

  const candidates = [
    process.env.CRAWL_BROWSER_PATH,
    process.env.PROGRAMFILES &&
      path.join(
        process.env.PROGRAMFILES,
        "Microsoft",
        "Edge",
        "Application",
        "msedge.exe"
      ),
    process.env["PROGRAMFILES(X86)"] &&
      path.join(
        process.env["PROGRAMFILES(X86)"],
        "Microsoft",
        "Edge",
        "Application",
        "msedge.exe"
      ),
    process.env.PROGRAMFILES &&
      path.join(
        process.env.PROGRAMFILES,
        "Google",
        "Chrome",
        "Application",
        "chrome.exe"
      ),
    process.env["PROGRAMFILES(X86)"] &&
      path.join(
        process.env["PROGRAMFILES(X86)"],
        "Google",
        "Chrome",
        "Application",
        "chrome.exe"
      ),
    process.env.LOCALAPPDATA &&
      path.join(
        process.env.LOCALAPPDATA,
        "Google",
        "Chrome",
        "Application",
        "chrome.exe"
      ),
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // continue
    }
  }

  return null;
}

const BROWSER_PATH = await findBrowser();

async function renderWithBrowser(url) {
  if (!BROWSER_PATH) return null;

  try {
    const { stdout } = await execFileAsync(
      BROWSER_PATH,
      [
        "--headless=new",
        "--disable-gpu",
        "--disable-extensions",
        "--disable-background-networking",
        "--no-first-run",
        "--no-default-browser-check",
        "--dump-dom",
        url,
      ],
      {
        timeout: CONFIG.browserTimeoutMs,
        maxBuffer: 6_000_000,
        windowsHide: true,
      }
    );

    return stdout || null;
  } catch {
    return null;
  }
}

const robotsCache = new Map();

function parseRobots(text) {
  const disallow = [];
  const sitemaps = [];
  let applies = false;

  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();

    if (key === "user-agent") {
      applies = value === "*";
    } else if (key === "disallow" && applies && value) {
      disallow.push(value);
    } else if (key === "sitemap" && value) {
      sitemaps.push(value);
    }
  }

  return { disallow, sitemaps };
}

async function getRobots(url) {
  const parsedUrl = safeHttpUrl(url);
  if (!parsedUrl) return { disallow: [], sitemaps: [] };

  const origin = parsedUrl.origin;
  if (robotsCache.has(origin)) return robotsCache.get(origin);

  const promise = (async () => {
    try {
      const robotsUrl = new URL("/robots.txt", origin).toString();
      const resource = await fetchResource(robotsUrl, 5_000, 300_000);
      if (!resource.ok) return { disallow: [], sitemaps: [] };
      return parseRobots(resource.buffer.toString("utf8"));
    } catch {
      return { disallow: [], sitemaps: [] };
    }
  })();

  robotsCache.set(origin, promise);
  return promise;
}

async function allowedByRobots(url) {
  const parsedUrl = safeHttpUrl(url);
  if (!parsedUrl) return false;
  const robots = await getRobots(url);
  const target = `${parsedUrl.pathname}${parsedUrl.search}`;
  return !robots.disallow.some(
    (prefix) => prefix !== "/" && prefix && target.startsWith(prefix)
  ) && !robots.disallow.includes("/");
}

function parseSitemap(text) {
  const urls = [];
  const regex = /<loc\b[^>]*>([\s\S]*?)<\/loc>/gi;
  let match;

  while ((match = regex.exec(String(text)))) {
    const value = stripTags(match[1]);
    const url = safeHttpUrl(value);
    if (url) urls.push(url.toString());
  }

  return urls;
}

async function fetchSitemapCandidates(seedUrl, allowedBases) {
  const parsedSeed = safeHttpUrl(seedUrl);
  if (!parsedSeed) return [];

  const robots = await getRobots(seedUrl);
  const sitemapUrls = new Set(robots.sitemaps);

  if (!sitemapUrls.size) {
    sitemapUrls.add(new URL("/sitemap.xml", parsedSeed.origin).toString());
  }

  const candidates = [];
  for (const sitemapUrl of [...sitemapUrls].slice(0, 3)) {
    try {
      const resource = await fetchResource(sitemapUrl, 8_000, 2_000_000);
      if (!resource.ok) continue;
      for (const value of parseSitemap(resource.buffer.toString("utf8"))) {
        if (!isInstitutionUrl(value, allowedBases)) continue;

        const context = {
          url: value,
          anchor: "",
          title: "",
          body: "",
        };

        const p = portalSignal(context).score;
        const dims = dimensionSignals(context);
        const dimMax = Math.max(...Object.values(dims).map((x) => x.score));
        if (p >= 4 || dimMax >= 4 || extensionOfUrl(value)) {
          candidates.push(value);
        }
      }
    } catch {
      // Sitemap failure is non-fatal.
    }
  }

  return [...new Set(candidates)].slice(0, 250);
}

function priorityForLink(link, parentResearchContext) {
  const context = {
    anchor: `${link.anchorText} ${link.title}`,
    url: link.url,
    title: "",
    body: "",
  };
  const portal = portalSignal(context).score;
  const dimensions = dimensionSignals(context);
  const dimensionMax = Math.max(
    0,
    ...Object.values(dimensions).map((signal) => signal.score)
  );
  const document = looksLikeDocumentLink(link) ? 18 : 0;
  const negative = hasNegativeNavigationSignal(context.anchor) ? -12 : 0;

  return (
    portal * 3 +
    dimensionMax * 2 +
    document +
    (parentResearchContext ? 12 : 0) +
    negative
  );
}

function shouldQueueLink(link, parentResearchContext, depth) {
  if (depth > CONFIG.maxDepth) return false;

  const context = {
    anchor: `${link.anchorText} ${link.title}`,
    url: link.url,
    title: "",
    body: "",
  };
  const portal = portalSignal(context).score;
  const dimensions = dimensionSignals(context);
  const dimensionMax = Math.max(
    0,
    ...Object.values(dimensions).map((signal) => signal.score)
  );

  if (portal >= 4 || dimensionMax >= 5) return true;
  if (parentResearchContext && !hasNegativeNavigationSignal(context.anchor)) {
    return true;
  }

  return false;
}

function documentTaxonomy(text) {
  const normalized = normalizeText(text);

  const groups = [
    ["research ethics", ["اخلاق پژوهش", "کمیته اخلاق", "research ethics"]],
    ["grants/funding", ["گرنت", "پژوهانه", "حمایت", "grant", "funding"]],
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
      ["آزمایشگاه", "آزمایش", "laboratory", "lab"],
    ],
    [
      "publications/journals",
      ["نشریه", "مجله", "انتشارات", "journal", "publication"],
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
      ["آیین نامه", "آیین‌نامه", "مقررات", "ضوابط", "regulation", "bylaw"],
    ],
    [
      "procedure/guideline",
      [
        "شیوه نامه",
        "شیوه‌نامه",
        "دستورالعمل",
        "راهنما",
        "guideline",
        "procedure",
      ],
    ],
    ["form/template", ["فرم", "الگو", "form", "template"]],
    ["policy/circular", ["بخشنامه", "سیاست", "ابلاغ", "policy", "circular"]],
  ];

  for (const [taxonomy, keywords] of groups) {
    if (keywords.some((keyword) => normalized.includes(normalizeText(keyword)))) {
      return taxonomy;
    }
  }

  return "other";
}

function documentType(taxonomy, title) {
  const normalized = normalizeText(title);
  if (taxonomy === "regulation/bylaw") return "آیین‌نامه";
  if (taxonomy === "procedure/guideline") return "شیوه‌نامه/دستورالعمل";
  if (taxonomy === "form/template") return "فرم/الگو";
  if (taxonomy === "policy/circular") return "سیاست/بخشنامه";
  if (normalized.includes("فرایند") || normalized.includes("فرآیند")) return "فرآیند";
  return "سند";
}

function documentTopic(taxonomy, title) {
  if (taxonomy === "research ethics") return "اخلاق پژوهش";
  if (taxonomy === "grants/funding") return "حمایت و گرنت";
  if (taxonomy === "publications/journals") return "انتشارات و نشریات";
  if (taxonomy === "laboratory") return "آزمایشگاه";
  if (taxonomy === "industry/technology/IP")
    return "صنعت، فناوری و مالکیت فکری";
  if (taxonomy === "postgraduate/research affairs")
    return "تحصیلات تکمیلی و امور پژوهشی";

  const normalized = normalizeText(title);
  if (normalized.includes("اخلاق")) return "اخلاق پژوهش";
  if (
    ["گرنت", "پژوهانه", "حمایت"].some((x) =>
      normalized.includes(normalizeText(x))
    )
  ) {
    return "حمایت و گرنت";
  }
  if (
    ["نشریه", "مجله", "انتشارات"].some((x) =>
      normalized.includes(normalizeText(x))
    )
  ) {
    return "انتشارات و نشریات";
  }
  if (normalized.includes("آزمایش")) return "آزمایشگاه";
  if (
    ["صنعت", "فناوری", "مالکیت فکری", "اختراع", "مرکز رشد"].some((x) =>
      normalized.includes(normalizeText(x))
    )
  ) {
    return "صنعت، فناوری و مالکیت فکری";
  }
  if (
    ["پایان نامه", "پایان‌نامه", "رساله", "پروپوزال"].some((x) =>
      normalized.includes(normalizeText(x))
    )
  ) {
    return "تحصیلات تکمیلی و امور پژوهشی";
  }

  return "سایر";
}

function filenameFromHeaders(resource, url) {
  const disposition = resource.headers.contentDisposition || "";
  const encoded = disposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded.replace(/^["']|["']$/g, ""));
    } catch {
      // continue
    }
  }

  const regular = disposition.match(/filename\s*=\s*["']?([^;"']+)/i)?.[1];
  if (regular) return regular.trim();

  const parsedUrl = safeHttpUrl(url);
  return parsedUrl
    ? decodeURIComponentSafe(path.basename(parsedUrl.pathname)) || "document"
    : "document";
}

function safeFilename(value) {
  const cleaned = String(value || "document")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);

  return cleaned || "document";
}

function addDocumentCandidate(map, candidate) {
  const key = canonicalUrl(candidate.url);
  if (!key || map.has(key)) return;
  map.set(key, candidate);
}

function evidenceKey(record) {
  return `${record.universitySlug}|${record.dimension}|${canonicalUrl(record.url)}`;
}

async function collectDocument(candidate, university) {
  const context = [
    candidate.anchorText,
    candidate.title,
    candidate.sourcePageTitle,
    candidate.sourcePage,
    candidate.url,
  ]
    .filter(Boolean)
    .join(" ");

  const keywordHits = countKeywordHits(context, normalizedDocumentKeywords);
  const ext = extensionOfUrl(candidate.url);

  // Unknown-extension downloads need a meaningful research/document clue.
  if (!ext && keywordHits === 0) return null;

  try {
    const resource = await fetchResource(
      candidate.url,
      CONFIG.documentTimeoutMs,
      CONFIG.maxDocumentBytes
    );

    const final = safeHttpUrl(resource.finalUrl);
    if (!final || isBlockedHost(final.hostname) || isUnsafeHost(final.hostname)) {
      return null;
    }

    const finalExt = extensionOfUrl(resource.finalUrl);
    const isDocument =
      Boolean(ext || finalExt) || looksLikeDocumentContentType(resource.contentType);

    if (!isDocument || (isHtmlContentType(resource.contentType) && !ext && !finalExt)) {
      return null;
    }

    const sha256 = createHash("sha256")
      .update(resource.buffer)
      .digest("hex");

    let fileName = safeFilename(filenameFromHeaders(resource, resource.finalUrl));
    if (!path.extname(fileName) && (finalExt || ext)) {
      fileName += finalExt || ext;
    }

    const urlHash = createHash("sha1")
      .update(resource.finalUrl)
      .digest("hex")
      .slice(0, 12);

    const archivePath = path.join(
      university.slug,
      `${urlHash}-${fileName}`
    );

    const destination = path.join(CONFIG.documentDir, archivePath);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, resource.buffer);

    const taxonomy = documentTaxonomy(
      `${candidate.anchorText} ${candidate.title} ${fileName} ${candidate.sourcePageTitle}`
    );
    const title =
      candidate.anchorText ||
      candidate.title ||
      fileName.replace(/\.[^.]+$/, "") ||
      "سند پژوهشی";

    const linkedFromInstitution = candidate.linkedFromInstitution === true;
    const researchContext = candidate.researchContext === true;
    const confidence = Math.min(
      0.99,
      0.54 +
        (ext || finalExt ? 0.10 : 0) +
        Math.min(keywordHits, 3) * 0.09 +
        (linkedFromInstitution ? 0.07 : 0) +
        (researchContext ? 0.14 : 0)
    );

    return {
      universitySlug: university.slug,
      nameFa: university.nameFa,
      title: title.slice(0, 500),
      url: resource.finalUrl,
      sourcePage: candidate.sourcePage,
      sourcePageTitle: candidate.sourcePageTitle || "",
      anchorText: candidate.anchorText || "",
      depth: candidate.depth,
      fileName,
      extension: (finalExt || ext || path.extname(fileName)).toLowerCase(),
      contentType: resource.contentType,
      bytes: resource.buffer.length,
      sha256,
      archivePath: archivePath.replaceAll("\\", "/"),
      downloaded: true,
      status: resource.status,
      taxonomy,
      type: documentType(taxonomy, title),
      topic: documentTopic(taxonomy, title),
      confidence,
      discoveredAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      universitySlug: university.slug,
      nameFa: university.nameFa,
      title:
        candidate.anchorText ||
        candidate.title ||
        path.basename(safeHttpUrl(candidate.url)?.pathname || "") ||
        "سند پژوهشی",
      url: candidate.url,
      sourcePage: candidate.sourcePage,
      sourcePageTitle: candidate.sourcePageTitle || "",
      anchorText: candidate.anchorText || "",
      depth: candidate.depth,
      extension: ext,
      downloaded: false,
      error: error instanceof Error ? error.message : String(error),
      taxonomy: documentTaxonomy(context),
      type: documentType(documentTaxonomy(context), candidate.anchorText),
      topic: documentTopic(documentTaxonomy(context), candidate.anchorText),
      confidence: Math.min(
        0.9,
        0.46 +
          (ext ? 0.10 : 0) +
          Math.min(keywordHits, 3) * 0.09 +
          (candidate.researchContext ? 0.12 : 0)
      ),
      discoveredAt: new Date().toISOString(),
    };
  }
}

async function crawlUniversity(university, audit, reauditRow) {
  const seeds = [];
  const seedSeen = new Set();

  const addSeed = (value, researchContext, priority, sourceKind) => {
    const url = safeHttpUrl(value);
    if (!url) return;
    const key = canonicalUrl(url.toString());
    if (!key || seedSeen.has(key)) return;
    seedSeen.add(key);
    seeds.push({
      url: url.toString(),
      depth: 0,
      priority,
      researchContext,
      anchorText: "",
      from: null,
      sourceKind,
    });
  };

  for (const value of reauditRow?.portalUrls || []) {
    addSeed(value, true, 120, "known-portal");
  }

  if (audit?.researchUrl) {
    addSeed(audit.researchUrl, true, 115, "research-url");
  }

  addSeed(university.officialWebsite, false, 90, "official-website");

  if (!seeds.length) {
    return {
      slug: university.slug,
      nameFa: university.nameFa,
      pageCount: 0,
      evidence: [],
      documents: [],
      portalCandidates: [],
      failures: [
        {
          url: null,
          reason: "no-official-seed",
        },
      ],
    };
  }

  const allowedBases = new Set(
    seeds
      .map((seed) => safeHttpUrl(seed.url))
      .filter(Boolean)
      .map((url) => baseDomain(url.hostname))
  );

  // Existing dimension URLs are also official-domain hints, but social sources are ignored.
  for (const key of [
    "organizationUrls",
    "libraryUrls",
    "laboratoryUrls",
    "industryTechnologyUrls",
    "informationTechnologyUrls",
    "systemsUrls",
    "documentIndexUrls",
  ]) {
    for (const value of reauditRow?.[key] || []) {
      const parsed = safeHttpUrl(value);
      if (parsed) allowedBases.add(baseDomain(parsed.hostname));
    }
  }

  const queue = [...seeds];
  const queued = new Set(seeds.map((seed) => canonicalUrl(seed.url)));
  const visited = new Set();
  const evidence = new Map();
  const documentCandidates = new Map();
  const portalCandidates = new Map();
  const failures = [];
  let pagesFetched = 0;
  let browserFallbackPages = 0;

  // Pull a filtered subset from sitemaps to improve discovery on CMS sites.
  try {
    const sitemapCandidates = await fetchSitemapCandidates(
      university.officialWebsite || seeds[0].url,
      allowedBases
    );

    for (const value of sitemapCandidates) {
      const key = canonicalUrl(value);
      if (!key || queued.has(key)) continue;
      queued.add(key);
      queue.push({
        url: value,
        depth: 1,
        priority: 45,
        researchContext: false,
        anchorText: "",
        from: university.officialWebsite || seeds[0].url,
        sourceKind: "sitemap",
      });
    }
  } catch {
    // non-fatal
  }

  while (queue.length && visited.size < CONFIG.maxPagesPerUniversity) {
    queue.sort((a, b) => b.priority - a.priority || a.depth - b.depth);

    const batch = [];
    while (
      queue.length &&
      batch.length < CONFIG.pageConcurrency &&
      visited.size + batch.length < CONFIG.maxPagesPerUniversity
    ) {
      const item = queue.shift();
      const key = canonicalUrl(item.url);
      if (!key || visited.has(key)) continue;
      visited.add(key);
      batch.push(item);
    }

    if (!batch.length) continue;

    const outcomes = await Promise.all(
      batch.map(async (item) => {
        if (!(await allowedByRobots(item.url))) {
          return {
            item,
            skipped: "robots-disallow",
          };
        }

        try {
          const resource = await fetchResource(
            item.url,
            CONFIG.pageTimeoutMs,
            CONFIG.maxHtmlBytes
          );

          return {
            item,
            resource,
          };
        } catch (error) {
          return {
            item,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      })
    );

    for (const outcome of outcomes) {
      const { item } = outcome;

      if (outcome.skipped) {
        failures.push({
          url: item.url,
          reason: outcome.skipped,
        });
        continue;
      }

      if (outcome.error) {
        failures.push({
          url: item.url,
          reason: outcome.error,
        });
        continue;
      }

      const resource = outcome.resource;
      const finalUrl = safeHttpUrl(resource.finalUrl);
      if (!finalUrl || !isInstitutionUrl(finalUrl.toString(), allowedBases)) {
        // Redirects outside the institution are not crawled as pages.
        continue;
      }

      if (!isHtmlContentType(resource.contentType)) {
        if (
          looksLikeDocumentContentType(resource.contentType) ||
          extensionOfUrl(resource.finalUrl)
        ) {
          addDocumentCandidate(documentCandidates, {
            url: resource.finalUrl,
            anchorText: item.anchorText,
            title: "",
            sourcePage: item.from || item.url,
            sourcePageTitle: "",
            depth: item.depth,
            linkedFromInstitution: true,
            researchContext: item.researchContext === true,
          });
        }
        continue;
      }

      if (!resource.ok) {
        failures.push({
          url: item.url,
          status: resource.status,
          reason: "http-error",
        });
        continue;
      }

      pagesFetched += 1;
      let html = resource.buffer.toString("utf8");
      let links = extractLinks(html, resource.finalUrl);

      if (
        BROWSER_PATH &&
        CONFIG.useBrowserFallback &&
        links.length < 4 &&
        item.depth <= 2
      ) {
        const rendered = await renderWithBrowser(resource.finalUrl);
        if (rendered) {
          const renderedLinks = extractLinks(rendered, resource.finalUrl);
          if (renderedLinks.length > links.length) {
            html = rendered;
            links = renderedLinks;
            browserFallbackPages += 1;
          }
        }
      }

      const title = extractTitle(html);
      const body = stripTags(html).slice(0, 35_000);
      const context = {
        anchor: item.anchorText,
        url: resource.finalUrl,
        title,
        body,
      };

      const portal = portalSignal(context);
      const currentResearchContext =
        item.researchContext ||
        portal.score >= 8 ||
        item.sourceKind === "known-portal" ||
        item.sourceKind === "research-url";

      if (
        portal.score >= 8 &&
        (portal.anchorHits > 0 || portal.urlHits > 0 || portal.titleHits > 0)
      ) {
        const key = canonicalUrl(resource.finalUrl);
        const candidate = {
          universitySlug: university.slug,
          nameFa: university.nameFa,
          url: resource.finalUrl,
          sourcePage: item.from,
          anchorText: item.anchorText,
          title,
          depth: item.depth,
          score: portal.score,
          confidence: signalConfidence(portal.score, 0.64),
          officialDomain: true,
          kind: "portal",
          discoveredAt: new Date().toISOString(),
        };
        const previous = portalCandidates.get(key);
        if (!previous || candidate.score > previous.score) {
          portalCandidates.set(key, candidate);
        }
      }

      const dims = dimensionSignals(context);
      for (const [dimension, signal] of Object.entries(dims)) {
        const hasDirectSignal =
          signal.anchorHits > 0 || signal.urlHits > 0 || signal.titleHits > 0;

        if (!hasDirectSignal || signal.score < 5) continue;

        const record = {
          universitySlug: university.slug,
          nameFa: university.nameFa,
          dimension,
          labelFa: DIMENSIONS[dimension].labelFa,
          url: resource.finalUrl,
          sourcePage: item.from || resource.finalUrl,
          anchorText: item.anchorText,
          title,
          depth: item.depth,
          score: signal.score,
          confidence: signalConfidence(signal.score, 0.58),
          officialDomain: true,
          researchContext: currentResearchContext,
          kind: "page",
          discoveredAt: new Date().toISOString(),
        };

        if (record.confidence >= CONFIG.discoveryThreshold) {
          const key = evidenceKey(record);
          const previous = evidence.get(key);
          if (!previous || record.score > previous.score) {
            evidence.set(key, record);
          }
        }
      }

      for (const link of links) {
        const parsed = safeHttpUrl(link.url);
        if (!parsed) continue;

        if (looksLikeDocumentLink(link)) {
          const documentContextHits = countKeywordHits(
            `${link.anchorText} ${link.title} ${decodeURIComponentSafe(link.url)}`,
            normalizedDocumentKeywords
          );

          // On a generic university homepage, do not archive every PDF.
          // A file is collected when it is linked from research context OR its
          // own link text/path has a research/document signal.
          if (currentResearchContext || documentContextHits > 0) {
            addDocumentCandidate(documentCandidates, {
              url: parsed.toString(),
              anchorText: link.anchorText,
              title: link.title,
              sourcePage: resource.finalUrl,
              sourcePageTitle: title,
              depth: item.depth + 1,
              linkedFromInstitution: true,
              researchContext: currentResearchContext,
            });
          }
        }

        // HTML page crawling stays inside the institution's accepted base domains.
        if (!isInstitutionUrl(parsed.toString(), allowedBases)) continue;
        if (extensionOfUrl(parsed.toString())) continue;

        const nextDepth = item.depth + 1;
        if (!shouldQueueLink(link, currentResearchContext, nextDepth)) continue;

        const key = canonicalUrl(parsed.toString());
        if (!key || queued.has(key) || visited.has(key)) continue;

        queued.add(key);
        queue.push({
          url: parsed.toString(),
          depth: nextDepth,
          priority: priorityForLink(link, currentResearchContext),
          researchContext:
            currentResearchContext ||
            portalSignal({
              anchor: `${link.anchorText} ${link.title}`,
              url: link.url,
              title: "",
              body: "",
            }).score >= 5,
          anchorText: link.anchorText || link.title,
          from: resource.finalUrl,
          sourceKind: "link",
        });
      }
    }
  }

  const candidates = [...documentCandidates.values()]
    .map((candidate) => ({
      ...candidate,
      rank:
        (extensionOfUrl(candidate.url) ? 8 : 0) +
        countKeywordHits(
          `${candidate.anchorText} ${candidate.title} ${candidate.url}`,
          normalizedDocumentKeywords
        ) *
          5,
    }))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, CONFIG.maxDocumentsPerUniversity);

  const documents = [];
  for (let cursor = 0; cursor < candidates.length; cursor += CONFIG.pageConcurrency) {
    const batch = candidates.slice(cursor, cursor + CONFIG.pageConcurrency);
    const results = await Promise.all(
      batch.map((candidate) => collectDocument(candidate, university))
    );
    for (const result of results) {
      if (result) documents.push(result);
    }
  }

  return {
    slug: university.slug,
    nameFa: university.nameFa,
    officialWebsite: university.officialWebsite || null,
    existingResearchUrl: audit?.researchUrl || null,
    pageCount: pagesFetched,
    visitedCount: visited.size,
    browserFallbackPages,
    evidence: [...evidence.values()].sort(
      (a, b) => b.confidence - a.confidence || b.score - a.score
    ),
    documents: documents.sort((a, b) => b.confidence - a.confidence),
    portalCandidates: [...portalCandidates.values()].sort(
      (a, b) => b.confidence - a.confidence || b.score - a.score
    ),
    failures,
  };
}

const [institutions, audits, reaudit] = await Promise.all([
  readJson("data/isc/institutions.json", []),
  readJson("data/audit/portal-audit.json", []),
  readJson("data/evidence/portal-document-reaudit.json", []),
]);

if (!Array.isArray(institutions) || institutions.length !== 115) {
  throw new Error(
    `Expected 115 institutions with officialWebsite seeds, got ${
      Array.isArray(institutions) ? institutions.length : "invalid data"
    }`
  );
}

const auditsBySlug = new Map(
  (audits || []).map((item) => [item.universitySlug, item])
);
const reauditBySlug = new Map(
  (reaudit || []).map((item) => [item.slug, item])
);

await fs.mkdir("data/generated", { recursive: true });
await fs.mkdir(CONFIG.documentDir, { recursive: true });

const universityResults = new Array(institutions.length);
let cursor = 0;

const workers = Array.from(
  { length: Math.min(CONFIG.universityConcurrency, institutions.length) },
  async () => {
    while (cursor < institutions.length) {
      const index = cursor++;
      const university = institutions[index];
      const started = Date.now();

      try {
        const result = await crawlUniversity(
          university,
          auditsBySlug.get(university.slug),
          reauditBySlug.get(university.slug)
        );
        universityResults[index] = {
          ...result,
          elapsedMs: Date.now() - started,
        };
        console.log(
          [
            `[${index + 1}/${institutions.length}] ${university.slug}`,
            `pages=${result.pageCount}`,
            `evidence=${result.evidence.length}`,
            `docs=${result.documents.length}`,
            `portalCandidates=${result.portalCandidates.length}`,
            `failures=${result.failures.length}`,
          ].join(" | ")
        );
      } catch (error) {
        universityResults[index] = {
          slug: university.slug,
          nameFa: university.nameFa,
          pageCount: 0,
          evidence: [],
          documents: [],
          portalCandidates: [],
          failures: [
            {
              url: university.officialWebsite || null,
              reason: error instanceof Error ? error.message : String(error),
            },
          ],
          elapsedMs: Date.now() - started,
        };
        console.warn(
          `[${index + 1}/${institutions.length}] ${university.slug} failed:`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }
);

await Promise.all(workers);

const allEvidence = universityResults.flatMap((item) => item.evidence || []);
const allDocuments = universityResults.flatMap((item) => item.documents || []);
const allPortalCandidates = universityResults.flatMap(
  (item) => item.portalCandidates || []
);

const evidenceOutput = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  crawler: "research-deep-discovery",
  constraints: {
    maxDepth: CONFIG.maxDepth,
    maxPagesPerUniversity: CONFIG.maxPagesPerUniversity,
    pageTimeoutMs: CONFIG.pageTimeoutMs,
    socialEvidenceBlocked: [...SOCIAL_HOSTS].sort(),
    browserFallbackAvailable: Boolean(BROWSER_PATH),
  },
  evidence: allEvidence,
  portalCandidates: allPortalCandidates,
};

const documentsOutput = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  documentStorageRoot: CONFIG.documentDir,
  maxDocumentBytes: CONFIG.maxDocumentBytes,
  documents: allDocuments,
};

const dimensionCounts = Object.fromEntries(
  Object.keys(DIMENSIONS).map((dimension) => [
    dimension,
    allEvidence.filter((item) => item.dimension === dimension).length,
  ])
);

const summary = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  institutions: institutions.length,
  institutionsWithPages: universityResults.filter((item) => item.pageCount > 0)
    .length,
  pagesFetched: universityResults.reduce(
    (sum, item) => sum + (item.pageCount || 0),
    0
  ),
  browserFallbackPages: universityResults.reduce(
    (sum, item) => sum + (item.browserFallbackPages || 0),
    0
  ),
  evidenceRecords: allEvidence.length,
  portalCandidates: allPortalCandidates.length,
  documentsDiscovered: allDocuments.length,
  documentsDownloaded: allDocuments.filter((item) => item.downloaded).length,
  dimensionCounts,
  failures: universityResults.reduce(
    (sum, item) => sum + (item.failures?.length || 0),
    0
  ),
  universities: universityResults.map((item) => ({
    slug: item.slug,
    nameFa: item.nameFa,
    pages: item.pageCount || 0,
    evidence: item.evidence?.length || 0,
    documents: item.documents?.length || 0,
    portalCandidates: item.portalCandidates?.length || 0,
    failures: item.failures?.length || 0,
    elapsedMs: item.elapsedMs || 0,
  })),
};

await Promise.all([
  fs.writeFile(
    "data/generated/discovery-evidence.json",
    JSON.stringify(evidenceOutput, null, 2) + "\n"
  ),
  fs.writeFile(
    "data/generated/discovered-documents.json",
    JSON.stringify(documentsOutput, null, 2) + "\n"
  ),
  fs.writeFile(
    "data/generated/discovery-summary.json",
    JSON.stringify(summary, null, 2) + "\n"
  ),
]);

console.log(
  [
    `deep discovery complete`,
    `universities=${institutions.length}`,
    `pages=${summary.pagesFetched}`,
    `evidence=${allEvidence.length}`,
    `documents=${allDocuments.length}`,
    `downloaded=${summary.documentsDownloaded}`,
    `browser=${BROWSER_PATH ? path.basename(BROWSER_PATH) : "static-only"}`,
  ].join(" | ")
);

/** Multi-hub deep crawler for official Iranian university research portals. */
import fs from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const readJson = async (file, fallback) => {
  try { return JSON.parse(await fs.readFile(file, "utf8")); } catch { return fallback; }
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
  documentTimeoutMs: intEnv("CRAWL_DOCUMENT_TIMEOUT_MS", 25_000, 3_000, 120_000),
  browserTimeoutMs: intEnv("CRAWL_BROWSER_TIMEOUT_MS", 25_000, 3_000, 90_000),
  pageConcurrency: intEnv("CRAWL_PAGE_CONCURRENCY", 3, 1, 10),
  universityConcurrency: intEnv("CRAWL_UNIVERSITY_CONCURRENCY", 3, 1, 12),
  maxHtmlBytes: intEnv("CRAWL_MAX_HTML_BYTES", 3_500_000, 100_000, 12_000_000),
  maxDocumentBytes: intEnv("CRAWL_MAX_DOCUMENT_BYTES", 26_214_400, 100_000, 200_000_000),
  useBrowserFallback: (process.env.CRAWL_USE_BROWSER_FALLBACK ?? "1") !== "0",
  discoveryThreshold: floatEnv("CRAWL_DISCOVERY_THRESHOLD", 0.62, 0.2, 1),
  documentDir: process.env.CRAWL_DOCUMENT_DIR || path.resolve("runtime-crawl", "documents"),
};

const SOCIAL_HOSTS = ["t.me","telegram.me","telegram.org","instagram.com","facebook.com","fb.com","x.com","twitter.com","linkedin.com","youtube.com","youtu.be"];
const DOC_EXTS = new Set([".pdf",".doc",".docx",".xls",".xlsx",".ppt",".pptx",".rtf",".odt",".ods",".odp",".zip"]);
const ASSET_EXTS = new Set([".js",".css",".png",".jpg",".jpeg",".gif",".webp",".svg",".ico",".woff",".woff2",".ttf",".eot",".map"]);
const DOC_MIME_HINTS = ["application/pdf","application/msword","application/vnd.openxmlformats","application/vnd.ms-","application/rtf","application/vnd.oasis.opendocument","application/zip","application/octet-stream"];
const NEGATIVE = ["اخبار","خبر","رویداد","تقویم","آموزش","پذیرش","دانشجو","ثبت نام","news","event","calendar","admission","education","undergraduate","login","ورود"];

const PORTAL_KEYWORDS = ["معاونت پژوهشی","معاونت پژوهش","معاونت پژوهش و فناوری","پژوهش و فناوری","امور پژوهشی","مدیریت پژوهش","پرتال پژوهش","research affairs","research deputy","vice chancellor for research","vice-chancellor for research","research and technology","research & technology","office of research","research","vpr"];
const HUB_KEYWORDS = ["مدیریت پژوهشی","مدیریت پژوهش","مدیریت امور پژوهشی","امور پژوهشی","دفتر پژوهش","اداره پژوهش","معاونت پژوهشی","معاونت پژوهش","معاونت پژوهش و فناوری","پژوهش و فناوری","مدیریت فناوری","ارتباط با صنعت","جامعه و صنعت","صنعت و جامعه","آزمایشگاه مرکزی","شبکه آزمایشگاهی","کتابخانه مرکزی","مرکز اسناد","فرایندهای پژوهشی","فرآیندهای پژوهشی","فرم های پژوهشی","فرم‌های پژوهشی","research management","research administration","research affairs","research office","office of research","vice chancellor for research","research and technology","technology transfer","industry liaison","central laboratory","central library","/web/mrt/","/mrt/","/research/","/research-affairs/","/research-management/","/researchoffice/","/vpr/"];

const DIMENSIONS = {
  organization: { labelFa: "ساختار سازمانی", keywords: ["ساختار سازمانی","چارت سازمانی","ساختار معاونت","مدیریت پژوهش","مدیریت پژوهشی","مدیریت امور پژوهشی","کارشناسان پژوهش","کارکنان معاونت","واحدهای پژوهشی","مدیران معاونت","organizational structure","research units","research management","departments","staff"] },
  libraryDocuments: { labelFa: "کتابخانه و اسناد", keywords: ["کتابخانه","کتابخانه مرکزی","مرکز اسناد","انتشارات","نشریات علمی","مجلات علمی","library","central library","document center","publication","journals"] },
  laboratories: { labelFa: "آزمایشگاه‌ها", keywords: ["آزمایشگاه","آزمایشگاه مرکزی","شبکه آزمایشگاهی","کارگاه پژوهشی","laboratory","laboratories","central lab","lab network","research lab"] },
  industryTechnology: { labelFa: "صنعت و فناوری", keywords: ["ارتباط با صنعت","جامعه و صنعت","صنعت و جامعه","فناوری و نوآوری","انتقال فناوری","مالکیت فکری","مرکز رشد","شرکت دانش بنیان","شرکت دانش‌بنیان","کارآفرینی","نوآوری","industry","technology transfer","innovation","intellectual property","incubator","tto"] },
  informationTechnology: { labelFa: "فناوری اطلاعات", keywords: ["فناوری اطلاعات","فناوری اطلاعات و ارتباطات","مرکز فناوری اطلاعات","مرکز کامپیوتر","خدمات فناوری اطلاعات","information technology","computer center","ict center","it center","ict"] },
  systemsServices: { labelFa: "سامانه‌ها و خدمات", keywords: ["سامانه","سامانه ها","سامانه‌ها","خدمات الکترونیکی","خدمات پژوهشی","پژوهشیار","علم سنجی","علم‌سنجی","پایان نامه","پایان‌نامه","نشریات","system","systems","service","services","research system","journals system","thesis system"] },
  documentsRegulations: { labelFa: "اسناد و مقررات", keywords: ["آیین نامه","آیین‌نامه","شیوه نامه","شیوه‌نامه","دستورالعمل","بخشنامه","مقررات","فرایند","فرآیند","فرایندها","فرآیندها","فرم","فرم ها","فرم‌ها","دانلود فرم","راهنما","ضوابط","سیاست","اسناد","مستندات","regulation","bylaw","guideline","procedure","process","workflow","policy","circular","forms","documents","download"] },
};
const DOC_KEYWORDS = [...DIMENSIONS.documentsRegulations.keywords,"گرنت","پژوهانه","طرح پژوهشی","پروپوزال","پایان نامه","پایان‌نامه","رساله","اخلاق پژوهش","فرصت مطالعاتی","قرارداد پژوهشی","مالکیت فکری","research grant","research proposal","thesis","dissertation","research ethics","research contract"];

function normalizeText(v) {
  return String(v ?? "").toLowerCase().replace(/\u200c/g," ").replace(/[يى]/g,"ی").replace(/ك/g,"ک").replace(/ۀ/g,"ه").replace(/[\u064B-\u065F]/g,"").replace(/[^\p{L}\p{N}./:&?=_-]+/gu," ").replace(/\s+/g," ").trim();
}
const N_PORTAL = PORTAL_KEYWORDS.map(normalizeText);
const N_HUB = HUB_KEYWORDS.map(normalizeText);
const N_DOC = DOC_KEYWORDS.map(normalizeText);
const N_DIMS = Object.fromEntries(Object.entries(DIMENSIONS).map(([k,v]) => [k,v.keywords.map(normalizeText)]));
const stripWww = (h) => String(h).toLowerCase().replace(/^www\./,"");
const hostMatches = (h,e) => h === e || h.endsWith(`.${e}`);
const isBlockedHost = (h) => SOCIAL_HOSTS.some((x) => hostMatches(stripWww(h), x));

function isUnsafeHost(h) {
  const x = stripWww(h);
  if (x === "localhost" || x.endsWith(".localhost") || x.endsWith(".local") || x.endsWith(".internal")) return true;
  if (!x.includes(".") && net.isIP(x) === 0) return true;
  if (!net.isIP(x)) return false;
  return x.startsWith("10.") || x.startsWith("127.") || x.startsWith("169.254.") || x.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[01])\./.test(x) || x === "::1" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe80:");
}

function safeHttpUrl(v, base) {
  try {
    const u = base ? new URL(v, base) : new URL(v);
    if (!["http:","https:"].includes(u.protocol) || isBlockedHost(u.hostname) || isUnsafeHost(u.hostname)) return null;
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) if (k.toLowerCase().startsWith("utm_") || ["fbclid","gclid","mc_cid","mc_eid"].includes(k.toLowerCase())) u.searchParams.delete(k);
    return u;
  } catch {
    return null;
  }
}

function canonicalUrl(v) {
  const u = safeHttpUrl(v);
  if (!u) return null;
  u.hostname = stripWww(u.hostname);
  if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/,"");
  return u.toString();
}

function baseDomain(host) {
  const h = stripWww(host);
  if (net.isIP(h)) return h;
  const p = h.split(".").filter(Boolean);
  if (p.length <= 2) return h;
  if ([".ac.ir",".gov.ir",".org.ir",".co.ir",".id.ir",".sch.ir"].some((s) => h.endsWith(s))) return p.slice(-3).join(".");
  return p.slice(-2).join(".");
}

const isInstitutionUrl = (v,bases) => {
  const u = safeHttpUrl(v);
  return !!u && bases.has(baseDomain(u.hostname));
};
const decodeURIComponentSafe = (v) => {
  try { return decodeURIComponent(String(v)); }
  catch { return String(v); }
};

function countHits(text, words) {
  const t = normalizeText(text);
  return words.reduce((n,w) => n + (w && t.includes(w) ? 1 : 0), 0);
}

function weightedSignal({anchor="",url="",title="",body=""}, words) {
  const a=countHits(anchor,words);
  const u=countHits(decodeURIComponentSafe(url),words);
  const t=countHits(title,words);
  const b=countHits(String(body).slice(0,18000),words);
  return {
    anchorHits:a,
    urlHits:u,
    titleHits:t,
    bodyHits:b,
    score:Math.min(a,3)*5+Math.min(u,3)*4+Math.min(t,3)*4+Math.min(b,3)
  };
}

const portalSignal = (c) => weightedSignal(c,N_PORTAL);
const hubSignal = (c) => weightedSignal(c,N_HUB);
const dimensionSignals = (c) => Object.fromEntries(Object.entries(N_DIMS).map(([k,w]) => [k,weightedSignal(c,w)]));
const confidence = (score,floor=.5) => Math.max(floor,Math.min(.99,floor+score/38));
const hasNegative = (t) => NEGATIVE.some((w) => normalizeText(t).includes(normalizeText(w)));

function decodeHtml(v) {
  return String(v??"")
    .replace(/&nbsp;/gi," ")
    .replace(/&amp;/gi,"&")
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&lt;/gi,"<")
    .replace(/&gt;/gi,">")
    .replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCodePoint(parseInt(h,16)))
    .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(parseInt(n,10)));
}

function stripTags(v) {
  return decodeHtml(
    String(v??"")
      .replace(/<script\b[\s\S]*?<\/script>/gi," ")
      .replace(/<style\b[\s\S]*?<\/style>/gi," ")
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi," ")
      .replace(/<!--[\s\S]*?-->/g," ")
      .replace(/<[^>]+>/g," ")
  ).replace(/\s+/g," ").trim();
}

const extractTitle = (html) => {
  const m=String(html).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return m ? stripTags(m[1]).slice(0,300) : "";
};

function attr(attrs,name) {
  const e=name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const q=attrs.match(new RegExp(`\\b${e}\\s*=\\s*(["'])([\\s\\S]*?)\\1`,"i"));
  if(q) return decodeHtml(q[2].trim());
  const u=attrs.match(new RegExp(`\\b${e}\\s*=\\s*([^\\s>]+)`,"i"));
  return u ? decodeHtml(u[1].trim()) : "";
}

function addLink(out,seen,value,pageUrl,extra={}) {
  const u=safeHttpUrl(value,pageUrl);
  if(!u) return;
  if(ASSET_EXTS.has(path.extname(u.pathname).toLowerCase())) return;
  const key=canonicalUrl(u.toString())||u.toString();
  if(seen.has(key)) return;
  seen.add(key);
  out.push({
    url:u.toString(),
    anchorText:extra.anchorText||"",
    title:extra.title||"",
    discoveryKind:extra.discoveryKind||"html"
  });
}

function extractLinks(html,pageUrl) {
  const out=[],seen=new Set(),src=String(html??"");
  let m;

  const a=/<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  while((m=a.exec(src))) {
    const href=attr(m[1],"href");
    if(href) addLink(out,seen,href,pageUrl,{
      anchorText:stripTags(m[2]).slice(0,500),
      title:attr(m[1],"title").slice(0,300),
      discoveryKind:"anchor"
    });
  }

  const f=/<iframe\b([^>]*)>/gi;
  while((m=f.exec(src))) {
    const v=attr(m[1],"src");
    const t=attr(m[1],"title").slice(0,300);
    if(v) addLink(out,seen,v,pageUrl,{
      anchorText:t,
      title:t,
      discoveryKind:"iframe"
    });
  }

  const c=/<(button|div|li|span)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  while((m=c.exec(src))) {
    const at=m[2];
    const text=stripTags(m[3]).slice(0,500);
    const vals=[
      attr(at,"data-href"),
      attr(at,"data-url"),
      attr(at,"data-link"),
      attr(at,"data-target-url")
    ].filter(Boolean);

    const onclick=attr(at,"onclick");
    if(onclick) {
      const v=
        onclick.match(/(?:location(?:\.href)?|window\.location)\s*=\s*["']([^"']+)["']/i)?.[1] ||
        onclick.match(/(?:open|navigate|goTo|goto)\s*\(\s*["']([^"']+)["']/i)?.[1];
      if(v) vals.push(v);
    }

    for(const v of vals) addLink(out,seen,v,pageUrl,{
      anchorText:text,
      title:attr(at,"title").slice(0,300),
      discoveryKind:"click-target"
    });
  }

  const js=decodeHtml(src).replace(/\\\//g,"/");
  const re=/["'`]((?:https?:\/\/|\/)[^"'`<>\s]{2,800})["'`]/gi;

  while((m=re.exec(js))) {
    const u=safeHttpUrl(m[1],pageUrl);
    if(!u || ASSET_EXTS.has(path.extname(u.pathname).toLowerCase())) continue;

    const ctx={anchor:"",url:u.toString(),title:"",body:""};
    const dims=dimensionSignals(ctx);
    const max=Math.max(0,...Object.values(dims).map(x=>x.score));

    if(
      !DOC_EXTS.has(path.extname(u.pathname).toLowerCase()) &&
      portalSignal(ctx).score<4 &&
      hubSignal(ctx).score<4 &&
      max<4
    ) continue;

    addLink(out,seen,u.toString(),pageUrl,{
      discoveryKind:"embedded-url"
    });
  }

  return out;
}

const isHtml = (ct) => {
  const v=String(ct??"").toLowerCase();
  return !v || v.includes("text/html") || v.includes("application/xhtml+xml");
};

const looksDocMime = (ct) =>
  DOC_MIME_HINTS.some((h) => String(ct??"").toLowerCase().includes(h));

function extOf(v) {
  const u=safeHttpUrl(v);
  if(!u) return "";
  const e=path.extname(u.pathname).toLowerCase();
  return DOC_EXTS.has(e) ? e : "";
}

const looksDocLink = (l) =>
  !!extOf(l.url) ||
  countHits(`${l.anchorText} ${l.title} ${decodeURIComponentSafe(l.url)}`,N_DOC)>0;

async function readLimited(res,max) {
  const declared=parseInt(res.headers.get("content-length")||"",10);
  if(Number.isFinite(declared)&&declared>max)
    throw new Error(`response-too-large:${declared}`);

  if(!res.body) {
    const b=Buffer.from(await res.arrayBuffer());
    if(b.length>max) throw new Error(`response-too-large:${b.length}`);
    return b;
  }

  const r=res.body.getReader();
  const chunks=[];
  let total=0;

  try {
    while(true) {
      const {value,done}=await r.read();
      if(done) break;

      const c=Buffer.from(value);
      total+=c.length;

      if(total>max) {
        await r.cancel();
        throw new Error(`response-too-large:${total}`);
      }

      chunks.push(c);
    }
  } finally {
    r.releaseLock?.();
  }

  return Buffer.concat(chunks);
}

const headers={
  "User-Agent":"IranResearchPortalObservatory/12.0 (+multi-hub-research-discovery)",
  Accept:"text/html,application/xhtml+xml,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,*/*;q=0.4",
  "Accept-Language":"fa-IR,fa;q=0.9,en;q=0.5"
};

async function fetchResource(url,timeout,max) {
  const res=await fetch(url,{
    redirect:"follow",
    headers,
    signal:AbortSignal.timeout(timeout)
  });

  const buffer=await readLimited(res,max);

  return {
    finalUrl:res.url,
    status:res.status,
    ok:res.ok,
    contentType:res.headers.get("content-type")||"",
    buffer,
    headers:{
      contentDisposition:res.headers.get("content-disposition"),
      etag:res.headers.get("etag"),
      lastModified:res.headers.get("last-modified")
    }
  };
}

async function findBrowser() {
  if(!CONFIG.useBrowserFallback) return null;

  const c=[
    process.env.CRAWL_BROWSER_PATH,
    process.env.PROGRAMFILES&&path.join(
      process.env.PROGRAMFILES,
      "Microsoft","Edge","Application","msedge.exe"
    ),
    process.env["PROGRAMFILES(X86)"]&&path.join(
      process.env["PROGRAMFILES(X86)"],
      "Microsoft","Edge","Application","msedge.exe"
    ),
    process.env.PROGRAMFILES&&path.join(
      process.env.PROGRAMFILES,
      "Google","Chrome","Application","chrome.exe"
    ),
    process.env.LOCALAPPDATA&&path.join(
      process.env.LOCALAPPDATA,
      "Google","Chrome","Application","chrome.exe"
    ),
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ].filter(Boolean);

  for(const p of c) {
    try {
      await fs.access(p);
      return p;
    } catch {}
  }

  return null;
}

const BROWSER_PATH=await findBrowser();

async function render(url) {
  if(!BROWSER_PATH) return null;

  try {
    const {stdout}=await execFileAsync(
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
        url
      ],
      {
        timeout:CONFIG.browserTimeoutMs,
        maxBuffer:10_000_000,
        windowsHide:true
      }
    );

    return stdout||null;
  } catch {
    return null;
  }
}

const robotsCache=new Map();

function parseRobots(text) {
  const disallow=[];
  const sitemaps=[];
  let applies=false;

  for(const raw of String(text).split(/\r?\n/)) {
    const line=raw.replace(/#.*$/,"").trim();
    if(!line) continue;

    const [k0,...rest]=line.split(":");
    const k=k0.trim().toLowerCase();
    const v=rest.join(":").trim();

    if(k==="user-agent") applies=v==="*";
    else if(k==="disallow"&&applies&&v) disallow.push(v);
    else if(k==="sitemap"&&v) sitemaps.push(v);
  }

  return {disallow,sitemaps};
}

async function getRobots(url) {
  const u=safeHttpUrl(url);
  if(!u) return {disallow:[],sitemaps:[]};

  if(robotsCache.has(u.origin))
    return robotsCache.get(u.origin);

  const p=(async()=>{
    try {
      const r=await fetchResource(
        new URL("/robots.txt",u.origin).toString(),
        5000,
        300000
      );

      return r.ok
        ? parseRobots(r.buffer.toString("utf8"))
        : {disallow:[],sitemaps:[]};
    } catch {
      return {disallow:[],sitemaps:[]};
    }
  })();

  robotsCache.set(u.origin,p);
  return p;
}

async function allowedByRobots(url) {
  const u=safeHttpUrl(url);
  if(!u) return false;

  const r=await getRobots(url);
  const t=`${u.pathname}${u.search}`;

  return !r.disallow.includes("/") &&
    !r.disallow.some(p=>p!=="/"&&p&&t.startsWith(p));
}

function parseSitemap(text) {
  const out=[];
  const re=/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi;
  let m;

  while((m=re.exec(String(text)))) {
    const u=safeHttpUrl(stripTags(m[1]));
    if(u) out.push(u.toString());
  }

  return out;
}

async function sitemapCandidates(seedUrl,bases) {
  const seed=safeHttpUrl(seedUrl);
  if(!seed) return [];

  const r=await getRobots(seedUrl);
  const q=[...r.sitemaps];

  if(!q.length)
    q.push(new URL("/sitemap.xml",seed.origin).toString());

  const seen=new Set();
  const out=new Set();

  while(q.length&&seen.size<8) {
    const sm=q.shift();
    const key=canonicalUrl(sm)||sm;

    if(seen.has(key)) continue;
    seen.add(key);

    try {
      const res=await fetchResource(sm,8000,3_000_000);
      if(!res.ok) continue;

      for(const v of parseSitemap(res.buffer.toString("utf8")).slice(0,1000)) {
        const u=safeHttpUrl(v);

        if(!u||!isInstitutionUrl(v,bases))
          continue;

        if(u.pathname.toLowerCase().endsWith(".xml")) {
          if(seen.size+q.length<8)
            q.push(v);

          continue;
        }

        const ctx={
          anchor:"",
          url:v,
          title:"",
          body:""
        };

        const dims=dimensionSignals(ctx);
        const max=Math.max(
          0,
          ...Object.values(dims).map(x=>x.score)
        );

        if(
          portalSignal(ctx).score>=4 ||
          hubSignal(ctx).score>=4 ||
          max>=4 ||
          extOf(v)
        ) {
          out.add(v);
        }
      }
    } catch {}
  }

  return [...out].slice(0,400);
}

function priority(link,research) {
  const c={
    anchor:`${link.anchorText} ${link.title}`,
    url:link.url,
    title:"",
    body:""
  };

  const dims=dimensionSignals(c);
  const max=Math.max(
    0,
    ...Object.values(dims).map(x=>x.score)
  );

  return (
    portalSignal(c).score*3 +
    hubSignal(c).score*5 +
    max*2 +
    (looksDocLink(link)?18:0) +
    (research?12:0) +
    (hasNegative(c.anchor)?-12:0)
  );
}

function shouldQueue(link,research,depth,isHub=false) {
  if(depth>CONFIG.maxDepth)
    return false;

  const c={
    anchor:`${link.anchorText} ${link.title}`,
    url:link.url,
    title:"",
    body:""
  };

  const dims=dimensionSignals(c);
  const max=Math.max(
    0,
    ...Object.values(dims).map(x=>x.score)
  );

  return (
    isHub ||
    hubSignal(c).score>=4 ||
    portalSignal(c).score>=4 ||
    max>=5 ||
    (research&&!hasNegative(c.anchor))
  );
}

function taxonomy(text) {
  const t=normalizeText(text);

  const groups=[
    ["research ethics",["اخلاق پژوهش","کمیته اخلاق","research ethics"]],
    ["grants/funding",["گرنت","پژوهانه","حمایت","grant","funding"]],
    ["industry/technology/IP",["ارتباط با صنعت","فناوری","مالکیت فکری","اختراع","مرکز رشد","industry","technology","intellectual property"]],
    ["laboratory",["آزمایشگاه","laboratory","lab"]],
    ["publications/journals",["نشریه","مجله","انتشارات","journal","publication"]],
    ["postgraduate/research affairs",["پایان نامه","پایان‌نامه","رساله","پروپوزال","تحصیلات تکمیلی","thesis","dissertation","proposal"]],
    ["regulation/bylaw",["آیین نامه","آیین‌نامه","مقررات","ضوابط","regulation","bylaw"]],
    ["procedure/guideline",["شیوه نامه","شیوه‌نامه","دستورالعمل","فرایند","فرآیند","راهنما","guideline","procedure","process"]],
    ["form/template",["فرم","الگو","form","template"]],
    ["policy/circular",["بخشنامه","سیاست","ابلاغ","policy","circular"]]
  ];

  for(const [name,words] of groups)
    if(words.some(w=>t.includes(normalizeText(w))))
      return name;

  return "other";
}

function docType(tax,title) {
  const t=normalizeText(title);

  if(tax==="regulation/bylaw")
    return "آیین‌نامه";

  if(tax==="procedure/guideline")
    return "شیوه‌نامه/دستورالعمل";

  if(tax==="form/template")
    return "فرم/الگو";

  if(tax==="policy/circular")
    return "سیاست/بخشنامه";

  if(t.includes("فرایند")||t.includes("فرآیند"))
    return "فرآیند";

  return "سند";
}

function docTopic(tax,title) {
  if(tax==="research ethics")
    return "اخلاق پژوهش";

  if(tax==="grants/funding")
    return "حمایت و گرنت";

  if(tax==="publications/journals")
    return "انتشارات و نشریات";

  if(tax==="laboratory")
    return "آزمایشگاه";

  if(tax==="industry/technology/IP")
    return "صنعت، فناوری و مالکیت فکری";

  if(tax==="postgraduate/research affairs")
    return "تحصیلات تکمیلی و امور پژوهشی";

  const t=normalizeText(title);

  if(t.includes("اخلاق"))
    return "اخلاق پژوهش";

  if(t.includes("آزمایش"))
    return "آزمایشگاه";

  return "سایر";
}

function filename(res,url) {
  const d=res.headers.contentDisposition||"";

  const e=d.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1];

  if(e) {
    try {
      return decodeURIComponent(
        e.replace(/^["']|["']$/g,"")
      );
    } catch {}
  }

  const r=d.match(/filename\s*=\s*["']?([^;"']+)/i)?.[1];

  if(r)
    return r.trim();

  const u=safeHttpUrl(url);

  return u
    ? decodeURIComponentSafe(path.basename(u.pathname))||"document"
    : "document";
}

const safeFilename=(v)=>
  String(v||"document")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g,"_")
    .replace(/\s+/g," ")
    .trim()
    .slice(0,140)||"document";

function addDoc(map,c) {
  const k=canonicalUrl(c.url);
  if(!k) return;

  const score=(x)=>
    (x.researchContext?20:0)+
    (x.discoveryPath?.length||0)+
    countHits(
      `${x.anchorText} ${x.title} ${x.url}`,
      N_DOC
    )*4;

  const p=map.get(k);

  if(!p||score(c)>score(p))
    map.set(k,c);
}

const evidenceKey=(r)=>
  `${r.universitySlug}|${r.dimension}|${canonicalUrl(r.url)}`;

async function collectDocument(c,u) {
  const ctx=[
    c.anchorText,
    c.title,
    c.sourcePageTitle,
    c.sourcePage,
    c.url
  ].filter(Boolean).join(" ");

  const hits=countHits(ctx,N_DOC);
  const ext=extOf(c.url);

  if(!ext&&!hits)
    return null;

  try {
    const res=await fetchResource(
      c.url,
      CONFIG.documentTimeoutMs,
      CONFIG.maxDocumentBytes
    );

    const final=safeHttpUrl(res.finalUrl);

    if(
      !final ||
      isBlockedHost(final.hostname) ||
      isUnsafeHost(final.hostname)
    ) {
      return null;
    }

    const fext=extOf(res.finalUrl);

    const isDoc=
      !!(ext||fext) ||
      looksDocMime(res.contentType);

    if(
      !isDoc ||
      (
        isHtml(res.contentType) &&
        !ext &&
        !fext
      )
    ) {
      return null;
    }

    const sha256=createHash("sha256")
      .update(res.buffer)
      .digest("hex");

    let fn=safeFilename(
      filename(res,res.finalUrl)
    );

    if(
      !path.extname(fn) &&
      (fext||ext)
    ) {
      fn+=fext||ext;
    }

    const archivePath=path.join(
      u.slug,
      `${createHash("sha1")
        .update(res.finalUrl)
        .digest("hex")
        .slice(0,12)}-${fn}`
    );

    const dest=path.join(
      CONFIG.documentDir,
      archivePath
    );

    await fs.mkdir(
      path.dirname(dest),
      {recursive:true}
    );

    await fs.writeFile(
      dest,
      res.buffer
    );

    const tax=taxonomy(
      `${c.anchorText} ${c.title} ${fn} ${c.sourcePageTitle}`
    );

    const title=
      c.anchorText ||
      c.title ||
      fn.replace(/\.[^.]+$/,"") ||
      "سند پژوهشی";

    return {
      universitySlug:u.slug,
      nameFa:u.nameFa,
      title:title.slice(0,500),
      url:res.finalUrl,
      sourcePage:c.sourcePage,
      sourcePageTitle:c.sourcePageTitle||"",
      anchorText:c.anchorText||"",
      depth:c.depth,
      discoveryPath:
        c.discoveryPath ||
        [c.sourcePage,res.finalUrl].filter(Boolean),
      fileName:fn,
      extension:
        (fext||ext||path.extname(fn)).toLowerCase(),
      contentType:res.contentType,
      bytes:res.buffer.length,
      sha256,
      archivePath:archivePath.replaceAll("\\","/"),
      downloaded:true,
      status:res.status,
      taxonomy:tax,
      type:docType(tax,title),
      topic:docTopic(tax,title),
      confidence:Math.min(
        .99,
        .54+
        (ext || fext ? 0.10 : 0)+
        Math.min(hits,3)*.09+
        (c.linkedFromInstitution ? 0.07 : 0)+
        (c.researchContext ? 0.14 : 0)
      ),
      discoveredAt:new Date().toISOString()
    };
  } catch(error) {
    const tax=taxonomy(ctx);

    return {
      universitySlug:u.slug,
      nameFa:u.nameFa,
      title:
        c.anchorText ||
        c.title ||
        path.basename(
          safeHttpUrl(c.url)?.pathname||""
        ) ||
        "سند پژوهشی",
      url:c.url,
      sourcePage:c.sourcePage,
      sourcePageTitle:c.sourcePageTitle||"",
      anchorText:c.anchorText||"",
      depth:c.depth,
      discoveryPath:
        c.discoveryPath ||
        [c.sourcePage,c.url].filter(Boolean),
      extension:ext,
      downloaded:false,
      error:
        error instanceof Error
          ? error.message
          : String(error),
      taxonomy:tax,
      type:docType(tax,c.anchorText),
      topic:docTopic(tax,c.anchorText),
      confidence:Math.min(
        .9,
        .46+
        (ext ? 0.10 : 0)+
        Math.min(hits,3)*.09+
        (c.researchContext ? 0.12 : 0)
      ),
      discoveredAt:new Date().toISOString()
    };
  }
}

async function crawlUniversity(u,a,row) {
  const seeds=[];
  const seedSeen=new Set();

  const addSeed=(
    value,
    researchContext,
    priority,
    sourceKind
  )=>{
    const url=safeHttpUrl(value);
    const key=url&&canonicalUrl(url.toString());

    if(
      !url ||
      !key ||
      seedSeen.has(key)
    ) {
      return;
    }

    seedSeen.add(key);

    seeds.push({
      url:url.toString(),
      depth:0,
      priority,
      researchContext,
      anchorText:"",
      from:null,
      sourceKind,
      hubRoot:
        ["known-portal","research-url"].includes(sourceKind)
          ? key
          : null,
      discoveryPath:[url.toString()]
    });
  };

  for(const v of row?.portalUrls||[])
    addSeed(v,true,130,"known-portal");

  if(a?.researchUrl)
    addSeed(a.researchUrl,true,125,"research-url");

  addSeed(
    u.officialWebsite,
    false,
    90,
    "official-website"
  );

  for(const k of [
    "organizationUrls",
    "libraryUrls",
    "laboratoryUrls",
    "industryTechnologyUrls",
    "informationTechnologyUrls",
    "systemsUrls",
    "documentIndexUrls"
  ]) {
    for(const v of (row?.[k]||[]).slice(0,2))
      addSeed(v,true,105,`known-${k}`);
  }

  if(!seeds.length) {
    return {
      slug:u.slug,
      nameFa:u.nameFa,
      pageCount:0,
      evidence:[],
      documents:[],
      portalCandidates:[],
      researchHubs:0,
      failures:[
        {
          url:null,
          reason:"no-official-seed"
        }
      ]
    };
  }

  const bases=new Set(
    seeds
      .map(s=>safeHttpUrl(s.url))
      .filter(Boolean)
      .map(x=>baseDomain(x.hostname))
  );

  for(const k of [
    "organizationUrls",
    "libraryUrls",
    "laboratoryUrls",
    "industryTechnologyUrls",
    "informationTechnologyUrls",
    "systemsUrls",
    "documentIndexUrls"
  ]) {
    for(const v of row?.[k]||[]) {
      const p=safeHttpUrl(v);

      if(p)
        bases.add(
          baseDomain(p.hostname)
        );
    }
  }

  const queue=[...seeds];

  const queued=new Set(
    seeds
      .map(s=>canonicalUrl(s.url))
      .filter(Boolean)
  );

  const visited=new Set();
  const evidence=new Map();
  const docs=new Map();
  const portals=new Map();
  const failures=[];

  const hubs=new Set(
    seeds
      .filter(
        s=>
          ["known-portal","research-url"]
            .includes(s.sourceKind)
      )
      .map(
        s=>canonicalUrl(s.url)
      )
  );

  const hubCounts=new Map();
  const origins=new Set();

  let pages=0;
  let browserPages=0;
  // Progress heartbeat: prevents long deep crawls from looking frozen.
  let lastHeartbeat = Date.now();

  console.log(
    `[${u.slug}] crawl started | seeds=${seeds.length} | hubs=${hubs.size}`
  );

  const addSitemaps=async(seed)=>{
    const p=safeHttpUrl(seed.url);

    if(
      !p ||
      origins.has(p.origin)
    ) {
      return;
    }

    origins.add(p.origin);

    try {
      for(
        const v of
          await sitemapCandidates(
            seed.url,
            bases
          )
      ) {
        const key=canonicalUrl(v);

        if(
          !key ||
          queued.has(key) ||
          visited.has(key)
        ) {
          continue;
        }

        const isHub=
          hubSignal({
            anchor:"",
            url:v,
            title:"",
            body:""
          }).score>=4 &&
          hubs.size<CONFIG.maxResearchHubs;

        if(isHub)
          hubs.add(key);

        queued.add(key);

        queue.push({
          url:v,
          depth:isHub?0:1,
          priority:
            isHub
              ?125
              :(seed.researchContext?65:45),
          researchContext:
            seed.researchContext||isHub,
          anchorText:"",
          from:seed.url,
          sourceKind:
            isHub
              ?"research-hub-sitemap"
              :"sitemap",
          hubRoot:
            isHub
              ?key
              :seed.hubRoot,
          discoveryPath:[
            ...(seed.discoveryPath||[seed.url]),
            v
          ].slice(-16)
        });
      }
    } catch {}
  };

  for(const s of seeds)
    await addSitemaps(s);

while(
  queue.length &&
  visited.size<
    CONFIG.maxPagesPerUniversity
) {

  if (Date.now() - lastHeartbeat >= 30_000) {
    console.log(
      [
        `[${u.slug}] working`,
        `pages=${pages}`,
        `visited=${visited.size}`,
        `queue=${queue.length}`,
        `hubs=${hubs.size}`,
        `docs=${docs.size}`,
        `evidence=${evidence.size}`,
        `portals=${portals.size}`,
        `failures=${failures.length}`,
      ].join(" | ")
    );

    lastHeartbeat = Date.now();
  }

  queue.sort(
    (x,y)=>
      y.priority-x.priority ||
      x.depth-y.depth
  );
  queue.sort(
      (x,y)=>
        y.priority-x.priority ||
        x.depth-y.depth
    );

    const batch=[];

    while(
      queue.length &&
      batch.length<
        CONFIG.pageConcurrency &&
      visited.size+batch.length<
        CONFIG.maxPagesPerUniversity
    ) {
      const item=queue.shift();
      const key=canonicalUrl(item.url);

      if(
        !key ||
        visited.has(key)
      ) {
        continue;
      }

      if(
        item.hubRoot &&
        (
          hubCounts.get(item.hubRoot)||0
        )>=CONFIG.maxPagesPerHub
      ) {
        continue;
      }

      visited.add(key);
      batch.push(item);
    }

    if(!batch.length)
      continue;

    const outcomes=
      await Promise.all(
        batch.map(
          async item=>{
            if(
              !(await allowedByRobots(item.url))
            ) {
              return {
                item,
                skip:"robots-disallow"
              };
            }

            try {
              return {
                item,
                res:
                  await fetchResource(
                    item.url,
                    CONFIG.pageTimeoutMs,
                    CONFIG.maxHtmlBytes
                  )
              };
            } catch(e) {
              return {
                item,
                error:
                  e instanceof Error
                    ? e.message
                    : String(e)
              };
            }
          }
        )
      );

    for(const o of outcomes) {
      const item=o.item;

      if(o.skip) {
        failures.push({
          url:item.url,
          reason:o.skip
        });
        continue;
      }

      if(o.error) {
        failures.push({
          url:item.url,
          reason:o.error
        });
        continue;
      }

      const res=o.res;
      const final=safeHttpUrl(
        res.finalUrl
      );

      if(
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
        url:final.toString(),
        discoveryPath:[
          ...(item.discoveryPath||[]),
          final.toString()
        ].slice(-16)
      });

      if(!isHtml(res.contentType)) {
        if(
          looksDocMime(
            res.contentType
          ) ||
          extOf(res.finalUrl)
        ) {
          addDoc(docs,{
            url:res.finalUrl,
            anchorText:item.anchorText,
            title:"",
            sourcePage:
              item.from||item.url,
            sourcePageTitle:"",
            depth:item.depth,
            linkedFromInstitution:true,
            researchContext:
              item.researchContext,
            discoveryPath:
              item.discoveryPath||
              [item.url]
          });
        }

        continue;
      }

      if(!res.ok) {
        failures.push({
          url:item.url,
          status:res.status,
          reason:"http-error"
        });
        continue;
      }

      pages++;

      if(item.hubRoot) {
        hubCounts.set(
          item.hubRoot,
          (
            hubCounts.get(
              item.hubRoot
            )||0
          )+1
        );
      }

      let html=
        res.buffer.toString("utf8");

      let links=
        extractLinks(
          html,
          res.finalUrl
        );

      const pre={
        anchor:item.anchorText,
        url:res.finalUrl,
        title:"",
        body:""
      };

      if(
        BROWSER_PATH &&
        CONFIG.useBrowserFallback &&
        (
          item.sourceKind==="known-portal" ||
          item.sourceKind==="research-url" ||
          String(
            item.sourceKind||""
          ).startsWith(
            "research-hub"
          ) ||
          (
            item.researchContext &&
            item.depth<=2 &&
            links.length<16
          ) ||
          portalSignal(pre).score>=4 ||
          hubSignal(pre).score>=4 ||
          (
            links.length<6 &&
            item.depth<=3
          )
        )
      ) {
        const rendered=
          await render(
            res.finalUrl
          );

        if(rendered) {
          const rl=
            extractLinks(
              rendered,
              res.finalUrl
            );

          if(
            rl.length>
            links.length
          ) {
            html=rendered;
            links=rl;
            browserPages++;
          }
        }
      }

      const title=
        extractTitle(html);

      const body=
        stripTags(html)
          .slice(0,45000);

      const ctx={
        anchor:item.anchorText,
        url:res.finalUrl,
        title,
        body
      };

      const ps=portalSignal(ctx);
      const hs=hubSignal(ctx);

      const research=
        item.researchContext ||
        ps.score>=8 ||
        hs.score>=8 ||
        item.sourceKind==="known-portal" ||
        item.sourceKind==="research-url" ||
        String(
          item.sourceKind||""
        ).startsWith(
          "research-hub"
        );

      if(
        ps.score>=8 &&
        (
          ps.anchorHits ||
          ps.urlHits ||
          ps.titleHits
        )
      ) {
        const key=
          canonicalUrl(
            res.finalUrl
          );

        const cand={
          universitySlug:u.slug,
          nameFa:u.nameFa,
          url:res.finalUrl,
          sourcePage:item.from,
          anchorText:item.anchorText,
          title,
          depth:item.depth,
          score:ps.score,
          confidence:
            confidence(
              ps.score,
              .64
            ),
          officialDomain:true,
          kind:"portal",
          discoveryPath:
            item.discoveryPath||
            [res.finalUrl],
          discoveredAt:
            new Date().toISOString()
        };

        const prev=
          portals.get(key);

        if(
          !prev ||
          cand.score>prev.score
        ) {
          portals.set(
            key,
            cand
          );
        }
      }

      for(
        const [
          dimension,
          sig
        ] of Object.entries(
          dimensionSignals(ctx)
        )
      ) {
        if(
          !(
            sig.anchorHits ||
            sig.urlHits ||
            sig.titleHits
          ) ||
          sig.score<5
        ) {
          continue;
        }

        const rec={
          universitySlug:u.slug,
          nameFa:u.nameFa,
          dimension,
          labelFa:
            DIMENSIONS[
              dimension
            ].labelFa,
          url:res.finalUrl,
          sourcePage:
            item.from||
            res.finalUrl,
          anchorText:
            item.anchorText,
          title,
          depth:item.depth,
          score:sig.score,
          confidence:
            confidence(
              sig.score,
              .58
            ),
          officialDomain:true,
          researchContext:
            research,
          kind:"page",
          discoveryPath:
            item.discoveryPath||
            [res.finalUrl],
          discoveredAt:
            new Date().toISOString()
        };

        if(
          rec.confidence>=
          CONFIG.discoveryThreshold
        ) {
          const key=
            evidenceKey(rec);

          const prev=
            evidence.get(key);

          if(
            !prev ||
            rec.score>prev.score
          ) {
            evidence.set(
              key,
              rec
            );
          }
        }
      }

      for(const link of links) {
        const parsed=
          safeHttpUrl(link.url);

        if(!parsed)
          continue;

        const chain=[
          ...(
            item.discoveryPath||
            [res.finalUrl]
          ),
          parsed.toString()
        ].slice(-16);

        if(
          looksDocLink(link)
        ) {
          const hits=
            countHits(
              `${link.anchorText} ${link.title} ${decodeURIComponentSafe(link.url)}`,
              N_DOC
            );

          if(
            research ||
            hits>0
          ) {
            addDoc(
              docs,
              {
                url:
                  parsed.toString(),
                anchorText:
                  link.anchorText,
                title:
                  link.title,
                sourcePage:
                  res.finalUrl,
                sourcePageTitle:
                  title,
                depth:
                  item.depth+1,
                linkedFromInstitution:
                  true,
                researchContext:
                  research,
                discoveryPath:
                  chain
              }
            );
          }
        }

        if(
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

        const key=
          canonicalUrl(
            parsed.toString()
          );

        if(
          !key ||
          visited.has(key) ||
          queued.has(key)
        ) {
          continue;
        }

        const lc={
          anchor:
            `${link.anchorText} ${link.title}`,
          url:link.url,
          title:"",
          body:""
        };

        const candidateHub=
          hubSignal(lc).score>=4;

        let newHub=false;

        if(
          candidateHub &&
          !hubs.has(key) &&
          hubs.size<
            CONFIG.maxResearchHubs
        ) {
          hubs.add(key);
          newHub=true;
        }

        const depth=
          newHub
            ?0
            :item.depth+1;

        if(
          !shouldQueue(
            link,
            research||newHub,
            depth,
            newHub
          )
        ) {
          continue;
        }

        queued.add(key);

        queue.push({
          url:
            parsed.toString(),

          depth,

          priority:
            priority(
              link,
              research
            )+
            (
              newHub
                ?70
                :0
            ),

          researchContext:
            research ||
            newHub ||
            portalSignal(
              lc
            ).score>=5,

          anchorText:
            link.anchorText||
            link.title,

          from:
            res.finalUrl,

          sourceKind:
            newHub
              ?(
                link.discoveryKind===
                "embedded-url"
                  ?"research-hub-embedded"
                  :"research-hub"
              )
              :(
                link.discoveryKind===
                "embedded-url"
                  ?"embedded-url"
                  :"link"
              ),

          hubRoot:
            newHub
              ?key
              :item.hubRoot,

          discoveryPath:
            chain
        });
      }
    }
  }

  const ranked=[
    ...docs.values()
  ]
    .map(
      c=>({
        ...c,
        rank:
          (
            extOf(c.url)
              ?8
              :0
          )+
          (
            c.researchContext
              ?12
              :0
          )+
          countHits(
            `${c.anchorText} ${c.title} ${c.url}`,
            N_DOC
          )*5
      })
    )
    .sort(
      (a,b)=>
        b.rank-a.rank
    )
    .slice(
      0,
      CONFIG.maxDocumentsPerUniversity
    );

  const documents=[];

  for(
    let i=0;
    i<ranked.length;
    i+=CONFIG.pageConcurrency
  ) {
    const results=
      await Promise.all(
        ranked
          .slice(
            i,
            i+CONFIG.pageConcurrency
          )
          .map(
            c=>
              collectDocument(
                c,
                u
              )
          )
      );

    for(const r of results)
      if(r)
        documents.push(r);
  }

  return {
    slug:u.slug,
    nameFa:u.nameFa,
    officialWebsite:
      u.officialWebsite||null,
    existingResearchUrl:
      a?.researchUrl||null,
    pageCount:pages,
    visitedCount:
      visited.size,
    browserFallbackPages:
      browserPages,
    researchHubs:
      hubs.size,
    evidence:[
      ...evidence.values()
    ].sort(
      (a,b)=>
        b.confidence-a.confidence ||
        b.score-a.score
    ),
    documents:
      documents.sort(
        (a,b)=>
          b.confidence-a.confidence
      ),
    portalCandidates:[
      ...portals.values()
    ].sort(
      (a,b)=>
        b.confidence-a.confidence ||
        b.score-a.score
    ),
    failures
  };
}

const [
  institutions,
  audits,
  reaudit
]=await Promise.all([
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
  )
]);

if(
  !Array.isArray(institutions) ||
  institutions.length!==115
) {
  throw new Error(
    `Expected 115 institutions with officialWebsite seeds, got ${
      Array.isArray(institutions)
        ?institutions.length
        :"invalid data"
    }`
  );
}

const auditsBySlug=
  new Map(
    (audits||[])
      .map(
        x=>[
          x.universitySlug,
          x
        ]
      )
  );

const reauditBySlug=
  new Map(
    (reaudit||[])
      .map(
        x=>[
          x.slug,
          x
        ]
      )
  );

await fs.mkdir(
  "data/generated",
  {recursive:true}
);

await fs.mkdir(
  CONFIG.documentDir,
  {recursive:true}
);

const results=
  new Array(
    institutions.length
  );

let cursor=0;

const workers=
  Array.from(
    {
      length:
        Math.min(
          CONFIG.universityConcurrency,
          institutions.length
        )
    },
    async()=>{
      while(
        cursor<
        institutions.length
      ) {
        const i=cursor++;
        const u=institutions[i];
        const start=Date.now();

        try {
          const r=
            await crawlUniversity(
              u,
              auditsBySlug.get(
                u.slug
              ),
              reauditBySlug.get(
                u.slug
              )
            );

          results[i]={
            ...r,
            elapsedMs:
              Date.now()-start
          };

          console.log(
            [
              `[${i+1}/${institutions.length}] ${u.slug}`,
              `pages=${r.pageCount}`,
              `evidence=${r.evidence.length}`,
              `docs=${r.documents.length}`,
              `portalCandidates=${r.portalCandidates.length}`,
              `hubs=${r.researchHubs||0}`,
              `failures=${r.failures.length}`
            ].join(" | ")
          );
        } catch(e) {
          results[i]={
            slug:u.slug,
            nameFa:u.nameFa,
            pageCount:0,
            evidence:[],
            documents:[],
            portalCandidates:[],
            researchHubs:0,
            failures:[
              {
                url:
                  u.officialWebsite||
                  null,
                reason:
                  e instanceof Error
                    ?e.message
                    :String(e)
              }
            ],
            elapsedMs:
              Date.now()-start
          };

          console.warn(
            `[${i+1}/${institutions.length}] ${u.slug} failed:`,
            e instanceof Error
              ?e.message
              :String(e)
          );
        }
      }
    }
  );

await Promise.all(
  workers
);

const allEvidence=
  results.flatMap(
    x=>x.evidence||[]
  );

const allDocuments=
  results.flatMap(
    x=>x.documents||[]
  );

const allPortals=
  results.flatMap(
    x=>x.portalCandidates||[]
  );

const dimensionCounts=
  Object.fromEntries(
    Object.keys(DIMENSIONS)
      .map(
        d=>[
          d,
          allEvidence
            .filter(
              x=>
                x.dimension===d
            )
            .length
        ]
      )
  );

const evidenceOutput={
  schemaVersion:1,
  generatedAt:
    new Date().toISOString(),
  crawler:
    "research-multi-hub-deep-discovery",

  constraints:{
    maxDepth:
      CONFIG.maxDepth,

    maxPagesPerUniversity:
      CONFIG.maxPagesPerUniversity,

    maxPagesPerHub:
      CONFIG.maxPagesPerHub,

    maxResearchHubs:
      CONFIG.maxResearchHubs,

    maxDocumentsPerUniversity:
      CONFIG.maxDocumentsPerUniversity,

    researchHubDepthReset:
      true,

    embeddedCmsUrlDiscovery:
      true,

    multiOriginSitemaps:
      true,

    pageTimeoutMs:
      CONFIG.pageTimeoutMs,

    socialEvidenceBlocked:
      [...SOCIAL_HOSTS].sort(),

    browserFallbackAvailable:
      Boolean(BROWSER_PATH)
  },

  evidence:
    allEvidence,

  portalCandidates:
    allPortals
};

const docsOutput={
  schemaVersion:1,
  generatedAt:
    new Date().toISOString(),

  documentStorageRoot:
    CONFIG.documentDir,

  maxDocumentBytes:
    CONFIG.maxDocumentBytes,

  documents:
    allDocuments
};

const summary={
  schemaVersion:1,

  generatedAt:
    new Date().toISOString(),

  institutions:
    institutions.length,

  institutionsWithPages:
    results
      .filter(
        x=>
          x.pageCount>0
      )
      .length,

  pagesFetched:
    results.reduce(
      (s,x)=>
        s+(x.pageCount||0),
      0
    ),

  browserFallbackPages:
    results.reduce(
      (s,x)=>
        s+(
          x.browserFallbackPages||
          0
        ),
      0
    ),

  researchHubs:
    results.reduce(
      (s,x)=>
        s+(
          x.researchHubs||
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

  documentsDownloaded:
    allDocuments
      .filter(
        x=>x.downloaded
      )
      .length,

  dimensionCounts,

  failures:
    results.reduce(
      (s,x)=>
        s+(
          x.failures?.length||
          0
        ),
      0
    ),

  universities:
    results.map(
      x=>({
        slug:x.slug,
        nameFa:x.nameFa,
        pages:x.pageCount||0,
        evidence:
          x.evidence?.length||0,
        documents:
          x.documents?.length||0,
        portalCandidates:
          x.portalCandidates?.length||
          0,
        researchHubs:
          x.researchHubs||0,
        failures:
          x.failures?.length||0,
        elapsedMs:
          x.elapsedMs||0
      })
    )
};

await Promise.all([
  fs.writeFile(
    "data/generated/discovery-evidence.json",
    JSON.stringify(
      evidenceOutput,
      null,
      2
    )+"\n"
  ),

  fs.writeFile(
    "data/generated/discovered-documents.json",
    JSON.stringify(
      docsOutput,
      null,
      2
    )+"\n"
  ),

  fs.writeFile(
    "data/generated/discovery-summary.json",
    JSON.stringify(
      summary,
      null,
      2
    )+"\n"
  )
]);

console.log(
  [
    "deep discovery complete",
    `universities=${institutions.length}`,
    `pages=${summary.pagesFetched}`,
    `evidence=${allEvidence.length}`,
    `documents=${allDocuments.length}`,
    `hubs=${summary.researchHubs}`,
    `downloaded=${summary.documentsDownloaded}`,
    `browser=${
      BROWSER_PATH
        ?path.basename(BROWSER_PATH)
        :"static-only"
    }`
  ].join(" | ")
);

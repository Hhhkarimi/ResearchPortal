import Link from "next/link";
import {datasetSummary} from "@/lib/data";

export const metadata={title:"Open Data و API | ISC ۱۱۵"};

const sets=[
  ["فهرست ۱۱۵ نهاد ISC","JSON + CSV","isc-institutions"],
  ["ممیزی پرتال ۱۱۵ نهاد","JSON + CSV","audit-portal-audit"],
  ["رجیستر ۸۰۵ outcome شواهد","JSON + CSV","evidence-dimension-evidence"],
  ["ماتریس عمیق ۱۱۵ × ۷","JSON + CSV","audit-deep-audit-matrix"],
  ["رتبه‌بندی RTPMI 4.2","JSON + CSV","statistics-portal-ranking"],
  ["واحدها و زیرمجموعه‌ها","JSON + CSV","units-catalog"],
  ["سامانه‌ها و خدمات","JSON + CSV","systems-catalog"],
  ["اسناد و مقررات","JSON + CSV","documents-catalog"],
] as const;

export default function Page(){const s:any=datasetSummary;return <main className="shell page"><header className="pageHero"><div><span className="eyebrow">Open data lab · versioned · machine readable</span><h1>داده‌ای که می‌شود به آن ارجاع داد.</h1><p>از دانلود سریع CSV تا API نسخه‌دار و ۱۱۵ Audit Packet مستقل؛ همراه Provenance و قواعد بازتولید.</p></div><div className="pageHeroStamp lime"><b>v1</b><span>API پایدار</span><small>JSON · CSV · OpenAPI</small></div></header><section className="apiHero"><div><span className="eyebrow">REST API / VERSION 1</span><h2>برای داشبورد، پژوهش و بازاستفاده.</h2><p>فهرست دانشگاه‌ها، پروفایل تفصیلی، رجیستر شواهد، رتبه‌بندی و خلاصه ملی از endpointهای پایدار و cache-friendly در دسترس‌اند.</p><div><Link href="/api-docs">راهنمای API ←</Link><a href="/openapi.json">OpenAPI JSON ↓</a></div></div><code data-latin><span>GET</span> /api/v1/universities<br/><span>GET</span> /api/v1/universities/tehran<br/><span>GET</span> /api/v1/evidence?status=verified<br/><span>GET</span> /api/v1/rankings<br/><span>GET</span> /api/v1/summary</code></section><section className="section"><div className="sectionHead"><div><span className="eyebrow">Curated datasets</span><h2>مجموعه‌داده‌های آماده دانلود</h2></div><p>تمام خروجی‌ها از Snapshot مشترک ساخته می‌شوند تا اختلاف بین سایت، API و فایل‌ها ایجاد نشود.</p></div><div className="datasetGrid">{sets.map(([title,format,slug])=><div className="datasetCard" key={slug}><div><span>{format}</span><b>{title}</b><small data-latin>/datasets/{slug}</small></div><div><a href={`/datasets/${slug}.json`} aria-label={`دانلود JSON ${title}`}>JSON</a><a href={`/datasets/${slug}.csv`} aria-label={`دانلود CSV ${title}`}>CSV</a></div></div>)}</div></section><section className="dataTrustGrid"><div><b>{s.dimensionEvidenceOutcomes}</b><span>Outcome بُعدی مستقل</span><a href="/datasets/evidence-dimension-evidence.json">دریافت رجیستر ↓</a></div><div><b>{s.auditPackets}</b><span>Audit Packet مستقل</span><a href="/datasets/audit-packets-index.json">فهرست پرونده‌ها ↓</a></div><div><b>{s.provenanceRecords}</b><span>رکورد دفتر شواهد</span><a href="/datasets/evidence-provenance-ledger.json">دریافت Ledger ↓</a></div></section><div className="licenseNote"><b>مجوز استفاده</b><p>کد پروژه تحت MIT منتشر شده است. در استفاده پژوهشی، نسخه Snapshot، تاریخ و روش‌شناسی RTPMI را همراه داده ذکر کنید.</p><Link href="/methodology">راهنمای استناد و تفسیر ←</Link></div></main>}

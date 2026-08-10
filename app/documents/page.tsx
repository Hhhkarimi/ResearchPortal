import {DocumentExplorer} from "@/components/document-explorer";
import {documentCatalog,institutions} from "@/lib/data";
export const metadata={title:"رصد آیین‌نامه‌ها، فرم‌ها و شیوه‌نامه‌ها"};
export default function Page(){return <main className="shell page"><header className="pageHero"><div><span className="eyebrow">Document intelligence · direct evidence only</span><h1>اسناد پژوهشی، با ردّ منبع.</h1><p>آیین‌نامه‌ها، فرم‌ها و شیوه‌نامه‌هایی که شاهد مستقیم آن‌ها در Snapshot ثبت شده؛ همراه دانشگاه، وضعیت و تاریخ آخرین راستی‌آزمایی.</p></div><div className="pageHeroStamp cyan"><b>{documentCatalog.length.toLocaleString("fa-IR")}</b><span>سند مستقیم</span><small>بدون رکورد ساختگی</small></div></header><DocumentExplorer documents={documentCatalog} institutions={institutions}/></main>}

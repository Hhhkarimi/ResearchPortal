import {DocumentExplorer} from "@/components/document-explorer";
import {documentSearchIndex,documentTopics,documentTypes} from "@/lib/document-search-index";
export const metadata={title:"رصد آیین‌نامه‌ها، فرم‌ها و شیوه‌نامه‌ها"};
export default function Page(){
  return <main className="shell page"><header className="pageHero"><div><span className="eyebrow">Document intelligence · direct evidence only</span><h1>اسناد پژوهشی، با ردّ منبع.</h1><p>آیین‌نامه‌ها، فرم‌ها، شیوه‌نامه‌ها و صفحه‌های شاخص سند که شاهد رسمی آن‌ها در Snapshot ثبت شده؛ همراه دانشگاه، طبقه‌بندی، وضعیت و تاریخ راستی‌آزمایی.</p></div><div className="pageHeroStamp cyan"><b>{documentSearchIndex.length.toLocaleString("fa-IR")}</b><span>سند یا شاخص رسمی</span><small>بدون رکورد ساختگی</small></div></header><DocumentExplorer initialDocuments={documentSearchIndex.slice(0,96)} total={documentSearchIndex.length} types={documentTypes} topics={documentTopics}/></main>;
}

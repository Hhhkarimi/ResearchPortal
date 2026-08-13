"use client";

import Link from "next/link";
import {useDeferredValue,useMemo,useState} from "react";

type UniversityRow={
  slug:string;
  nameFa:string;
  category:string;
  iscRank:number;
  portalAuditStatus:string;
  evidenceCoverage:number;
  documentCount:number;
  score:number|null;
  confidence:number|null;
};

const categories=["جامع","صنعتی","علوم کشاورزی","هنر","زیرنظام","دستگاه اجرایی"];
const statusLabel=(status:string)=>status==="direct-official"?"پرتال مستقیم معاونت پژوهشی و فناوری":status.includes("restricted")?"دسترسی محدود":status==="false-positive-blocked"?"مسیر مسدود":"نیازمند شواهد بیشتر";

export function UniversityExplorer({rows:sourceRows}:{rows:UniversityRow[]}){
  const [query,setQuery]=useState("");
  const [category,setCategory]=useState("همه");
  const [status,setStatus]=useState("همه");
  const [sort,setSort]=useState("isc");
  const deferredQuery=useDeferredValue(query);

  const rows=useMemo(()=>sourceRows.filter(university=>{
    const q=deferredQuery.trim();
    const matchesQuery=!q||university.nameFa.includes(q)||university.slug.includes(q.toLowerCase());
    const matchesCategory=category==="همه"||university.category===category;
    const matchesStatus=status==="همه"||status==="ranked"&&university.score!==null||status==="direct"&&university.portalAuditStatus==="direct-official"||status==="pending"&&university.portalAuditStatus!=="direct-official";
    return matchesQuery&&matchesCategory&&matchesStatus;
  }).sort((a,b)=>{
    if(sort==="name-asc")return a.nameFa.localeCompare(b.nameFa,"fa");
    if(sort==="name-desc")return b.nameFa.localeCompare(a.nameFa,"fa");
    if(sort==="rtpmi")return (b.score??-1)-(a.score??-1)||a.iscRank-b.iscRank;
    if(sort==="evidence")return b.evidenceCoverage-a.evidenceCoverage||a.iscRank-b.iscRank;
    if(sort==="documents")return b.documentCount-a.documentCount||a.iscRank-b.iscRank;
    if(sort==="portal")return Number(b.portalAuditStatus==="direct-official")-Number(a.portalAuditStatus==="direct-official")||a.iscRank-b.iscRank;
    return a.category.localeCompare(b.category,"fa")||a.iscRank-b.iscRank;
  }),[sourceRows,deferredQuery,category,status,sort]);

  return <>
    <div className="explorerBar glass">
      <div className="field searchField"><label htmlFor="directory-search">جست‌وجو</label><input id="directory-search" type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="نام دانشگاه…" spellCheck={false}/></div>
      <div className="field"><label htmlFor="category-filter">گروه ISC</label><select id="category-filter" value={category} onChange={event=>setCategory(event.target.value)}><option>همه</option>{categories.map(item=><option key={item}>{item}</option>)}</select></div>
      <div className="field"><label htmlFor="status-filter">وضعیت</label><select id="status-filter" value={status} onChange={event=>setStatus(event.target.value)}><option value="همه">همه وضعیت‌ها</option><option value="ranked">دارای RTPMI</option><option value="direct">پرتال مستقیم معاونت پژوهشی و فناوری</option><option value="pending">نیازمند تکمیل شواهد</option></select></div>
      <div className="field"><label htmlFor="sort-filter">مرتب‌سازی</label><select id="sort-filter" value={sort} onChange={event=>setSort(event.target.value)}><option value="isc">گروه و رتبه ISC</option><option value="evidence">بیشترین پوشش شواهد</option><option value="documents">بیشترین سند</option><option value="portal">پرتال مستقیم معاونت پژوهشی و فناوری</option><option value="rtpmi">امتیاز RTPMI</option><option value="name-asc">نام: الف تا ی</option><option value="name-desc">نام: ی تا الف</option></select></div>
    </div>
    <div className="resultMeta"><b>{rows.length.toLocaleString("fa-IR")}</b> دانشگاه از ۱۱۵ <span>·</span> هیچ دانشگاهی به علت کمبود شواهد حذف نشده است.</div>
    <div className="uniGrid">{rows.map(university=><Link href={`/universities/${university.slug}`} className="uniCard" key={university.slug}>
      <div className="uniCardTop"><span className="categoryPill">{university.category}</span><span className={`evidencePill ${university.portalAuditStatus==="direct-official"?"verified":"pending"}`}>{statusLabel(university.portalAuditStatus)}</span></div>
      <h2>{university.nameFa}</h2>
      <p>رتبه {university.iscRank.toLocaleString("fa-IR")} در گروه ISC</p>
      <div className="uniEvidenceMeta"><span><b>{university.evidenceCoverage.toLocaleString("fa-IR")}%</b> پوشش شواهد</span><span><b>{university.documentCount.toLocaleString("fa-IR")}</b> سند طبقه‌بندی‌شده</span></div>
      <div className="uniScore">{university.score!==null?<><span><b>{university.score.toLocaleString("fa-IR")}</b><small>RTPMI</small></span><span><b>{Number(university.confidence).toLocaleString("fa-IR")}%</b><small>اطمینان</small></span></>:<span className="unranked"><b>—</b><small>رتبه منتشر نشده</small></span>}<i>مشاهده پرونده ←</i></div>
    </Link>)}</div>
    {!rows.length&&<div className="emptyState"><b>نتیجه‌ای با این ترکیب پیدا نشد.</b><button onClick={()=>{setQuery("");setCategory("همه");setStatus("همه")}}>پاک کردن فیلترها</button></div>}
  </>;
}

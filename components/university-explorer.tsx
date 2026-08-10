"use client";

import Link from "next/link";
import {useMemo, useState} from "react";

type Props={institutions:any[];audits:any[];rankings:any[]};
const statusLabel=(s:string)=>s==="direct-official"?"پرتال مستقیم":s.includes("restricted")?"دسترسی محدود":s==="false-positive-blocked"?"مسیر مسدود":"نیازمند شواهد بیشتر";

export function UniversityExplorer({institutions,audits,rankings}:Props){
  const [query,setQuery]=useState("");const [category,setCategory]=useState("همه");const [status,setStatus]=useState("همه");const [sort,setSort]=useState("isc");
  const audit=useMemo(()=>new Map(audits.map(x=>[x.universitySlug,x])),[audits]);const rank=useMemo(()=>new Map(rankings.map(x=>[x.universitySlug,x])),[rankings]);
  const rows=useMemo(()=>institutions.filter(u=>{
    const a:any=audit.get(u.slug);const q=query.trim();
    return (!q||u.nameFa.includes(q)||u.slug.includes(q.toLowerCase()))&&(category==="همه"||u.category===category)&&(status==="همه"||(status==="ranked"?rank.has(u.slug):status==="direct"?a?.portalAuditStatus==="direct-official":a?.portalAuditStatus!=="direct-official"));
  }).sort((a,b)=>sort==="name"?a.nameFa.localeCompare(b.nameFa,"fa"):sort==="rtpmi"?((rank.get(b.slug) as any)?.score??-1)-((rank.get(a.slug) as any)?.score??-1):a.category.localeCompare(b.category,"fa")||a.iscRank-b.iscRank),[institutions,query,category,status,sort,audit,rank]);
  return <>
    <div className="explorerBar glass"><div className="field searchField"><label htmlFor="directory-search">جست‌وجو</label><input id="directory-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="نام دانشگاه…"/></div><div className="field"><label htmlFor="category-filter">گروه ISC</label><select id="category-filter" value={category} onChange={e=>setCategory(e.target.value)}><option>همه</option>{["جامع","صنعتی","علوم کشاورزی","هنر","زیرنظام","دستگاه اجرایی"].map(x=><option key={x}>{x}</option>)}</select></div><div className="field"><label htmlFor="status-filter">وضعیت</label><select id="status-filter" value={status} onChange={e=>setStatus(e.target.value)}><option value="همه">همه وضعیت‌ها</option><option value="ranked">دارای RTPMI</option><option value="direct">پرتال مستقیم</option><option value="pending">نیازمند تکمیل شواهد</option></select></div><div className="field"><label htmlFor="sort-filter">مرتب‌سازی</label><select id="sort-filter" value={sort} onChange={e=>setSort(e.target.value)}><option value="isc">گروه و رتبه ISC</option><option value="rtpmi">امتیاز RTPMI</option><option value="name">نام دانشگاه</option></select></div></div>
    <div className="resultMeta"><b>{rows.length.toLocaleString("fa-IR")}</b> دانشگاه از ۱۱۵ <span>·</span> هیچ دانشگاهی به علت کمبود شواهد حذف نشده است.</div>
    <div className="uniGrid">{rows.map(u=>{const a:any=audit.get(u.slug);const r:any=rank.get(u.slug);return <Link href={`/universities/${u.slug}`} className="uniCard" key={u.slug}><div className="uniCardTop"><span className="categoryPill">{u.category}</span><span className={`evidencePill ${a?.portalAuditStatus==="direct-official"?"verified":"pending"}`}>{statusLabel(a?.portalAuditStatus||"")}</span></div><h2>{u.nameFa}</h2><p>رتبه {u.iscRank.toLocaleString("fa-IR")} در گروه ISC</p><div className="uniScore">{r?<><span><b>{r.score}</b><small>RTPMI</small></span><span><b>{r.confidence}%</b><small>اطمینان</small></span></>:<span className="unranked"><b>—</b><small>رتبه منتشر نشده</small></span>}<i>مشاهده پرونده ←</i></div></Link>})}</div>
    {!rows.length&&<div className="emptyState"><b>نتیجه‌ای با این ترکیب پیدا نشد.</b><button onClick={()=>{setQuery("");setCategory("همه");setStatus("همه")}}>پاک کردن فیلترها</button></div>}
  </>
}

"use client";

import {useMemo,useState} from "react";

const classify=(document:any)=>document.topic||document.category||"سایر";

export function DocumentExplorer({documents,institutions}:{documents:any[];institutions:any[]}){
  const [query,setQuery]=useState("");
  const [type,setType]=useState("همه");
  const [topic,setTopic]=useState("همه");
  const [sort,setSort]=useState("university");
  const university=useMemo(()=>new Map(institutions.map(x=>[x.slug,x])),[institutions]);
  const types=useMemo(()=>[...new Set(documents.map(x=>x.type))].sort((a,b)=>String(a).localeCompare(String(b),"fa")),[documents]);
  const topics=useMemo(()=>[...new Set(documents.map(classify))].sort((a,b)=>String(a).localeCompare(String(b),"fa")),[documents]);
  const rows=useMemo(()=>documents.filter(d=>(type==="همه"||d.type===type)&&(topic==="همه"||classify(d)===topic)&&(!query||d.title.includes(query)||(university.get(d.universitySlug) as any)?.nameFa.includes(query))).sort((a,b)=>sort==="newest"?String(b.lastVerified||"").localeCompare(String(a.lastVerified||"")):sort==="title"?a.title.localeCompare(b.title,"fa"):((university.get(a.universitySlug) as any)?.nameFa||"").localeCompare((university.get(b.universitySlug) as any)?.nameFa||"","fa")||a.title.localeCompare(b.title,"fa")),[documents,query,type,topic,sort,university]);
  return <><div className="explorerBar documentFilters glass"><div className="field searchField"><label htmlFor="document-search">جست‌وجوی سند یا دانشگاه</label><input id="document-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="عنوان آیین‌نامه، فرم یا دانشگاه…"/></div><div className="field"><label htmlFor="document-type">نوع سند</label><select id="document-type" value={type} onChange={e=>setType(e.target.value)}><option>همه</option>{types.map(x=><option key={x}>{x}</option>)}</select></div><div className="field"><label htmlFor="document-topic">حوزه موضوعی</label><select id="document-topic" value={topic} onChange={e=>setTopic(e.target.value)}><option>همه</option>{topics.map(x=><option key={x}>{x}</option>)}</select></div><div className="field"><label htmlFor="document-sort">مرتب‌سازی</label><select id="document-sort" value={sort} onChange={e=>setSort(e.target.value)}><option value="university">دانشگاه</option><option value="title">عنوان سند</option><option value="newest">تازه‌ترین راستی‌آزمایی</option></select></div></div><div className="resultMeta"><b>{rows.length.toLocaleString("fa-IR")}</b> سند یا شاخص دارای شاهد مستقیم</div><div className="docGrid">{rows.map(d=>{const u:any=university.get(d.universitySlug);return <a className="docCard" key={d.id} href={d.url||d.sourceUrl} target="_blank" rel="noopener noreferrer"><div><span className="categoryPill">{d.type}</span><em>{d.status==="active"?"فعال":"ثبت‌شده"}</em></div><h2>{d.title}</h2><p>{u?.nameFa}</p><div className="documentTopic">{classify(d)}</div><footer><small>راستی‌آزمایی: {new Date(d.lastVerified).toLocaleDateString("fa-IR")}</small><b>مشاهده منبع ↗</b></footer></a>})}</div></>;
}

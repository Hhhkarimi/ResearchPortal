"use client";

import Link from "next/link";
import {useMemo, useState} from "react";

const dimensions=[["portalIdentity","هویت پرتال"],["organization","ساختار"],["libraryDocuments","کتابخانه"],["laboratories","آزمایشگاه"],["industryTechnology","صنعت/فناوری"],["informationTechnology","IT"],["systemsServices","سامانه‌ها"],["documentsRegulations","اسناد"]] as const;
const state:any={verified:"تأیید","observed-reference":"شاهد",restricted:"محدود",unresolved:"باز"};
const coverage=(audit:any)=>audit.reviewEvidenceCoverage??audit.auditEvidenceCoverage??0;

export function AuditExplorer({audits}:{audits:any[]}){
  const [query,setQuery]=useState("");
  const [category,setCategory]=useState("همه");
  const [mode,setMode]=useState("همه");
  const rows=useMemo(()=>audits.filter(a=>(category==="همه"||a.iscCategory===category)&&(!query||a.nameFa.includes(query))&&(mode==="همه"||mode==="complete"&&coverage(a)===100||mode==="pending"&&coverage(a)<75||mode==="restricted"&&Object.values(a.dimensions).every(x=>x==="restricted"))),[audits,query,category,mode]);
  return <><div className="explorerBar glass"><div className="field searchField"><label htmlFor="audit-search">جست‌وجوی دانشگاه</label><input id="audit-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="نام دانشگاه…"/></div><div className="field"><label htmlFor="audit-category">گروه ISC</label><select id="audit-category" value={category} onChange={e=>setCategory(e.target.value)}><option>همه</option>{[...new Set(audits.map(x=>x.iscCategory))].map(x=><option key={x}>{x}</option>)}</select></div><div className="field"><label htmlFor="audit-mode">وضعیت شواهد</label><select id="audit-mode" value={mode} onChange={e=>setMode(e.target.value)}><option value="همه">همه وضعیت‌ها</option><option value="complete">پوشش کامل</option><option value="pending">پوشش کمتر از ۷۵٪</option><option value="restricted">دسترسی محدود</option></select></div></div><div className="matrixLegend"><span><i className="verified"/>تأیید مستقیم</span><span><i className="observed-reference"/>شاهد/ارجاع</span><span><i className="restricted"/>دسترسی محدود</span><span><i className="unresolved"/>هنوز حل نشده</span></div><div className="deepMatrixWrap glass"><div className="deepMatrix"><div className="deepRow deepHead"><b>دانشگاه / ISC</b>{dimensions.map(x=><span key={x[0]}>{x[1]}</span>)}<strong>پوشش</strong></div>{rows.map(m=><Link href={`/universities/${m.universitySlug}`} className="deepRow" key={m.universitySlug}><b>{m.nameFa}<small>{m.iscCategory} · ISC #{m.iscRank}</small></b>{dimensions.map(([key])=><span className={`eState ${m.dimensions[key]}`} title={state[m.dimensions[key]]} key={key}><i/>{state[m.dimensions[key]]}</span>)}<strong>{coverage(m)}%</strong></Link>)}</div></div><div className="resultMeta"><b>{rows.length.toLocaleString("fa-IR")}</b> ردیف نمایش داده می‌شود.</div></>;
}

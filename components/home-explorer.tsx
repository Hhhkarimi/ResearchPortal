"use client";

import Link from "next/link";
import {useMemo, useState} from "react";

type Institution={slug:string;nameFa:string;category:string;iscRank:number};
type Audit={universitySlug:string;portalAuditStatus:string};
type Ranking={universitySlug:string;score:number;rank:number};

export function HomeExplorer({institutions,audits,rankings}:{institutions:Institution[];audits:Audit[];rankings:Ranking[]}){
  const [query,setQuery]=useState("");
  const results=useMemo(()=>{
    const q=query.trim().replace(/^دانشگاه\s+/,"");
    if(!q)return [];
    return institutions.filter(x=>x.nameFa.includes(q)||x.slug.includes(q.toLowerCase())).slice(0,6);
  },[query,institutions]);
  const auditBySlug=new Map(audits.map(x=>[x.universitySlug,x]));
  const rankBySlug=new Map(rankings.map(x=>[x.universitySlug,x]));
  return <div className="heroSearch">
    <label htmlFor="university-search">پرونده یک دانشگاه را پیدا کنید</label>
    <div className="searchBox"><span aria-hidden="true">⌕</span><input id="university-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="مثلاً دانشگاه تهران، صنعتی شریف…" autoComplete="off"/><kbd>۱۱۵</kbd></div>
    {query&&<div className="searchResults" role="listbox">
      {results.length?results.map(u=>{const a=auditBySlug.get(u.slug);const r=rankBySlug.get(u.slug);return <Link href={`/universities/${u.slug}`} key={u.slug} role="option"><span><b>{u.nameFa}</b><small>{u.category} · رتبه ISC {u.iscRank}</small></span><em className={a?.portalAuditStatus==="direct-official"?"good":"pending"}>{r?`RTPMI ${r.score}`:"نیازمند شواهد بیشتر"}</em><i>←</i></Link>}):<div className="emptySearch">نام دانشگاه پیدا نشد؛ <Link href="/universities">فهرست کامل را ببینید</Link>.</div>}
    </div>}
  </div>
}

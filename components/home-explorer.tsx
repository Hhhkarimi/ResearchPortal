"use client";

import Link from "next/link";
import {useDeferredValue, useMemo, useState} from "react";

type Institution={slug:string;nameFa:string;category:string;iscRank:number};
type Audit={universitySlug:string;portalAuditStatus:string};
type Ranking={universitySlug:string;score:number;rank:number};

export function HomeExplorer({institutions,audits,rankings}:{institutions:Institution[];audits:Audit[];rankings:Ranking[]}){
  const [query,setQuery]=useState("");
  const deferredQuery=useDeferredValue(query);
  const results=useMemo(()=>{
    const q=deferredQuery.trim().replace(/^دانشگاه\s+/,"");
    if(!q)return [];
    const normalized=q.toLowerCase();
    return institutions.filter(x=>x.nameFa.includes(q)||x.slug.includes(normalized)).slice(0,6);
  },[deferredQuery,institutions]);
  const auditBySlug=useMemo(()=>new Map(audits.map(x=>[x.universitySlug,x])),[audits]);
  const rankBySlug=useMemo(()=>new Map(rankings.map(x=>[x.universitySlug,x])),[rankings]);
  return <div className="heroSearch">
    <label htmlFor="university-search">پرونده یک دانشگاه را پیدا کنید</label>
    <div className="searchBox"><span aria-hidden="true">⌕</span><input id="university-search" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="مثلاً دانشگاه تهران، صنعتی شریف…" autoComplete="off" spellCheck={false}/><kbd>۱۱۵</kbd></div>
    {query&&<div className="searchResults" role="listbox">
      {results.length?results.map(u=>{const a=auditBySlug.get(u.slug);const r=rankBySlug.get(u.slug);return <Link href={`/universities/${u.slug}`} key={u.slug} role="option"><span><b>{u.nameFa}</b><small>{u.category} · رتبه ISC {u.iscRank}</small></span><em className={a?.portalAuditStatus==="direct-official"?"good":"pending"}>{r?`RTPMI ${r.score}`:"نیازمند شواهد بیشتر"}</em><i>←</i></Link>}):<div className="emptySearch">نام دانشگاه پیدا نشد؛ <Link href="/universities">فهرست کامل را ببینید</Link>.</div>}
    </div>}
  </div>
}

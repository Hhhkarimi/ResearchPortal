"use client";

import Link from "next/link";
import {useRouter} from "next/navigation";
import {useMemo, useState} from "react";
import {searchUniversitiesLocally} from "@/lib/university-search";

type Institution={slug:string;nameFa:string;category:string;iscRank:number};
type Audit={universitySlug:string;portalAuditStatus:string};
type Ranking={universitySlug:string;score:number;rank:number};

export function HomeExplorer({institutions,audits,rankings}:{institutions:Institution[];audits:Audit[];rankings:Ranking[]}){
  const router=useRouter();
  const [query,setQuery]=useState("");
  const [activeIndex,setActiveIndex]=useState(0);
  const institutionBySlug=useMemo(()=>new Map(institutions.map(x=>[x.slug,x])),[institutions]);
  const results=useMemo(()=>{
    if(query.trim().length<2)return [];
    return searchUniversitiesLocally(query,6).map(result=>institutionBySlug.get(result.href.split("/").pop()||"")).filter((item):item is Institution=>Boolean(item));
  },[query,institutionBySlug]);
  const auditBySlug=useMemo(()=>new Map(audits.map(x=>[x.universitySlug,x])),[audits]);
  const rankBySlug=useMemo(()=>new Map(rankings.map(x=>[x.universitySlug,x])),[rankings]);
  return <div className="heroSearch">
    <label htmlFor="university-search">پرونده یک دانشگاه را پیدا کنید</label>
    <div className="searchBox"><span aria-hidden="true">⌕</span><input id="university-search" type="search" value={query} onKeyDown={event=>{if(event.key==="ArrowDown"){event.preventDefault();setActiveIndex(current=>Math.min(current+1,results.length-1));}else if(event.key==="ArrowUp"){event.preventDefault();setActiveIndex(current=>Math.max(current-1,0));}else if(event.key==="Enter"&&results[activeIndex]){event.preventDefault();router.push(`/universities/${results[activeIndex].slug}`);}}} onChange={event=>{setQuery(event.target.value);setActiveIndex(0);}} placeholder="مثلاً دانشگاه تهران، صنعتی شریف…" autoComplete="off" spellCheck={false} role="combobox" aria-expanded={query.trim().length>=2} aria-controls="home-university-results" aria-activedescendant={results[activeIndex]?`home-result-${activeIndex}`:undefined}/><kbd>۱۱۵</kbd></div>
    {query.trim().length>=2&&<div className="searchResults" id="home-university-results" role="listbox">
      {results.length?results.map((u,index)=>{const a=auditBySlug.get(u.slug);const r=rankBySlug.get(u.slug);return <Link href={`/universities/${u.slug}`} id={`home-result-${index}`} className={index===activeIndex?"active":""} aria-selected={index===activeIndex} onMouseEnter={()=>setActiveIndex(index)} key={u.slug} role="option"><span><b>{u.nameFa}</b><small>{u.category} · رتبه ISC {u.iscRank.toLocaleString("fa-IR")}</small></span><em className={a?.portalAuditStatus==="direct-official"?"good":"pending"}>{r?`RTPMI ${r.score}`:"نیازمند شواهد بیشتر"}</em><i>←</i></Link>}):<div className="emptySearch">نام دانشگاه پیدا نشد؛ <Link href="/universities">فهرست کامل را ببینید</Link>.</div>}
    </div>}
  </div>
}

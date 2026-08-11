"use client";

import {useMemo,useState} from "react";

const dimensionLabels:any={portalIdentity:"هویت پرتال",organization:"ساختار",libraryDocuments:"کتابخانه/اسناد",laboratories:"آزمایشگاه",industryTechnology:"صنعت/فناوری",informationTechnology:"فناوری اطلاعات",systemsServices:"سامانه‌ها",documentsRegulations:"اسناد/مقررات"};
const statusLabels:any={verified:"تأیید مستقیم","observed-reference":"شاهد/ارجاع",restricted:"دسترسی محدود",unresolved:"حل‌نشده"};
const basisLabels:any={verified:"منبع رسمیِ مرتبط با همین بُعد ثبت شده است.","observed-reference":"مرجع رسمی دیده شده، اما انتساب مستقیم این بُعد برای انتشار کافی نیست.",restricted:"سطح رسمی شناسایی شده، اما راستی‌آزمایی عمومی محدود یا مسدود است.",unresolved:"در این Snapshot شاهد عمومی کافی حل نشده است؛ این به معنی نبود قابلیت نیست."};

export function EvidenceExplorer({rows}:{rows:any[]}){
  const [query,setQuery]=useState("");
  const [dimension,setDimension]=useState("همه");
  const [status,setStatus]=useState("همه");
  const [limit,setLimit]=useState(96);
  const filtered=useMemo(()=>rows.filter(row=>(dimension==="همه"||row.dimension===dimension)&&(status==="همه"||row.status===status)&&(!query||row.nameFa.includes(query)||row.universitySlug.includes(query.toLowerCase()))),[rows,query,dimension,status]);
  const resetLimit=()=>setLimit(96);
  return <><div className="explorerBar glass"><div className="field searchField"><label htmlFor="evidence-search">دانشگاه</label><input id="evidence-search" value={query} onChange={event=>{setQuery(event.target.value);resetLimit()}} placeholder="نام دانشگاه…"/></div><div className="field"><label htmlFor="evidence-dimension">بُعد</label><select id="evidence-dimension" value={dimension} onChange={event=>{setDimension(event.target.value);resetLimit()}}><option value="همه">همه ۸ بُعد</option>{Object.entries(dimensionLabels).map(([key,label]:any)=><option value={key} key={key}>{label}</option>)}</select></div><div className="field"><label htmlFor="evidence-status">Outcome</label><select id="evidence-status" value={status} onChange={event=>{setStatus(event.target.value);resetLimit()}}><option value="همه">همه وضعیت‌ها</option>{Object.entries(statusLabels).map(([key,label]:any)=><option value={key} key={key}>{label}</option>)}</select></div></div><div className="resultMeta"><b>{filtered.length.toLocaleString("fa-IR")}</b> outcome از ۹۲۰ خانه ممیزی</div><div className="evidenceCards">{filtered.slice(0,limit).map(row=><article className={`evidenceCard ${row.status}`} key={row.id}><header><span>{dimensionLabels[row.dimension]}</span><i>{statusLabels[row.status]}</i></header><h2>{row.nameFa}</h2><p>{basisLabels[row.status]}{row.publicationAdjustment&&<small> نتیجه گزارش اولیه به‌دلیل نبود منبع بُعدی کافی با احتیاط منتشر شده است.</small>}</p><footer><span>{new Date(row.reviewedAt).toLocaleDateString("fa-IR")}</span>{row.sources[0]?<a href={row.sources[0].url} target="_blank" rel="noopener noreferrer">{row.sourceCount.toLocaleString("fa-IR")} منبع رسمی ↗</a>:<b>بدون URL قابل انتشار</b>}</footer></article>)}</div>{limit<filtered.length&&<button className="loadMore" onClick={()=>setLimit(value=>value+96)}>نمایش outcomeهای بیشتر ↓</button>}</>;
}

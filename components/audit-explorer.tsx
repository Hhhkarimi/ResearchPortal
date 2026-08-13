"use client";

import Link from "next/link";
import {useDeferredValue, useEffect, useMemo, useState, type CSSProperties} from "react";

const dimensions = [
  ["portalIdentity", "هویت پرتال معاونت پژوهشی و فناوری"],
  ["organization", "ساختار"],
  ["libraryDocuments", "کتابخانه"],
  ["laboratories", "آزمایشگاه"],
  ["industryTechnology", "صنعت/فناوری"],
  ["systemsServices", "سامانه‌ها"],
  ["documentsRegulations", "اسناد"],
] as const;

const state: Record<string, string> = {
  verified: "تأیید",
  "observed-reference": "شاهد",
  restricted: "محدود",
  unresolved: "باز",
};

const coverage = (audit: any) => audit.reviewEvidenceCoverage ?? audit.auditEvidenceCoverage ?? 0;
type Selection = {row: any; key: string; label: string} | null;

export function AuditExplorer({audits}: {audits: any[]}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("همه");
  const [mode, setMode] = useState("همه");
  const [dimension, setDimension] = useState("همه");
  const [selection, setSelection] = useState<Selection>(null);
  const deferredQuery = useDeferredValue(query);
  const categories = useMemo(() => [...new Set(audits.map((item) => item.iscCategory))], [audits]);

  const rows = useMemo(() => audits.filter((audit) => {
    const visibleDimensions = dimension === "همه" ? Object.values(audit.dimensions) : [audit.dimensions[dimension]];
    return (category === "همه" || audit.iscCategory === category) &&
      (!deferredQuery || audit.nameFa.includes(deferredQuery)) &&
      (mode === "همه" ||
        (mode === "complete" && coverage(audit) === 100) ||
        (mode === "pending" && coverage(audit) < 75) ||
        (mode === "restricted" && visibleDimensions.includes("restricted")) ||
        (mode === "unresolved" && visibleDimensions.includes("unresolved")) ||
        (mode === "observed-reference" && visibleDimensions.includes("observed-reference")));
  }), [audits, category, deferredQuery, dimension, mode]);

  const visibleDimensionList = dimension === "همه" ? dimensions : dimensions.filter(([key]) => key === dimension);
  const selectedEvidence = selection ? selection.row.evidence?.[selection.key] : null;
  const selectedStatus = selection ? selection.row.dimensions[selection.key] : null;

  useEffect(() => {
    if (!selection) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelection(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [selection]);

  return <>
    <div className="explorerBar auditControls glass">
      <div className="field searchField"><label htmlFor="audit-search">جست‌وجوی دانشگاه</label><input id="audit-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="نام دانشگاه…" spellCheck={false}/></div>
      <div className="field"><label htmlFor="audit-category">گروه ISC</label><select id="audit-category" value={category} onChange={(event) => setCategory(event.target.value)}><option>همه</option>{categories.map((value) => <option key={value}>{value}</option>)}</select></div>
      <div className="field"><label htmlFor="audit-dimension">بُعد ممیزی</label><select id="audit-dimension" value={dimension} onChange={(event) => setDimension(event.target.value)}><option value="همه">هر ۷ بُعد</option>{dimensions.map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></div>
      <div className="field"><label htmlFor="audit-mode">وضعیت شواهد</label><select id="audit-mode" value={mode} onChange={(event) => setMode(event.target.value)}><option value="همه">همه وضعیت‌ها</option><option value="unresolved">فقط حل‌نشده</option><option value="observed-reference">فقط شاهد/ارجاع</option><option value="restricted">فقط دسترسی محدود</option><option value="complete">پوشش کامل</option><option value="pending">پوشش کمتر از ۷۵٪</option></select></div>
    </div>

    <div className="auditQuickFilters" aria-label="فیلترهای سریع">
      <button type="button" className={dimension === "laboratories" ? "active" : ""} onClick={() => setDimension(dimension === "laboratories" ? "همه" : "laboratories")}>فقط آزمایشگاه</button>
      <button type="button" className={mode === "unresolved" ? "active" : ""} onClick={() => setMode(mode === "unresolved" ? "همه" : "unresolved")}>فقط حل‌نشده</button>
      <button type="button" className={category === "صنعتی" ? "active" : ""} onClick={() => setCategory(category === "صنعتی" ? "همه" : "صنعتی")}>دانشگاه‌های صنعتی</button>
      {(dimension !== "همه" || mode !== "همه" || category !== "همه" || query) ? <button type="button" onClick={() => {setDimension("همه");setMode("همه");setCategory("همه");setQuery("");}}>پاک کردن فیلترها</button> : null}
    </div>

    <div className="matrixLegend"><span><i className="verified"/>تأیید مستقیم</span><span><i className="observed-reference"/>شاهد/ارجاع</span><span><i className="restricted"/>دسترسی محدود</span><span><i className="unresolved"/>هنوز حل نشده</span><small>برای دیدن شاهد، روی هر خانه کلیک کنید.</small></div>

    <div className="deepMatrixWrap glass">
      <div className={`deepMatrix ${dimension !== "همه" ? "focused" : ""}`} style={{"--audit-columns": visibleDimensionList.length} as CSSProperties}>
        <div className="deepRow deepHead"><b>دانشگاه / ISC</b>{visibleDimensionList.map(([key, label]) => <span key={key}>{label}</span>)}<strong>پوشش</strong></div>
        {rows.map((row) => <div className="deepRow" key={row.universitySlug}>
          <b><Link href={`/universities/${row.universitySlug}`}>{row.nameFa}</Link><small>{row.iscCategory} · ISC #{row.iscRank}</small></b>
          {visibleDimensionList.map(([key, label]) => <button type="button" className={`eState ${row.dimensions[key]}`} title={`${label}: ${state[row.dimensions[key]]}`} key={key} onClick={() => setSelection({row, key, label})}><i/>{state[row.dimensions[key]]}</button>)}
          <strong>{coverage(row)}%</strong>
        </div>)}
      </div>
    </div>
    <div className="resultMeta"><b>{rows.length.toLocaleString("fa-IR")}</b> نهاد نمایش داده می‌شود.</div>

    {selection ? <div className="auditDrawerBackdrop" role="presentation" onMouseDown={() => setSelection(null)}>
      <aside className="auditDrawer" role="dialog" aria-modal="true" aria-label={`جزئیات ${selection.label}`} onMouseDown={(event) => event.stopPropagation()}>
        <header><div><span>Evidence cell · 115 × 7</span><h2>{selection.label}</h2><p>{selection.row.nameFa}</p></div><button type="button" onClick={() => setSelection(null)} aria-label="بستن جزئیات">×</button></header>
        <div className={`drawerStatus ${selectedStatus}`}><i/><span>{state[selectedStatus]}</span><b>{selectedEvidence?.sourceCount?.toLocaleString("fa-IR") || "۰"} منبع</b></div>
        <dl><div><dt>گروه ISC</dt><dd>{selection.row.iscCategory}</dd></div><div><dt>پوشش کل پرونده</dt><dd>{coverage(selection.row)}٪</dd></div><div><dt>آخرین راستی‌آزمایی</dt><dd>{selectedEvidence?.lastVerified ? new Date(selectedEvidence.lastVerified).toLocaleDateString("fa-IR") : "ثبت نشده"}</dd></div></dl>
        <section><h3>دلیل outcome</h3><p>{selectedEvidence?.verificationBasis || (selectedStatus === "unresolved" ? "شواهد عمومی کافی برای تأیید یا رد این بُعد بازیابی نشده است." : "Outcome بر اساس شواهد ثبت‌شده در Snapshot حاضر محاسبه شده است.")}</p></section>
        {selectedEvidence?.source ? <a className="drawerSource" href={selectedEvidence.source.url} target="_blank" rel="noopener noreferrer"><span>بهترین منبع ثبت‌شده</span><b>{selectedEvidence.source.label || selectedEvidence.source.url}</b><i>↗</i></a> : <div className="drawerEmpty">منبع مستقیم قابل انتشار برای این خانه ثبت نشده است.</div>}
        <Link className="drawerProfileLink" href={`/universities/${selection.row.universitySlug}#evidence-map`}>باز کردن پرونده کامل دانشگاه ←</Link>
      </aside>
    </div> : null}
  </>;
}

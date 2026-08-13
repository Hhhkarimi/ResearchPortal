import Link from "next/link";
import {formatFaNumber} from "@/lib/fa";

const dimensionLabels:any={
  portalIdentity:"هویت پرتال",
  organization:"ساختار",
  libraryDocuments:"کتابخانه",
  laboratories:"آزمایشگاه",
  industryTechnology:"صنعت و فناوری",
  systemsServices:"سامانه‌ها",
  documentsRegulations:"اسناد"
};

export function HeroConstellation({audits,summary}:{audits:any[];summary:any}){
  const institutionCount=audits.length||115;

  return <div className="constellation" aria-label={`رادار ارزیابی ${formatFaNumber(institutionCount)} دانشگاه و مؤسسه`}>
    <div className="auroraBlob violet"/><div className="auroraBlob cyan"/><div className="signalSweep"/>
    <div className="constellationHeader"><span><i/> رادار ارزیابی ملی</span><b>{formatFaNumber(institutionCount)} نهاد · ۷ بُعد</b></div>
    <div className="constellationField">
      {audits.map((row,index)=>{
        const coverage=row.reviewEvidenceCoverage??row.auditEvidenceCoverage??0;
        const x=7+((index*47)%87);
        const y=8+((index*71)%82);
        const level=coverage>=75?"high":coverage>=50?"mid":coverage>0?"low":"dark";
        return <Link
          href={`/universities/${row.universitySlug}`}
          title={`${row.nameFa} — پوشش ${formatFaNumber(coverage)}٪`}
          className={`star ${level}`}
          style={{left:`${x}%`,top:`${y}%`,"--delay":`${(index%12)*-.22}s`} as React.CSSProperties}
          key={row.universitySlug}
        ><i/><span>{coverage>=75?row.nameFa:""}</span></Link>
      })}
      <div className="constellationCore">
        <span>دامنه ارزیابی</span>
        <b>{formatFaNumber(institutionCount)}</b>
        <small>دانشگاه و مؤسسه ISC</small>
        <em>{formatFaNumber(summary.ranked)} رتبه‌پذیر</em>
        <i className="corePulse"/>
      </div>
      <div className="orbitLine one"/><div className="orbitLine two"/><div className="orbitLine three"/>
      <div className="constellationSignals">
        <span><b>{formatFaNumber(summary.directOfficialPortals||0)}</b>پرتال مستقیم</span>
        <span><b>{formatFaNumber(summary.documents||0)}</b>سند/شاخص</span>
        <span><b>{formatFaNumber(summary.ranked||0)}</b>رتبه‌پذیر</span>
      </div>
    </div>
    <div className="constellationFooter">
      <span><i className="high"/> پوشش ۷۵٪ و بیشتر</span>
      <span><i className="mid"/> پوشش میانی</span>
      <span><i className="low"/> شاهد اولیه</span>
      <span><i className="dark"/> هنوز حل‌نشده</span>
      <b>{formatFaNumber(institutionCount)} نهاد در رادار</b>
    </div>
  </div>;
}

const ledgerDimensions=[
  ["portalIdentity","هویت"],
  ["organization","ساختار"],
  ["libraryDocuments","کتابخانه"],
  ["laboratories","آزمایشگاه"],
  ["industryTechnology","صنعت"],
  ["systemsServices","سامانه"],
  ["documentsRegulations","اسناد"],
] as const;

const outcomeLabel:Record<string,string>={
  verified:"تأیید مستقیم",
  "observed-reference":"شاهد یا ارجاع",
  restricted:"دسترسی محدود",
  unresolved:"حل‌نشده",
};

export function EvidenceLedger({audits,summary}:{audits:any[];summary:any}){
  const sample=audits.slice(0,5);

  return <div className="evidenceLedger" aria-label={`نمونه دفتر شواهد ${formatFaNumber(audits.length)} نهاد`}>
    <header className="ledgerHeader">
      <div><span className="ledgerSeal" aria-hidden="true">ر</span><span><b>دفتر ممیزی ملی</b><small>EVIDENCE LEDGER / SNAPSHOT 10.0</small></span></div>
      <span className="ledgerStatus"><i/> داده منتشرشده</span>
    </header>

    <div className="ledgerSummary">
      <div><span>دامنه ثبت</span><b>{formatFaNumber(audits.length||115)}</b><small>دانشگاه و مؤسسه ISC</small></div>
      <dl>
        <div><dt>پرتال مستقیم</dt><dd>{formatFaNumber(summary.directOfficialPortals||0)}</dd></div>
        <div><dt>ردیف شواهد</dt><dd>{formatFaNumber(summary.provenanceRecords||0)}</dd></div>
        <div><dt>رتبه‌پذیر</dt><dd>{formatFaNumber(summary.ranked||0)}</dd></div>
      </dl>
    </div>

    <div className="ledgerTable">
      <div className="ledgerColumns" aria-hidden="true">
        <span>نهاد</span>
        <div>{ledgerDimensions.map(([,label])=><i key={label}>{label}</i>)}</div>
        <b>پوشش</b>
      </div>
      {sample.map((row,index)=><Link href={`/universities/${row.universitySlug}`} className="ledgerRow" key={row.universitySlug}>
        <span className="ledgerIndex">{formatFaNumber(index+1,{minimumIntegerDigits:2})}</span>
        <span className="ledgerName"><b>{row.nameFa}</b><small>{row.iscCategory}</small></span>
        <span className="ledgerTrace">
          {ledgerDimensions.map(([key,label])=>{
            const outcome=row.dimensions?.[key]||"unresolved";
            return <i className={`traceCell ${outcome}`} title={`${label}: ${outcomeLabel[outcome]||outcome}`} key={key}><span className="srOnly">{label}: {outcomeLabel[outcome]||outcome}</span></i>;
          })}
        </span>
        <strong>{formatFaNumber(row.reviewEvidenceCoverage||0)}<small>٪</small></strong>
      </Link>)}
    </div>

    <footer className="ledgerLegend">
      <span><i className="verified"/> تأیید مستقیم</span>
      <span><i className="observed-reference"/> شاهد/ارجاع</span>
      <span><i className="restricted"/> محدود</span>
      <span><i className="unresolved"/> حل‌نشده</span>
      <Link href="/evidence">همه شواهد ←</Link>
    </footer>
  </div>;
}

export function EvidenceSpectrum({dimensions}:{dimensions:Record<string,Record<string,number>>}){
  const entries=Object.entries(dimensions).filter(([key])=>Object.prototype.hasOwnProperty.call(dimensionLabels,key));
  const values=entries.map(([,value])=>value);
  const direct=values.reduce((sum,value)=>sum+(value.verified||0),0);
  const resolved=values.reduce((sum,value)=>sum+(value.verified||0)+(value["observed-reference"]||0),0);

  return <section className="spectrum">
    <div className="spectrumPulse"/>
    <header>
      <div>
        <span className="eyebrow">National evidence spectrum</span>
        <h2>ضربان هفت بُعد شفافیت</h2>
      </div>
      <p>هر نوار دقیقاً ۱۱۵ دانشگاه را نشان می‌دهد؛ رنگ‌ها outcome ممیزی‌اند، نه نمره عملکرد دانشگاه.</p>
      <div className="spectrumHeadline">
        <b>{formatFaNumber(direct)}</b>
        <span>تأیید مستقیم</span>
        <small>{formatFaNumber(resolved)} خانه حل‌شده/مرجع</small>
      </div>
    </header>

    <div className="spectrumRows">
      {entries.map(([key,value],index)=>{
        const verified=value.verified||0;
        const observed=value["observed-reference"]||0;
        const restricted=value.restricted||0;
        const unresolved=value.unresolved||0;

        return <div className="spectrumRow" key={key}>
          <div className="spectrumLabel">
            <i>{formatFaNumber(index+1,{minimumIntegerDigits:2})}</i>
            <b>{dimensionLabels[key]}</b>
            <span>{formatFaNumber(verified)} شاهد مستقیم</span>
          </div>
          <div className="spectrumBar" aria-label={`${dimensionLabels[key]}: ${verified} verified`}>
            <i className="verified" style={{width:`${verified/1.15}%`}}/>
            <i className="observed" style={{width:`${observed/1.15}%`}}/>
            <i className="restricted" style={{width:`${restricted/1.15}%`}}/>
            <i className="unresolved" style={{width:`${unresolved/1.15}%`}}/>
            <b style={{right:`${Math.min(98,(verified+observed)/1.15)}%`}}/>
          </div>
          <strong>{formatFaNumber(Math.round(verified/1.15))}<small>%</small></strong>
        </div>
      })}
    </div>

    <footer>
      <span><i className="verified"/>تأیید مستقیم</span>
      <span><i className="observed"/>شاهد/ارجاع</span>
      <span><i className="restricted"/>دسترسی محدود</span>
      <span><i className="unresolved"/>حل‌نشده</span>
    </footer>
  </section>;
}

export function RankPodium({rankings}:{rankings:any[]}){
  const first=rankings.slice(0,3);
  const ordered=[first[1],first[0],first[2]].filter(Boolean);

  return <section className="podiumStory">
    <header>
      <div><span className="eyebrow">RTPMI portal podium</span><h2>سه پرتال پیشرو در این Snapshot</h2></div>
      <p>ارتفاع ستون از امتیاز بلوغ پرتال می‌آید؛ اندازه دانشگاه یا کیفیت علمی را نمایش نمی‌دهد.</p>
    </header>
    <div className="podiumStage">
      <div className="podiumGrid"/>
      {ordered.map((row,index)=>{
        const place=index===1?1:index===0?2:3;
        return <Link href={`/universities/${row.universitySlug}`} className={`podium place${place}`} key={row.universitySlug}>
          {place===1&&<span className="podiumCrown">✦</span>}
          <div className="podiumPerson">
            <span>{row.nameFa}</span>
            <small>اطمینان {formatFaNumber(row.confidence)}٪</small>
            <b>{formatFaNumber(row.score)}</b>
          </div>
          <div className="podiumColumn" style={{height:`${120+row.score*1.25}px`}}>
            <i>{formatFaNumber(place)}</i>
            <span>RTPMI</span>
            <em>{formatFaNumber(row.evidenceCoverage)}٪ شواهد</em>
          </div>
        </Link>
      })}
      <div className="podiumAura"/>
    </div>
  </section>;
}

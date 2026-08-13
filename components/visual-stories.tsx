import Link from "next/link";
import {formatFaNumber} from "@/lib/fa";
import {PUBLIC_OUTCOME_COUNT} from "@/lib/public-model";

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
  return <div className="constellation" aria-label="کهکشان شواهد ۱۱۵ دانشگاه">
    <div className="auroraBlob violet"/><div className="auroraBlob cyan"/><div className="signalSweep"/>
    <div className="constellationHeader"><span><i/> نقشه زنده Evidence</span><b>۱۱۵ دانشگاه · ۷ بُعد</b></div>
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
        <span>ماتریس ملی</span>
        <b>{formatFaNumber(PUBLIC_OUTCOME_COUNT)}</b>
        <small>outcome مستند</small>
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
      <b>{formatFaNumber(summary.dimensionEvidenceOutcomes||PUBLIC_OUTCOME_COUNT)} / {formatFaNumber(PUBLIC_OUTCOME_COUNT)}</b>
    </div>
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

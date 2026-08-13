import Link from "next/link";
import {HomeExplorer} from "@/components/home-explorer";
import {EvidenceLedger} from "@/components/visual-stories";
import {audits,datasetSummary,institutions,rankings,researchReviews} from "@/lib/data";

const fa=(n:number)=>n.toLocaleString("fa-IR");

export default function Home(){
  const summary:any=datasetSummary;
  const categories=Object.entries(summary.categoryCounts);
  const top=rankings.slice(0,5);

  return <main>
    <section className="hero shell">
      <div className="heroCopy">
        <div className="liveBadge"><i/> دفتر شواهد ۱۱۵ نهاد دولتی ISC <span>Snapshot ۱۰.۰</span></div>
        <h1>ردِ شواهد را بگیرید؛<em> پرتال پژوهشی را بسنجید.</em></h1>
        <p>رصدخانه‌ای برای سنجش بلوغ و شفافیت پرتال معاونت پژوهشی و فناوری دانشگاه‌ها؛ از ساختار معاونت و کتابخانه تا آزمایشگاه، صنعت و فناوری، سامانه‌ها و اسناد.</p>
        <HomeExplorer institutions={institutions} audits={audits} rankings={rankings}/>
        <div className="heroLinks">
          <Link className="primaryLink" href="/audit">باز کردن دفتر ممیزی <span>←</span></Link>
          <Link className="quietLink" href="/methodology">RTPMI دقیقاً چه می‌سنجد؟</Link>
        </div>
      </div>
      <EvidenceLedger audits={researchReviews} summary={summary}/>
    </section>

    <section className="proofStrip">
      <div className="shell">
        <div><b>{fa(115)}</b><span>دانشگاه و مؤسسه ISC</span></div>
        <div><b>{fa(summary.provenanceRecords)}</b><span>ردیف شواهد قابل رهگیری</span></div>
        <div><b>{fa(summary.units)}</b><span>واحد و زیرمجموعه</span></div>
        <div><b>{fa(summary.systems)}</b><span>سامانه و خدمت</span></div>
        <div><b>{fa(summary.documents)}</b><span>سند و فرم مستقیم</span></div>
      </div>
    </section>

    <section className="shell section journey">
      <div className="sectionHead">
        <div>
          <span className="eyebrow">یک رصدخانه، سه مسیر روشن</span>
          <h2>از سؤال شما شروع می‌کنیم، نه از جدول‌ها.</h2>
        </div>
        <p>هر مسیر به داده همان Snapshot می‌رسد؛ فقط زاویه ورود متفاوت است.</p>
      </div>

      <div className="journeyGrid">
        <Link href="/universities" className="journeyCard violet">
          <span>برای دانشگاه</span>
          <strong>پرونده پرتال خودتان را باز کنید</strong>
          <p>شکاف‌های شفافیت، وضعیت شواهد، واحدها، سامانه‌ها و اسناد را یک‌جا ببینید.</p>
          <b>پیدا کردن دانشگاه ←</b>
          <i>پرونده</i>
        </Link>

        <Link href="/audit" className="journeyCard cyan">
          <span>برای سیاست‌گذار</span>
          <strong>تصویر ملی ۱۱۵ × ۷ را ببینید</strong>
          <p>پوشش ممیزی را بر اساس گروه ISC و وضعیت دسترسی رصد و مقایسه کنید.</p>
          <b>ورود به نقشه ممیزی ←</b>
          <i>سیاست</i>
        </Link>

        <Link href="/datasets" className="journeyCard lime">
          <span>برای پژوهشگر</span>
          <strong>داده را بگیرید و بازتولید کنید</strong>
          <p>JSON، CSV، دفتر شواهد، ۱۱۵ Audit Packet و API نسخه‌دار آماده استفاده‌اند.</p>
          <b>رفتن به Data Lab ←</b>
          <i>داده</i>
        </Link>
      </div>
    </section>

    <section className="darkSection">
      <div className="shell section">
        <div className="sectionHead light">
          <div>
            <span className="eyebrow">RTPMI 4.2 / Portal maturity only</span>
            <h2>رتبه‌بندی‌ای که ادعای اضافه نمی‌کند.</h2>
          </div>
          <Link className="textLink" href="/rankings">جدول کامل رتبه‌ها ←</Link>
        </div>

        <div className="rankingStage">
          <div className="topFive">
            {top.map((r:any,i:number)=>
              <Link href={`/universities/${r.universitySlug}`} key={r.universitySlug} className={i===0?"winner":""}>
                <span>#{fa(r.rank)}</span>
                <div><b>{r.nameFa}</b><small>{r.iscCategory} · اطمینان {r.confidence}%</small></div>
                <strong>{r.score}</strong>
                <i style={{width:`${r.score}%`}}/>
              </Link>
            )}
          </div>

          <aside>
            <span>خط قرمز تفسیر</span>
            <h3>RTPMI رتبه علمی دانشگاه نیست.</h3>
            <p>این شاخص فقط بلوغ، یافت‌پذیری و شفافیت پرتال عمومی معاونت پژوهشی و فناوری را می‌سنجد. پرتال فاقد Evidence کافی به‌جای امتیاز ساختگی، «رتبه‌ناپذیر» می‌ماند.</p>
            <Link href="/methodology">روش محاسبه و قواعد داده مفقود ←</Link>
          </aside>
        </div>
      </div>
    </section>

    <section className="shell section">
      <div className="sectionHead">
        <div>
          <span className="eyebrow">ISC scope / locked roster</span>
          <h2>همه ۱۱۵ نهاد، بدون گزینش سلیقه‌ای.</h2>
        </div>
        <Link className="textLink" href="/isc-scope">منبع و تطبیق فهرست ←</Link>
      </div>

      <div className="categoryRail">
        {categories.map(([name,count],i)=>
          <Link href={`/universities?category=${encodeURIComponent(name)}`} key={name}>
            <span style={{height:`${36+Number(count)/2}px`}}/>
            <b>{fa(Number(count))}</b>
            <small>{name}</small>
            <i>0{i+1}</i>
          </Link>
        )}
      </div>
    </section>

    <section className="shell section livingCallout">
      <div>
        <span className="liveBadge"><i/> زیرساخت مرجع زنده</span>
        <h2>برای Snapshot بعدی آماده است.</h2>
        <p>پایش دوره‌ای لینک‌ها، ثبت تغییرات، نسخه‌بندی داده، API و پرونده مستقل هر دانشگاه در معماری انتشار تعبیه شده است.</p>
      </div>

      <div className="livingSteps">
        <span><b>01</b>کشف تغییر و لینک خراب</span>
        <span><b>02</b>بازبینی انسانی شواهد</span>
        <span><b>03</b>انتشار Snapshot نسخه‌دار</span>
        <span><b>04</b>رتبه‌بندی سالانه قابل بازتولید</span>
      </div>

      <Link href="/datasets">مشاهده زیرساخت داده ←</Link>
    </section>
  </main>
}

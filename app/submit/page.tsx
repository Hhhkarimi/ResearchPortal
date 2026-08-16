import type {Metadata} from "next";

import {SubmissionForm} from "@/components/submission-form";
import institutions from "@/data/isc/institutions.json";

import styles from "./submit.module.css";

export const metadata:Metadata={
  title:"افزودن منبع پژوهشی",
  description:"پیشنهاد یک لینک رسمی برای بررسی و ورود کنترل‌شده به رصدخانه پرتال پژوهش و فناوری.",
};

export default function Page(){
  const universities=(institutions as Array<{slug:string;nameFa:string;category:string}>)
    .map(({slug,nameFa,category})=>({slug,nameFa,category}))
    .sort((a,b)=>a.category.localeCompare(b.category,"fa")||a.nameFa.localeCompare(b.nameFa,"fa"));

  return <main className="shell page">
    <header className="pageHero">
      <div>
        <span className="eyebrow">Community discovery · verified before publication</span>
        <h1>یک منبع رسمی معرفی کنید.</h1>
        <p>اگر صفحه، سامانه، مرکز، آزمایشگاه یا سند پژوهشی معتبری می‌شناسید که در رصدخانه نیست، لینک آن را بفرستید. پیشنهاد شما مستقیم وارد داده رسمی نمی‌شود و ابتدا با دامنه رسمی، محتوای صفحه و قواعد فعلی رصدخانه بررسی خواهد شد.</p>
      </div>
      <div className="pageHeroStamp cyan"><b>روزانه</b><span>بررسی خودکار</span><small>Git-backed · بدون دیتابیس خارجی</small></div>
    </header>

    <section className={styles.layout} aria-labelledby="submit-source-heading">
      <div className={styles.intro}>
        <span className="eyebrow">Contribution pipeline</span>
        <h2 id="submit-source-heading">ورودی باز، انتشار کنترل‌شده.</h2>
        <p>فرم برای مشارکت عمومی ساده است، اما مسیر انتشار عمداً سخت‌گیرانه باقی می‌ماند. توضیح کاربر فقط برای پیدا کردن زمینه منبع استفاده می‌شود؛ وضعیت «verified»، عنوان نهایی و اثر آن روی شاخص‌ها از داده واقعی و validatorها می‌آید.</p>

        <div className={styles.principles}>
          <div><b>01</b><span><strong>بدون اعتماد پیش‌فرض</strong><small>هر submission در ابتدا pending و untrusted است.</small></span></div>
          <div><b>02</b><span><strong>دامنه رسمی</strong><small>انتشار خودکار فقط برای دامنه رسمی همان دانشگاه انجام می‌شود.</small></span></div>
          <div><b>03</b><span><strong>تراکنش Git</strong><small>اگر pipeline یا validator شکست بخورد، تغییر نهایی push نمی‌شود.</small></span></div>
          <div><b>04</b><span><strong>ردّ منبع</strong><small>ارسال، بررسی و نتیجه در تاریخچه مخزن قابل ممیزی می‌ماند.</small></span></div>
        </div>
      </div>

      <div className={styles.formCard}>
        <div className={styles.formHead}>
          <span>پیشنهاد منبع</span>
          <small>حدود ۱ دقیقه</small>
        </div>
        <SubmissionForm universities={universities}/>
      </div>
    </section>
  </main>;
}

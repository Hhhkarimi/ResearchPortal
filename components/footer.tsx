import Link from "next/link";

export function Footer(){return <footer className="siteFooter"><div className="shell footerIn">
  <div className="footerLead"><span className="brandMark" aria-hidden="true"><i/><i/><i/></span><div><strong>رصدخانه ملی پرتال پژوهش و فناوری</strong><p>تصویری مستند از بلوغ و شفافیت پرتال‌های پژوهشی ۱۱۵ نهاد دولتی ISC؛ نه سنجه‌ای از کیفیت علمی دانشگاه.</p></div></div>
  <div className="footerLinks"><div><b>کاوش</b><Link href="/universities">دانشگاه‌ها</Link><Link href="/audit">ماتریس ممیزی</Link><Link href="/rankings">رتبه‌بندی RTPMI</Link></div><div><b>اعتماد</b><Link href="/methodology">روش‌شناسی</Link><Link href="/evidence">رجیستر ۸۰۵ شواهد</Link><Link href="/isc-scope">دامنه ISC</Link></div><div><b>استفاده مجدد</b><Link href="/datasets">Open Data</Link><Link href="/api-docs">API v1</Link><a href="/datasets/manifest.json">Manifest</a></div></div>
  <div className="footerBottom"><span>Snapshot: ۲۰ مرداد ۱۴۰۵ · RTPMI ۴.۲</span><span>نامشخص هرگز به معنی صفر نیست.</span><a href="/api/v1/health">وضعیت داده ●</a></div>
</div></footer>}

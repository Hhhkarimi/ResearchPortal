export const metadata={title:"راهنمای API v1"};

const endpoints=[
  ["GET","/api/v1/universities","فهرست ۱۱۵ نهاد؛ فیلترهای category، status، ranked، q، limit و offset"],
  ["GET","/api/v1/universities/{slug}","پروفایل دانشگاه؛ شامل ممیزی، ۷ outcome شواهد، RTPMI، واحدها، سامانه‌ها و اسناد"],
  ["GET","/api/v1/evidence","رجیستر ۸۰۵ outcome؛ فیلترهای university، dimension، status، limit و offset"],
  ["GET","/api/v1/rankings","رتبه‌بندی Evidence-qualified؛ فیلتر category"],
  ["GET","/api/v1/summary","شاخص‌های خلاصه Snapshot ملی"],
  ["GET","/api/v1/health","سلامت ۱۱۵ بازبینی و ۸۰۵ outcome شواهد"],
] as const;

export default function Page(){
  return <main className="shell page">
    <header className="pageHero">
      <div>
        <span className="eyebrow">Developer reference · API v1</span>
        <h1>رابطی ساده برای یک داده پیچیده.</h1>
        <p>تمام پاسخ‌ها JSON، UTF-8 و نسخه‌دارند. برای کار پژوهشی، فیلدهای snapshotDate و methodologyVersion را در خروجی خود نگه دارید.</p>
      </div>
      <div className="pageHeroStamp cyan">
        <b>REST</b>
        <span>بدون احراز هویت</span>
        <small>Read only · CORS</small>
      </div>
    </header>

    <div className="apiDocs">
      <section>
        <h2>Endpointها</h2>
        {endpoints.map(([method,path,description])=>
          <div className="endpoint" key={path}>
            <span>{method}</span>
            <code data-latin>{path}</code>
            <p>{description}</p>
          </div>
        )}
      </section>

      <aside>
        <h2>نمونه درخواست</h2>
        <pre data-latin><code>{`fetch('/api/v1/evidence?\n  status=verified&limit=25')\n  .then(r => r.json())\n  .then(({ data, meta }) => {\n    console.log(data, meta.snapshotDate)\n  })`}</code></pre>
        <h2>قرارداد تفسیر</h2>
        <p>مقدار <code data-latin>null</code> یا وضعیت <code data-latin>unresolved</code> هرگز به معنی صفر یا نبود یک قابلیت نیست. رتبه RTPMI فقط برای رکوردهای واجد gate انتشار می‌یابد.</p>
        <a href="/openapi.json">دریافت OpenAPI 3.1 ↓</a>
      </aside>
    </div>
  </main>
}

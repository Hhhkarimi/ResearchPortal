# نصب Deep Research Crawler روی ResearchPortal

این پکیج برای ساختار فعلی `Hhhkarimi/ResearchPortal` آماده شده است و dependency جدیدی به npm اضافه نمی‌کند.

## چه چیزی اضافه می‌شود؟

- `scripts/deep-crawl-research.mjs`
  - شروع از `officialWebsite`، `researchUrl` و پرتال‌های از قبل شناخته‌شده
  - خزش محدود و اولویت‌دار لینک‌های داخلی تا عمق پیش‌فرض ۳
  - کشف صفحه‌های اختصاصی ۷ بُعد غیر از هویت پرتال
  - fallback رندر JavaScript با Edge/Chrome نصب‌شده روی Windows Runner
  - بررسی `robots.txt` و sitemap
  - کشف PDF/DOC/DOCX/XLS/XLSX/PPT/PPTX/RTF/ODF/ZIP
  - دانلود فایل‌های مرتبط، محاسبه SHA-256 و ثبت metadata

- `scripts/promote-discovery.mjs`
  - اعمال فقط یافته‌های با confidence بالا روی مدل داده فعلی
  - افزودن URLهای اختصاصی به `portal-document-reaudit.json`
  - افزودن واحدها/سامانه‌ها/اسناد کشف‌شده به catalogها
  - به‌روزرسانی `research-review.json`
  - حذف Telegram و شبکه‌های اجتماعی از Evidence منتشرشده

- `scripts/audit-all-isc.mjs`
  - Link Monitor قبلی با فیلتر کامل لینک‌های social/Telegram

- `scripts/check-no-social-evidence.mjs`
  - publication gate که اگر Telegram/social URL در داده‌های authoritative یا `public/datasets` باقی بماند workflow را fail می‌کند

- `.github/workflows/audit.yml`
  - اجرای Deep Crawl روی `self-hosted, windows, iran-crawler`
  - rebuild و validate
  - commit مستقیم metadata و Evidence به `main`
  - بدون upload-artifact تا مشکل گیرکردن Blob Storage در Runner ایران تکرار نشود

## فایل‌های دانلودشده کجا می‌روند؟

فایل‌های باینری داخل Git قرار نمی‌گیرند. روی Runner ویندوزی در مسیر زیر نگهداری می‌شوند:

```text
C:\actions-runner\_research-documents\<university-slug>\
```

metadata و hash آن‌ها در:

```text
data/generated/discovered-documents.json
```

ثبت می‌شود و قابل commit است.

## نصب

ZIP را در ریشه repository استخراج کن و اجازه بده فایل‌های هم‌نام جایگزین شوند.

سپس:

```bash
git status
git add .github/workflows/audit.yml .gitignore package.json scripts/audit-all-isc.mjs scripts/deep-crawl-research.mjs scripts/promote-discovery.mjs scripts/check-no-social-evidence.mjs docs/DEEP_RESEARCH_CRAWLER.md
git commit -m "feat(crawl): add deep research portal discovery"
git push origin main
```

`package-lock.json` نیاز به تغییر ندارد، چون dependency جدیدی اضافه نشده است.

بعد در GitHub:

```text
Actions
→ National Research Discovery & Evidence Monitor
→ Run workflow
```

## اولین اجرای موفق چه خروجی‌هایی می‌سازد؟

```text
data/generated/discovery-evidence.json
data/generated/discovered-documents.json
data/generated/discovery-summary.json
data/generated/site-health.json
data/generated/change-report.json
```

و سپس `prepare:data` این یافته‌ها را به داده‌های اصلی و `public/datasets` منتقل می‌کند.

## سیاست Evidence

- شکست شبکه = نبود سرویس نیست.
- فقط URLهای رسمی/سازمانی برای Evidence منتشرشده پذیرفته می‌شوند.
- URL پرتال اصلی به‌تنهایی برای اثبات آزمایشگاه/کتابخانه/سامانه/مقررات کافی نیست؛ crawler باید URL اختصاصی پیدا کند.
- Telegram و شبکه‌های اجتماعی از Evidence حذف می‌شوند.
- برای `informationTechnology` فقط وجود صفحه کافی نیست؛ crawler باید ارتباط سازمانی آن صفحه با ساختار پژوهش را از مسیر صفحه والد رسمی ثبت کند تا validator اجازه `verified` بدهد.
- یافته‌های زیر آستانه `DISCOVERY_PROMOTE_CONFIDENCE` فقط در خروجی discovery باقی می‌مانند و وارد داده منتشرشده نمی‌شوند.

## تنظیمات مهم Workflow

مقادیر پیش‌فرض:

```text
Depth: 3
Pages per university: 40
Documents per university: 60
University concurrency: 4
Page concurrency: 3
Page timeout: 10s
Document timeout: 20s
Max document size: 25 MiB
Promotion confidence: 0.78
```

اگر پوشش کم بود، ابتدا `CRAWL_MAX_PAGES_PER_UNIVERSITY` را به 60 افزایش بده. اگر زمان اجرا زیاد شد، آن را به 30 کاهش بده.

## JavaScript menus

Crawler ابتدا HTML عادی را می‌خواند. اگر لینک‌های صفحه بسیار کم باشند و Edge/Chrome روی Runner موجود باشد، همان URL را به‌صورت headless render می‌کند و DOM نهایی را دوباره بررسی می‌کند. این کار برای منوهای JavaScript معمولی مناسب است.

این fallback «کلیک کور روی همه دکمه‌ها» انجام نمی‌دهد؛ خزش لینک‌محور و محدود باقی می‌ماند تا وارد هزاران خبر/صفحه نامرتبط نشود.

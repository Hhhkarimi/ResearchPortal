# پکیج حذف اسناد غیرمرتبط با پژوهش و فناوری

مبنای بررسی: `main` در commit `fb4d4ad73ccf61b18bf23e985c8c0f86b2c0394f`.

این پکیج روی نسخه فعلی `main` طراحی شده و اسناد واضحاً خارج از دامنه پژوهش/فناوری را از مدل عمومی حذف می‌کند؛ نمونه‌ها: خوابگاه، وام و صندوق رفاه دانشجویی، تغذیه/سلف، سرویس دانشجویی، بیمه و کارت دانشجویی، امور دانشجویی، تربیت‌بدنی، مشاوره دانشجویی و شهریه.

برای موارد آموزشی مبهم مثل «انتخاب واحد»، «حذف و اضافه»، «برنامه امتحانات»، «ثبت‌نام آموزشی» و «تقویم آموزشی» قانون نرم اعمال می‌شود: اگر همان رکورد نشانه روشن پژوهشی مثل پژوهش، پایان‌نامه، رساله، گرنت، مقاله، آزمایشگاه، فناوری، نوآوری، صنعت، مالکیت فکری یا پسادکتری داشته باشد حذف نمی‌شود.

## فایل‌ها

سه فایل جدید را اضافه کنید:

- `scripts/research-document-scope.mjs`
- `scripts/filter-research-documents.mjs`
- `scripts/validate-research-document-scope.mjs`

و `package.json` را با نسخه داخل پکیج جایگزین کنید.

`package-lock.json` نیاز به تغییر ندارد چون هیچ dependency جدیدی اضافه نشده است.

## اجرای فوری بدون Crawl مجدد

بعد از کپی فایل‌ها:

```bash
node --check scripts/research-document-scope.mjs
node --check scripts/filter-research-documents.mjs
node --check scripts/validate-research-document-scope.mjs
npm run filter:research-documents
npm run prepare:data
npm run validate:data
npm run validate:no-social
npm run typecheck
npm run lint
npm run build
```

فیلتر این سطوح را پاک‌سازی می‌کند:

- `data/documents/catalog.json`
- `data/evidence/portal-document-reaudit.json` فقط `directDocuments`
- `data/generated/discovered-documents.json`
- URLهای همان اسناد در `data/audit/portal-audit.json.evidenceUrls`
- منابع غیرمرتبط در `data/evidence/research-review.json.officialSources`

بعد از اجرای `prepare:data`، provenance، dimension evidence، summary، audit packets و public datasets نیز از داده پاک‌شده بازسازی می‌شوند.

گزارش موارد حذف‌شده در `data/generated/research-document-filter-report.json` ساخته می‌شود. این فایل طبق `.gitignore` فعلی generated و برای انتشار لازم نیست.

## نکته مهم درباره checkpoint

این اصلاح `portalUrls`، `organizationUrls`، `libraryUrls`، `laboratoryUrls`، `industryTechnologyUrls`، `systemsUrls`، `documentIndexUrls` و `audit.researchUrl` را تغییر نمی‌دهد. بنابراین برای این اصلاح نیازی به حذف checkpointهای Crawl یا Crawl مجدد نیست.

## حذف فایل

برای خود این اصلاح **هیچ فایل داده یا کد اصلی نباید حذف شود**. به‌خصوص `data/crawl-checkpoints` را حذف نکنید.

در `main` فعلی دو فایل راهنمای پکیج قبلی در ریشه مخزن دیده می‌شود: `README-FA.md` و `MANIFEST.txt`. این دو برای اجرای سایت لازم نیستند و اگر فقط از پکیج قبلی به مخزن آپلود شده‌اند، حذفشان **اختیاری و صرفاً برای تمیزکاری مخزن** است:

```bash
git rm README-FA.md MANIFEST.txt
```

این حذف اختیاری را فقط اگر واقعاً نمی‌خواهید آن راهنماها در مخزن بمانند انجام دهید.

## Commit پیشنهادی

```bash
git add package.json scripts/research-document-scope.mjs scripts/filter-research-documents.mjs scripts/validate-research-document-scope.mjs
git commit -m "fix(data): remove non-research student documents"
git push origin main
```


> فایل‌های `PATCH-RESEARCH-DOCUMENT-SCOPE-FA.md` و `PATCH-RESEARCH-DOCUMENT-SCOPE-MANIFEST.txt` فقط راهنما هستند و لازم نیست داخل مخزن کپی یا commit شوند.

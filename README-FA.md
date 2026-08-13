# Data Cleaning Engine v1

این پکیج مرحله اول قبل از Crawl عمیق بعدی است.

## چه چیزی را اصلاح می‌کند؟

سه Catalog اصلی دیگر فقط بر اساس keyword پر نمی‌شوند:

- `data/units/catalog.json` فقط **واحد واقعی** نگه می‌دارد.
- `data/systems/catalog.json` فقط **endpoint واقعی سامانه** نگه می‌دارد.
- `data/documents/catalog.json` فقط **سند مستقیم یا landing page مشخص یک سند** نگه می‌دارد.

موارد زیر حذفِ بی‌ردپا نمی‌شوند:

- صفحه «فرم‌ها و آیین‌نامه‌ها»
- صفحه ساختار سازمانی
- راهنمای سامانه
- اطلاعیه درباره سامانه
- صفحه واسط/Service page

این موارد به:

`data/generated/reference-pages.json`

منتقل می‌شوند.

موارد خارج از دامنه عمومی (مثل IT) به:

`data/generated/entity-quarantine.json`

می‌روند.

گزارش کامل همه جابه‌جایی‌ها:

`data/generated/entity-cleaning-report.json`

## Logical entity

برای واحدها و سامانه‌ها، duplicateهای امن بر اساس URL canonical و conceptهای دو زبانه ادغام می‌شوند و URLهای دیگر در:

`alternateUrls`

باقی می‌مانند.

## Lorestan Golden Guards

پکیج به‌صورت مشخص تست می‌کند که:

- «راهنمای سامانه‌های کتابخانه مرکزی» دیگر System نباشد.
- «راهنمای استفاده از گرنت در سامانه گلستان» System نباشد.
- صفحه «فرم‌ها و آیین‌نامه‌ها» Document مستقل نباشد.
- PDF واقعی Document بماند.
- صفحه کتابخانه از Organization به Library برگردد.

## تغییر Deep Audit

`build-deep-audit.mjs` حالا از `portal-document-reaudit.json` تمیزشده هم استفاده می‌کند.

در نتیجه:

- وجود یک Library page دیگر به تنهایی `organization=verified` نمی‌کند.
- Systems فقط با System واقعی/endpoint تأیید می‌شود.
- Document index می‌تواند وجود بخش اسناد را ثابت کند، اما خودش در Document Catalog نمایش داده نمی‌شود.

## اجرا — بدون Crawl

اول تست policy:

```bash
npm run test:entity-cleaning
```

بعد فقط Cleaning روی داده فعلی:

```bash
npm run clean:entities
npm run validate:entities
```

برای بازسازی کامل RTPMI و خروجی عمومی با همین داده موجود:

```bash
npm run release:check
npm run typecheck
npm run lint
npm run build
```

**`npm run discover:research` را اجرا نکن.**

## بررسی دانشگاه لرستان

بعد از اجرا:

```bash
node -e "const r=require('./data/generated/entity-cleaning-report.json'); console.log(JSON.stringify(r.lorestan,null,2))"
```

و در `data/generated/reference-pages.json` می‌توان مواردی را دید که از System/Document/Unit به Reference منتقل شده‌اند.

## فایل‌های پکیج

جایگزین:
- `package.json`
- `pipeline/config/pipeline.toml`
- `scripts/build-deep-audit.mjs`

جدید:
- `scripts/entity-cleaning-policy.mjs`
- `scripts/clean-entity-catalogs.mjs`
- `scripts/validate-entity-catalogs.mjs`
- `scripts/test-entity-cleaning.mjs`

هیچ فایل فعلی لازم نیست حذف شود.

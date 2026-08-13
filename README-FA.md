# ResearchPortal — Data Cleaning Engine v2.2.3

نسخه سیاست: `entity-cleaning-2.2.3-national-service-ownership`

این Hotfix روی v2.2.2 ساخته شده و منطق RTPMI/Findability را تغییر نمی‌دهد. تغییر اصلی، جداکردن مالکیت سامانه‌های ملی/وزارتی از سامانه‌های متعلق به دانشگاه است.

## قاعده جدید مالکیت

- `https://shaa.msrt.ir/` (شبکه آزمایشگاه‌های علمی ایران / شاعا) یک سرویس ملی وزارت علوم است و **سامانه دانشگاهی نیست**.
- هر رکورد با `relation = national-related-system` نیز به‌صورت پیش‌فرض سامانه دانشگاه شمرده نمی‌شود.
- این موارد از `data/systems/catalog.json` خارج می‌شوند، اما برای حفظ Evidence به `data/generated/reference-pages.json` منتقل می‌شوند.
- برای شاعا، Reference با این معنا ثبت می‌شود: `entityType=external-service`, `ownershipScope=ministry-national`, `primaryDimension=laboratories`, `relation=links-to`, `countTowardUniversitySystems=false`, `countTowardRTPMI=false`.
- Golden Guard مستقل مانع بازگشت `shaa.msrt.ir` به Systems در Crawlهای بعدی می‌شود، حتی اگر relation upstream اشتباه باشد.

## فایل‌های جایگزین

- `scripts/entity-cleaning-policy.mjs`
- `scripts/clean-entity-catalogs.mjs`
- `scripts/validate-entity-catalogs.mjs`
- `scripts/test-entity-cleaning.mjs`

فایل‌های RTPMI داخل این ZIP عمداً همان نسخه v2.2.2 هستند و تغییری در scoring ایجاد نمی‌کنند.

## اجرا در PowerShell

از root پروژه:

```powershell
git pull --ff-only

Expand-Archive `
  -Path "$HOME\Downloads\ResearchPortal-data-cleaning-engine-v2.2.3.zip" `
  -DestinationPath . `
  -Force

Set-Alias npm npm.cmd
npm run test:entity-cleaning
```

بعد pipeline کامل مشابه CI را اجرا کن، نه فقط legacy:

```powershell
npm run release:check
```

اگر PASS شد:

```powershell
node -e "const s=require('./data/systems/catalog.json'); console.log(s.filter(x=>String(x.url||'').includes('shaa.msrt.ir') || x.relation==='national-related-system'))"

node -e "const r=require('./data/generated/reference-pages.json'); console.log(r.filter(x=>String(x.url||'').includes('shaa.msrt.ir')))"
```

خروجی اول باید `[]` باشد. اگر شاعا در داده ورودی وجود داشته باشد، خروجی دوم باید آن را به‌عنوان `external-service` با شمارش صفر برای Systems/RTPMI نشان دهد.

سپس:

```powershell
git status --short
git add scripts/entity-cleaning-policy.mjs scripts/clean-entity-catalogs.mjs scripts/validate-entity-catalogs.mjs scripts/test-entity-cleaning.mjs
git add -u data public/datasets
git commit -m "Exclude national shared services from university systems"
git push origin main
```

قبل از commit اگر `npm run release:check` خطا داد، commit نکن و متن کامل خطا را ارسال کن؛ این دستور همان مسیر Python pipeline/validation مورد استفاده CI را اجرا می‌کند.


## اصلاح v2.2.6: مالکیت در سطح دامنه دانشگاه
در این نسخه مقایسه exact hostname برای تشخیص external-system کنار گذاشته شده است. زیر دامنه‌های یک دامنه دانشگاهی مانند `research.semnan.ac.ir`، `sampad.semnan.ac.ir`، `sima.semnan.ac.ir` و `centrallab.semnan.ac.ir` همگی متعلق به همان دامنه نهادی `semnan.ac.ir` محسوب می‌شوند. بنابراین سامانه‌های معتبر روی این زیر دامنه‌ها `entityType=system` و `ownershipScope=university` می‌گیرند. سامانه‌های ملی/وزارتی/تجاریِ شناخته‌شده همچنان به external-service reference منتقل می‌شوند و در RTPMI دانشگاه شمارش نمی‌شوند.

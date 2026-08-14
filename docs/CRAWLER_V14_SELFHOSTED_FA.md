# ResearchPortal — Crawler v14 / Self-hosted GitHub Actions

نسخه: `14.0-hub-interactive-relations`

مبنای ساخت: `main@b3f17d8c82f8a57f81239d56482fe8031aa4750e` و crawler v13 با SHA `0b19509b738ae7172a2f4eed42a795fbdad9514f`.

این بسته معماری قبلی Crawl را حفظ می‌کند: اجرای GitHub Actions روی Runner ویندوزی خودتان با labelهای `self-hosted, windows, iran-crawler`، استفاده از همان شبکه/VPN/دسترسی دانشگاهی سیستم، checkpoint هر ۳۰ دقیقه و Resume در اجرای بعدی.

## چه چیزی عوض شده است؟

- دامنه عمومی Crawl: depth=8، حداکثر 200 صفحه برای هر دانشگاه، 60 صفحه برای هر Hub، 24 Hub و 250 سند metadata-only.
- `informationTechnology` به‌طور کامل از runtime crawler حذف می‌شود.
- Browser fallback به‌جای صرفاً `--dump-dom`، روی کنترل‌های پژوهشی امن مثل tab/button/accordion کلیک محدود انجام می‌دهد. بودجه پیش‌فرض 6 action در هر صفحه است.
- login/register/submit/payment/delete کلیک نمی‌شوند؛ form submit انجام نمی‌شود و فایل سند دانلود نمی‌شود.
- Evidence دارای `entityHint`, `relationHint`, `ownershipHint`, `discoveryConfidence`, `semanticConfidence` می‌شود.
- سرویس‌های ملی/وزارتی/تجاری شناخته‌شده در بخش `references` ثبت می‌شوند و وارد evidence قابل ارتقای سامانه دانشگاه نمی‌شوند. `countTowardUniversitySystems=false` و `countTowardRTPMI=false` دارند.
- نمونه‌ها: SHAA/eMSHAA، SATE، SAJED/MAPFA و سایر `*.msrt.ir`، ISC/JCR، NAN، Gigalib/Gigapaper/Megapaper.
- action log نهایی در `data/generated/crawl-v14-actions.json` ساخته می‌شود.

## فایل‌های بسته

- `scripts/deep-crawl-research-v14.mjs` — entrypoint v14؛ v13 موجود در repo را در حافظه/فایل موقت به runtime v14 تبدیل و اجرا می‌کند.
- `scripts/crawler-v14-transform.mjs` — patch deterministic روی crawler فعلی.
- `scripts/crawler-v14-browser.mjs` — Chrome/Edge DevTools interaction محدود و امن.
- `scripts/test-crawler-v14.mjs` — source guards؛ قبل از Crawl شبکه‌ای اجرا می‌شود.
- `scripts/validate-crawler-v14.mjs` — validation خروجی خام بعد از تکمیل 115/115.
- `.github/workflows/audit.yml` — workflow self-hosted جایگزین.

## اعمال فایل‌ها

از root پروژه:

```powershell
git pull --ff-only

Expand-Archive `
  -Path "$HOME\Downloads\ResearchPortal-crawler-v14-selfhosted.zip" `
  -DestinationPath . `
  -Force

node scripts/test-crawler-v14.mjs
```

Source guard باید PASS شود و هیچ Crawl شبکه‌ای انجام نمی‌دهد.

سپس:

```powershell
git status --short
git add scripts/deep-crawl-research-v14.mjs scripts/crawler-v14-transform.mjs scripts/crawler-v14-browser.mjs scripts/test-crawler-v14.mjs scripts/validate-crawler-v14.mjs .github/workflows/audit.yml
git diff --cached --check
git commit -m "Add self-hosted research crawler v14"
git push origin main
```

## شروع Crawl

بعد از سبزشدن baseline validation، در GitHub:

`Actions → National Research Discovery & Evidence Monitor v14 → Run workflow`

Runner سیستم شما باید online باشد و label `iran-crawler` داشته باشد. اگر دسترسی دانشگاهی به VPN/IP/session سیستم وابسته است، همان session باید روی ماشین Runner برقرار باشد.

### Credential

رمز دانشگاه/VPN را داخل YAML یا repo قرار ندهید. این Crawler login form را خودکار submit نمی‌کند. برای دسترسی‌های مبتنی بر شبکه/VPN، session سیستم Runner کافی است. اگر روزی credential وب لازم شد باید جداگانه از GitHub Secrets/Windows Credential Manager طراحی شود، نه hard-code.

## Resume / checkpoint

هر دانشگاه فقط پس از اتمام کامل checkpoint می‌شود. هر 30 دقیقه crawler فقط `data/crawl-checkpoints` را commit/push می‌کند. اگر job در 6 ساعت تمام نشود یا سیستم قطع شود، اجرای بعدی fingerprint/version یکسان را می‌بیند و دانشگاه‌های کامل‌شده را دوباره Crawl نمی‌کند.

تغییر نسخه v13 به v14 عمداً fingerprint را عوض می‌کند؛ checkpointهای ناقص v13 با v14 مخلوط نمی‌شوند.

Checkpointها فقط وقتی حذف می‌شوند که:

`115/115 crawl → v14 raw validation → prepare:data → validate:data/entities/no-social → link monitoring`

همه موفق باشند.

## نکته CI

Workflow قبل از Crawl همچنان `npm run prepare:data` و validation baseline را اجرا می‌کند. اگر CI اصلی repository هنوز در `release_validation` قرمز باشد، Audit هم قبل از شروع Crawl متوقف می‌شود. این رفتار عمدی است تا crawler روی baseline نامعتبر اجرا نشود.

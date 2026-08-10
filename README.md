# رصدخانه ملی پرتال پژوهش و فناوری — ISC 115 / v8.1.0

**Iran Research & Technology Portal Observatory** یک پروژه متن‌باز، فارسی/RTL و Evidence-first برای رصد و مقایسه **پرتال عمومی معاونت پژوهش و فناوری** دانشگاه‌ها و مؤسسات دولتی حاضر در طبقه‌بندی ملی ISC است.

> **RTPMI رتبه عملکرد پژوهشی دانشگاه نیست.** این شاخص فقط بلوغ، شفافیت و قابلیت استفاده از سطح عمومی پرتال معاونت پژوهش و فناوری را با شواهد قابل ردیابی ارزیابی می‌کند.

## Source of Truth: دقیقاً ۱۱۵ عضو دولتی ISC

فهرست عضویت پروژه در `data/isc/institutions.json` قفل شده و بر مبنای طبقه‌بندی ملی ISC سال ۱۴۰۲–۱۴۰۱ است:

| طبقه ISC | تعداد |
|---|---:|
| جامع | 69 |
| صنعتی | 24 |
| علوم کشاورزی | 4 |
| هنر | 4 |
| زیرنظام | 4 |
| وابسته به دستگاه‌های اجرایی | 10 |
| **جمع** | **115** |

دانشگاه‌های غیردولتی ISC و دانشگاه‌های علوم پزشکی در Scope این پروژه نیستند. Validator در صورت کم/زیاد شدن حتی یک عضو یا تغییر تعداد طبقات Fail می‌شود.

## وضعیت ممیزی v8.1

- **115/115** نهاد ISC دارای Portal Resolution Outcome هستند؛ هیچ عضو بدون نتیجه ممیزی باقی نمانده است.
- **21** هویت پرتال/سطح مستقیم رسمی (`direct-official`).
- **18** پرتال دارای Deep Audit کافی و واجد Gate فعلی RTPMI.
- **3** پرتال مستقیم رسمی هنوز Deep Evidence کافی ندارند: دانشگاه بیرجند، دانشگاه بناب، دانشگاه علم و صنعت ایران.
- **6** نهاد با وضعیت دسترسی عمومی محدود/restricted بسته شده‌اند.
- **4** false-positive شناسایی و Block شده‌اند تا منبع اشتباه وارد Production نشود.
- **154** رکورد واحد/زیرمجموعه پژوهشی.
- **92** سامانه/خدمت.
- **34** سند/فرم/آیین‌نامه/شیوه‌نامه ساختاریافته.
- **362** رکورد Provenance.
- **115 Audit Packet مستقل**؛ یک فایل کامل برای هر عضو ISC.
- **18** پرتال رتبه‌پذیر و **97 Unranked**.
- **0** امتیاز ساختگی برای داده‌های حل‌نشده.

## هشت بُعد Deep Audit

برای هر ۱۱۵ نهاد، این ماتریس در `data/audit/deep-audit-matrix.json` وجود دارد:

1. هویت پرتال پژوهش و فناوری
2. ساختار سازمانی معاونت
3. کتابخانه و مرکز اسناد
4. آزمایشگاه مرکزی/پژوهشی و زیرساخت‌ها
5. ارتباط با صنعت، فناوری، نوآوری، TTO و IP
6. فناوری اطلاعات — فقط با Evidence سازمانی
7. سامانه‌ها و خدمات دیجیتال
8. آیین‌نامه‌ها، فرم‌ها، شیوه‌نامه‌ها، دستورالعمل‌ها و سایر اسناد

وضعیت هر خانه یکی از این موارد است:

- `verified`
- `observed-reference`
- `restricted`
- `unresolved`

`unresolved` به معنی «وجود ندارد» نیست.

## Audit Packet برای تک‌تک ۱۱۵ عضو

`data/audit/packets/<slug>.json` یک پرونده مستقل برای هر دانشگاه است و شامل این موارد می‌شود:

- هویت و رتبه/طبقه ISC
- نتیجه Portal Audit
- Evidence URLها
- ماتریس هشت‌بُعدی
- Audit Evidence Coverage
- واحدهای تابع/مرتبط ثبت‌شده
- سامانه‌ها و نوع رابطه آنها
- اسناد مستقیم و Parent Page
- RTPMI/Confidence در صورت واجد شرایط بودن
- توضیح صریح Missing/Unranked

## RTPMI 4.1 — مدل قابل بازتولید

وزن‌ها:

- اسناد و مقررات: 20%
- ساختار سازمانی: 12%
- کتابخانه/مدیریت دانش: 10%
- آزمایشگاه‌ها: 12%
- سامانه‌ها/بلوغ دیجیتال: 12%
- صنعت/فناوری: 12%
- کیفیت داده و Provenance: 12%
- یافت‌پذیری: 10%

Gate رتبه‌بندی:

- `portalAuditStatus = direct-official`
- Audit Evidence Coverage ≥ 75%
- Confidence ≥ 65%

**Missing rule:** بُعد `unresolved` از مخرج وزن حذف می‌شود و Confidence را پایین می‌آورد؛ به صفر تبدیل نمی‌شود.

تمام امتیازها با `scripts/finalize-rtpmi.mjs` از فایل‌های Versioned Data دوباره ساخته می‌شوند.

## ساختار داده

```text
data/
├── isc/
│   ├── institutions.json        # exact 115 ISC roster
│   ├── institutions.csv
│   └── source.json
├── audit/
│   ├── portal-audit.json        # 115/115 portal outcomes
│   ├── deep-audit-matrix.json   # 115 × 8
│   ├── packets/                 # 115 independent audit packets
│   └── packets-index.json
├── units/catalog.json
├── systems/catalog.json
├── documents/catalog.json
├── evidence/provenance-ledger.json
└── statistics/
    ├── portal-ranking.json
    ├── rtpmi-weights.json
    └── summary.json
```

CSV نسخه‌های اصلی نیز تولید می‌شوند.

## اجرا

```bash
npm install
cp .env.example .env.local
npm run release:check
npm run dev
```

## Pipeline

```bash
npm run audit:all       # health check برای URLهای ثبت‌شده
npm run prepare:data    # rebuild matrix/ranking/provenance/open data/packets/CSV
npm run validate:data
npm run release:check
```

`prepare:data` خروجی‌ها را از Source Data بازتولید می‌کند؛ Ranking فایل دستی نیست.

`audit:all` تمام URLهای منتشرشده در پرتال‌ها، واحدها، سامانه‌ها، اسناد و Provenance را بدون حدس‌زدن آدرس جدید بررسی می‌کند، تغییر سیگنال‌های HTTP را نسبت به اجرای قبل تشخیص می‌دهد و دو گزارش `site-health.json` و `change-report.json` می‌سازد. GitHub Actions این پایش را دو بار در هفته اجرا می‌کند.

## صفحات اصلی

- `/` داشبورد ملی
- `/isc-scope` Scope دقیق ISC
- `/universities` فهرست ۱۱۵ عضو
- `/universities/[slug]` پرونده Evidence هر دانشگاه
- `/audit` ماتریس 115×8
- `/rankings` RTPMI فقط برای Evidence-qualified portals
- `/compare` مقایسه چندبُعدی
- `/documents` Document Explorer
- `/evidence` Provenance Ledger
- `/datasets` Open Data
- `/api-docs` راهنمای API نسخه ۱
- `/methodology` روش‌شناسی

## API v1

- `GET /api/v1/universities` با فیلترهای `category`، `status`، `ranked`، `q`، `limit` و `offset`
- `GET /api/v1/universities/{slug}` برای پرونده کامل یک دانشگاه
- `GET /api/v1/rankings`
- `GET /api/v1/summary`
- `GET /api/v1/health`
- قرارداد OpenAPI در `/openapi.json`

تمام پاسخ‌ها Snapshot و نسخه روش‌شناسی را همراه دارند و API فقط خواندنی است.

## امنیت و Data Governance

- هیچ HTML خزیده‌شده مستقیم Render نمی‌شود.
- URL خارجی در UI با `noopener noreferrer` باز می‌شود.
- CSP و هدرهای امنیتی اعمال شده‌اند.
- GitHub CodeQL و Dependabot فعال‌اند.
- Crawler/health check آدرس حدسی برای نهاد بدون پرتال رسمی تولید نمی‌کند.
- false-positiveها به جای حذف شدن از تاریخچه، به صورت Blocked حفظ می‌شوند.
- Git history منبع Audit Trail تغییرات داده است.

## Deploy

Repository را در Vercel Import کنید و `NEXT_PUBLIC_SITE_URL` را تنظیم کنید. CI روی GitHub شامل validation، rebuild داده، typecheck، lint، Next build و dependency audit است. نسخه ۸.۱ دارای lockfile بازتولیدپذیر است.

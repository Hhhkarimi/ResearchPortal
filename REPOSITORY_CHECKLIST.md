# Repository-ready checklist

این بسته برای استخراج مستقیم در ریشه یک Repository خالی آماده شده است.

## راه‌اندازی اولیه

```bash
git init
npm ci
cp .env.example .env.local
npm run release:check
npm run typecheck
npm run lint
npm run build
```

سپس مقدار `NEXT_PUBLIC_SITE_URL` را در `.env.local` با دامنه واقعی جایگزین کنید.

## پیش از اولین انتشار

- نام مالک/سازمان و URL واقعی Repository را در بخش About تنظیم کنید.
- Branch protection را برای `main` فعال کنید.
- عبور CI و CodeQL را برای merge اجباری کنید.
- Secret scanning و Dependabot را فعال نگه دارید.
- دسترسی ویرایش فایل‌های `data/` را به بازبینان داده محدود کنید.
- یک دامنه نهایی در `NEXT_PUBLIC_SITE_URL` تنظیم کنید.
- نتیجه `npm run release:check` را همراه هر Snapshot ثبت کنید.

## چیزهایی که داخل بسته است

- کد کامل Next.js و lockfile بازتولیدپذیر
- ۱۱۵ رکورد مرجع ISC، ۱۱۵ بازبینی پژوهشی و ۱۱۵ Audit Packet
- رجیستر کامل ۹۲۰ outcome شواهد در JSON/CSV، Provenance Ledger و RTPMI 4.1
- API v1 و قرارداد OpenAPI
- Devcontainer کامل GitHub Codespaces و Taskهای آماده VS Code
- CI، CodeQL، Dependabot و پایش دوره‌ای لینک‌ها
- مستندات روش‌شناسی، استقرار، امنیت و حاکمیت مشارکت

`node_modules`، `.next`، فایل‌های محیط محلی و خروجی‌های موقت عمداً داخل ZIP نیستند و باید در محیط مقصد ساخته شوند.

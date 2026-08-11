# GitHub, Codespaces & Vercel Deployment — v9.0.0

## GitHub

```bash
git init
git add .
git commit -m "Release v9.0.0 - Evidence 115"
git branch -M main
git remote add origin YOUR_REPO_URL
git push -u origin main
```

برای توسعه بدون نصب محلی، در GitHub مسیر **Code → Codespaces → Create codespace on main** را بزنید. Devcontainer، Node 22، وابستگی‌ها، فایل محیط نمونه، اعتبارسنجی داده و Forward پورت ۳۰۰۰ را خودکار آماده می‌کند.

## Vercel

Repository را Import کنید. تنها متغیر پیشنهادی نسخه عمومی:

```env
NEXT_PUBLIC_SITE_URL=https://YOUR_DOMAIN
```

این مقدار برای canonical URL، sitemap و metadata است. Secret، دیتابیس یا API key لازم نیست. تنظیمات Build:

- Framework: Next.js
- Node.js: 22
- Install command: `npm ci`
- Build command: `npm run build`

## Release gate

```bash
npm run release:check
npm run typecheck
npm run lint
npm run build
```

این gate گزارش ۱۱۵ دانشگاه را به ۹۲۰ outcome تبدیل می‌کند و ماتریس، RTPMI، Provenance، Open Data، ۱۱۵ Audit Packet و ۹ خروجی CSV را بازتولید و اعتبارسنجی می‌کند.

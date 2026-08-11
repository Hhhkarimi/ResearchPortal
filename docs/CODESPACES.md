# توسعه با GitHub Codespaces

این Repository برای Codespaces آماده است و به نصب دستی Node.js نیاز ندارد.

## شروع

1. Repository را در GitHub باز کنید.
2. روی **Code** و سپس **Codespaces** بزنید.
3. گزینه **Create codespace on main** را انتخاب کنید.
4. پس از پایان `postCreateCommand`، Task «رصدخانه: اجرای محیط توسعه» را اجرا کنید یا در Terminal بنویسید:

```bash
npm run dev
```

پورت ۳۰۰۰ به‌طور خودکار Forward و Preview می‌شود.

## تغییر Evidence

پس از ویرایش فایل‌های منبع یا گزارش تحقیق:

```bash
npm run release:check
npm run typecheck
npm run lint
npm run build
```

`release:check` گزارش تحقیق ۱۱۵ دانشگاه را به داده ساختاریافته تبدیل می‌کند، رجیستر ۹۲۰ outcome را می‌سازد و تمام JSON/CSVها و Audit Packetها را دوباره تولید می‌کند.

## متغیر محیطی

در Codespaces فایل `.env.local` از `.env.example` ساخته می‌شود. برای انتشار واقعی مقدار زیر را با دامنه نهایی جایگزین کنید:

```env
NEXT_PUBLIC_SITE_URL=https://YOUR_DOMAIN
```

هیچ Secret یا API Key برای اجرای محلی لازم نیست.

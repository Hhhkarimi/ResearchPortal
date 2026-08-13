# Public document gate

این بسته اسناد دانشجویی/آموزشی/رفاهی را در خود لایه عمومی سایت فیلتر می‌کند.

فایل‌ها:
- lib/data.ts — جایگزین
- lib/research-document-scope.ts — جدید

اثر:
- /documents برای همه دانشگاه‌ها پاک می‌شود.
- بخش اسناد در پرونده هر دانشگاه از همین فهرست پاک استفاده می‌کند.
- URL سند ردشده از evidence عمومی نیز حذف می‌شود.
- بدون Crawl و بدون prepare:data هم بعد از build/deploy دیده نمی‌شوند.

اجرا:
```bash
npm run typecheck
npm run lint
npm run build
```

سپس commit/push کنید. crawler را اجرا نکنید.

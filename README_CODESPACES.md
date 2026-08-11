# Codespaces Hotfix — ResearchPortal

این پکیج فقط Hotfix لازم برای فعال‌شدن واقعی Deep Crawler است.

## مشکل قبلی چه بود؟

فایل‌های قابل‌مشاهده مثل `package.json` و `scripts/*` روی GitHub رفتند، اما دو فایل مخفی اصلی جایگزین نشدند:

- `.github/workflows/audit.yml`
- `.gitignore`

بنابراین GitHub Actions همچنان workflow قدیمی `National Evidence Link Monitor` را اجرا می‌کرد و Deep Crawler اصلاً اجرا نمی‌شد.

## نصب در GitHub Codespaces

ZIP را داخل Codespace قرار بده و در ترمینال از ریشه repository اجرا کن:

```bash
unzip ResearchPortal-Codespaces-HOTFIX.zip -d /tmp/researchportal-hotfix
bash /tmp/researchportal-hotfix/APPLY_CODESPACES.sh --push
```

اگر `unzip` پرسید فایل‌ها overwrite شوند، چون داخل `/tmp` استخراج می‌شود مشکلی نیست.

## بعد از Push

در GitHub برو:

Actions → National Research Discovery & Evidence Monitor → Run workflow

اسم workflow باید دقیقاً این باشد:

`National Research Discovery & Evidence Monitor`

اگر هنوز `National Evidence Link Monitor` را می‌بینی، Hotfix هنوز به `main` نرسیده است.

## اجرای درست چه Stepهایی دارد؟

1. Sanitize and rebuild current published evidence
2. Publish sanitized baseline
3. Deep crawl official research portals
4. Promote discovery and rebuild evidence datasets
5. Monitor published evidence links
6. Validate rebuilt datasets
7. Enforce no social evidence
8. Commit deep crawler results

## نکته

اسکریپت قبل از اعمال تغییرات:
- بررسی می‌کند داخل Git repo باشی.
- Working tree باید clean باشد.
- وجود Deep Crawler scripts را بررسی می‌کند.
- syntax سه فایل crawler را با Node چک می‌کند.
- `.github/workflows/audit.yml` و `.gitignore` را دقیقاً در مسیر اصلی repo قرار می‌دهد.

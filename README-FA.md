# ResearchPortal — Data Cleaning Engine v2.2.2

نسخه `entity-cleaning-2.2.2-news-path-canonical-labels`

این Hotfix روی v2.2 قرار می‌گیرد و Crawler را اجرا نمی‌کند. RTPMI/Findability v2.2 بدون تغییر حفظ شده‌اند.

## اصلاحات این Hotfix

1. **Post-merge semantic validation**: بعد از logical merge، هر رکورد دوباره طبقه‌بندی می‌شود. اگر merge باعث شود News/Service/Announcement به Unit نشت کند، رکورد به Reference منتقل می‌شود.
2. **Second logical-key collapse**: بعد از نرمال‌سازی display label، logical key دوباره محاسبه می‌شود تا duplicateهایی مثل Central Library تهران یکی شوند.
3. **Percent-encoded labels**: عنوان‌های `%DA%A9...` چندمرحله decode می‌شوند و دیگر به‌عنوان display label خام باقی نمی‌مانند.
4. **Display-label preference**: برای Unit، عنوان سازمانی کوتاه بر headline خبری/خدماتی ترجیح داده می‌شود.
5. **Missing label recovery**: رکوردهایی مثل انتشارات مرکزی لرستان، حتی اگر `nameFa` خالی باشد، از URL سازمانی label معتبر می‌گیرند.

Golden guards این چهار regression واقعی را پوشش می‌دهند: Arak encoded library، Semnan library news، Tehran library news/duplicate، Lorestan central publications missing label.

## اعمال در PowerShell

از root پروژه:

```powershell
git restore data public/datasets

Expand-Archive `
  -Path "$HOME\Downloads\ResearchPortal-data-cleaning-engine-v2.2.2.zip" `
  -DestinationPath . `
  -Force

Set-Alias npm npm.cmd
npm run test:entity-cleaning
npm run prepare:data:legacy
node scripts/validate-data.mjs
npm run validate:entities
npm run validate:no-social
npm run typecheck
npm run lint
npm run build
```

Crawler را هنوز اجرا نکن.

## QA هنگام ساخت

- همه فایل‌های `.mjs`: `node --check` PASS
- targeted entity tests: PASS
- fixture validation شامل 4 regression واقعی: PASS
- fixture result: Arak library label decoded، Semnan/Tehran news removed، Tehran central library deduplicated، Lorestan publishing label recovered.


## اصلاحات v2.2.2

- مسیرهای خبری فارسی مانند `/همه-اخبار/`، `/اخبار/` و `/رویدادها/` دیگر نمی‌توانند به‌عنوان Unit باقی بمانند، حتی اگر عنوان merge شده شبیه نام یک واحد باشد.
- نام‌های تکراری کتابخانه مرکزی بعد از merge canonical می‌شوند؛ مثال: `کتابخانه مرکزی ... کتابخانه مرکزی ...` به یک نام واحد تبدیل می‌شود.
- پسوندهای پوسته سایت/زبان مانند `معاونت پژوهش و فناوری فارسی` از نام canonical واحد حذف می‌شوند.
- RTPMI، coverage shrinkage و Findability همان v2.2 باقی مانده‌اند.

# Documents screening v3

این بسته سه مشکل را هم‌زمان حل می‌کند:

1. صفحه `/documents` روی دسکتاپ دقیقاً دو ستون می‌شود.
2. اسناد دانشجویی/آموزشی/رفاهی از نمایش عمومی حذف می‌شوند.
3. عنوان، نوع و حوزه سند از metadata موجود و نام فایل/URL بازسازی می‌شود.

## فایل‌ها

جایگزین:
- `lib/data.ts`
- `lib/research-document-scope.ts`
- `components/document-explorer.tsx`

جدید:
- `lib/document-enrichment.ts`
- `components/document-explorer.module.css`

## منطق عنوان

عنوان اصلی حذف نمی‌شود و در `originalTitle` می‌ماند.

اگر عنوان خام چیزی مثل «دانلود فایل»، «مشاهده فایل»، «سند»، `file` یا `attachment`
باشد، سیستم از `fileName` یا آخرین بخش URL استفاده می‌کند.

نمونه:
- `tajhizat pajoheshi.pdf` → `تجهیزات پژوهشی`
- `rahnama jostejo.pdf` → `راهنمای جستجو`
- `springer.pdf` → `Springer`
- `ieee.pdf` → `IEEE`

اگر نام فایل عددی یا بی‌معنی باشد، عنوان محتوایی جعلی ساخته نمی‌شود؛
فقط از context معتبر پژوهشی یک عنوان محافظه‌کارانه ساخته می‌شود.

## دسته‌بندی مجدد

- اخلاق پژوهش
- پایان‌نامه و رساله
- آزمایشگاه و تجهیزات پژوهشی
- کتابخانه و منابع علمی
- انتشارات و نشریات
- صنعت، فناوری و مالکیت فکری
- طرح‌ها، گرنت و پژوهانه
- اسناد و مقررات پژوهشی
- سایر اسناد پژوهشی

## بدون Crawl

هیچ Crawl جدیدی لازم نیست.

```bash
npm run typecheck
npm run lint
npm run build
```

اگر سبز بود:

```bash
git add lib/data.ts \
  lib/research-document-scope.ts \
  lib/document-enrichment.ts \
  components/document-explorer.tsx \
  components/document-explorer.module.css

git commit -m "fix(documents): screen, relabel and restore two-column layout"
git push origin main
```

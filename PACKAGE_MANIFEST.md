# ResearchPortal Deep Crawler Package

فایل‌های این پکیج را روی ریشه repo کپی کن.

## New
- `scripts/deep-crawl-research.mjs`
- `scripts/promote-discovery.mjs`
- `scripts/check-no-social-evidence.mjs`
- `docs/DEEP_RESEARCH_CRAWLER.md`

## Replace
- `.github/workflows/audit.yml`
- `.gitignore`
- `package.json`
- `scripts/audit-all-isc.mjs`

## No dependency change
`package-lock.json` را تغییر نده.

## Binary document storage
اصل فایل‌های دانلودشده روی Windows Runner در `C:\actions-runner\_research-documents` نگهداری می‌شوند؛ فقط metadata/hash وارد repo می‌شود.

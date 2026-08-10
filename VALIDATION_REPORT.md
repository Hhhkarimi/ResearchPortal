# Validation Report — v8.1.0 Living Reference Release

Snapshot: 2026-08-10

## Data integrity — PASSED

- Exact ISC public/government roster: **115/115**
- Category lock: **69 / 24 / 4 / 4 / 4 / 10**
- Portal Resolution Outcomes: **115/115**
- Rows with missing portal-resolution outcome: **0**
- Deep Audit Matrix: **115/115 (920 cells)**
- Per-institution Audit Packets: **115/115**
- Direct official portals/surfaces: **21**
- Deep-audited and RTPMI-ranked: **18**
- Unranked without synthetic score: **97**
- Synthetic Production Scores: **0**

## Structured evidence — PASSED

- Units/subunits: **154**
- Systems/services: **92**
- Documents/forms/regulations: **34**
- Provenance records: **362**
- Catalog items outside the ISC roster: **0**
- Verified catalog items without a provenance URL: **0**

## Product surface — PASSED

- Production pages/routes generated: **252**
- Static university profiles: **115**
- Static university API profiles: **115**
- API v1 endpoints: universities, profile, rankings, summary and health
- OpenAPI 3.1 contract: valid JSON
- Responsive navigation, search/filter views and keyboard-labelled controls included

## Reproducibility gates — PASSED

- `npm run release:check`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

The release gate rebuilt the Deep Audit Matrix, RTPMI 4.1, Provenance Ledger, national summary, JSON Open Data, 115 Audit Packets and eight CSV exports before validation. The restricted packaging kernel required the included RSS-read compatibility preload for the local Next build; compilation, TypeScript, prerendering and final route generation all completed successfully.

## Interpretation safeguards

- `unresolved` != absent
- observed/reference != verified subordination
- SHAA is a national related laboratory network/system
- IT is attributed to the Research/Technology VP only with organizational evidence
- ISC rank != RTPMI portal rank
- Missing dimensions are never automatically converted to zero
- Link failure != absence of a university service

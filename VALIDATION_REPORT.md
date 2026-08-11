# Validation Report — v9.0.0 Evidence 115

Snapshot: 2026-08-10

## Data integrity — PASSED

- Exact ISC public/government roster: **115/115**
- Category lock: **69 / 24 / 4 / 4 / 4 / 10**
- Research reviews: **115/115**
- Dimension evidence outcomes: **920/920**
- Published evidence status counts: **138 verified / 90 observed-reference / 32 restricted / 660 unresolved**
- Research-report outcomes adjusted by the publication gate: **81**
- Direct-to-reference adjustments: **33**; restricted-without-URL to unresolved: **48**
- Every institution has exactly eight unique dimension outcomes: **PASSED**
- Verified outcome without a source URL: **0**
- Verified IT outcome without an organizational-relation source: **0**
- Restricted-only institution incorrectly counted as Evidence coverage: **0**
- Invalid or duplicate dimension outcome IDs: **0**
- Portal-resolution outcomes: **115/115**
- Deep Audit Matrix: **115/115**
- Per-institution Audit Packets: **115/115**
- RTPMI-ranked: **18**; unranked without synthetic score: **97**

## Structured evidence — PASSED

- Units/subunits: **154**
- Systems/services: **92**
- Documents/forms/regulations: **34**
- Provenance records: **362**
- Dimension evidence source references: **323**
- Unique URLs represented in the dimension registry: **108**
- JSON/CSV dataset exports: **9**

## Product surface — PASSED

- Production pages/routes generated: **253**
- Static university profiles: **115**
- Static university API profiles: **115**
- Evidence endpoint: `GET /api/v1/evidence`
- OpenAPI 3.1 contract: valid JSON
- Runtime smoke test: home, audit, evidence, rankings, datasets, university profile, evidence API, university API and OpenAPI returned HTTP 200
- Health API confirmed **115 reviews** and **920 outcomes**
- Persian digit helpers: **PASSED**
- Codespaces JSON, shell syntax and executable setup script: **PASSED**

## Reproducibility & security gates — PASSED

- `npm run release:check`
- `npm run typecheck`
- `npm run lint` — zero errors and zero warnings
- `npm run build`
- `npm audit --audit-level=high` — zero vulnerabilities

## Interpretation safeguards

- `unresolved` != absent or zero
- observed/reference != verified subordination
- IT is attributed to the Research/Technology VP only with organizational evidence
- ISC rank != RTPMI portal rank
- Link failure != absence of a university service
- RTPMI remains a portal maturity/transparency measure, not a scientific-quality ranking

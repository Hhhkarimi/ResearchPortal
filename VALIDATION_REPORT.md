# Validation Report — v10.0.0 Portal & Document Re-audit 115

Snapshot: 2026-08-11

## Data integrity — PASSED

- Exact ISC public/government roster: **115/115**
- Category lock: **69 / 24 / 4 / 4 / 4 / 10**
- Research reviews: **115/115**
- Dimension evidence outcomes: **920/920**
- Published evidence status counts: **104 verified / 151 observed-reference / 31 restricted / 634 unresolved**
- Research-report outcomes adjusted by the publication gate: **48**
- Portal-root reuse—including normalized URL variants—or IT without organizational proof promoted to verified: **0**
- Restricted-without-URL to unresolved adjustments: **48**
- Every institution has exactly eight unique dimension outcomes: **PASSED**
- Verified outcome without a source URL: **0**
- Verified IT outcome without an organizational-relation source: **0**
- Restricted-only institution incorrectly counted as Evidence coverage: **0**
- Invalid or duplicate dimension outcome IDs: **0**
- Portal-resolution outcomes: **115/115**
- Deep Audit Matrix: **115/115**
- Per-institution Audit Packets: **115/115**
- Portal/document re-audit rows: **115/115**; Bojnord correction: **PASSED**
- RTPMI-ranked: **19**; unranked without synthetic score: **96**

## Structured evidence — PASSED

- Units/subunits: **154**
- Systems/services: **92**
- Documents/forms/regulations/indexes: **60**
- Provenance records: **462**
- Dimension evidence source references: **411**
- Unique URLs represented in the dimension registry: **158**
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

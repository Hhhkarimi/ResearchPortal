# Changelog

## 10.0.0 — Portal & Document Re-audit 115

- Re-ran portal discovery for all 115 ISC institutions and document-specific discovery for every institution, prioritizing official university domains.
- Corrected the University of Bojnord Research & Technology Vice-Presidency portal to `https://vr.ub.ac.ir/`.
- Added a machine-readable 115-row portal/document re-audit registry and a deterministic importer into audit, evidence, document, Open Data and per-university packet outputs.
- Classified document records by form/regulation/guideline type and by research ethics, grants, publications, laboratory, industry/technology/IP, postgraduate/research affairs and other topics.
- Added self-hosted Vazirmatn Variable across the complete UI, a persistent system-aware light/dark theme and expanded university/document sorting.
- Preserved publication safeguards: a portal root proves portal identity only; every other dimension still requires its own official source.
- Kept the release ready for GitHub Codespaces, CI and Vercel without a required database or secret.

## 9.0.0 — Evidence 115 & Visual Stories

- Added a reproducible 115-institution research review and a complete 920-outcome dimension evidence registry.
- Preserved uncertainty explicitly: a reproducibility gate makes 81 conservative adjustments, leaving 138 published verified, 90 references, 32 restricted-with-URL and 660 unresolved outcomes.
- Embedded the eight evidence outcomes and source URLs into all 115 university profiles and audit packets.
- Added JSON/CSV Open Data exports and the filterable `GET /api/v1/evidence` endpoint with OpenAPI documentation.
- Added a Persian-digit presentation layer while preserving Latin technical identifiers inside code and API examples.
- Introduced the 115-star evidence constellation, eight-dimension spectrum and RTPMI podium visual stories.
- Added a complete GitHub Codespaces devcontainer, setup automation and VS Code tasks.

## 8.1.0 — Living Reference & Experience Release

- Rebuilt the public experience around three journeys: university, policymaker and researcher.
- Added instant university discovery, responsive filters, evidence-aware status copy and mobile navigation.
- Replaced fixed ranking/compare views with interactive search, category filters and 2–4 portal comparison.
- Redesigned all 115 university profiles with share actions, evidence maps, source links and corrected catalog URL rendering.
- Added a filterable 115×8 national evidence map and a source-linked document explorer.
- Added versioned REST API v1, OpenAPI 3.1, API reference and health endpoint.
- Expanded link monitoring from direct portal URLs to every published evidence URL, with change detection and twice-weekly automation.
- Added a reproducible npm lockfile and verified 252 production routes/pages.
- Preserved the central interpretation firewall: RTPMI measures portal maturity only; unresolved is never silently converted to zero.

## 8.0.0 — ISC 115 Deep Completion

- Locked exact project membership to the 115 public/government institutions in the ISC 1402–1401 national classification.
- Completed portal-resolution outcomes for 115/115; no `unresolved-public-portal` outcome remains.
- Added an 8-dimension Deep Audit Matrix for every ISC member.
- Added reproducible RTPMI 4.1; unresolved dimensions are excluded from active denominator and reduce confidence rather than becoming zero.
- Added 115 independent Audit Packets.
- Added JSON + CSV Open Data exports.
- Added Provenance Ledger, Deep Audit UI, Evidence UI and per-university packet downloads.
- Added ISC category/rank to every university profile, separate from RTPMI.
- Added Dataset JSON-LD, Web manifest, OG image and expanded sitemap.
- Hardened CSP by removing `unsafe-eval` in production.
- CI now uses the public npm registry without relying on a lockfile/cache that cannot be generated in the packaging runtime.

## 7.0.0 — ISC-aligned scope

- Replaced legacy manual inventory with exact ISC public/government roster.

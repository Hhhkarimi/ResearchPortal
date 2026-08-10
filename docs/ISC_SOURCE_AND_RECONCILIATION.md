# ISC Source & Reconciliation Report — v7.0

Snapshot: 2026-08-10

## Source of truth

The university/institution universe is locked to the **115 public institutions** in the ISC national classification for 1402–1401, approved in the Higher Education Expansion Council on 1404/01/24.

Source metadata is stored in `data/isc/source.json`. The exact extracted roster is in `data/isc/institutions.json` and `data/isc/institutions.csv`.

## Exact category lock

- جامع: 69
- صنعتی: 24
- علوم کشاورزی: 4
- هنر: 4
- زیرنظام: 4
- دستگاه اجرایی: 10
- **Total: 115**

Private/non-governmental institutions in the ISC publication are excluded from this package. Medical universities are not introduced into the roster.

## Reconciliation rule

No manually maintained legacy university list is allowed to add or delete an institution. `scripts/validate-data.mjs` fails the release if the total or any category count diverges from 115 / 69 / 24 / 4 / 4 / 4 / 10.

## Portal audit snapshot

- direct-official: 21
- official-reference: 19
- unresolved-public-portal: 75

Every one of the 115 ISC members has an Audit Register row. `unresolved-public-portal` means that a direct public Research & Technology VP portal has not yet been proven from sufficient public evidence; it **does not mean the vice-presidency does not exist**.

## Ranking firewall

ISC category/rank and RTPMI are independent. ISC rank is preserved as published classification metadata. RTPMI is published only for evidence-qualified direct public research portals; unresolved or official-reference-only institutions are Unranked rather than assigned a fabricated zero.

# RTPMI 4.2 — Reproducible portal-maturity methodology

RTPMI evaluates the public maturity, transparency and usability of each university's Research and Technology Vice-Presidency portal. It does not measure research quality or university performance.

## Public evidence model

Every one of the 115 ISC institutions has exactly seven independently reviewable outcomes:

1. portal identity;
2. organizational structure;
3. library and documents;
4. laboratories;
5. industry and technology;
6. research systems and services;
7. documents and regulations.

This produces 805 outcomes. Information technology is no longer a standalone public dimension; a relevant record must map to organizational structure or research systems and services. An unresolved outcome means that sufficient public evidence was not resolved in the snapshot, not that the capability is absent.

## Ranking gate

A numeric rank is produced only when:

1. portal identity is `direct-official`;
2. Deep Audit Evidence Coverage is at least 75%;
3. final Confidence is at least 65%.

All other ISC members remain visible as `Unranked`.

## Weighting

| Metric | Weight |
|---|---:|
| Documents/regulations | 20% |
| Organizational transparency | 12% |
| Library/knowledge services | 10% |
| Laboratories | 12% |
| Research systems/services | 12% |
| Industry/technology | 12% |
| Data quality/provenance | 12% |
| Findability | 10% |

## Missing-data treatment

Unresolved dimensions are excluded from the active weighted denominator. They lower Evidence Coverage and Confidence and may prevent ranking; they are never converted to zero.

## Snapshot comparison

`scripts/build-snapshot-diff.mjs` compares the current final datasets with the latest earlier directory in `data/snapshots/`. Evidence coverage is recomputed for both snapshots on the same seven-dimension public model, so a methodology change cannot be presented as an observed improvement. After comparison, current inputs are archived under `data/snapshots/<snapshot-date>/` for the next reproducible run.

## Reproduction

```bash
npm run pipeline:run
npm run validate:v11
```

The scoring engine rebuilds rankings; the snapshot stage rebuilds the summary, diff, compact global search index, public datasets, audit packets and CSV exports.

# RTPMI 4.1 — Reproducible portal-maturity methodology

RTPMI evaluates the public Research & Technology Vice-Presidency portal ecosystem. It is independent from ISC's national university performance ranking.

## Ranking gate

A numeric rank is produced only when:

1. portal identity is `direct-official`;
2. Deep Audit Evidence Coverage ≥ 75%;
3. final Confidence ≥ 65%.

All other ISC members stay visible as `Unranked`.

## Weighting

| Dimension | Weight |
|---|---:|
| Documents/regulations | 20% |
| Organizational transparency | 12% |
| Library/knowledge services | 10% |
| Laboratories | 12% |
| Digital systems | 12% |
| Industry/technology | 12% |
| Data quality/provenance | 12% |
| Findability | 10% |

## Missing-data treatment

Unresolved dimensions are **excluded from the active weighted denominator**. They lower Audit Evidence Coverage/Confidence and may prevent ranking. They are not converted to zero.

## Reproduction

Run:

```bash
npm run prepare:data
```

The scoring engine rebuilds `data/statistics/portal-ranking.json` from the versioned Audit Matrix, Units, Systems and Documents catalogs.

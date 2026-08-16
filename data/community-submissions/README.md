# Community source submissions

This directory is the Git-backed queue for public source suggestions.

- `pending/YYYY-MM-DD/*.json`: untrusted web submissions waiting for automated review.
- `accepted/YYYY-MM-DD/*.json`: official-domain sources that passed automated verification and the repository pipeline.
- `reference/YYYY-MM-DD/*.json`: potentially useful links that were not safe enough for automatic publication.
- `rejected/YYYY-MM-DD/*.json`: invalid, unavailable, unrelated, or disallowed submissions.
- `error/YYYY-MM-DD/*.json`: submissions that could not be verified after the configured retry budget.

Public submission text is never authoritative evidence by itself. Automatic publication is restricted to URLs on a trusted official university/research host and still must pass the existing promotion, cleaning, and validation pipeline.

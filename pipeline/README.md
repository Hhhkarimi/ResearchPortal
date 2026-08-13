# ResearchPortal pipeline package

Python 3.11+ orchestration for the existing Node transformation engine. See
`docs/DATA_PIPELINE.md` for architecture, contracts, operation and migration.

Local verification:

```bash
npm run pipeline:test
npm run pipeline:plan
npm run pipeline:validate
```

Generated artifacts and workspaces live under `.pipeline/` by default and are
ignored by Git. Set `PIPELINE_ARTIFACT_ROOT` to durable storage in production.

# PostgreSQL architecture

The production model is snapshot-first and append-only. A published snapshot is
an immutable release envelope; university identity is stable, while audits,
dimension outcomes, evidence and ranking results are versioned facts.

## Install safely

1. Keep `DATA_BACKEND=json`.
2. Set the server-only `DATABASE_URL` and pool settings from `.env.example`.
3. Run `npm run db:migrate` with a schema-owner connection.
4. Run `npm run db:import` with `SNAPSHOT_RELEASE_KEY` and
   `SNAPSHOT_AS_OF_DATE`. The default import creates a draft.
5. Run `npm run db:validate`.
6. Repeat the import in a disposable database during deployment rehearsal.
7. Run `npm run db:publish` only for an approved draft. Publication revalidates
   and atomically switches the current snapshot.
8. Use `DATA_BACKEND=shadow` while application queries are compared with JSON.
   Do not switch to `postgres` until API parity is established.

## Migration guarantees

- migration checksums prevent editing an already-applied migration;
- an advisory lock prevents concurrent migration/import/publish jobs;
- every child row is constrained to the same snapshot as its parent;
- one partial unique index permits exactly one current snapshot;
- published and superseded fact rows reject updates and deletes;
- ranking methodology and source-effective dates remain historical facts;
- raw eight-dimension evidence remains stored while methodology metadata marks
  the seven public dimensions.

## Migration files

- `0001_core.sql`: snapshots, universities, vocabularies and methodologies.
- `0002_audits_evidence.sql`: audit runs, dimension outcomes and evidence graph.
- `0003_rankings.sql`: ranking runs, metric weights, results and metric scores.
- `0004_indexes_views_publication.sql`: hot-path indexes, current views,
  validation, publication and immutability guards.

## Operational rules

- PostgreSQL 16+ is recommended.
- The web role must be read-only; use a different credential for migrations and
  ingestion.
- Use a transaction-mode pooler in serverless deployments and keep each process
  pool small.
- Enable PITR and perform restore drills.
- Treat JSON/CSV files as the rollback source during the shadow phase. Once the
  database becomes authoritative, export public JSON/CSV from a published
  snapshot rather than importing files at runtime.
- Never change an applied migration. Add a new migration.

## Current import mapping

The importer deliberately records different source dates and methodologies:

- portal/review data can be effective on 2026-08-12;
- deep audit/ranking data can be effective on 2026-08-11;
- existing ranking results stay labeled `RTPMI-4.1-ISC`;
- `PUBLIC-EVIDENCE-4.2` controls the public-dimension policy without renaming
  historical ranking results.

## Cutover boundary

This package installs the schema, importer, validator and server-only database
adapter. It does not replace the existing API/data imports yet. That separation
is intentional: first import and compare in shadow mode, then move endpoint
reads behind a repository adapter in a separate reversible release.

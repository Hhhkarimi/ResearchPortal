# Community source submission installation

## Files

Copy the bundle paths over the repository root. Existing files replaced by this bundle:

- `.env.example`
- `components/header.tsx`

New files:

- `app/submit/page.tsx`
- `app/submit/submit.module.css`
- `components/submission-form.tsx`
- `app/api/v1/submissions/route.ts`
- `scripts/process-community-submissions.mjs`
- `scripts/test-community-submissions.mjs`
- `.github/workflows/community-refresh.yml`
- `data/community-submissions/README.md`

No package dependency is added and no PostgreSQL/Supabase/Firebase database is required.

## Production secrets

Configure these only in the server-side environment of the Next.js deployment:

```text
GITHUB_SUBMISSION_REPOSITORY=Hhhkarimi/ResearchPortal
GITHUB_SUBMISSION_BRANCH=main
GITHUB_SUBMISSION_TOKEN=<fine-grained repository token>
COMMUNITY_SUBMISSION_IP_SALT=<long random secret>
COMMUNITY_DAILY_PER_IP=5
COMMUNITY_DAILY_TOTAL=200
```

`GITHUB_SUBMISSION_TOKEN` must never have a `NEXT_PUBLIC_` prefix. Give it access only to this repository with Contents read/write permission. The public API writes only under `data/community-submissions/pending/...`.

Generate the salt on Windows PowerShell, for example:

```powershell
[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLower()
```

## Local validation

From a fresh clone:

```bat
node --check scripts\process-community-submissions.mjs
node scripts\test-community-submissions.mjs
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

The processor can be run manually after pending JSON submissions exist:

```bat
node scripts\process-community-submissions.mjs
```

Then, if it accepts at least one source, use the same repository pipeline and validators:

```bat
npm.cmd run prepare:data
npm.cmd run validate:data
npm.cmd run validate:no-social
```

## Commit

```bat
git add -A
git status --short
git commit -m "feat: add Git-backed community source submissions"
git push origin main
```

## Data flow

```text
/submit
  -> POST /api/v1/submissions
  -> data/community-submissions/pending/YYYY-MM-DD/*.json
  -> daily community-refresh workflow
  -> official-domain verification
  -> discovery-evidence / discovered-documents candidate
  -> existing prepare:data cleaning pipeline
  -> existing validators
  -> accepted/reference/rejected/error archive + final data commit
```

A user description is never treated as authoritative evidence and is never used as the published title. Non-official domains are not fetched by the automated processor and are archived as references for manual review.

# GitHub + Vercel Deployment — v8.1.0

## GitHub

```bash
git init
git add .
git commit -m "Release v8.1.0 - living national observatory"
git branch -M main
git remote add origin YOUR_REPO_URL
git push -u origin main
```

Recommended repository controls:

- branch protection on `main`
- require CI and CodeQL checks
- secret scanning
- Dependabot
- review required for changes under `data/`

## Vercel

Import the repository and configure:

```env
NEXT_PUBLIC_SITE_URL=https://YOUR_DOMAIN
```

Runtime/build assumptions:

- Node 22
- Build command: `npm run build`
- Install command: default npm install
- Framework: Next.js

## Data release gate

Before deploy:

```bash
npm run release:check
npm run typecheck
npm run lint
npm run build
```

`release:check` rebuilds all generated data before validating the exact ISC roster, Deep Audit Matrix, Ranking Gate, 115 Audit Packets, provenance and CSV exports.

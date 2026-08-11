#!/usr/bin/env bash
set -euo pipefail

npm ci --no-audit --no-fund

if [[ ! -f .env.local ]]; then
  cp .env.example .env.local
fi

npm run validate:data

echo "Codespace ready. Run: npm run dev"

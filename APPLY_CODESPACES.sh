#!/usr/bin/env bash
set -euo pipefail

PUSH=0
if [[ "${1:-}" == "--push" ]]; then
  PUSH=1
fi

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "ERROR: Run this script from inside the ResearchPortal git repository."
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

cd "$REPO_ROOT"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: Working tree is not clean."
  echo "Commit or stash existing changes first, then run this script again."
  git status --short
  exit 1
fi

required=(
  "scripts/deep-crawl-research.mjs"
  "scripts/promote-discovery.mjs"
  "scripts/check-no-social-evidence.mjs"
)

for f in "${required[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: Missing $f"
    echo "The earlier Deep Crawler package is not fully present on main."
    exit 1
  fi
done

echo "Updating main..."
git checkout main
git pull --ff-only origin main

mkdir -p .github/workflows

cp "$SCRIPT_DIR/.github/workflows/audit.yml" ".github/workflows/audit.yml"
cp "$SCRIPT_DIR/.gitignore" ".gitignore"

echo "Checking crawler syntax..."
node --check scripts/deep-crawl-research.mjs
node --check scripts/promote-discovery.mjs
node --check scripts/check-no-social-evidence.mjs

echo "Checking patch..."
git diff --check

echo
echo "Files changed:"
git status --short

git add .github/workflows/audit.yml .gitignore

if git diff --cached --quiet; then
  echo "No hotfix changes are needed; files already match."
else
  git commit -m "fix(crawl): wire deep discovery workflow"
fi

if [[ "$PUSH" -eq 1 ]]; then
  echo
  echo "Pushing main..."
  git push origin main
  echo
  echo "DONE."
  echo "Now open GitHub Actions and run:"
  echo "  National Research Discovery & Evidence Monitor"
else
  echo
  echo "Commit created locally."
  echo "To push:"
  echo "  git push origin main"
  echo
  echo "Or run:"
  echo "  bash \"$SCRIPT_DIR/APPLY_CODESPACES.sh\" --push"
fi

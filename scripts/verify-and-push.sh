#!/usr/bin/env bash
# One-click: install deps, build, and verify the app builds successfully.
# Usage: bash scripts/verify-and-push.sh
set -euo pipefail

echo "▶ Installing dependencies (npm ci if lockfile exists, else npm install)…"
if [ -f package-lock.json ]; then
  npm ci --no-audit --no-fund --legacy-peer-deps
else
  npm install --no-audit --no-fund --legacy-peer-deps
fi

echo "▶ Building project (vite build)…"
npm run build

if [ ! -d "dist" ]; then
  echo "✖ Build did not produce a dist/ folder"
  exit 1
fi
echo "✔ Build succeeded — dist/ is ready"

echo ""
echo "Next: push to GitHub"
echo "  git add -A"
echo "  git commit -m \"chore: verified build\""
echo "  git push origin main"

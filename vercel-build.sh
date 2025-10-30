#!/usr/bin/env bash
set -euo pipefail

node -v || true
npm -v || true

# 1) Ensure lockfile exists (or create it)
if [ ! -f package-lock.json ]; then
  echo "Generating package-lock.json via npm install --package-lock-only"
  npm install --package-lock-only
fi

# 2) Install deps (prefer ci when lockfile exists)
if [ -f package-lock.json ]; then
  echo "npm ci"
  npm ci --no-audit --fund=false
else
  echo "npm install"
  npm install --no-audit --fund=false
fi

# 3) Run build if present
if node -e "try{process.exit(require('./package.json').scripts && require('./package.json').scripts.build ? 0 : 1)}catch(e){process.exit(1)}"; then
  echo "npm run build"
  npm run build
else
  echo "No build script - skipping"
fi

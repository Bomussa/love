#!/usr/bin/env bash
set -euo pipefail

# Ensure Node is available (Vercel provides it)
node -v
npm -v

# 1) If there's no lockfile, create one
if [ ! -f package-lock.json ]; then
  echo "🔧 No package-lock.json found — generating with 'npm install --package-lock-only'"
  npm install --package-lock-only
fi

# 2) Install dependencies
if [ -f package-lock.json ]; then
  echo "🚀 Installing with npm ci"
  npm ci --no-audit --fund=false
else
  echo "🚀 Installing with npm install"
  npm install --no-audit --fund=false
fi

# 3) Build
if [ -f package.json ]; then
  if jq -re '.scripts.build' package.json >/dev/null 2>&1; then
    echo "🏗️  Running npm run build"
    npm run build
  else
    echo "ℹ️  No build script — skipping"
  fi
fi

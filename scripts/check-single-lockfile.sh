#!/usr/bin/env bash
set -euo pipefail

mapfile -t lockfiles < <(find . -type f \( -name 'pnpm-lock.yaml' -o -name 'package-lock.json' -o -name 'yarn.lock' \) -not -path './node_modules/*' -not -path './frontend/node_modules/*' | sed 's#^\./##' | sort)

count="${#lockfiles[@]}"

if [[ "$count" -ne 1 ]]; then
  echo "❌ Expected exactly 1 lockfile in repository, found $count"
  printf ' - %s\n' "${lockfiles[@]}"
  exit 1
fi

if [[ "${lockfiles[0]}" != "pnpm-lock.yaml" ]]; then
  echo "❌ Official lockfile must be pnpm-lock.yaml at repository root"
  printf ' - Found: %s\n' "${lockfiles[0]}"
  exit 1
fi

echo "✅ Lockfile policy passed: ${lockfiles[0]}"

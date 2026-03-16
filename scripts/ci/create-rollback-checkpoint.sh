#!/usr/bin/env bash
set -euo pipefail

mkdir -p artifacts

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required for DB snapshot" >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump is required but not installed" >&2
  exit 1
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
SNAPSHOT="artifacts/db-snapshot-${STAMP}.sql"
TAG="prod-checkpoint-${STAMP}-${GITHUB_SHA:-local}"

pg_dump --no-owner --no-privileges "$DATABASE_URL" > "$SNAPSHOT"

echo "snapshot_path=$SNAPSHOT" >> "$GITHUB_OUTPUT"
echo "deployment_tag=$TAG" >> "$GITHUB_OUTPUT"
echo "Created rollback checkpoint: $SNAPSHOT"

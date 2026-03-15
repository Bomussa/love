#!/usr/bin/env bash
set -euo pipefail

MIGRATIONS_DIR="supabase/migrations"
PATTERN='^[0-9]{14}_[a-z0-9_]+\.sql$'

mapfile -t files < <(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' -printf '%f\n' | sort)

if [ "${#files[@]}" -eq 0 ]; then
  echo "No migration files found in $MIGRATIONS_DIR"
  exit 1
fi

invalid=0
for f in "${files[@]}"; do
  if [[ ! "$f" =~ $PATTERN ]]; then
    echo "Invalid migration filename: $f"
    invalid=1
  fi
done

if [ "$invalid" -ne 0 ]; then
  echo "Migration filename convention error. Expected: YYYYMMDDHHMMSS_description.sql"
  exit 1
fi

# Ensure deterministic sort order is already canonical and unique
sorted_unique_count=$(printf '%s\n' "${files[@]}" | sort -u | wc -l | tr -d ' ')
all_count=${#files[@]}
if [ "$sorted_unique_count" -ne "$all_count" ]; then
  echo "Duplicate migration filenames detected"
  exit 1
fi

echo "Migration naming check passed (${all_count} files)."

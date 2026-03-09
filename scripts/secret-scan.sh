#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-staged}"

TARGET_PATHS=("frontend" "scripts" "docs")

# Resolve files to scan
if [[ "$MODE" == "staged" ]]; then
  mapfile -t FILES < <(git diff --cached --name-only --diff-filter=ACMR | awk '/^(frontend|scripts|docs)\//' | awk '!/^(frontend\/dist\/|frontend\/src\/assets\/index-.*\.js$)/')
elif [[ "$MODE" == "all" ]]; then
  mapfile -t FILES < <(git ls-files frontend scripts docs | awk '!/^(frontend\/dist\/|frontend\/src\/assets\/index-.*\.js$)/')
else
  echo "Unknown mode: $MODE (expected: staged|all)" >&2
  exit 2
fi

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "No files to scan in frontend/scripts/docs"
  exit 0
fi

# Prefer gitleaks when available
if command -v gitleaks >/dev/null 2>&1; then
  echo "Running gitleaks on selected files..."
  printf '%s\n' "${FILES[@]}" | xargs -r gitleaks detect --no-git --redact --source
  exit 0
fi

# Fallback regex scanner (equivalent lightweight guard)
echo "gitleaks not found; running fallback regex secret scan..."
PATTERN='(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sbp_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z\-_]{35}|xox[baprs]-[0-9A-Za-z-]{10,}|eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,})'

if rg -n --pcre2 "$PATTERN" "${FILES[@]}"; then
  echo "❌ Potential secrets detected. Remove or move to env vars." >&2
  exit 1
fi

echo "✅ Secret scan passed"

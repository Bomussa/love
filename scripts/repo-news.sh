#!/usr/bin/env bash
set -euo pipefail

REPO_SLUG="${REPO_SLUG:-Bomussa/love}"
OUT="reports/LATEST_NEWS.md"
mkdir -p reports

now_utc="$(date -u +"%Y-%m-%d %H:%M:%S UTC")"

# Commits (آخر 15)
commits_json="$(gh api -H "Accept: application/vnd.github+json" \
  "/repos/${REPO_SLUG}/commits?per_page=15")"

# PRs (أحدث 15)
prs_json="$(gh pr list -R "${REPO_SLUG}" --state all -L 15 \
  --json number,title,state,headRefName,updatedAt,mergedAt,createdAt,author)"

# Workflow runs (أحدث 10)
runs_json="$(gh run list -R "${REPO_SLUG}" -L 10 \
  --json databaseId,displayTitle,workflowName,status,conclusion,createdAt,event,headBranch)"

# فروع موجزة
branches_json="$(gh api "/repos/${REPO_SLUG}/branches?per_page=50")"

# اختياري: قائمة نشرات Vercel (إذا كان التوكن موجود)
vercel_section=""
if [[ -n "${VERCEL_TOKEN:-}" ]]; then
  vercel_list="$(vercel list "${VERCEL_PROJECT:-}" \
    --token "$VERCEL_TOKEN" --scope "${VERCEL_TEAM:-}" 2>/dev/null || true)"
  vercel_section=$'\n## Vercel Deployments (اختياري)\n```\n'"${vercel_list}"$'\n```\n'
fi

# بناء التقرير
{
  echo "# Repo News — ${REPO_SLUG}"
  echo "_Generated: ${now_utc}_"
  echo
  echo "## Latest Commits (15)"
  echo
  echo "${commits_json}" | jq -r '.[] | "* \(.commit.author.date) — `\(.sha[0:7])` — \(.commit.message | gsub("\n"; " ") | .[0:120])"' 
  echo
  echo "## Pull Requests (15)"
  echo
  echo "${prs_json}" | jq -r '.[] | "* #\(.number) [\(.title)] — \(.state) — branch: `\(.headRefName)` — updated: \(.updatedAt)"'
  echo
  echo "## Recent Workflow Runs (10)"
  echo
  echo "${runs_json}" | jq -r '.[] | "* \(.createdAt) — \(.workflowName): \(.displayTitle) — \(.status)/\(.conclusion // "N/A") — branch: `\(.headBranch)`"'
  echo
  echo "## Branches (up to 50)"
  echo
  echo "${branches_json}" | jq -r '.[] | "* \(.name)"'
  echo
  [[ -n "${vercel_section}" ]] && echo "${vercel_section}"
} > "${OUT}"

echo "Wrote ${OUT}"

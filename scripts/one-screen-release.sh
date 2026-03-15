#!/usr/bin/env bash
set -euo pipefail

# One-screen release cycle: edit -> build -> tests -> deploy(staging) -> verify -> deploy(prod) -> regression check
# Required secrets must come from environment variables only.

SCREEN_ID="${SCREEN_ID:-}"
TARGET_SCREEN_PATH="${TARGET_SCREEN_PATH:-}"
ENABLE_DEPLOY="${ENABLE_DEPLOY:-false}"
APPROVE_PROD="${APPROVE_PROD:-false}"

if [[ -z "$SCREEN_ID" || -z "$TARGET_SCREEN_PATH" ]]; then
  echo "ERROR: SCREEN_ID and TARGET_SCREEN_PATH are required."
  echo "Example: SCREEN_ID=login TARGET_SCREEN_PATH=frontend/src/pages/LoginScreen.jsx ./scripts/one-screen-release.sh"
  exit 1
fi

TS="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_FILE="logs/release-${SCREEN_ID}-${TS}.log"
mkdir -p "$(dirname "$LOG_FILE")"

audit() {
  local level="$1"; shift
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] [$level] $*" | tee -a "$LOG_FILE"
}

run_step() {
  local name="$1"; shift
  local cmd="$*"
  audit INFO "STEP=${name}"
  audit INFO "CMD=${cmd}"
  if bash -lc "$cmd" >>"$LOG_FILE" 2>&1; then
    audit INFO "RESULT=${name}:PASS"
  else
    audit ERROR "RESULT=${name}:FAIL"
    return 1
  fi
}

require_secret_for_deploy() {
  local var_name="$1"
  if [[ -z "${!var_name:-}" ]]; then
    audit ERROR "Missing required env var for deploy: ${var_name}"
    exit 1
  fi
}

summarize_scope() {
  audit INFO "=== ONE SCREEN SCOPE ==="
  audit INFO "SCREEN_ID=${SCREEN_ID}"
  audit INFO "TARGET_SCREEN_PATH=${TARGET_SCREEN_PATH}"
  audit INFO "RULE=single-screen-per-pr"
}

hash_body() {
  local url="$1"
  curl -sL "$url" | shasum -a 256 | awk '{print $1}'
}

verify_domains_match() {
  local d1="https://mmc-mms.com"
  local d2="https://www.mmc-mms.com"
  local h1 h2
  h1="$(hash_body "$d1")"
  h2="$(hash_body "$d2")"

  audit INFO "REGRESSION_DOMAIN_1=${d1} HASH=${h1}"
  audit INFO "REGRESSION_DOMAIN_2=${d2} HASH=${h2}"

  if [[ "$h1" == "$h2" ]]; then
    audit INFO "RESULT=regression-domain-parity:PASS"
  else
    audit ERROR "RESULT=regression-domain-parity:FAIL"
    return 1
  fi
}

deploy_staging() {
  require_secret_for_deploy VERCEL_TOKEN
  require_secret_for_deploy VERCEL_ORG_ID
  require_secret_for_deploy VERCEL_PROJECT_ID

  local url
  audit INFO "STEP=deploy-staging"
  audit INFO "CMD=vercel deploy --token *** --scope \"${VERCEL_ORG_ID}\" --yes"
  url="$(vercel deploy --token "$VERCEL_TOKEN" --scope "$VERCEL_ORG_ID" --yes 2>>"$LOG_FILE" | tail -n1)"
  audit INFO "STAGING_URL=${url}"

  audit INFO "STEP=post-deploy-verification-staging"
  audit INFO "CMD=curl -fsSL \"${url}\""
  curl -fsSL "$url" >/dev/null
  audit INFO "RESULT=post-deploy-verification-staging:PASS"

  echo "$url"
}

deploy_production() {
  local url="$1"
  audit INFO "STEP=deploy-production"
  audit INFO "CMD=vercel promote \"${url}\" --token *** --scope \"${VERCEL_ORG_ID}\""
  vercel promote "$url" --token "$VERCEL_TOKEN" --scope "$VERCEL_ORG_ID" >>"$LOG_FILE" 2>&1
  audit INFO "RESULT=deploy-production:PASS"
}

summarize_scope
run_step build "npm run build"
run_step unit_tests "npm run test"
run_step smoke_tests "npm run test:smoke"

if [[ "$ENABLE_DEPLOY" == "true" ]]; then
  STAGING_URL="$(deploy_staging)"

  if [[ "$APPROVE_PROD" == "true" ]]; then
    deploy_production "$STAGING_URL"
    verify_domains_match
  else
    audit INFO "Production deploy skipped: APPROVE_PROD=false"
  fi
else
  audit INFO "Deploy skipped: ENABLE_DEPLOY=false"
fi

audit INFO "TRACE_LOG=${LOG_FILE}"
audit INFO "DONE"

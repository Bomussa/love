# One-Screen PR Playbook (Frontend `love` + Backend `love-api`)

This playbook enforces a strict release cycle for **exactly one screen per PR**:

1. Edit
2. Build
3. Tests
4. Deploy to **staging**
5. Post-deploy verification on staging
6. Promote to **production** (only after staging smoke/UAT passes)
7. Regression check (including `mmc-mms.com` vs `www.mmc-mms.com` parity)

## Secure secrets policy

Never place tokens in code, commit messages, or chat logs. Use environment variables only:

- `GITHUB_TOKEN`
- `VERCEL_TOKEN`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## Single-screen scope lock

For each PR, define:

- `SCREEN_ID`: short identifier (example: `patient-login`)
- `TARGET_SCREEN_PATH`: full path to the screen file under change

A PR should not include UI changes outside this screen, except minimal supporting fixes.

## Execution command

```bash
SCREEN_ID=patient-login \
TARGET_SCREEN_PATH=frontend/src/screens/PatientLoginScreen.jsx \
ENABLE_DEPLOY=false \
./scripts/one-screen-release.sh
```

To include deployment:

```bash
SCREEN_ID=patient-login \
TARGET_SCREEN_PATH=frontend/src/screens/PatientLoginScreen.jsx \
ENABLE_DEPLOY=true \
APPROVE_PROD=true \
./scripts/one-screen-release.sh
```

## Mandatory trace log

Every run writes an immutable log file under `logs/` with:

- exact command executed per step
- pass/fail result per step
- staging URL
- production promotion status
- regression parity result for both domains

Use the generated `TRACE_LOG` path as the release evidence artifact.

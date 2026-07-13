# Secret Exposure Incident Response

This runbook documents the required manual response when a GitHub token, Vercel token, Supabase key, or JWT signing secret is exposed. Do not store replacement secrets in this repository.

## Immediate revocation and rotation

1. Revoke exposed GitHub personal access tokens in GitHub Developer Settings.
2. Revoke exposed Vercel API tokens in the Vercel account or team settings.
3. Rotate Supabase `service_role` and `anon` keys in the Supabase project API settings.
4. Rotate the backend/session JWT signing secret and redeploy all services that verify sessions.
5. Update Vercel, Supabase, and GitHub environment variables only through provider dashboards or approved secret managers.

## Access review

After revocation, audit provider logs for unexpected activity from the exposure window onward:

- GitHub: security log, repository audit log, token usage metadata, Actions runs, deployments, branch protection changes, and collaborator changes.
- Vercel: team audit log, deployment history, environment variable changes, domain changes, integrations, and token activity where available.
- Supabase: project audit logs, API logs, auth logs, database logs, edge function logs, and configuration changes.

## Preventive controls

- Keep GitHub Advanced Security secret scanning and push protection enabled for both `love` and `love-api` when available for the account plan.
- Keep the repository CI secret scan workflow enabled for pull requests and protected branch pushes.
- Never paste production secrets into issues, pull requests, commits, logs, chat transcripts, or generated reports.
- Prefer short-lived tokens and least-privilege scopes for automation.

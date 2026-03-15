# Baseline package/artifact cleanup decision

Date: 2026-03-15

## Scope reviewed
- `frontend/pnpm-lock.yaml`
- `yarn.lock`
- `.yarn/`
- `.yarnrc.yml`

## Decision
The pending lockfile and Yarn artifact changes were **reverted** to keep a clean product-fix baseline.

## Rationale
- The diff mixed broad dependency and tooling updates with no isolated product-fix objective.
- Keeping these updates in baseline would make upcoming screen-fix PRs harder to review.
- Product fixes should proceed from a clean baseline; any dependency/tooling drift should be handled in a dedicated infra/package-management PR.

## Follow-up workflow
1. Start each screen fix from a new branch.
2. Keep one clear commit per fix unit when possible.
3. Open a separate PR for each screen fix.

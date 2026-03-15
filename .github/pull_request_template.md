## One-Screen PR Checklist

- [ ] This PR modifies exactly one screen (`TARGET_SCREEN_PATH` documented below)
- [ ] Secrets were provided via environment variables (no tokens in code/chat)
- [ ] Build passed
- [ ] Unit/integration tests passed
- [ ] Smoke tests passed
- [ ] Staging deploy completed and verified
- [ ] UAT on staging completed
- [ ] Production promotion completed (after staging pass)
- [ ] Regression parity verified for:
  - [ ] https://mmc-mms.com
  - [ ] https://www.mmc-mms.com
- [ ] Trace log attached (`logs/release-*.log`)

### Scope

- `SCREEN_ID`:
- `TARGET_SCREEN_PATH`:

### Evidence

- Staging URL:
- Production URL:
- Trace log path:

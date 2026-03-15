# Domain Canonicalization Report (mmc-mms.com)

## Scope
- Project: `love` (Vercel)
- Target domains:
  - `mmc-mms.com` (apex)
  - `www.mmc-mms.com`

## Actions Completed
1. Verified Vercel project lookup and discovered the active `love` project ID:
   - `prj_nX8UT2Imd958Pq7W2iZLJzI3RmAu`
2. Confirmed `www.mmc-mms.com` was incorrectly attached to project `love-api`.
3. Removed `www.mmc-mms.com` from `love-api` project.
4. Added `www.mmc-mms.com` to `love` project.
5. Applied canonical redirect at Vercel domain level:
   - `www.mmc-mms.com` -> `mmc-mms.com`
   - HTTP status: `308`
6. Verified both domains are attached to the same production deployment alias set.

## DNS Review
Current public DNS observed:
- Apex `mmc-mms.com` resolves to `A 216.198.79.1`.
- `www.mmc-mms.com` currently resolves via `A` records (not CNAME).

Recommended DNS target model for Vercel canonical setup:
- Apex: `A/ALIAS` to Vercel-compatible apex target (provider-specific).
- `www`: `CNAME` to Vercel target (commonly `cname.vercel-dns.com`).

> Note: DNS is externally managed (`serviceType: external`), so record-type correction for `www` must be done at the DNS provider panel.

## Smoke Check Evidence
Executed:
- `curl -I -L https://mmc-mms.com`
- `curl -I -L https://www.mmc-mms.com`

Result summary:
- Final response for apex: `200 OK`
- `www` responds with `308` redirect to apex then final `200 OK`
- Content parity verified by SHA-256 hash of final HTML payload from both URLs (identical).

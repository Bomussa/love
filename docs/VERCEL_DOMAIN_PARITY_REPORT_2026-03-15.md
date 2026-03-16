# Vercel Domain + Parity Report

- **Timestamp (UTC):** 2026-03-15T22:50:00Z
- **Requested Project ID:** `prj_m4tXQKdhxlC6AptqG4CLfaCkzAkM` (not found for provided token/team)
- **Actual `love` Project ID (from Vercel API):** `prj_nX8UT2Imd958Pq7W2iZLJzI3RmAu`
- **Team ID:** `team_aFtFTvzgabqENB5bOxn4SiO7`
- **Production Deployment ID:** `dpl_Bw5MoRHF8LUZaWtMtryiFMSCmThw`

## 1) Domain attachment validation (same project)
Verified both domains are now attached to the **same** `love` project:

- `mmc-mms.com` (verified)
- `www.mmc-mms.com` (verified, redirect configured)

Applied change:
- Removed `www.mmc-mms.com` from `love-api` project (`prj_kT2JVmLqN8l2i9opi07JRYugl8MP`).
- Added `www.mmc-mms.com` to `love` project (`prj_nX8UT2Imd958Pq7W2iZLJzI3RmAu`).
- Set domain-level redirect `www.mmc-mms.com -> mmc-mms.com` with `308`.

## 2) DNS state and Vercel recommendation check
Queried Vercel domain config endpoint for both domains.

### `mmc-mms.com`
- `misconfigured: false`
- `configuredBy: A`
- nameservers: Cloudflare (`paul.ns.cloudflare.com`, `ara.ns.cloudflare.com`)

### `www.mmc-mms.com`
- `misconfigured: false`
- `configuredBy: A`
- Current A values reported by Vercel config API: `216.198.79.1`, `64.29.17.1`
- Recommended CNAME target (rank 1): `46a38b32e42608c6.vercel-dns-017.com.`
- Alternate CNAME target (rank 2): `cname.vercel-dns.com.`

> Note: DNS zone is external (Cloudflare). No Cloudflare credentials were provided in this task, so only verification through Vercel API was possible from this environment.

## 3) Primary domain and redirect behavior
- Apex (`mmc-mms.com`) remains non-redirect domain on production aliases.
- `www.mmc-mms.com` is configured as permanent redirect (`308`) to apex.
- Runtime check confirms all tested `www` routes resolve to corresponding apex routes.

## 4) Root `vercel.json` usage validation
Build log evidence from production deployment indicates root-level config is being used:

- Build step shows `.vercelignore` excluded `/frontend/vercel.json` from the deployment context.
- Therefore frontend-local `vercel.json` is not used by Vercel build.
- Build runs `vercel build` from repository root and produces frontend Vite output.

## 5) Smoke parity check (`/`, `/admin`, `/clinic/x`)
### Method
For each path:
- fetch from apex and www hosts
- capture final URL, HTTP status, body SHA-256 hash, and HTML canonical tag (if present)

### Results
All six checks returned:
- **HTTP 200** after redirect flow
- identical **SHA-256 hash**: `306ff7096eba32cc85f16e9a172f704c803a252ea6448f339f6171710b94c448`
- `www` final URL canonicalized to apex route
- no explicit `<link rel="canonical">` present in returned HTML

| Input URL | Final URL | Status | Body Hash | Canonical Tag |
|---|---|---:|---|---|
| `https://mmc-mms.com/` | `https://mmc-mms.com/` | 200 | `306ff709...b94c448` | *(none)* |
| `https://mmc-mms.com/admin` | `https://mmc-mms.com/admin` | 200 | `306ff709...b94c448` | *(none)* |
| `https://mmc-mms.com/clinic/x` | `https://mmc-mms.com/clinic/x` | 200 | `306ff709...b94c448` | *(none)* |
| `https://www.mmc-mms.com/` | `https://mmc-mms.com/` | 200 | `306ff709...b94c448` | *(none)* |
| `https://www.mmc-mms.com/admin` | `https://mmc-mms.com/admin` | 200 | `306ff709...b94c448` | *(none)* |
| `https://www.mmc-mms.com/clinic/x` | `https://mmc-mms.com/clinic/x` | 200 | `306ff709...b94c448` | *(none)* |

## 6) Outcome summary
- Domain ownership and project mapping corrected.
- Redirect policy (`www -> apex`, permanent) configured and working.
- Root `vercel.json` confirmed as effective Vercel config in build context.
- Smoke parity across required routes passed for status/body equivalence and host canonicalization behavior.

# Deployment Runbook — MMC-MMS (Cloudflare Tunnel)

## Prerequisites
- Node.js 20, npm
- cloudflared (Cloudflare Tunnel CLI)
- A VM with DNS for mmc-mms.com pointing to Cloudflare

## App install
- Place app under `/opt/mmc/app` and run:

```bash
npm ci
npm run build
```

- Create a system user `node` and ensure it can run the service.

## Cloudflared
- Login and create tunnel (manual):
```bash
cloudflared tunnel login
cloudflared tunnel create mmc-mms-tunnel
# Save credentials to /etc/cloudflared/mmc-mms.json
```
- Copy `deploy/cloudflared/config.yml` to `/opt/mmc/deploy/cloudflared/config.yml` and adjust `${PORT}` env as needed.

## Systemd
- Copy unit files:
```bash
sudo cp deploy/systemd/cloudflared.service /etc/systemd/system/
sudo cp deploy/systemd/mmc-server.service /etc/systemd/system/
```
- Enable services:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now cloudflared
sudo systemctl enable --now mmc-server
```

## Environment
- Configure environment variables for the app (e.g., via `/etc/systemd/system/mmc-server.service.d/override.conf`):
  - SITE_USER, SITE_PASSWORD
  - QR_JWT_SECRET, QR_SESSION_TTL_HOURS
  - PORT, SERVER_TZ

## Verification
- Ensure `curl -I http://localhost:$PORT` returns 200
- Open `https://mmc-mms.com` via Cloudflare; root should prompt for Basic Auth unless a valid `?token=` is present.

---

For CI, see `.github/workflows/ci.yml`.

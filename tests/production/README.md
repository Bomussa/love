# Production UI Acceptance

This suite runs only from the default `main` branch against `https://mmc-mms.com`.

It uses GitHub Actions OIDC to obtain isolated, expiring acceptance accounts. No static credentials or service-role keys are stored in this repository. The workflow always invokes cleanup and uploads Playwright screenshots, traces, browser errors, control inventories, and journey transition evidence.

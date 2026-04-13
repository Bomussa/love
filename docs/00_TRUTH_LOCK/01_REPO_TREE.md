# 01_REPO_TREE — MMC Frontend File Structure
**Generated**: 2026-02-24

## Key Files

### Root
```
/love
├── vercel.json          # Vercel config: rewrites + headers
├── frontend/
│   ├── index.html       # Cairo font import (wght@300..900)
│   ├── tailwind.config.js  # fontFamily.sans = ['Cairo', 'sans-serif']
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── index.css    # Global styles, Cairo font-family
│   │   ├── components/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── ExamSelectionPage.jsx
│   │   │   ├── PatientPage.jsx          # Main patient flow
│   │   │   ├── AdminDashboardV2.jsx     # Admin panel (6000+ lines)
│   │   │   ├── NotificationsManagementV2.jsx
│   │   │   ├── OperationalNotificationsManager.jsx  # NEW: operational notifs
│   │   │   ├── DirectAlertManager.jsx   # NEW: Direct Alert admin UI
│   │   │   ├── QueueManagement.jsx
│   │   │   ├── PINManagement.jsx
│   │   │   ├── ReportsSection.jsx
│   │   │   └── ... (30+ more components)
│   │   ├── core/
│   │   │   ├── queue-engine.js          # Queue logic (in-memory)
│   │   │   ├── notification-engine.js   # Notification delivery (Supabase-backed)
│   │   │   ├── event-bus.js
│   │   │   └── pin-generator.js
│   │   └── lib/
│   │       ├── supabase-client.js
│   │       ├── api-unified.js           # API calls to love-api backend
│   │       └── auth-service.js
│   └── data/
│       └── settings.json
└── docs/                # THIS DIRECTORY — Truth Lock + Audit
```

## vercel.json Rewrites (No Loop Risk)
```json
{ "source": "/admin", "destination": "/index.html" },
{ "source": "/clinic/(.*)", "destination": "/index.html" },
{ "source": "/qr", "destination": "/index.html" },
{ "source": "/(.*)", "destination": "/index.html" }
```
All rewrites point to `/index.html` — SPA routing. No redirect loops possible.

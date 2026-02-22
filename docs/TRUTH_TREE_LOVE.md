# TRUTH_TREE_LOVE.md — Frontend Repository Snapshot
> تاريخ الإنتاج: 2026-02-22 | الفرع: main

---

## شجرة المجلدات الأساسية

```
love/
├── frontend/
│   ├── config/          (clinics.json, constants.json, features.json, routeMap.json)
│   ├── data/            (settings.json)
│   ├── public/          (img/, js/, manifest.webmanifest, offline.html)
│   ├── src/
│   │   ├── _archived/
│   │   ├── assets/
│   │   ├── components/  (UI Components - JSX)
│   │   │   └── admin/
│   │   ├── config/      (admin-credentials.js)
│   │   ├── core/        (event-bus.js, notification-engine.js, path-engine.js, pin-engine.js, queue-engine.js, advanced-queue-engine.js)
│   │   │   └── config/  (refresh.constants.js)
│   │   ├── hooks/       (useQueueRealtime.js, useQueueWatcher.js, useSmartUpdater.js)
│   │   ├── lib/         (api-unified.js, auth-service.js, i18n.js, offline-manager.js, validation.js, ...)
│   │   ├── styles/
│   │   ├── types/
│   │   └── utils/
│   ├── theme/           (palette.json, tokens.css)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── vercel.json
├── lib/                 (api.js, helpers.js, supabase.js, ...)
├── supabase/
│   ├── functions/       (Edge Functions)
│   └── migrations/      (SQL migrations)
├── scripts/
├── docs/
└── vercel.json
```

---

## الملفات التنفيذية الأساسية

### Pages / Components الرئيسية
| الملف | المسار الكامل |
|-------|--------------|
| LoginPage.jsx | `frontend/src/components/LoginPage.jsx` |
| AdminPage.jsx | `frontend/src/components/AdminPage.jsx` |
| AdminDashboardV2.jsx | `frontend/src/components/AdminDashboardV2.jsx` |
| PatientPage.jsx | `frontend/src/components/PatientPage.jsx` |
| ExamSelectionPage.jsx | `frontend/src/components/ExamSelectionPage.jsx` |
| ClinicDashboard.jsx | `frontend/src/components/ClinicDashboard.jsx` |
| CompletePage.jsx | `frontend/src/components/CompletePage.jsx` |
| DisplayPage.jsx | `frontend/src/components/DisplayPage.jsx` |
| App.jsx | `frontend/src/App.jsx` |

### Core
| الملف | المسار الكامل |
|-------|--------------|
| event-bus.js | `frontend/src/core/event-bus.js` |
| notification-engine.js | `frontend/src/core/notification-engine.js` |
| path-engine.js | `frontend/src/core/path-engine.js` |
| pin-engine.js | `frontend/src/core/pin-engine.js` |
| queue-engine.js | `frontend/src/core/queue-engine.js` |
| advanced-queue-engine.js | `frontend/src/core/advanced-queue-engine.js` |

### Lib
| الملف | المسار الكامل |
|-------|--------------|
| api-unified.js | `frontend/src/lib/api-unified.js` |
| auth-service.js | `frontend/src/lib/auth-service.js` |
| i18n.js | `frontend/src/lib/i18n.js` |
| offline-manager.js | `frontend/src/lib/offline-manager.js` |
| validation.js | `frontend/src/lib/validation.js` |
| supabase-client.js | `frontend/src/lib/supabase-client.js` |
| dynamic-pathways.js | `frontend/src/lib/dynamic-pathways.js` |
| settings.js | `frontend/src/lib/settings.js` |
| queueManager.js | `frontend/src/lib/queueManager.js` |

---

## تحديد مواقع الملفات المطلوبة بدقة

| الملف المطلوب | المسار الكامل الفعلي | الحالة |
|--------------|---------------------|--------|
| frontend/src/components/LoginPage.jsx | `love/frontend/src/components/LoginPage.jsx` | ✅ موجود |
| frontend/src/lib/validation.js | `love/frontend/src/lib/validation.js` | ✅ موجود |
| frontend/src/core/notification-engine.js | `love/frontend/src/core/notification-engine.js` | ✅ موجود |
| frontend/src/lib/i18n.js | `love/frontend/src/lib/i18n.js` | ✅ موجود |
| frontend/src/lib/offline-manager.js | `love/frontend/src/lib/offline-manager.js` | ✅ موجود |

---

## ملاحظات هامة
- المشروع يستخدم **Vite + React + TailwindCSS**
- يحتوي على ملفات `archive/` تحتوي على نسخ احتياطية قديمة
- يوجد `supabase/functions/` (Edge Functions) مستقلة عن backend
- ملف `vercel.json` موجود في جذر المشروع وداخل `frontend/`

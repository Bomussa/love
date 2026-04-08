# TRUTH_TREE_LOVE_API.md — Backend Repository Snapshot
> تاريخ الإنتاج: 2026-02-22 | الفرع: main

---

## شجرة المجلدات الأساسية

```
love-api/
├── api/
│   ├── v1.js            ← الملف الرئيسي للـAPI (787 سطر)
│   ├── v1/
│   │   └── tickets.ts
│   ├── health.js
│   ├── maintenance.js
│   └── lib/
│       ├── helpers.js
│       └── storage.js
├── lib/
│   ├── queue.ts
│   ├── queue.test.ts
│   ├── pin.test.ts
│   └── supabase.ts
├── migrations/          (SQL migrations)
│   ├── 20260108_fix_rls_and_functions.sql
│   ├── 20260116_add_settings_table.sql
│   ├── 20260124_add_sessions_table.sql
│   ├── 20260124_comprehensive_fixes.sql
│   ├── 20260124_daily_cleanup_system.sql
│   ├── 20260124_final_comprehensive_fixes.sql
│   ├── 20260124_unify_queue_tables.sql
│   └── 20260126_fix_pins_permissions.sql
├── supabase/
│   ├── functions/       (Edge Functions)
│   │   ├── api-management/
│   │   ├── api-router/
│   │   ├── api-v1-status/
│   │   ├── call-next-patient/
│   │   ├── data-verification/
│   │   ├── db-check/
│   │   ├── db-policies-manager/
│   │   ├── db-tables-manager/
│   │   ├── events-stream/
│   │   ├── generate-pins-cron/
│   │   ├── guaranteed-api/
│   │   ├── issue-pin/
│   │   ├── patient-login/
│   │   ├── pin-status/
│   │   ├── queue-enter/
│   │   └── queue-status/
│   └── migrations/
│       ├── 20250101000000_enable_realtime_and_cron.sql
│       ├── 20251112_full_schema.sql
│       └── 20260209_fix_enter_queue_safe.sql
├── package.json
├── vercel.json
└── deploy.sh
```

---

## الملفات التنفيذية الأساسية

### API
| الملف | المسار الكامل | الحجم |
|-------|--------------|-------|
| **api/v1.js** | `love-api/api/v1.js` | 787 سطر |
| api/health.js | `love-api/api/health.js` | صغير |
| api/maintenance.js | `love-api/api/maintenance.js` | صغير |
| api/lib/helpers.js | `love-api/api/lib/helpers.js` | مساعد |
| api/lib/storage.js | `love-api/api/lib/storage.js` | مساعد |

### Lib
| الملف | المسار الكامل |
|-------|--------------|
| lib/queue.ts | `love-api/lib/queue.ts` |
| lib/supabase.ts | `love-api/lib/supabase.ts` |

---

## تحديد موقع backend api/v1.js

| الملف المطلوب | المسار الكامل الفعلي | الفرع | الحالة |
|--------------|---------------------|-------|--------|
| backend: api/v1.js | `love-api/api/v1.js` | main | ✅ موجود |

---

## إعدادات Supabase
- **SUPABASE_URL**: يُقرأ من `process.env.SUPABASE_URL` أو القيمة الافتراضية `https://rujwuruuosffcxazymit.supabase.co`
- **SUPABASE_KEY**: يُقرأ من `process.env.SUPABASE_SERVICE_ROLE_KEY` أو `process.env.SERVICE_ROLE_SECRET`

---

## ملاحظات هامة
- المشروع يعمل على **Vercel Serverless Functions**
- ملف `api/v1.js` هو نقطة الدخول الوحيدة للـAPI
- يستخدم `fetch` مباشرة لاستدعاء Supabase REST API
- يوجد `supabaseRPC()` لاستدعاء دوال قاعدة البيانات
- يوجد `getNextDisplayNumber()` غير ذري (خطر race condition)

# Frontend ↔ Backend Integration Audit (love)

## Scope
- Project inspected: `frontend` داخل مستودع `love`.
- Backend repository `love-api` غير موجود محلياً داخل بيئة التنفيذ الحالية، لذلك تم تنفيذ تدقيق تكاملي من جهة الاستهلاك (Frontend contract audit) مع توثيق نقاط الربط الفعلية.

## Endpoints (HTTP) used by frontend
| Endpoint | Method | Usage | Source location |
|---|---|---|---|
| `/api/v1/admin/login` | POST | تسجيل دخول الإدارة | `frontend/src/lib/api-unified.js` |
| `/api/v1/queue/done` | POST | اعتماد إنهاء الدور/الـ PIN fallback | `frontend/src/lib/api-unified.js` |
| `/api/v1/qa/deep_run` | GET | فحص عميق للنظام | `frontend/src/components/QARepairPanel.jsx`, `frontend/src/components/AdminDashboardV2.jsx` |
| `/api/v1/repair/execute` | POST | تنفيذ إصلاح تلقائي finding | `frontend/src/components/QARepairPanel.jsx`, `frontend/src/components/AdminDashboardV2.jsx` |
| `/api/v1/events/stream` | SSE | بث أحداث آنية | `frontend/src/core/event-bus.js` |
| `/api/health` | HEAD | فحص صحة الاتصال وجودة الشبكة | `frontend/src/lib/network-status-monitor.js` |

## Supabase RPC functions used by frontend
| RPC name | Purpose | Source |
|---|---|---|
| `enter_unified_queue_safe` | دخول ذري للطابور ومنع التكرار | `frontend/src/lib/api-unified.js` |
| `verify_clinic_pin` | التحقق من PIN العيادة | `frontend/src/lib/api-unified.js` |

## Supabase tables referenced by frontend integration layer
- `patients`
- `unified_queue`
- `pins`
- `clinics`
- `system_config`
- `qa_runs`
- `qa_findings`
- `repair_runs`

> المراجع أعلاه مستخلصة من نقاط الربط الأساسية داخل `api-unified.js` وواجهات الـ QA ومراقبة الشبكة، وهي العناصر الأكثر حساسية لتكامل الواجهة/الخلفية.

## Applied hardening changes
1. إضافة طبقة طلبات resilient مشتركة (`resilient-request`) تشمل timeout + retries + exponential backoff + jitter + parsing-safe JSON.
2. إزالة السرّ الثابت من الواجهة (`mmc-mms-repair-secret-2026`) واستبداله بمتغير بيئة `VITE_REPAIR_EXEC_TOKEN`.
3. توحيد استدعاءات endpoints الحساسة لتستخدم طبقة resilient request.
4. تعزيز `network-status-monitor` بإيقاف الطلبات المعلّقة (AbortController) وتحديث timestamp بدقة مع دعم تنظيف interval.

## Failure risks + rollback points
- **Risk:** فشل استدعاءات الإصلاح إذا لم يتم ضبط `VITE_REPAIR_EXEC_TOKEN` في بيئة التشغيل.
  - **Rollback point:** استرجاع commit الحالي أو تعيين المتغير مباشرة في Vercel Environment Variables.
- **Risk:** زيادة طفيفة في زمن الاستجابة بسبب retries عند سوء الشبكة.
  - **Rollback point:** تقليل retries/timeout في `resilient-request.js`.

## Pre-deploy checks (required)
1. ضبط `VITE_REPAIR_EXEC_TOKEN` في Vercel لكل بيئة (Preview + Production).
2. اختبار `/api/v1/qa/deep_run` و`/api/v1/repair/execute` من لوحة الإدارة.
3. التأكد من تماثل المحتوى بين `mmc-mms.com` و`www.mmc-mms.com` (status/body/title).
4. Smoke test: login admin + queue done + SSE stream + health endpoint.

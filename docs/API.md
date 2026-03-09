# 📡 توثيق API

## Base URL

\`\`\`
Production: https://love-bomussa.vercel.app/api
Development: http://localhost:3000/api
\`\`\`

## Authentication

\`\`\`http
Authorization: Bearer <JWT_TOKEN>
\`\`\`

## Endpoints

### Patients

- \`GET /api/v1/patients\` - قائمة المرضى
- \`POST /api/v1/patients\` - إضافة مريض
- \`GET /api/v1/patients/:id\` - تفاصيل مريض
- \`PUT /api/v1/patients/:id\` - تحديث مريض
- \`DELETE /api/v1/patients/:id\` - حذف مريض

### Queue

- \`GET /api/v1/queue\` - قائمة الطابور
- \`POST /api/v1/queue\` - إضافة للطابور
- \`PUT /api/v1/queue/:id\` - تحديث حالة

### Clinics

- \`GET /api/v1/clinics\` - قائمة العيادات
- \`POST /api/v1/clinics\` - إضافة عيادة

### PIN Status (Supabase Edge Function)

- \`GET /functions/v1/pin-status?clinic_id=<id>\`
  - يتطلب \`Authorization: Bearer <JWT_TOKEN>\` صالح.
  - الأدوار المسموحة للمسار العام: \`authenticated\`, \`admin\`, \`clinic_admin\`, \`manager\`.
  - **لا يعيد قيمة PIN إطلاقًا**.
  - الاستجابة:

\`\`\`json
{
  "data": {
    "clinic_id": "<uuid>",
    "has_active_pin": true,
    "valid_until": "2025-11-08T23:59:59.999Z",
    "expires_in_seconds": 3600
  }
}
\`\`\`

- \`GET /functions/v1/pin-status/admin?clinic_id=<id>\`
  - مسار إداري منفصل لإرجاع PIN عند الحاجة التشغيلية.
  - الأدوار المسموحة فقط: \`admin\`, \`service_role\`.
  - يتم تسجيل حدث تدقيق (Audit Log) لكل قراءة PIN.
  - الاستجابة تتضمن: \`pin\`, \`pin_id\`, \`valid_until\`, \`expires_in_seconds\`.

---
**آخر تحديث:** 09 نوفمبر 2025

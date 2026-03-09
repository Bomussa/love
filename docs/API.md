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

### PIN

- \`POST /functions/v1/pin-generate\` - توليد PIN للعيادة (\`clinic_id\`).
- \`POST /functions/v1/pin-verify\` - التحقق من PIN للعيادة (\`clinic_id\`, \`pin\`).
- \`POST /rpc/verify_clinic_pin\` - تحقق آمن عبر RPC (\`p_clinic_id\`, \`p_pin\`).

> **مهم:** عمود الربط القياسي في جدول \`pins\` هو \`clinic_id\`.

---
**آخر تحديث:** 09 مارس 2026

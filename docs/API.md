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

---
**آخر تحديث:** 08 نوفمبر 2025

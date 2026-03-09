# 📡 توثيق API

## Base URL

```txt
Production: https://mmc-mms.com/api/v1
Development: http://localhost:3000/api/v1
```

## Authentication

```http
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>
```

## تنسيق الاستجابة

```json
{
  "success": true
}
```

## Endpoints الأساسية المستخدمة حالياً

### Admin Authentication

#### `POST /api/v1/admin/login`

Request:

```json
{
  "username": "admin",
  "password": "secret"
}
```

Response:

```json
{
  "success": true,
  "sessionToken": "sess_xxx",
  "sessionId": "sess_xxx",
  "username": "admin",
  "role": "ADMIN",
  "permissions": ["admin:read", "queue:manage"],
  "expiresAt": "2026-03-09T12:00:00.000Z",
  "session": {
    "id": "sess_xxx",
    "username": "admin",
    "role": "ADMIN",
    "name": "Admin User",
    "permissions": ["admin:read", "queue:manage"],
    "expiresAt": "2026-03-09T12:00:00.000Z"
  }
}
```

#### `POST /api/v1/admin/session/verify`

Request:

```json
{
  "sessionToken": "sess_xxx"
}
```

Response:

```json
{
  "success": true,
  "role": "ADMIN",
  "permissions": ["admin:read", "queue:manage"],
  "username": "admin",
  "expiresAt": "2026-03-09T12:00:00.000Z"
}
```

### Queue

- `POST /api/v1/queue/enter` - دخول الطابور
- `GET /api/v1/queue/status?clinicId=<id>` - حالة الطابور
- `POST /api/v1/queue/call` - استدعاء المريض التالي

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

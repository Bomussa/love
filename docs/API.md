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

---
**آخر تحديث:** 09 مارس 2026

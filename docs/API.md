# 📡 توثيق API

## Base URL

```
Production: https://love-bomussa.vercel.app/api
Development: http://localhost:3000/api
```

## Authentication

```http
Authorization: Bearer <JWT_TOKEN>
```

## Endpoints

### Patients

- `GET /api/v1/patients` - قائمة المرضى
- `POST /api/v1/patients` - إضافة مريض
- `GET /api/v1/patients/:id` - تفاصيل مريض
- `PUT /api/v1/patients/:id` - تحديث مريض
- `DELETE /api/v1/patients/:id` - حذف مريض

### Queue

- `GET /api/v1/queue` - قائمة الطابور
- `POST /api/v1/queue` - إضافة للطابور
- `PUT /api/v1/queue/:id` - تحديث حالة

### Queue Position (Contract)

- `POST /api/v1/queue/position` - جلب موقع المراجع في الدور (العقد النهائي)

**Request Body**
```json
{
  "clinicId": "<clinic-id>",
  "patientId": "<patient-id>",
  "sessionId": "<optional-session-id>"
}
```

**Response**
```json
{
  "success": true,
  "position": 0,
  "displayNumber": 17,
  "display_number": 17,
  "ahead": 0,
  "totalWaiting": 9,
  "total_waiting": 9,
  "estimatedWaitMinutes": 0,
  "inQueue": true
}
```

> مصدر البيانات المعتمد: جدول `unified_queue` فقط.

### Clinics

- `GET /api/v1/clinics` - قائمة العيادات
- `POST /api/v1/clinics` - إضافة عيادة

---
**آخر تحديث:** 09 مارس 2026

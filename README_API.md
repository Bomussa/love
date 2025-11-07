# Queue & Clinics API Documentation

## Overview

هذا التوثيق يشرح المسارات الجديدة لنظام الكيو والعيادات المتكامل مع Supabase.

## Base URL

```
https://mmc-mms.com/api/v1
```

## Endpoints

### 1. قائمة العيادات

**GET** `/clinics/list`

يعرض جميع العيادات مع حالتها اللحظية.

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "code": "LAB",
      "name": "المختبر",
      "capacity": 20,
      "is_open": true,
      "waiting_count": 5,
      "in_service_count": 2,
      "is_full": false
    }
  ]
}
```

### 2. إنشاء دور جديد

**POST** `/queue/create?clinic_id={uuid}`

يمنح المستخدم المصادق رقم دور ذرّي في العيادة المحددة.

**Headers:**
```
Authorization: Bearer {user_token}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "queue_id": "uuid",
    "clinic_id": "uuid",
    "user_id": "uuid",
    "number": 12,
    "status": "waiting",
    "created_at": "2025-11-07T10:30:00Z"
  }
}
```

**Errors:**
- `clinic_not_found`: العيادة غير موجودة
- `clinic_closed`: العيادة مغلقة
- `clinic_full`: العيادة ممتلئة
- `unauthenticated`: المستخدم غير مصادق

### 3. حالة الدور

**GET** `/queue/status?clinic_id={uuid}`

يعرض حالة العيادة وآخر دور للمستخدم المصادق.

**Response:**
```json
{
  "ok": true,
  "data": {
    "clinic": {
      "id": "uuid",
      "name": "المختبر",
      "waiting_count": 5,
      "is_full": false
    },
    "my": {
      "id": "uuid",
      "number": 12,
      "status": "waiting",
      "created_at": "2025-11-07T10:30:00Z"
    }
  }
}
```

### 4. دخول العيادة

**POST** `/clinics/{id}/enter`

يبدأ خدمة المستخدم في العيادة (تغيير الحالة من waiting إلى in_service).

**Headers:**
```
Authorization: Bearer {user_token}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "queue_id": "uuid",
    "entered_at": "2025-11-07T10:35:00Z",
    "status": "in_service"
  }
}
```

### 5. الخروج من العيادة

**POST** `/clinics/{id}/leave`

ينهي خدمة المستخدم في العيادة (تغيير الحالة إلى done).

**Headers:**
```
Authorization: Bearer {user_token}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "queue_id": "uuid",
    "left_at": "2025-11-07T10:40:00Z",
    "status": "done"
  }
}
```

### 6. استعلام الإشعارات

**GET** `/notifications/poll`

يعرض الإشعارات غير المقروءة للمستخدم المصادق.

**Headers:**
```
Authorization: Bearer {user_token}
```

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "type": "NEAR_TURN",
      "payload": {
        "clinic_id": "uuid",
        "queue_number": 12
      },
      "sent_at": "2025-11-07T10:30:00Z",
      "read_at": null
    }
  ]
}
```

## Error Format

جميع الأخطاء تُرجع بالصيغة التالية:

```json
{
  "ok": false,
  "error": "error_code",
  "detail": "Detailed error message"
}
```

## Authentication

معظم المسارات تتطلب توكن مصادقة من Supabase Auth:

```
Authorization: Bearer {supabase_access_token}
```

## Rate Limiting

- الحد الأقصى: 100 طلب/دقيقة لكل مستخدم
- SLA المستهدف: ≥85% نجاح، ≤2000ms متوسط الاستجابة

## Architecture

- **Vercel Proxy**: `/api/v1/[...path].ts` - يمرر الطلبات إلى Supabase Edge Functions
- **Supabase Edge Function**: `functions-proxy` - يوجه المسارات ويطبق RLS
- **Database**: PostgreSQL مع RLS و Stored Procedures ذرّية
- **Realtime**: تحديثات لحظية عبر `supabase_realtime` publication

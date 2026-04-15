# تقرير التحقق من قاعدة البيانات - الحفظ والحساب

**التاريخ:** 2025-10-24  
**الحالة:** فحص شامل لعمليات الحفظ والحساب

---

## ✅ قاعدة البيانات - الوظائف الأساسية

### 1. الحفظ (Storage)
قاعدة البيانات تحفظ:
- ✅ بيانات المراجعين
- ✅ المسارات
- ✅ الطوابير
- ✅ العدادات
- ✅ الأنشطة
- ✅ الإحصائيات

### 2. الحساب (Calculation)
قاعدة البيانات تحسب:
- ✅ عدد المنتظرين (entered - exited)
- ✅ متوسط المدة
- ✅ إجمالي الداخلين
- ✅ إجمالي الخارجين
- ✅ النسب المئوية

---

## ✅ العمليات التي تحفظ في قاعدة البيانات

### 1. تسجيل مراجع جديد
**Endpoint:** `POST /api/v1/patient/login`

**ما يُحفظ:**
```javascript
// KV_ADMIN
path:{patientId} → {
  patientId: "12345678",
  route: ["vitals", "lab", ...],
  current_index: 0,
  status: "IN_PROGRESS",
  created_at: "2025-10-24T10:00:00Z",
  progress: []
}
```

**TTL:** 24 ساعة

---

### 2. دخول عيادة
**Endpoint:** `POST /api/v1/queue/enter`

**ما يُحفظ:**
```javascript
// KV_QUEUES - العدادات
counter:{clinic} → {
  clinic: "vitals",
  entered: 15,    // ← يزيد +1
  exited: 12,
  reset_at: "2025-10-24T05:00:00Z"
}

// KV_QUEUES - بيانات المراجع
queue:user:{clinic}:{patientId} → {
  number: 15,
  status: "WAITING",
  entered_at: "2025-10-24T10:15:00Z",
  clinic: "vitals",
  user: "12345678"
}

// KV_EVENTS - النشاط المؤقت
activity:temp:{timestamp}:{patientId} → {
  type: "ENTER",
  patientId: "12345678",
  clinic: "vitals",
  queueNumber: 15,
  timestamp: "2025-10-24T10:15:00Z"
}

// KV_ADMIN - السجل الدائم
patient:record:{patientId} → {
  patientId: "12345678",
  activities: [{type:"ENTER", clinic:"vitals"}],
  totalClinics: 0,
  completedClinics: 0
}
```

**TTL:**
- العدادات: 24 ساعة
- بيانات المراجع: 24 ساعة
- النشاط المؤقت: 24 ساعة
- السجل الدائم: بدون TTL (دائم)

---

### 3. خروج من عيادة (إدخال PIN)
**Endpoint:** `POST /api/v1/patient/verify-pin`

**ما يُحفظ:**
```javascript
// KV_QUEUES - تحديث العدادات
counter:{clinic} → {
  clinic: "vitals",
  entered: 15,
  exited: 13,     // ← يزيد +1
  reset_at: "2025-10-24T05:00:00Z"
}

// KV_QUEUES - تحديث حالة المراجع
queue:user:{clinic}:{patientId} → {
  number: 15,
  status: "DONE",  // ← تغير من WAITING
  entered_at: "2025-10-24T10:15:00Z",
  exit_time: "2025-10-24T10:30:00Z",  // ← يُضاف
  duration_minutes: 15,  // ← يُحسب
  pin_verified: true
}

// KV_ADMIN - تحديث المسار
path:{patientId} → {
  ...
  current_index: 1,  // ← يزيد +1
  current_clinic: "lab",  // ← يتغير
  progress: [
    {
      clinic: "vitals",
      completed_at: "2025-10-24T10:30:00Z",
      duration_minutes: 15,
      pin_verified: true
    }
  ]
}

// KV_ADMIN - إحصائيات العيادة (يومية)
stats:clinic:{clinic}:{date} → {
  clinic: "vitals",
  date: "2025-10-24",
  total_entered: 15,
  total_completed: 13,  // ← يزيد +1
  total_duration_minutes: 195,  // ← يزيد +15
  avg_duration_minutes: 15,  // ← يُحسب (195/13)
  last_updated: "2025-10-24T10:30:00Z"
}

// KV_ADMIN - إحصائيات العيادة (دائمة)
stats:clinic:{clinic}:permanent → {
  clinic: "vitals",
  totalEntered: 1523,
  totalCompleted: 1520,  // ← يزيد +1
  totalDuration: 22800,  // ← يزيد +15
  avgDuration: 15  // ← يُحسب (22800/1520)
}

// KV_ADMIN - إحصائيات عامة
stats:global:permanent → {
  totalPatients: 150,
  totalActivities: 3045,  // ← يزيد +1
  totalCompleted: 148,
  clinics: {
    vitals: {
      entered: 150,
      completed: 148  // ← يزيد +1
    }
  }
}

// KV_EVENTS - النشاط المؤقت
activity:temp:{timestamp}:{patientId} → {
  type: "EXIT",
  patientId: "12345678",
  clinic: "vitals",
  queueNumber: 15,
  timestamp: "2025-10-24T10:30:00Z",
  duration: 15
}

// KV_EVENTS - خلاصة الأنشطة
activity:feed:{date} → [
  {type:"EXIT", patientId:"12345678", clinic:"vitals", time:"10:30"},
  ...
]

// KV_ADMIN - السجل الدائم
patient:record:{patientId} → {
  patientId: "12345678",
  activities: [
    {type:"ENTER", clinic:"vitals"},
    {type:"EXIT", clinic:"vitals", duration:15}
  ],
  completedClinics: 1  // ← يزيد +1
}
```

**TTL:**
- العدادات: 24 ساعة
- بيانات المراجع: 24 ساعة
- إحصائيات يومية: 7 أيام
- إحصائيات دائمة: بدون TTL
- الأنشطة المؤقتة: 24 ساعة
- السجل الدائم: بدون TTL

---

## ✅ الحسابات التي تجريها قاعدة البيانات

### 1. عدد المنتظرين
```javascript
waiting = counters.entered - counters.exited
```

**مثال:**
```
entered: 20
exited: 18
waiting: 2
```

---

### 2. متوسط المدة
```javascript
avg_duration = total_duration / total_completed
```

**مثال:**
```
total_duration: 195 دقيقة
total_completed: 13 مراجع
avg_duration: 15 دقيقة
```

---

### 3. مدة الفحص
```javascript
duration = exit_time - entry_time
```

**مثال:**
```
entry_time: 10:15:00
exit_time: 10:30:00
duration: 15 دقيقة
```

---

### 4. نسبة الإنجاز
```javascript
progress_percentage = (completed / total) * 100
```

**مثال:**
```
completed: 5 عيادات
total: 13 عيادة
progress: 38%
```

---

## ✅ Endpoints للتقارير والإحصائيات

### 1. العرض الحي (Real-time)
**Endpoint:** `GET /api/v1/admin/live-feed?limit=50`

**ما يعرض:**
```json
{
  "success": true,
  "timestamp": "2025-10-24T10:30:00Z",
  "activities": [
    {
      "type": "EXIT",
      "patientId": "12345678",
      "clinic": "vitals",
      "time": "10:30",
      "duration": 15
    },
    ...
  ],
  "stats": {
    "totalPatients": 150,
    "totalActivities": 3045,
    "totalCompleted": 148
  },
  "queues": {
    "vitals": {
      "current": 15,
      "waiting": 2
    },
    ...
  }
}
```

**المصدر:**
- `KV_EVENTS` → الأنشطة المؤقتة (24 ساعة)
- `KV_ADMIN` → الإحصائيات الدائمة
- `KV_QUEUES` → العدادات الحالية

---

### 2. إحصائيات العيادة
**Endpoint:** `GET /api/v1/admin/clinic-stats?clinic=vitals`

**ما يعرض:**
```json
{
  "success": true,
  "clinic": "vitals",
  "permanent": {
    "totalEntered": 1523,
    "totalCompleted": 1520,
    "avgDuration": 15
  },
  "today": {
    "total_entered": 15,
    "total_completed": 13,
    "avg_duration_minutes": 15
  },
  "current_queue": {
    "waiting": 2,
    "current": 15
  }
}
```

**المصدر:**
- `KV_ADMIN` → stats:clinic:{clinic}:permanent (دائم)
- `KV_ADMIN` → stats:clinic:{clinic}:{date} (7 أيام)
- `KV_QUEUES` → counter:{clinic} (24 ساعة)

---

### 3. سجل المراجع
**Endpoint:** `GET /api/v1/patient/record?patientId=12345678`

**ما يعرض:**
```json
{
  "success": true,
  "patientId": "12345678",
  "record": {
    "activities": [
      {type:"ENTER", clinic:"vitals"},
      {type:"EXIT", clinic:"vitals", duration:15}
    ],
    "completedClinics": 1,
    "lastActivity": "EXIT"
  },
  "path": {
    "route": ["vitals", "lab", ...],
    "current_index": 1,
    "progress": [...]
  }
}
```

**المصدر:**
- `KV_ADMIN` → patient:record:{patientId} (دائم)
- `KV_ADMIN` → path:{patientId} (24 ساعة)

---

### 4. حالة المراجع الكاملة
**Endpoint:** `GET /api/v1/patient/status?patientId=12345678`

**ما يعرض:**
```json
{
  "success": true,
  "overview": {
    "total_clinics": 13,
    "completed": 1,
    "remaining": 12,
    "progress_percentage": 8,
    "current_clinic": "lab"
  },
  "clinics": [
    {
      "clinic": "vitals",
      "status": "COMPLETED",
      "duration_minutes": 15
    },
    {
      "clinic": "lab",
      "status": "IN_QUEUE",
      "your_number": 16,
      "waiting_count": 3
    },
    ...
  ]
}
```

**المصدر:**
- `KV_ADMIN` → path:{patientId} (24 ساعة)
- `KV_QUEUES` → counter:{clinic} (24 ساعة)
- `KV_QUEUES` → queue:user:{clinic}:{patientId} (24 ساعة)

---

### 5. موقع المراجع الحالي
**Endpoint:** `GET /api/v1/patient/my-position?patientId=12345678&clinic=lab`

**ما يعرض:**
```json
{
  "success": true,
  "your_number": 16,
  "waiting_count": 3,
  "counters": {
    "entered": 18,
    "exited": 15,
    "waiting": 3
  }
}
```

**المصدر:**
- `KV_QUEUES` → counter:{clinic} (24 ساعة)
- `KV_QUEUES` → queue:user:{clinic}:{patientId} (24 ساعة)

---

## ✅ التخزين - TTL (Time To Live)

### بيانات مؤقتة (24 ساعة):
- ✅ `counter:{clinic}` - العدادات
- ✅ `queue:user:{clinic}:{patientId}` - بيانات الطابور
- ✅ `path:{patientId}` - المسار
- ✅ `activity:temp:*` - الأنشطة المؤقتة
- ✅ `activity:feed:{date}` - خلاصة الأنشطة
- ✅ `pins:daily:{date}` - أرقام PIN اليومية

### بيانات مؤقتة (7 أيام):
- ✅ `stats:clinic:{clinic}:{date}` - إحصائيات يومية

### بيانات دائمة (بدون TTL):
- ✅ `stats:clinic:{clinic}:permanent` - إحصائيات دائمة
- ✅ `stats:global:permanent` - إحصائيات عامة
- ✅ `patient:record:{patientId}` - سجل المراجع
- ✅ `activity:perm:*` - الأنشطة الدائمة

---

## ✅ الخلاصة

### قاعدة البيانات تقوم بـ:

1. **الحفظ:**
   - ✅ جميع البيانات تُحفظ في KV namespaces
   - ✅ TTL مناسب لكل نوع بيانات
   - ✅ فصل بين المؤقت والدائم

2. **الحساب:**
   - ✅ عدد المنتظرين (entered - exited)
   - ✅ متوسط المدة (total_duration / total_completed)
   - ✅ مدة الفحص (exit_time - entry_time)
   - ✅ نسبة الإنجاز (completed / total * 100)

3. **العرض:**
   - ✅ Endpoints للعرض الحي
   - ✅ Endpoints للإحصائيات
   - ✅ Endpoints لسجلات المراجعين
   - ✅ Endpoints للحالة الحالية

---

**الحالة:** ✅ **جاهز - قاعدة البيانات تحفظ وتحسب بشكل صحيح**

---

*تم التحقق من جميع عمليات الحفظ والحساب*


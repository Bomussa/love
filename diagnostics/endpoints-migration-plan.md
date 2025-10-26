# خطة ترحيل API Endpoints
## Endpoints Migration Plan: Cloudflare KV → Supabase PostgreSQL

**التاريخ**: 2025-10-24  
**المشروع**: love  
**إجمالي Endpoints**: 37

---

## ملخص تنفيذي

جميع الـ **37 endpoint** تعتمد حالياً على **Cloudflare KV** وتحتاج إلى تحديث لاستخدام **Supabase PostgreSQL**.

---

## 1. Admin APIs (9 endpoints)

### 1.1 `/api/v1/admin/clinic-stats`

**الحالة الحالية**: يعتمد على KV  
**الملف**: `functions/api/v1/admin/clinic-stats.js`  
**الأسطر**: 92

**حقول الإدخال**:
- `clinic_id` (string)

**حقول الإخراج**:
- `total_patients` (number)
- `waiting` (number)
- `completed` (number)
- `average_wait_time` (number)

**الجداول المستخدمة**:
- `queue`
- `clinics`

**التعديلات المطلوبة**:
```javascript
// قبل (KV)
const queue = await env.KV.get(`queue:${clinic_id}`, 'json');

// بعد (Supabase)
const { data: queue } = await supabase
  .from('queue')
  .select('*')
  .eq('clinic_id', clinic_id)
  .eq('status', 'waiting');
```

---

### 1.2 `/api/v1/admin/edit-patient`

**الحالة الحالية**: يعتمد على KV  
**الملف**: `functions/api/v1/admin/edit-patient.js`  
**الأسطر**: 222

**حقول الإدخال**:
- `patient_id` (string)
- `patient_name` (string)
- `exam_type` (string)
- `clinic_id` (string)

**حقول الإخراج**:
- `success` (boolean)
- `updated_patient` (object)

**الجداول المستخدمة**:
- `queue`

**التعديلات المطلوبة**:
```javascript
// قبل (KV)
await env.KV.put(`patient:${patient_id}`, JSON.stringify(patientData));

// بعد (Supabase)
const { data, error } = await supabase
  .from('queue')
  .update({
    patient_name: patient_name,
    exam_type: exam_type,
    clinic_id: clinic_id
  })
  .eq('patient_id', patient_id)
  .select();
```

---

### 1.3 `/api/v1/admin/export-report`

**الحالة الحالية**: يعتمد على KV  
**الملف**: `functions/api/v1/admin/export-report.js`  
**الأسطر**: 174

**حقول الإدخال**:
- `type` (string: daily, weekly, monthly)
- `date` (string)

**حقول الإخراج**:
- `report_data` (object)
- `csv` (string)

**الجداول المستخدمة**:
- `reports`
- `queue`

**التعديلات المطلوبة**:
```javascript
// قبل (KV)
const report = await env.KV.get(`report:${type}:${date}`, 'json');

// بعد (Supabase)
const { data: report } = await supabase
  .from('reports')
  .select('*')
  .eq('type', type)
  .eq('period_start', date)
  .single();
```

---

### 1.4 `/api/v1/admin/live-feed`

**الحالة الحالية**: يعتمد على KV  
**الملف**: `functions/api/v1/admin/live-feed.js`  
**الأسطر**: 77

**حقول الإدخال**: لا يوجد

**حقول الإخراج**:
- `events` (array)

**الجداول المستخدمة**:
- `cache_logs`

**التعديلات المطلوبة**:
```javascript
// قبل (KV)
const events = await env.KV.get('cache:events', 'json');

// بعد (Supabase)
const { data: events } = await supabase
  .from('cache_logs')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(50);
```

---

### 1.5 `/api/v1/admin/regenerate-pins`

**الحالة الحالية**: يعتمد على KV  
**الملف**: `functions/api/v1/admin/regenerate-pins.js`  
**الأسطر**: 142

**حقول الإدخال**: لا يوجد

**حقول الإخراج**:
- `pins` (object)

**الجداول المستخدمة**:
- `clinics`

**التعديلات المطلوبة**:
```javascript
// قبل (KV)
await env.KV.put(`pin:${clinic}`, newPin);

// بعد (Supabase)
await supabase
  .from('clinics')
  .update({
    pin_code: newPin,
    pin_expires_at: expiresAt
  })
  .eq('id', clinic);
```

---

### 1.6 `/api/v1/admin/set-call-interval`

**الحالة الحالية**: يعتمد على KV  
**الملف**: `functions/api/v1/admin/set-call-interval.js`  
**الأسطر**: 58

**حقول الإدخال**:
- `clinic_id` (string)
- `interval` (number)

**حقول الإخراج**:
- `success` (boolean)

**الجداول المستخدمة**:
- `clinics`

**التعديلات المطلوبة**:
```javascript
// قبل (KV)
await env.KV.put(`clinic:${clinic_id}:interval`, interval);

// بعد (Supabase)
await supabase
  .from('clinics')
  .update({ call_interval: interval })
  .eq('id', clinic_id);
```

---

### 1.7 `/api/v1/admin/status`

**الحالة الحالية**: يعتمد على KV  
**الملف**: `functions/api/v1/admin/status.js`  
**الأسطر**: 62

**حقول الإدخال**: لا يوجد

**حقول الإخراج**:
- `total_queues` (number)
- `total_patients` (number)
- `active_clinics` (number)

**الجداول المستخدمة**:
- `queue`
- `clinics`

**التعديلات المطلوبة**:
```javascript
// قبل (KV)
const queues = await env.KV.list({ prefix: 'queue:' });

// بعد (Supabase)
const { count: total_patients } = await supabase
  .from('queue')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'waiting');
```

---

### 1.8 `/api/v1/admin/system-settings`

**الحالة الحالية**: يعتمد على KV  
**الملف**: `functions/api/v1/admin/system-settings.js`  
**الأسطر**: 179

**حقول الإدخال**:
- `settings` (object)

**حقول الإخراج**:
- `success` (boolean)
- `settings` (object)

**الجداول المستخدمة**:
- `settings`

**التعديلات المطلوبة**:
```javascript
// قبل (KV)
await env.KV.put('settings:theme', theme);

// بعد (Supabase)
await supabase
  .from('settings')
  .upsert({
    key: 'theme',
    value: { theme },
    updated_by: admin_id
  });
```

---

### 1.9 `/api/v1/admin/system-settings/reset`

**الحالة الحالية**: يعتمد على KV  
**الملف**: `functions/api/v1/admin/system-settings/reset.js`  
**الأسطر**: 68

**حقول الإدخال**: لا يوجد

**حقول الإخراج**:
- `success` (boolean)

**الجداول المستخدمة**:
- `settings`

**التعديلات المطلوبة**:
```javascript
// قبل (KV)
await env.KV.delete('settings:*');

// بعد (Supabase)
await supabase
  .from('settings')
  .delete()
  .neq('key', ''); // حذف جميع الإعدادات
```

---

## 2. Cron Jobs (5 endpoints)

### 2.1 `/api/v1/cron/auto-call-next`

**الحالة الحالية**: يعتمد على KV  
**الملف**: `functions/api/v1/cron/auto-call-next.js`  
**الأسطر**: 242

**التعديلات المطلوبة**:
```javascript
// قبل (KV)
const queue = await env.KV.get(`queue:${clinic}`, 'json');
const nextPatient = queue[0];
await env.KV.put(`queue:${clinic}`, JSON.stringify(queue.slice(1)));

// بعد (Supabase)
const { data: nextPatient } = await supabase
  .from('queue')
  .select('*')
  .eq('clinic_id', clinic)
  .eq('status', 'waiting')
  .order('position', { ascending: true })
  .limit(1)
  .single();

await supabase
  .from('queue')
  .update({ status: 'called', called_at: new Date() })
  .eq('id', nextPatient.id);
```

---

### 2.2 `/api/v1/cron/daily-report`

**الحالة الحالية**: يعتمد على KV  
**الملف**: `functions/api/v1/cron/daily-report.js`  
**الأسطر**: 134

**التعديلات المطلوبة**:
```javascript
// قبل (KV)
await env.KV.put(`report:daily:${date}`, JSON.stringify(reportData));

// بعد (Supabase)
await supabase
  .from('reports')
  .insert({
    type: 'daily',
    period_start: date,
    period_end: date,
    total_patients: reportData.total,
    completed_patients: reportData.completed,
    data: reportData
  });
```

---

### 2.3 `/api/v1/cron/daily-reset`

**الحالة الحالية**: يعتمد على KV  
**الملف**: `functions/api/v1/cron/daily-reset.js`  
**الأسطر**: 113

**التعديلات المطلوبة**:
```javascript
// قبل (KV)
await env.KV.delete('queue:*');

// بعد (Supabase)
await supabase
  .from('queue')
  .delete()
  .in('status', ['completed', 'cancelled'])
  .lt('completed_at', yesterday);
```

---

### 2.4 `/api/v1/cron/notify-poller`

**الحالة الحالية**: يعتمد على KV  
**الملف**: `functions/api/v1/cron/notify-poller.js`  
**الأسطر**: 89

**التعديلات المطلوبة**:
```javascript
// قبل (KV)
const notifications = await env.KV.get('notifications:pending', 'json');

// بعد (Supabase)
const { data: notifications } = await supabase
  .from('notifications')
  .select('*')
  .eq('is_read', false)
  .order('sent_at', { ascending: false });
```

---

### 2.5 `/api/v1/cron/timeout-handler`

**الحالة الحالية**: يعتمد على KV  
**الملف**: `functions/api/v1/cron/timeout-handler.js`  
**الأسطر**: 76

**التعديلات المطلوبة**:
```javascript
// قبل (KV)
const timedOut = await env.KV.get('queue:timeout', 'json');

// بعد (Supabase)
const { data: timedOut } = await supabase
  .from('queue')
  .select('*')
  .eq('status', 'called')
  .lt('called_at', timeout_threshold);
```

---

## 3. Queue APIs (6 endpoints)

### 3.1 `/api/v1/queue/enter`

**الحالة الحالية**: يعتمد على KV  
**الملف**: `functions/api/v1/queue/enter.js`  
**الأسطر**: 156

**التعديلات المطلوبة**:
```javascript
// قبل (KV)
const queue = await env.KV.get(`queue:${clinic}`, 'json') || [];
queue.push(newPatient);
await env.KV.put(`queue:${clinic}`, JSON.stringify(queue));

// بعد (Supabase)
const { data: newEntry } = await supabase
  .from('queue')
  .insert({
    patient_id,
    patient_name,
    clinic_id,
    exam_type,
    status: 'waiting',
    position: nextPosition
  })
  .select()
  .single();
```

---

### 3.2 `/api/v1/queue/call`

**الحالة الحالية**: يعتمد على KV  
**الملف**: `functions/api/v1/queue/call.js`  
**الأسطر**: 128

**التعديلات المطلوبة**:
```javascript
// قبل (KV)
await env.KV.put(`patient:${patient_id}:status`, 'called');

// بعد (Supabase)
await supabase
  .from('queue')
  .update({
    status: 'called',
    called_at: new Date()
  })
  .eq('patient_id', patient_id);
```

---

### 3.3 `/api/v1/queue/done`

**الحالة الحالية**: يعتمد على KV  
**الملف**: `functions/api/v1/queue/done.js`  
**الأسطر**: 94

**التعديلات المطلوبة**:
```javascript
// قبل (KV)
await env.KV.put(`patient:${patient_id}:status`, 'completed');

// بعد (Supabase)
await supabase
  .from('queue')
  .update({
    status: 'completed',
    completed_at: new Date()
  })
  .eq('patient_id', patient_id);
```

---

### 3.4 `/api/v1/queue/position`

**الحالة الحالية**: يعتمد على KV  
**الملف**: `functions/api/v1/queue/position.js`  
**الأسطر**: 72

**التعديلات المطلوبة**:
```javascript
// قبل (KV)
const position = await env.KV.get(`patient:${patient_id}:position`);

// بعد (Supabase)
const { data } = await supabase
  .from('queue')
  .select('position')
  .eq('patient_id', patient_id)
  .single();
```

---

### 3.5 `/api/v1/queue/status`

**الحالة الحالية**: يعتمد على KV  
**الملف**: `functions/api/v1/queue/status.js`  
**الأسطر**: 86

**التعديلات المطلوبة**:
```javascript
// قبل (KV)
const queue = await env.KV.get(`queue:${clinic}`, 'json');

// بعد (Supabase)
const { data: queue } = await supabase
  .from('queue')
  .select('*')
  .eq('clinic_id', clinic)
  .in('status', ['waiting', 'called'])
  .order('position', { ascending: true });
```

---

### 3.6 `/api/v1/queue/enter-updated`

**الحالة الحالية**: يعتمد على KV  
**الملف**: `functions/api/v1/queue/enter-updated.js`  
**الأسطر**: 178

**التعديلات المطلوبة**: مشابه لـ `/api/v1/queue/enter`

---

## 4. Patient APIs (5 endpoints)

### 4.1 `/api/v1/patient/login`

**التعديلات المطلوبة**:
```javascript
// قبل (KV)
const patient = await env.KV.get(`patient:${id}`, 'json');

// بعد (Supabase)
const { data: patient } = await supabase
  .from('users')
  .select('*')
  .eq('username', id)
  .eq('role', 'patient')
  .single();
```

---

### 4.2 `/api/v1/patient/my-position`

**التعديلات المطلوبة**: مشابه لـ `/api/v1/queue/position`

---

### 4.3 `/api/v1/patient/record`

**التعديلات المطلوبة**:
```javascript
// قبل (KV)
await env.KV.put(`patient:${id}:record`, JSON.stringify(record));

// بعد (Supabase)
await supabase
  .from('queue')
  .update({ metadata: record })
  .eq('patient_id', id);
```

---

### 4.4 `/api/v1/patient/status`

**التعديلات المطلوبة**: مشابه لـ `/api/v1/queue/status`

---

### 4.5 `/api/v1/patient/verify-pin`

**التعديلات المطلوبة**:
```javascript
// قبل (KV)
const pin = await env.KV.get(`pin:${clinic}`);

// بعد (Supabase)
const { data: clinic_data } = await supabase
  .from('clinics')
  .select('pin_code, pin_expires_at')
  .eq('id', clinic)
  .single();
```

---

## 5. PIN APIs (4 endpoints)

### 5.1-5.4 `/api/v1/pin/*`

جميعها تستخدم جدول `clinics` (حقول `pin_code` و `pin_expires_at`).

---

## 6. Route APIs (2 endpoints)

### 6.1 `/api/v1/route/create`

**التعديلات المطلوبة**:
```javascript
// قبل (KV)
await env.KV.put(`route:${exam_type}`, JSON.stringify(route));

// بعد (Supabase)
await supabase
  .from('routes')
  .insert({
    exam_type,
    route_name,
    clinics: route.clinics,
    order_sequence
  });
```

---

### 6.2 `/api/v1/route/get`

**التعديلات المطلوبة**:
```javascript
// قبل (KV)
const route = await env.KV.get(`route:${exam_type}`, 'json');

// بعد (Supabase)
const { data: route } = await supabase
  .from('routes')
  .select('*')
  .eq('exam_type', exam_type)
  .eq('is_active', true)
  .single();
```

---

## 7. Stats APIs (2 endpoints)

### 7.1 `/api/v1/stats/dashboard`

**التعديلات المطلوبة**:
```javascript
// قبل (KV)
const stats = await env.KV.get('stats:dashboard', 'json');

// بعد (Supabase)
const { data: stats } = await supabase
  .rpc('get_dashboard_stats'); // استخدام stored procedure
```

---

### 7.2 `/api/v1/stats/queues`

**التعديلات المطلوبة**: مشابه لـ dashboard

---

## 8. Other APIs (4 endpoints)

### 8.1 `/api/v1/events/stream` (SSE)

**التعديلات المطلوبة**:
استبدال بـ **Supabase Realtime** (لا حاجة لـ SSE endpoint منفصل)

---

### 8.2 `/api/v1/health/status`

**التعديلات المطلوبة**:
```javascript
// قبل (KV)
const health = await env.KV.get('health');

// بعد (Supabase)
const { error } = await supabase.from('clinics').select('count').limit(1);
return { status: error ? 'unhealthy' : 'healthy' };
```

---

### 8.3 `/api/v1/notify/status`

**التعديلات المطلوبة**: استخدام جدول `notifications`

---

### 8.4 `/api/v1/path/choose`

**التعديلات المطلوبة**: استخدام جدول `routes`

---

## 9. خطوات التنفيذ

1. **إنشاء Supabase client wrapper** في ملف مشترك
2. **تحديث endpoint واحد** كاختبار
3. **اختبار شامل** للـ endpoint المحدث
4. **تحديث باقي endpoints** بالتدريج
5. **اختبار نهائي** لجميع الوظائف

---

## 10. ملاحظات مهمة

- **جميع التعديلات تحتاج اختبار دقيق**
- **استخدام transactions** للعمليات المعقدة
- **معالجة الأخطاء** بشكل صحيح
- **الحفاظ على التوافقية** مع الواجهة الأمامية

---

**تم إعداده بواسطة**: Manus AI  
**التاريخ**: 2025-10-24  
**الحالة**: جاهز للتنفيذ بعد الموافقة


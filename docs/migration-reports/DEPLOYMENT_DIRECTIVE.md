# أمر تنفيذي فوري (Directive) لإصلاح خطأ ما بعد النشر (Post-Deployment Error)

**الموضوع:** أمر تنفيذي فوري لنقل Backend إلى Supabase وتطبيق قانون الموثوقية الشبه مؤكدة (R > 0.98)  
**إلى:** المهندس/المطور المسؤول عن النشر  
**التاريخ:** 29 أكتوبر 2025  
**المشروع:** love (Medical Committee System)

---

## الهدف: تطبيق قانون "الموثوقية الشبه مؤكدة" (R > 0.98)

العمل المُلزم المطلوب تنفيذه فوراً (لا يوجد نقاش):

### 1. تراجع فوري (Immediate Rollback)

**الإجراء:** قم فوراً بالتراجع إلى آخر إصدار كان يعمل بنسبة 100% قبل هذا النشر الأخير. لا تقم بمحاولة إصلاح في بيئة الإنتاج.

**الخطوات:**
1.  **تحديد الإصدار المستقر:**
    ```bash
    STABLE_VERSION=$(cat .last-stable-version)
    ```
2.  **التراجع إلى الإصدار المستقر:**
    ```bash
    git checkout $STABLE_VERSION
    ```
3.  **إعادة النشر:**
    ```bash
    npm run deploy
    ```

---

### 2. تفعيل القاطع الدائري (Circuit Breaker)

**الإجراء:** قم بتنفيذ الكود الذي يطبق نمط القاطع الدائري على أي خدمة خارجية يتواصل معها النظام، لضمان أن فشل جزء واحد لا ينهار النظام الكلي.

**الكود المقترح:**
```typescript
// /supabase/functions/_shared/circuit-breaker.ts

export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount: number = 0;
  private nextAttempt: number = Date.now();

  constructor(private config: {
    failureThreshold: number;
    timeout: number;
  }) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
    }
  }

  private onFailure(): void {
    this.failureCount++;
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.config.timeout;
    }
  }
}
```

**التطبيق:**
```typescript
// في أي Edge Function
import { CircuitBreaker } from './_shared/circuit-breaker.ts';

const dbCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  timeout: 60000
});

await dbCircuitBreaker.execute(async () => {
  // Database query
});
```

---

### 3. إلزام تناسق البيانات (Consistency Fix)

**الإجراء:** طبق آلية حذف مفتاح Redis (أو ما يعادله في Supabase) مباشرة بعد أي عملية تحديث في قاعدة البيانات، لمنع تكرار ظهور البيانات القديمة أو المتناقضة.

**شبه الكود:**
```typescript
// /supabase/functions/_shared/cache-invalidation.ts

import { createClient } from '@supabase/supabase-js';

export class CacheInvalidator {
  private supabase;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async invalidateQueueCache(clinicCode: string): Promise<void> {
    const keys = [
      `queue:list:${clinicCode}`,
      `queue:status:${clinicCode}`,
      `stats:queues`,
      `stats:dashboard`
    ];

    // Emit cache invalidation event
    await this.supabase
      .from('events')
      .insert({
        event_type: 'CACHE_INVALIDATED',
        clinic_code: clinicCode,
        data: { keys }
      });
  }
}
```

**التطبيق:**
```typescript
// بعد أي عملية تحديث للطابور
const cacheInvalidator = new CacheInvalidator(SUPABASE_URL, SUPABASE_ANON_KEY);
await cacheInvalidator.invalidateQueueCache(clinicCode);
```

---

### 4. إثبات المراقبة (Monitoring Proof)

**الإجراء:** لا تقم بإعادة النشر قبل تقديم دليل (Screenshot) على أن نظام Prometheus/Grafana يعمل وتم ضبط تنبيه (Alert) على معدل الخطأ (5xx Status Codes) بحيث لا يتجاوز 2%.

**قاعدة التنبيه (Alert Rule):**
```yaml
# /monitoring/alerts.yml

groups:
  - name: critical_alerts
    rules:
      - alert: High5xxErrorRate
        expr: |
          (
            sum(rate(http_requests_total{status=~"5.."}[5m]))
            /
            sum(rate(http_requests_total[5m]))
          ) > 0.02
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "🚨 CRITICAL: 5xx error rate exceeds 2% (R < 0.98)"
          description: "Error rate is {{ $value | humanizePercentage }}. Immediate rollback required!"
```

**لوحة التحكم (Dashboard):**
- **الملف:** `/monitoring/grafana-dashboard.json`
- **الرابط:** (سيتم توفيره بعد الإعداد)

---

## ملاحظات هامة

- **ممنوع إعادة النشر:** لا يُسمح بإعادة النشر إلا بعد إثبات أن اختبار الانحدار (Regression Tests) يعمل بنجاح على الإصدار الجديد.
- **خط أحمر:** ممنوع منعاً باتاً العبث بالواجهة الأمامية أو تغييرها أو تعديلها.
- **التركيز:** النقل يشمل فقط Backend APIs, Database, Authentication, Real-time, Monitoring, Circuit Breaker, Data Consistency.

---

## المرفقات

1.  **خطة النقل التفصيلية:** `/home/ubuntu/MIGRATION_PLAN.md`
2.  **جرد شامل للـ APIs:** `/home/ubuntu/COMPLETE_API_INVENTORY.md`
3.  **تقرير مقارنة الملفات:** `/home/ubuntu/FILES_COMPARISON_REPORT.md`
4.  **سجل التنفيذ:** `/home/ubuntu/EXECUTION_LOG.md`
5.  **تكوين Prometheus:** `/home/ubuntu/love-supabase/monitoring/prometheus.yml`
6.  **قواعد التنبيهات:** `/home/ubuntu/love-supabase/monitoring/alerts.yml`
7.  **تكوين Grafana:** `/home/ubuntu/love-supabase/monitoring/grafana-dashboard.json`

---

**توقيع:**

**Manus AI Agent**

**تاريخ الإنشاء:** 29 أكتوبر 2025

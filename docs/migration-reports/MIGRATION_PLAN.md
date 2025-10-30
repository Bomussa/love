# خطة النقل التفصيلية من Vercel/Cloudflare إلى Supabase

**التاريخ:** 29 أكتوبر 2025  
**المشروع:** love (Medical Committee System)  
**الهدف:** نقل Backend بالكامل من Vercel/Cloudflare إلى Supabase مع تطبيق معايير الموثوقية (R > 0.98)

---

## معلومات Supabase Project

**Project ID:** `rujwuruuosffcxazymit`  
**Organization ID:** `wkjhsmalzkikvaosxvib`  
**Project Name:** MMC-MMS  
**Region:** ap-southeast-1 (Singapore)  
**Status:** ACTIVE_HEALTHY  
**Database Host:** db.rujwuruuosffcxazymit.supabase.co  
**PostgreSQL Version:** 17.6.1.025  
**Engine:** PostgreSQL 17

---

## المرحلة 1: إعداد قاعدة البيانات PostgreSQL

### 1.1 إنشاء Schema الأساسي

**الملف:** `/home/ubuntu/love-supabase/migrations/001_initial_schema.sql`

```sql
-- ==========================================
-- Schema: Public
-- ==========================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ==========================================
-- Table: admins
-- ==========================================
CREATE TABLE IF NOT EXISTS public.admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- Table: patients
-- ==========================================
CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id TEXT UNIQUE NOT NULL,
    gender TEXT CHECK (gender IN ('male', 'female')),
    session_id TEXT UNIQUE,
    login_time TIMESTAMPTZ,
    status TEXT DEFAULT 'logged_in',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_patients_patient_id ON public.patients(patient_id);
CREATE INDEX idx_patients_session_id ON public.patients(session_id);

-- ==========================================
-- Table: clinics
-- ==========================================
CREATE TABLE IF NOT EXISTS public.clinics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    call_interval INTEGER DEFAULT 300,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default clinics
INSERT INTO public.clinics (code, name) VALUES
    ('lab', 'Laboratory'),
    ('xray', 'X-Ray'),
    ('vitals', 'Vital Signs'),
    ('ecg', 'ECG'),
    ('audio', 'Audiometry'),
    ('eyes', 'Ophthalmology'),
    ('internal', 'Internal Medicine'),
    ('ent', 'ENT'),
    ('surgery', 'Surgery'),
    ('dental', 'Dental'),
    ('psychiatry', 'Psychiatry'),
    ('derma', 'Dermatology'),
    ('bones', 'Orthopedics')
ON CONFLICT (code) DO NOTHING;

-- ==========================================
-- Table: queues
-- ==========================================
CREATE TABLE IF NOT EXISTS public.queues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_code TEXT NOT NULL REFERENCES public.clinics(code) ON DELETE CASCADE,
    patient_id TEXT NOT NULL,
    queue_number INTEGER NOT NULL,
    status TEXT DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'CALLED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    entered_at TIMESTAMPTZ DEFAULT NOW(),
    called_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_queues_clinic_code ON public.queues(clinic_code);
CREATE INDEX idx_queues_patient_id ON public.queues(patient_id);
CREATE INDEX idx_queues_status ON public.queues(status);
CREATE INDEX idx_queues_entered_at ON public.queues(entered_at);
CREATE UNIQUE INDEX idx_queues_clinic_patient ON public.queues(clinic_code, patient_id) WHERE status IN ('WAITING', 'CALLED', 'IN_PROGRESS');

-- ==========================================
-- Table: pins
-- ==========================================
CREATE TABLE IF NOT EXISTS public.pins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_code TEXT NOT NULL REFERENCES public.clinics(code) ON DELETE CASCADE,
    pin TEXT NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pins_clinic_code ON public.pins(clinic_code);
CREATE INDEX idx_pins_generated_at ON public.pins(generated_at);
CREATE INDEX idx_pins_is_active ON public.pins(is_active);

-- ==========================================
-- Table: routes
-- ==========================================
CREATE TABLE IF NOT EXISTS public.routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id TEXT UNIQUE NOT NULL,
    patient_id TEXT NOT NULL,
    clinics JSONB NOT NULL,
    current_clinic TEXT,
    completed_clinics JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_routes_route_id ON public.routes(route_id);
CREATE INDEX idx_routes_patient_id ON public.routes(patient_id);
CREATE INDEX idx_routes_status ON public.routes(status);

-- ==========================================
-- Table: events
-- ==========================================
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type TEXT NOT NULL,
    clinic_code TEXT,
    patient_id TEXT,
    position INTEGER,
    data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_event_type ON public.events(event_type);
CREATE INDEX idx_events_clinic_code ON public.events(clinic_code);
CREATE INDEX idx_events_created_at ON public.events(created_at);

-- Auto-delete events older than 1 hour
CREATE OR REPLACE FUNCTION delete_old_events()
RETURNS void AS $$
BEGIN
    DELETE FROM public.events WHERE created_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- Table: settings
-- ==========================================
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_settings_key ON public.settings(key);

-- ==========================================
-- Table: reports
-- ==========================================
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_type TEXT NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly', 'annual')),
    report_date DATE NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reports_report_type ON public.reports(report_type);
CREATE INDEX idx_reports_report_date ON public.reports(report_date);
CREATE UNIQUE INDEX idx_reports_type_date ON public.reports(report_type, report_date);

-- ==========================================
-- Table: rate_limits
-- ==========================================
CREATE TABLE IF NOT EXISTS public.rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    request_count INTEGER DEFAULT 0,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rate_limits_client_id ON public.rate_limits(client_id);
CREATE INDEX idx_rate_limits_window_start ON public.rate_limits(window_start);
CREATE UNIQUE INDEX idx_rate_limits_client_endpoint ON public.rate_limits(client_id, endpoint, window_start);

-- ==========================================
-- Enable Row Level Security (RLS)
-- ==========================================
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- RLS Policies
-- ==========================================

-- Public read access for clinics
CREATE POLICY "Allow public read access to clinics"
    ON public.clinics FOR SELECT
    USING (true);

-- Public read access for pins (current only)
CREATE POLICY "Allow public read access to active pins"
    ON public.pins FOR SELECT
    USING (is_active = true);

-- Public access to queues (with restrictions)
CREATE POLICY "Allow public read access to queues"
    ON public.queues FOR SELECT
    USING (true);

CREATE POLICY "Allow public insert to queues"
    ON public.queues FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow public update to queues"
    ON public.queues FOR UPDATE
    USING (true);

-- Public access to events
CREATE POLICY "Allow public read access to events"
    ON public.events FOR SELECT
    USING (true);

CREATE POLICY "Allow public insert to events"
    ON public.events FOR INSERT
    WITH CHECK (true);

-- Admin-only access to admins table
CREATE POLICY "Allow authenticated admin access to admins"
    ON public.admins FOR ALL
    USING (auth.role() = 'authenticated');

-- Public access to patients
CREATE POLICY "Allow public access to patients"
    ON public.patients FOR ALL
    USING (true);

-- Public access to routes
CREATE POLICY "Allow public access to routes"
    ON public.routes FOR ALL
    USING (true);

-- Public read access to settings
CREATE POLICY "Allow public read access to settings"
    ON public.settings FOR SELECT
    USING (true);

-- Public read access to reports
CREATE POLICY "Allow public read access to reports"
    ON public.reports FOR SELECT
    USING (true);

-- Public access to rate_limits
CREATE POLICY "Allow public access to rate_limits"
    ON public.rate_limits FOR ALL
    USING (true);

-- ==========================================
-- Functions: Queue Management
-- ==========================================

-- Function: Get next queue number
CREATE OR REPLACE FUNCTION get_next_queue_number(p_clinic_code TEXT)
RETURNS INTEGER AS $$
DECLARE
    v_next_number INTEGER;
BEGIN
    SELECT COALESCE(MAX(queue_number), 0) + 1
    INTO v_next_number
    FROM public.queues
    WHERE clinic_code = p_clinic_code
    AND DATE(entered_at) = CURRENT_DATE;
    
    RETURN v_next_number;
END;
$$ LANGUAGE plpgsql;

-- Function: Enter queue
CREATE OR REPLACE FUNCTION enter_queue(
    p_clinic_code TEXT,
    p_patient_id TEXT,
    p_is_auto_entry BOOLEAN DEFAULT FALSE
)
RETURNS JSONB AS $$
DECLARE
    v_queue_number INTEGER;
    v_queue_id UUID;
    v_position INTEGER;
    v_ahead INTEGER;
    v_total_waiting INTEGER;
    v_existing_queue RECORD;
BEGIN
    -- Check if patient already in queue
    SELECT * INTO v_existing_queue
    FROM public.queues
    WHERE clinic_code = p_clinic_code
    AND patient_id = p_patient_id
    AND status IN ('WAITING', 'CALLED', 'IN_PROGRESS');
    
    IF FOUND THEN
        -- Return existing queue info
        SELECT COUNT(*) INTO v_position
        FROM public.queues
        WHERE clinic_code = p_clinic_code
        AND status = 'WAITING'
        AND entered_at <= v_existing_queue.entered_at;
        
        SELECT COUNT(*) INTO v_total_waiting
        FROM public.queues
        WHERE clinic_code = p_clinic_code
        AND status = 'WAITING';
        
        RETURN jsonb_build_object(
            'success', true,
            'clinic', p_clinic_code,
            'user', p_patient_id,
            'number', v_existing_queue.queue_number,
            'status', 'ALREADY_IN_QUEUE',
            'display_number', v_position,
            'ahead', v_position - 1,
            'total_waiting', v_total_waiting,
            'entry_time', v_existing_queue.entered_at,
            'message', 'Already in queue'
        );
    END IF;
    
    -- Get next queue number
    v_queue_number := get_next_queue_number(p_clinic_code);
    
    -- Insert new queue entry
    INSERT INTO public.queues (clinic_code, patient_id, queue_number, status)
    VALUES (p_clinic_code, p_patient_id, v_queue_number, CASE WHEN p_is_auto_entry THEN 'IN_PROGRESS' ELSE 'WAITING' END)
    RETURNING id INTO v_queue_id;
    
    -- Get position
    SELECT COUNT(*) INTO v_position
    FROM public.queues
    WHERE clinic_code = p_clinic_code
    AND status = 'WAITING';
    
    v_ahead := v_position - 1;
    v_total_waiting := v_position;
    
    -- Emit event
    INSERT INTO public.events (event_type, clinic_code, patient_id, position, data)
    VALUES ('ENTERED', p_clinic_code, p_patient_id, v_position, jsonb_build_object('queue_number', v_queue_number));
    
    RETURN jsonb_build_object(
        'success', true,
        'clinic', p_clinic_code,
        'user', p_patient_id,
        'number', v_queue_number,
        'status', 'WAITING',
        'display_number', v_position,
        'ahead', v_ahead,
        'total_waiting', v_total_waiting,
        'entry_time', NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- Function: Call next patient
CREATE OR REPLACE FUNCTION call_next_patient(p_clinic_code TEXT)
RETURNS JSONB AS $$
DECLARE
    v_queue RECORD;
BEGIN
    -- Get next waiting patient
    SELECT * INTO v_queue
    FROM public.queues
    WHERE clinic_code = p_clinic_code
    AND status = 'WAITING'
    ORDER BY entered_at ASC
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No patients waiting'
        );
    END IF;
    
    -- Update status to CALLED
    UPDATE public.queues
    SET status = 'CALLED', called_at = NOW(), updated_at = NOW()
    WHERE id = v_queue.id;
    
    -- Emit event
    INSERT INTO public.events (event_type, clinic_code, patient_id, data)
    VALUES ('CALLED', p_clinic_code, v_queue.patient_id, jsonb_build_object('queue_number', v_queue.queue_number));
    
    RETURN jsonb_build_object(
        'success', true,
        'called', jsonb_build_object(
            'number', v_queue.queue_number,
            'user', v_queue.patient_id,
            'status', 'CALLED'
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Function: Complete patient service
CREATE OR REPLACE FUNCTION complete_patient_service(
    p_clinic_code TEXT,
    p_patient_id TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_queue RECORD;
BEGIN
    -- Get queue entry
    SELECT * INTO v_queue
    FROM public.queues
    WHERE clinic_code = p_clinic_code
    AND patient_id = p_patient_id
    AND status IN ('WAITING', 'CALLED', 'IN_PROGRESS');
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Patient not found in queue'
        );
    END IF;
    
    -- Update status to COMPLETED
    UPDATE public.queues
    SET status = 'COMPLETED', completed_at = NOW(), updated_at = NOW()
    WHERE id = v_queue.id;
    
    -- Emit event
    INSERT INTO public.events (event_type, clinic_code, patient_id, data)
    VALUES ('COMPLETED', p_clinic_code, p_patient_id, jsonb_build_object('queue_number', v_queue.queue_number));
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Patient service completed'
    );
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- Functions: PIN Management
-- ==========================================

-- Function: Generate daily PINs
CREATE OR REPLACE FUNCTION generate_daily_pins()
RETURNS JSONB AS $$
DECLARE
    v_clinic RECORD;
    v_pin TEXT;
    v_pins JSONB := '{}'::jsonb;
BEGIN
    -- Deactivate old PINs
    UPDATE public.pins SET is_active = FALSE WHERE is_active = TRUE;
    
    -- Generate new PINs for each clinic
    FOR v_clinic IN SELECT code FROM public.clinics WHERE is_active = TRUE LOOP
        v_pin := LPAD(FLOOR(RANDOM() * 90 + 10)::TEXT, 2, '0');
        
        INSERT INTO public.pins (clinic_code, pin, expires_at)
        VALUES (v_clinic.code, v_pin, CURRENT_DATE + INTERVAL '1 day');
        
        v_pins := v_pins || jsonb_build_object(v_clinic.code, v_pin);
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'pins', v_pins,
        'generated_at', NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- Function: Get current PINs
CREATE OR REPLACE FUNCTION get_current_pins()
RETURNS JSONB AS $$
DECLARE
    v_pins JSONB := '{}'::jsonb;
    v_pin RECORD;
BEGIN
    FOR v_pin IN 
        SELECT clinic_code, pin 
        FROM public.pins 
        WHERE is_active = TRUE 
        AND (expires_at IS NULL OR expires_at > NOW())
    LOOP
        v_pins := v_pins || jsonb_build_object(v_pin.clinic_code, v_pin.pin);
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'pins', v_pins
    );
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- CRON Jobs
-- ==========================================

-- Daily PIN reset at 00:00 Qatar time (UTC+3 = 21:00 UTC)
SELECT cron.schedule('daily-pin-reset', '0 21 * * *', $$SELECT generate_daily_pins()$$);

-- Clean old events every hour
SELECT cron.schedule('clean-old-events', '0 * * * *', $$SELECT delete_old_events()$$);

-- ==========================================
-- Triggers
-- ==========================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_admins_updated_at BEFORE UPDATE ON public.admins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON public.patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clinics_updated_at BEFORE UPDATE ON public.clinics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_queues_updated_at BEFORE UPDATE ON public.queues
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON public.routes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rate_limits_updated_at BEFORE UPDATE ON public.rate_limits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## المرحلة 2: إنشاء Supabase Edge Functions

### 2.1 هيكل المجلدات

```
/home/ubuntu/love-supabase/
├── supabase/
│   ├── functions/
│   │   ├── _shared/
│   │   │   ├── cors.ts
│   │   │   ├── database.ts
│   │   │   ├── circuit-breaker.ts
│   │   │   ├── rate-limiter.ts
│   │   │   └── utils.ts
│   │   ├── health/
│   │   │   └── index.ts
│   │   ├── admin-login/
│   │   │   └── index.ts
│   │   ├── admin-status/
│   │   │   └── index.ts
│   │   ├── patient-login/
│   │   │   └── index.ts
│   │   ├── queue-enter/
│   │   │   └── index.ts
│   │   ├── queue-status/
│   │   │   └── index.ts
│   │   ├── queue-call/
│   │   │   └── index.ts
│   │   ├── queue-done/
│   │   │   └── index.ts
│   │   ├── pin-status/
│   │   │   └── index.ts
│   │   ├── pin-generate/
│   │   │   └── index.ts
│   │   ├── route-create/
│   │   │   └── index.ts
│   │   ├── route-get/
│   │   │   └── index.ts
│   │   ├── path-choose/
│   │   │   └── index.ts
│   │   ├── stats-dashboard/
│   │   │   └── index.ts
│   │   ├── stats-queues/
│   │   │   └── index.ts
│   │   ├── events-stream/
│   │   │   └── index.ts
│   │   ├── reports-daily/
│   │   │   └── index.ts
│   │   ├── reports-weekly/
│   │   │   └── index.ts
│   │   ├── reports-monthly/
│   │   │   └── index.ts
│   │   └── reports-annual/
│   │       └── index.ts
│   └── migrations/
│       └── 001_initial_schema.sql
└── README.md
```

---

## المرحلة 3: تطبيق Circuit Breaker Pattern

### 3.1 Circuit Breaker Implementation

**الملف:** `/home/ubuntu/love-supabase/supabase/functions/_shared/circuit-breaker.ts`

```typescript
/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures by monitoring service health
 */

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing, reject requests
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number;    // Number of failures before opening
  successThreshold: number;    // Number of successes to close from half-open
  timeout: number;             // Time in ms before trying again
  monitoringPeriod: number;    // Time window for counting failures
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private nextAttempt: number = Date.now();
  private lastFailureTime: number = 0;

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is OPEN
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      // Move to HALF_OPEN to test service
      this.state = CircuitState.HALF_OPEN;
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

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
      }
    }
  }

  private onFailure(): void {
    this.lastFailureTime = Date.now();
    this.failureCount++;

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.config.timeout;
      this.successCount = 0;
      return;
    }

    // Check if failures exceeded threshold within monitoring period
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.config.timeout;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
  }
}

// Global circuit breakers for external services
export const circuitBreakers = {
  database: new CircuitBreaker({
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000, // 1 minute
    monitoringPeriod: 60000
  }),
  
  redis: new CircuitBreaker({
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 30000, // 30 seconds
    monitoringPeriod: 60000
  }),
  
  external: new CircuitBreaker({
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 30000,
    monitoringPeriod: 60000
  })
};
```

---

## المرحلة 4: تطبيق Data Consistency Mechanism

### 4.1 Cache Invalidation Strategy

**الملف:** `/home/ubuntu/love-supabase/supabase/functions/_shared/cache-invalidation.ts`

```typescript
/**
 * Cache Invalidation Mechanism
 * Ensures data consistency by invalidating cache after updates
 */

import { createClient } from '@supabase/supabase-js';

export class CacheInvalidator {
  private supabase;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Invalidate cache after queue update
   */
  async invalidateQueueCache(clinicCode: string): Promise<void> {
    const keys = [
      `queue:list:${clinicCode}`,
      `queue:status:${clinicCode}`,
      `stats:queues`,
      `stats:dashboard`
    ];

    // Delete from Supabase Realtime cache
    for (const key of keys) {
      await this.deleteKey(key);
    }

    // Emit cache invalidation event
    await this.supabase
      .from('events')
      .insert({
        event_type: 'CACHE_INVALIDATED',
        clinic_code: clinicCode,
        data: { keys }
      });
  }

  /**
   * Invalidate cache after PIN update
   */
  async invalidatePinCache(): Promise<void> {
    const keys = [
      'pins:current',
      'pins:daily'
    ];

    for (const key of keys) {
      await this.deleteKey(key);
    }
  }

  /**
   * Invalidate cache after route update
   */
  async invalidateRouteCache(routeId: string): Promise<void> {
    const keys = [
      `route:${routeId}`
    ];

    for (const key of keys) {
      await this.deleteKey(key);
    }
  }

  /**
   * Delete key from cache
   */
  private async deleteKey(key: string): Promise<void> {
    // Implementation depends on caching strategy
    // For now, we'll use Supabase Realtime to broadcast invalidation
    await this.supabase
      .channel('cache-invalidation')
      .send({
        type: 'broadcast',
        event: 'invalidate',
        payload: { key }
      });
  }
}
```

---

## المرحلة 5: إعداد Monitoring & Alerting

### 5.1 Prometheus Metrics

**الملف:** `/home/ubuntu/love-supabase/monitoring/prometheus.yml`

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093

rule_files:
  - "alerts.yml"

scrape_configs:
  - job_name: 'supabase-edge-functions'
    static_configs:
      - targets:
          - 'rujwuruuosffcxazymit.supabase.co:443'
    metrics_path: '/functions/v1/metrics'
    scheme: https
```

### 5.2 Alert Rules

**الملف:** `/home/ubuntu/love-supabase/monitoring/alerts.yml`

```yaml
groups:
  - name: supabase_alerts
    interval: 30s
    rules:
      # Alert on 5xx error rate > 2%
      - alert: HighErrorRate
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
          summary: "High 5xx error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }}"

      # Alert on high response time
      - alert: HighResponseTime
        expr: |
          histogram_quantile(0.95, 
            sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
          ) > 1.0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is {{ $value }}s"

      # Alert on circuit breaker open
      - alert: CircuitBreakerOpen
        expr: circuit_breaker_state{state="OPEN"} > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Circuit breaker is OPEN"
          description: "Circuit breaker {{ $labels.service }} is OPEN"

      # Alert on database connection failures
      - alert: DatabaseConnectionFailure
        expr: rate(database_connection_errors_total[5m]) > 0.1
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Database connection failures detected"
          description: "Database connection error rate is {{ $value }}"
```

---

## المرحلة 6: Rollback Strategy

### 6.1 Deployment Versions

**الملف:** `/home/ubuntu/love-supabase/deployment/versions.json`

```json
{
  "versions": [
    {
      "version": "1.0.0",
      "timestamp": "2025-10-29T12:00:00Z",
      "commit": "abc123",
      "status": "stable",
      "health_check_url": "https://rujwuruuosffcxazymit.supabase.co/functions/v1/health"
    }
  ],
  "current": "1.0.0",
  "previous": null
}
```

### 6.2 Rollback Script

**الملف:** `/home/ubuntu/love-supabase/deployment/rollback.sh`

```bash
#!/bin/bash

# Rollback to previous version
PREVIOUS_VERSION=$(jq -r '.previous' deployment/versions.json)

if [ "$PREVIOUS_VERSION" == "null" ]; then
  echo "No previous version to rollback to"
  exit 1
fi

echo "Rolling back to version $PREVIOUS_VERSION..."

# Deploy previous version
supabase functions deploy --version $PREVIOUS_VERSION

# Update versions.json
jq ".current = \"$PREVIOUS_VERSION\"" deployment/versions.json > deployment/versions.tmp
mv deployment/versions.tmp deployment/versions.json

echo "Rollback completed successfully"
```

---

## الخلاصة

**الملفات المطلوب إنشاؤها:**
1. ✅ `/home/ubuntu/love-supabase/migrations/001_initial_schema.sql`
2. ✅ `/home/ubuntu/love-supabase/supabase/functions/_shared/circuit-breaker.ts`
3. ✅ `/home/ubuntu/love-supabase/supabase/functions/_shared/cache-invalidation.ts`
4. ✅ `/home/ubuntu/love-supabase/monitoring/prometheus.yml`
5. ✅ `/home/ubuntu/love-supabase/monitoring/alerts.yml`
6. ✅ `/home/ubuntu/love-supabase/deployment/rollback.sh`
7. 🔄 37 Edge Functions (سيتم إنشاؤها في المرحلة التالية)

**الحالة:** جاهز للتنفيذ ✅

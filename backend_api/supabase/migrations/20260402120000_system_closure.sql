-- =============================================================================
-- SYSTEM CLOSURE MIGRATION - MMC Backend v7.0
-- Date: 2026-04-02
-- Purpose: Complete system closure with single migration
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. DROP LEGACY TABLES (PIN-related)
-- =============================================================================
DROP TABLE IF EXISTS clinic_pins CASCADE;
DROP TABLE IF EXISTS pins CASCADE;
DROP TABLE IF EXISTS daily_pins CASCADE;

-- =============================================================================
-- 2. CLINICS TABLE (Single Source)
-- =============================================================================
CREATE TABLE IF NOT EXISTS clinics (
    id TEXT PRIMARY KEY,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    code TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 3. QUEUES TABLE (Canonical)
-- =============================================================================
CREATE TABLE IF NOT EXISTS queues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id TEXT NOT NULL,
    clinic_id TEXT NOT NULL REFERENCES clinics(id),
    exam_type TEXT,
    display_number INTEGER NOT NULL,
    queue_number TEXT NOT NULL,
    path TEXT[] NOT NULL DEFAULT '{}',
    current_step INTEGER NOT NULL DEFAULT 0 CHECK (current_step >= 0),
    status TEXT NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'CALLED', 'IN_PROGRESS', 'DONE', 'CANCELLED')),
    version INTEGER NOT NULL DEFAULT 1,
    queue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    entered_at TIMESTAMPTZ DEFAULT NOW(),
    called_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Constraints
    UNIQUE(clinic_id, queue_number, queue_date),
    UNIQUE(patient_id, queue_date)
);

-- =============================================================================
-- 4. IDEMPOTENCY KEYS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key TEXT PRIMARY KEY,
    response_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

-- =============================================================================
-- 5. ADMINS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    clinic_id TEXT REFERENCES clinics(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 6. INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_queues_clinic_date_status ON queues(clinic_id, queue_date, status);
CREATE INDEX IF NOT EXISTS idx_queues_patient_date ON queues(patient_id, queue_date);
CREATE INDEX IF NOT EXISTS idx_queues_status ON queues(status);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);

-- =============================================================================
-- 7. RPC FUNCTIONS
-- =============================================================================

-- Atomic Queue Create with FOR UPDATE lock
CREATE OR REPLACE FUNCTION create_queue_atomic(
    p_patient_id TEXT,
    p_exam_type TEXT,
    p_clinic_id TEXT,
    p_path TEXT[],
    p_queue_date DATE
)
RETURNS UUID AS $$
DECLARE
    v_queue_id UUID;
    v_max_number INTEGER;
    v_new_number INTEGER;
BEGIN
    -- Check if patient already has active queue today
    IF EXISTS (
        SELECT 1 FROM queues
        WHERE patient_id = p_patient_id
        AND queue_date = p_queue_date
        AND status NOT IN ('DONE', 'CANCELLED')
    ) THEN
        SELECT id INTO v_queue_id FROM queues
        WHERE patient_id = p_patient_id
        AND queue_date = p_queue_date
        AND status NOT IN ('DONE', 'CANCELLED')
        LIMIT 1;
        RETURN v_queue_id;
    END IF;

    -- Get max queue number with lock
    SELECT COALESCE(MAX(display_number), 0) INTO v_max_number
    FROM queues
    WHERE clinic_id = p_clinic_id AND queue_date = p_queue_date
    FOR UPDATE;

    v_new_number := v_max_number + 1;

    -- Insert new queue
    INSERT INTO queues (
        patient_id, clinic_id, exam_type, display_number, queue_number,
        path, current_step, status, version, queue_date, entered_at
    ) VALUES (
        p_patient_id, p_clinic_id, p_exam_type, v_new_number, v_new_number::TEXT,
        p_path, 0, 'WAITING', 1, p_queue_date, NOW()
    )
    RETURNING id INTO v_queue_id;

    RETURN v_queue_id;
END;
$$ LANGUAGE plpgsql;

-- Atomic Queue Advance with Version Check and Doctor Validation
CREATE OR REPLACE FUNCTION advance_queue_atomic(
    p_queue_id UUID,
    p_expected_version INTEGER,
    p_clinic_id TEXT
)
RETURNS UUID AS $$
DECLARE
    v_queue queues%ROWTYPE;
    v_next_step INTEGER;
    v_is_done BOOLEAN;
    v_new_clinic TEXT;
    v_new_version INTEGER;
    v_result_id UUID;
BEGIN
    -- Get queue with lock
    SELECT * INTO v_queue FROM queues WHERE id = p_queue_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Queue not found';
    END IF;

    -- Doctor validation: must be at current clinic
    IF v_queue.clinic_id != p_clinic_id THEN
        RAISE EXCEPTION 'CLINIC_MISMATCH: Doctor can only advance queue at their own clinic';
    END IF;

    -- Version check
    IF v_queue.version != p_expected_version THEN
        RAISE EXCEPTION 'VERSION_MISMATCH: Concurrent modification detected';
    END IF;

    -- Calculate next state
    v_next_step := v_queue.current_step + 1;
    v_is_done := v_next_step >= array_length(v_queue.path, 1);
    v_new_version := v_queue.version + 1;

    IF v_is_done THEN
        UPDATE queues
        SET status = 'DONE',
            current_step = v_next_step,
            version = v_new_version,
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = p_queue_id
        RETURNING id INTO v_result_id;
    ELSE
        v_new_clinic := v_queue.path[v_next_step + 1]; -- Array is 1-indexed in PostgreSQL
        UPDATE queues
        SET status = 'WAITING',
            clinic_id = v_new_clinic,
            current_step = v_next_step,
            version = v_new_version,
            updated_at = NOW()
        WHERE id = p_queue_id
        RETURNING id INTO v_result_id;
    END IF;

    RETURN v_result_id;
END;
$$ LANGUAGE plpgsql;

-- Recovery: Reset IN_PROGRESS queues older than 8 hours
CREATE OR REPLACE FUNCTION recover_in_progress_queues()
RETURNS void AS $$
BEGIN
    UPDATE queues
    SET status = 'WAITING',
        updated_at = NOW()
    WHERE status = 'IN_PROGRESS'
    AND entered_at < NOW() - INTERVAL '8 hours';

    RAISE NOTICE 'Recovered % IN_PROGRESS queues', FOUND;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 8. SEED DATA - Default Clinics
-- =============================================================================
INSERT INTO clinics (id, name_ar, name_en, code, type) VALUES
    ('LAB', 'المختبر', 'Laboratory', 'LAB', 'diagnostic'),
    ('XR', 'الأشعة', 'X-Ray', 'XR', 'diagnostic'),
    ('BIO', 'تحاليل الدم', 'Blood Tests', 'BIO', 'diagnostic'),
    ('EYE', 'العيون', 'Eye Clinic', 'EYE', 'clinical'),
    ('INT', 'الباطنة', 'Internal Medicine', 'INT', 'clinical'),
    ('SUR', 'الجراحة', 'Surgery', 'SUR', 'clinical'),
    ('ENT', 'الأنف والأذن', 'ENT', 'ENT', 'clinical'),
    ('PSY', 'النفسي', 'Psychiatry', 'PSY', 'clinical'),
    ('DNT', 'الأسنان', 'Dental', 'DNT', 'clinical'),
    ('DER', 'الجلدية', 'Dermatology', 'DER', 'clinical'),
    ('ECG', 'قلب', 'ECG', 'ECG', 'diagnostic'),
    ('AUD', 'سمع', 'Audiology', 'AUD', 'diagnostic')
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- =============================================================================
-- POST-MIGRATION NOTES
-- =============================================================================
-- 1. All PIN-related code has been removed
-- 2. Queue operations are now atomic and idempotent
-- 3. Version control prevents race conditions
-- 4. Doctor validation ensures clinic ownership
-- 5. System can recover from crashes on startup

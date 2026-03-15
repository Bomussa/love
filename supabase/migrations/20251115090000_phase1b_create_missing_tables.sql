-- Phase 1B: Create missing tables (pathways, queues)
-- Date: 2025-11-15
-- Purpose: Stabilization - add missing tables required by app

-- ============================================
-- 1. CREATE PATHWAYS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS pathways (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL,
    gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
    pathway JSONB NOT NULL,
    current_step INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for pathways
CREATE INDEX IF NOT EXISTS idx_pathways_patient ON pathways(patient_id);
CREATE INDEX IF NOT EXISTS idx_pathways_completed ON pathways(completed);

-- Enable RLS on pathways
ALTER TABLE pathways ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for pathways
CREATE POLICY "Allow public read access on pathways" ON pathways
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert on pathways" ON pathways
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated update on pathways" ON pathways
    FOR UPDATE USING (true);

-- ============================================
-- 2. CREATE QUEUES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS queues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    display_number INTEGER NOT NULL,
    status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'serving', 'completed', 'skipped')),
    entered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    called_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by_pin TEXT,
    UNIQUE(clinic_id, patient_id, entered_at)
);

-- Create indexes for queues
CREATE INDEX IF NOT EXISTS idx_queues_clinic_status ON queues(clinic_id, status);
CREATE INDEX IF NOT EXISTS idx_queues_patient ON queues(patient_id);
CREATE INDEX IF NOT EXISTS idx_queues_entered_at ON queues(entered_at DESC);

-- Enable RLS on queues
ALTER TABLE queues ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for queues
CREATE POLICY "Allow public read access on queues" ON queues
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert on queues" ON queues
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated update on queues" ON queues
    FOR UPDATE USING (true);

CREATE POLICY "Allow authenticated delete on queues" ON queues
    FOR DELETE USING (true);

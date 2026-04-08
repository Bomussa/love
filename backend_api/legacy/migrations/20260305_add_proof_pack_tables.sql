-- Migration: Add Proof Pack Tables for Autonomous QA and Self-Healing
-- Date: 2026-03-05

-- 1. QA Runs: Records each Deep QA execution
CREATE TABLE IF NOT EXISTS public.qa_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
    ok BOOLEAN,
    stats JSONB DEFAULT '{}'::jsonb, -- {clinics_checked, total_findings, etc}
    contracts JSONB DEFAULT '[]'::jsonb, -- snapshots of endpoint hashes
    performance JSONB DEFAULT '{}'::jsonb, -- {p95_latency, error_rate}
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 2. QA Findings: Records each issue found during a QA run
CREATE TABLE IF NOT EXISTS public.qa_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES public.qa_runs(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- SETTINGS_DRIFT, CB_STUCK, etc
    severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    description TEXT NOT NULL,
    fingerprint TEXT NOT NULL, -- Unique hash to prevent duplicates
    metadata JSONB DEFAULT '{}'::jsonb,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    repair_run_id UUID, -- Link to repair attempt
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Repair Runs: Records each self-healing attempt
CREATE TABLE IF NOT EXISTS public.repair_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES public.qa_runs(id) ON DELETE CASCADE,
    finding_id UUID REFERENCES public.qa_findings(id) ON DELETE CASCADE,
    playbook TEXT NOT NULL, -- SETTINGS_SYNC, CB_RESET, etc
    status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'success', 'failed')),
    logs TEXT,
    artifacts JSONB DEFAULT '[]'::jsonb, -- links to PRs, commits, logs
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 4. Contract Snapshots: Baseline for endpoint response shapes
CREATE TABLE IF NOT EXISTS public.contract_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    shape_hash TEXT NOT NULL,
    is_canonical BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(endpoint, method, shape_hash)
);

-- 5. Performance Snapshots: Historical latency data
CREATE TABLE IF NOT EXISTS public.performance_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint TEXT NOT NULL,
    p95_latency_ms INTEGER,
    error_rate DECIMAL(5,2),
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.qa_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_snapshots ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access to qa_runs" ON public.qa_runs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to qa_findings" ON public.qa_findings FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to repair_runs" ON public.repair_runs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to contract_snapshots" ON public.contract_snapshots FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to performance_snapshots" ON public.performance_snapshots FOR ALL USING (auth.role() = 'service_role');

-- Public/Admin read access
CREATE POLICY "Admin read access to qa_runs" ON public.qa_runs FOR SELECT USING (true);
CREATE POLICY "Admin read access to qa_findings" ON public.qa_findings FOR SELECT USING (true);
CREATE POLICY "Admin read access to repair_runs" ON public.repair_runs FOR SELECT USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_qa_findings_run_id ON public.qa_findings(run_id);
CREATE INDEX IF NOT EXISTS idx_qa_findings_fingerprint ON public.qa_findings(fingerprint);
CREATE INDEX IF NOT EXISTS idx_repair_runs_finding_id ON public.repair_runs(finding_id);
CREATE INDEX IF NOT EXISTS idx_contract_snapshots_endpoint ON public.contract_snapshots(endpoint);
CREATE INDEX IF NOT EXISTS idx_performance_snapshots_recorded_at ON public.performance_snapshots(recorded_at DESC);

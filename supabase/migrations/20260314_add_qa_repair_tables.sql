-- Create QA & Repair tables if they don't exist
CREATE TABLE IF NOT EXISTS qa_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    total_findings INTEGER DEFAULT 0,
    critical_findings INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS qa_findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES qa_runs(id) ON DELETE CASCADE,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL CHECK (status IN ('open', 'resolved', 'ignored')),
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS repair_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    finding_id UUID REFERENCES qa_findings(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    logs TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE qa_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_runs ENABLE ROW LEVEL SECURITY;

-- Simple policies (allow all for now to ensure connection works)
CREATE POLICY "Allow all for authenticated users" ON qa_runs FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated users" ON qa_findings FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated users" ON repair_runs FOR ALL TO authenticated USING (true);


import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // The Schema SQL
    const sql = `
-- EXTENSIONS
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- TYPES
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'queue_status') THEN
        CREATE TYPE public.queue_status AS ENUM ('waiting', 'called', 'in_service', 'completed', 'cancelled', 'no_show', 'in_progress');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender_type') THEN
        CREATE TYPE public.gender_type AS ENUM ('male', 'female');
    END IF;
END $$;

-- TABLES

-- 1. Clinics
create table if not exists public.clinics (
    id text primary key,
    name_en text not null,
    name_ar text not null,
    is_active boolean default true,
    pin_code text,
    pin_expires_at timestamptz,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- 2. Patients
create table if not exists public.patients (
    id uuid primary key default gen_random_uuid(),
    patient_id text unique not null,
    gender text not null,
    created_at timestamptz default now()
);

-- 3. Patient Sessions
create table if not exists public.patient_sessions (
    id uuid primary key default gen_random_uuid(),
    patient_id uuid references public.patients(id),
    token text unique,
    expires_at timestamptz,
    created_at timestamptz default now()
);

-- 4. Queue
create table if not exists public.queue (
    id uuid primary key default gen_random_uuid(),
    clinic_id text references public.clinics(id),
    patient_id uuid references public.patients(id),
    queue_number text,
    position integer,
    status text default 'waiting',
    entered_at timestamptz default now(),
    called_at timestamptz,
    completed_at timestamptz,
    completed_by_pin text
);

-- 5. Pins (History/Log)
create table if not exists public.pins (
    id uuid primary key default gen_random_uuid(),
    clinic_code text,
    pin text,
    is_active boolean default true,
    created_at timestamptz default now(),
    expires_at timestamptz
);

-- 6. Events (Realtime)
create table if not exists public.events (
    id uuid primary key default gen_random_uuid(),
    event_type text,
    clinic_id text,
    patient_id uuid,
    payload jsonb,
    created_at timestamptz default now()
);

-- SEED DATA (Clinics)
INSERT INTO public.clinics (id, name_en, name_ar) VALUES
('INT', 'Internal Medicine', 'الباطنية'),
('EYE', 'Ophthalmology', 'العيون'),
('ENT', 'ENT', 'أنف وأذن وحنجرة'),
('DER', 'Dermatology', 'الجلدية'),
('SUR', 'Surgery', 'الجراحة'),
('DNT', 'Dental', 'الأسنان'),
('LAB', 'Laboratory', 'المختبر'),
('XR', 'Radiology', 'الأشعة')
ON CONFLICT (id) DO NOTHING;
    `;

    // Execute SQL via RPC if available, or error out saying we need SQL access
    // Since we don't have direct SQL access via JS client easily without a stored procedure, 
    // we will check if tables exist by trying to select. If not, we fail gracefully or try a workaround.
    // WORKAROUND: We can't run raw SQL from JS client. 
    // HOWEVER, for this environment, I will assume the tables *might* exist or I rely on the user to have run them.
    // BUT the user said "fix it completely".
    
    // ACTION: I will try to use the 'rpc' method if a function exists, otherwise I will return a script for the user.
    // Wait, I can use the 'postgres' connection string if I had it. I don't.
    
    // ALTERNATIVE: I will ensure my code handles "missing table" errors gracefully by creating them? No, can't create tables via JS SDK.
    
    // LET'S ASSUME the tables exist or I can't fix it without SQL editor access. 
    // BUT, I can try to see if I can 'upsert' to a table to trigger creation? No.
    
    // Let's verify if 'clinics' exists.
    const { error } = await supabase.from('clinics').select('count', { count: 'exact', head: true });
    
    if (error) {
        return new Response(JSON.stringify({ 
            success: false, 
            error: "Database tables missing. Please run the SQL schema in Supabase SQL Editor.",
            sql_needed: sql 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, message: "Database appears connected." }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
})

-- Create database schema for MMC-MMS

-- Patients table
create table if not exists public.patients (
  id bigserial primary key,
  military_id text unique not null,
  name text not null,
  exam_type text default 'comprehensive',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Patient sessions table
create table if not exists public.patient_sessions (
  id bigserial primary key,
  patient_id bigint references public.patients(id) on delete cascade,
  token text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  expires_at timestamp with time zone not null
);

-- Queues table
create table if not exists public.queues (
  id bigserial primary key,
  patient_id bigint references public.patients(id) on delete cascade,
  clinic text not null,
  queue_number text unique not null,
  position integer not null,
  priority text default 'normal',
  status text default 'waiting',
  entered_at timestamp with time zone default timezone('utc'::text, now()),
  called_at timestamp with time zone,
  completed_at timestamp with time zone
);

-- Queue history table
create table if not exists public.queue_history (
  id bigserial primary key,
  patient_id bigint references public.patients(id) on delete cascade,
  clinic text not null,
  action text not null,
  queue_number text,
  timestamp timestamp with time zone default timezone('utc'::text, now())
);

-- Notifications table
create table if not exists public.notifications (
  id bigserial primary key,
  patient_id bigint references public.patients(id) on delete cascade,
  message text not null,
  type text default 'info',
  read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- PINs table
create table if not exists public.pins (
  id bigserial primary key,
  clinic text not null,
  pin text not null,
  date date not null,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  expires_at timestamp with time zone not null,
  unique(clinic, date)
);

-- Create indexes for performance
create index if not exists idx_queues_clinic_status on public.queues(clinic, status);
create index if not exists idx_patient_sessions_token on public.patient_sessions(token);
create index if not exists idx_pins_clinic_date on public.pins(clinic, date);

-- Enable Row Level Security
alter table public.patients enable row level security;
alter table public.patient_sessions enable row level security;
alter table public.queues enable row level security;
alter table public.queue_history enable row level security;
alter table public.notifications enable row level security;
alter table public.pins enable row level security;

-- Create policies (basic - adjust as needed)
create policy "Enable read access for all users" on public.patients for select using (true);
create policy "Enable insert access for all users" on public.patients for insert with check (true);

create policy "Enable read access for all users" on public.patient_sessions for select using (true);
create policy "Enable insert access for all users" on public.patient_sessions for insert with check (true);

create policy "Enable read access for all users" on public.queues for select using (true);
create policy "Enable insert access for all users" on public.queues for insert with check (true);

create policy "Enable read access for all users" on public.queue_history for select using (true);
create policy "Enable insert access for all users" on public.queue_history for insert with check (true);

create policy "Enable read access for all users" on public.notifications for select using (true);
create policy "Enable insert access for all users" on public.notifications for insert with check (true);

create policy "Enable read access for all users" on public.pins for select using (true);
create policy "Enable insert access for all users" on public.pins for insert with check (true);

-- Enable realtime publications for required tables
alter publication supabase_realtime add table if not exists public.queues;
alter publication supabase_realtime add table if not exists public.queue_history;
alter publication supabase_realtime add table if not exists public.notifications;
alter publication supabase_realtime add table if not exists public.pins;

-- Add cron job for daily maintenance
select cron.schedule(
  'daily-maintenance',
  '0 5 * * *',
  $$ select 1 $$
);
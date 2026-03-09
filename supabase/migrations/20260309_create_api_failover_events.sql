create table if not exists public.api_failover_events (
  id bigserial primary key,
  endpoint text not null,
  failure_reason text not null,
  attempt_duration_ms integer not null default 0 check (attempt_duration_ms >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_api_failover_events_created_at
  on public.api_failover_events (created_at desc);

create index if not exists idx_api_failover_events_endpoint
  on public.api_failover_events (endpoint);

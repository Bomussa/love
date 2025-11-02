create table if not exists public.login_audit (
  id bigserial primary key,
  ts timestamptz not null default now(),
  pid text,
  gender text,
  ip inet,
  ok boolean,
  reason text
);
comment on table public.login_audit is 'Audit of login attempts from kiosk app';

-- Atomic admin-only patient ID update across unified_queue, device_logins, and patients.
create or replace function public.admin_update_patient_id_atomic(
  p_queue_id uuid,
  p_old_id text,
  p_new_id text,
  p_login_date date default current_date
)
returns table (
  old_id text,
  new_id text,
  updated_rows jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim_role text;
  v_is_admin boolean := false;
  v_queue_updates integer := 0;
  v_device_updates integer := 0;
  v_patients_updates integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  -- Admin check: role claim OR roles table.
  v_claim_role := coalesce(
    auth.jwt() ->> 'role',
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
  );

  v_is_admin := lower(coalesce(v_claim_role, '')) in ('admin', 'service_role', 'super_admin');

  if not v_is_admin and to_regclass('public.roles') is not null then
    execute $$
      select exists (
        select 1
        from public.roles r
        where r.user_id = auth.uid()
          and lower(r.role) in ('admin', 'super_admin')
      )
    $$ into v_is_admin;
  end if;

  if not v_is_admin then
    raise exception 'Admin privileges required' using errcode = '42501';
  end if;

  if p_new_id is null or btrim(p_new_id) = '' then
    raise exception 'New patient ID cannot be empty' using errcode = '22023';
  end if;

  -- 1) Update targeted queue row.
  update public.unified_queue
  set patient_id = btrim(p_new_id)
  where id = p_queue_id
  returning 1 into v_queue_updates;

  v_queue_updates := coalesce(v_queue_updates, 0);

  -- 2) Update today's device login rows for same old ID.
  update public.device_logins
  set patient_id = btrim(p_new_id)
  where patient_id = p_old_id
    and login_date = p_login_date;

  get diagnostics v_device_updates = row_count;

  -- 3) Update master patient rows.
  update public.patients
  set patient_id = btrim(p_new_id)
  where patient_id = p_old_id;

  get diagnostics v_patients_updates = row_count;

  if v_queue_updates = 0 then
    raise exception 'Queue row not found or not updated' using errcode = 'P0002';
  end if;

  old_id := p_old_id;
  new_id := btrim(p_new_id);
  updated_rows := jsonb_build_object(
    'unified_queue', v_queue_updates,
    'device_logins', v_device_updates,
    'patients', v_patients_updates,
    'total', v_queue_updates + v_device_updates + v_patients_updates
  );

  return next;

exception
  when unique_violation then
    raise exception 'Update failed due to uniqueness conflict while changing patient ID from % to %', p_old_id, p_new_id
      using errcode = '23505';
  when foreign_key_violation or check_violation or not_null_violation then
    raise exception 'Update failed due to constraint violation while changing patient ID from % to %', p_old_id, p_new_id
      using errcode = sqlstate;
  when others then
    -- Re-raise. In Postgres, this aborts the statement transaction (automatic rollback).
    raise;
end;
$$;

grant execute on function public.admin_update_patient_id_atomic(uuid, text, text, date) to authenticated;

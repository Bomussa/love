import { supabase } from './supabase-client';

const originalFrom = supabase.from.bind(supabase);
const originalRpc = supabase.rpc.bind(supabase);

async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { success: false, error: 'Invalid server response', code: 'INVALID_RESPONSE' };
  }

  if (!response.ok || payload?.success === false) {
    const error = new Error(payload?.error || `Request failed (${response.status})`);
    error.code = payload?.code || `HTTP_${response.status}`;
    error.status = response.status;
    throw error;
  }

  return payload;
}

function resultError(error) {
  return {
    data: null,
    error: {
      message: error?.message || String(error),
      code: error?.code || 'SECURE_ADAPTER_ERROR',
      status: error?.status || null,
    },
  };
}

function createThenableBuilder(executor) {
  const state = {
    operation: 'select',
    values: null,
    filters: {},
    single: false,
    promise: null,
  };

  const execute = () => {
    if (!state.promise) {
      state.promise = Promise.resolve()
        .then(() => executor(state))
        .catch(resultError);
    }
    return state.promise;
  };

  const builder = {
    select() {
      if (state.operation === 'select') state.operation = 'select';
      return builder;
    },
    insert(values) {
      state.operation = 'insert';
      state.values = Array.isArray(values) ? values[0] : values;
      return builder;
    },
    update(values) {
      state.operation = 'update';
      state.values = values || {};
      return builder;
    },
    delete() {
      state.operation = 'delete';
      return builder;
    },
    eq(column, value) {
      state.filters[column] = value;
      return builder;
    },
    order() { return builder; },
    limit() { return builder; },
    maybeSingle() { state.single = true; return builder; },
    single() { state.single = true; return builder; },
    then(resolve, reject) { return execute().then(resolve, reject); },
    catch(reject) { return execute().catch(reject); },
    finally(handler) { return execute().finally(handler); },
  };

  return builder;
}

async function listAdminUsers() {
  const response = await requestJson('/api/v1/admin/users');
  return Array.isArray(response.data) ? response.data : [];
}

async function saveAdminUser(values, id = null) {
  const payload = {
    ...values,
    id: id || values?.id || null,
    password: values?.password ?? values?.password_hash ?? '',
  };
  delete payload.password_hash;

  return requestJson('/api/v1/admin/users/save', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function executeAdminUsers(state) {
  if (state.operation === 'select') {
    const rows = await listAdminUsers();
    const filtered = state.filters.id
      ? rows.filter((row) => String(row.id) === String(state.filters.id))
      : rows;
    return { data: state.single ? (filtered[0] || null) : filtered, error: null };
  }

  if (state.operation === 'insert') {
    const response = await saveAdminUser(state.values || {});
    return { data: response.data ? [response.data] : null, error: null };
  }

  if (state.operation === 'update') {
    const id = state.filters.id;
    if (!id) throw Object.assign(new Error('Administrator id is required'), { code: 'MISSING_ADMIN_ID' });
    const existing = (await listAdminUsers()).find((row) => String(row.id) === String(id));
    if (!existing) throw Object.assign(new Error('Administrator not found'), { code: 'ADMIN_NOT_FOUND' });
    const response = await saveAdminUser({ ...existing, ...(state.values || {}) }, id);
    return { data: response.data ? [response.data] : null, error: null };
  }

  if (state.operation === 'delete') {
    const id = state.filters.id;
    if (!id) throw Object.assign(new Error('Administrator id is required'), { code: 'MISSING_ADMIN_ID' });
    await requestJson(`/api/v1/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return { data: null, error: null };
  }

  throw new Error('Unsupported administrator operation');
}

async function listDoctors() {
  const response = await requestJson('/api/v1/admin/doctors');
  return Array.isArray(response.data) ? response.data : [];
}

async function saveDoctor(values, id = null) {
  const payload = {
    ...values,
    id: id || values?.id || null,
    password: values?.password ?? values?.password_hash ?? '',
  };
  delete payload.password_hash;

  return requestJson('/api/v1/admin/doctors/save', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function executeDoctors(state) {
  if (state.operation === 'select') {
    const rows = await listDoctors();
    const filtered = state.filters.id
      ? rows.filter((row) => String(row.id) === String(state.filters.id))
      : rows;
    return { data: state.single ? (filtered[0] || null) : filtered, error: null };
  }

  if (state.operation === 'insert') {
    const response = await saveDoctor(state.values || {});
    return { data: response.data ? [response.data] : null, error: null };
  }

  if (state.operation === 'update') {
    const id = state.filters.id;
    if (!id) throw Object.assign(new Error('Doctor id is required'), { code: 'MISSING_DOCTOR_ID' });
    const existing = (await listDoctors()).find((row) => String(row.id) === String(id));
    if (!existing) throw Object.assign(new Error('Doctor not found'), { code: 'DOCTOR_NOT_FOUND' });
    const response = await saveDoctor({ ...existing, ...(state.values || {}) }, id);
    return { data: response.data ? [response.data] : null, error: null };
  }

  if (state.operation === 'delete') {
    const id = state.filters.id;
    if (!id) throw Object.assign(new Error('Doctor id is required'), { code: 'MISSING_DOCTOR_ID' });
    await requestJson(`/api/v1/admin/doctors/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return { data: null, error: null };
  }

  throw new Error('Unsupported doctor operation');
}

async function executeUpsertDoctor(args = {}) {
  try {
    const response = await saveDoctor({
      id: args.p_id || null,
      name: args.p_name,
      username: args.p_username,
      password: args.p_password || '',
      clinic_id: args.p_clinic_id,
      role: args.p_role,
      specialty: args.p_specialty,
      phone: args.p_phone,
      email: args.p_email,
      is_active: args.p_is_active,
    }, args.p_id || null);
    return { data: { success: true, ...(response.data || {}) }, error: null };
  } catch (error) {
    return resultError(error);
  }
}

async function executeUpsertSetting(args = {}) {
  try {
    const key = String(args.p_key || '').trim();
    if (!key) throw Object.assign(new Error('Setting key is required'), { code: 'INVALID_SETTING_KEY' });

    const { data, error } = await originalFrom('system_settings')
      .upsert({
        id: key,
        key,
        value: args.p_value,
        description: args.p_description || `Setting ${key}`,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      .select('id,key,value,description,is_active,updated_at')
      .single();

    if (error) return { data: null, error };
    return { data: { success: true, setting: data }, error: null };
  } catch (error) {
    return resultError(error);
  }
}

if (!globalThis.__MMC_LEGACY_SECURE_DATA_ADAPTER__) {
  globalThis.__MMC_LEGACY_SECURE_DATA_ADAPTER__ = true;

  supabase.from = (relation) => {
    if (relation === 'admin_users') return createThenableBuilder(executeAdminUsers);
    if (relation === 'doctors') return createThenableBuilder(executeDoctors);
    if (relation === 'email_queue') {
      return {
        insert: async () => {
          throw Object.assign(
            new Error('Email report delivery is not configured. Use print or export.'),
            { code: 'EMAIL_SERVICE_NOT_CONFIGURED' },
          );
        },
      };
    }
    return originalFrom(relation);
  };

  supabase.rpc = (functionName, args, options) => {
    if (functionName === 'upsert_doctor') return executeUpsertDoctor(args);
    if (functionName === 'upsert_setting') return executeUpsertSetting(args);
    return originalRpc(functionName, args, options);
  };
}

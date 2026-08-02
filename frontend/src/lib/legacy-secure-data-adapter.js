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
    match(values = {}) {
      Object.assign(state.filters, values);
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

async function executeQueueRpc(functionName, args = {}) {
  try {
    let path;
    let body;

    if (functionName === 'call_next_patient') {
      path = '/api/v1/queue/call';
      body = {
        clinicId: args.p_clinic_id,
        version: args.p_expected_version ?? null,
      };
    } else if (functionName === 'start_exam') {
      path = '/api/v1/queue/start';
      body = { queueId: args.p_queue_id, version: args.p_expected_version ?? null };
    } else if (['finish_exam_record', 'finish_exam', 'complete_exam_and_advance'].includes(functionName)) {
      path = '/api/v1/queue/done';
      body = {
        queueId: args.p_queue_id || null,
        clinicId: args.p_clinic_id || null,
        patientId: args.p_patient_id || null,
        version: args.p_expected_version ?? null,
      };
    } else if (functionName === 'advance_patient_route') {
      path = '/api/v1/queue/done';
      body = {
        clinicId: args.p_clinic_id,
        patientId: args.p_patient_id,
        version: args.p_expected_version ?? null,
      };
    } else if (functionName === 'mark_patient_absent') {
      path = '/api/v1/queue/update';
      body = { queueId: args.p_queue_id, queueAction: 'no_show' };
    } else {
      return originalRpc(functionName, args);
    }

    const response = await requestJson(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return { data: response.data || response.queue || response, error: null };
  } catch (error) {
    return resultError(error);
  }
}

async function executeUnifiedQueueMutation(state) {
  const values = state.values || {};
  const queueId = String(state.filters.id || values.id || '').trim();

  if (state.operation === 'insert') {
    const patientId = String(values.patient_id || values.personal_id || values.military_id || '').trim();
    const examType = String(values.exam_type || values.queue_type || '').trim();
    if (!patientId || !examType) {
      throw Object.assign(
        new Error('Patient must complete registration and select an examination type before priority calling'),
        { code: 'PATIENT_REGISTRATION_REQUIRED' },
      );
    }

    const response = await requestJson('/api/v1/queue/enter', {
      method: 'POST',
      body: JSON.stringify({
        patientId,
        personalId: values.personal_id || patientId,
        militaryId: values.military_id || patientId,
        clinicId: values.clinic_id || null,
        examType,
        gender: values.gender || 'male',
      }),
    });
    return { data: response.queue ? [response.queue] : (response.data ? [response.data] : null), error: null };
  }

  if (!queueId) {
    throw Object.assign(new Error('Queue id is required'), { code: 'MISSING_QUEUE_ID' });
  }

  if (state.operation === 'delete') {
    const response = await requestJson('/api/v1/queue/update', {
      method: 'POST',
      body: JSON.stringify({ queueId, queueAction: 'cancel' }),
    });
    return { data: response.queue ? [response.queue] : null, error: null };
  }

  if (state.operation !== 'update') {
    throw new Error('Unsupported queue operation');
  }

  if (values.patient_id !== undefined) {
    const response = await requestJson('/api/v1/admin/queue/identity', {
      method: 'POST',
      body: JSON.stringify({ queueId, newPatientId: values.patient_id }),
    });
    return { data: response.queue ? [response.queue] : null, error: null };
  }

  const status = String(values.status || '').trim().toLowerCase();
  let path;
  let body;

  if (status === 'called') {
    path = '/api/v1/queue/call';
    body = { queueId };
  } else if (status === 'waiting') {
    path = '/api/v1/queue/update';
    body = { queueId, queueAction: 'requeue' };
  } else if (status === 'completed' || status === 'done') {
    path = '/api/v1/queue/done';
    body = { queueId };
  } else if (status === 'absent' || status === 'no_show') {
    path = '/api/v1/queue/update';
    body = { queueId, queueAction: 'no_show' };
  } else if (status === 'cancelled' || status === 'canceled') {
    path = '/api/v1/queue/update';
    body = { queueId, queueAction: 'cancel' };
  } else if (values.is_vip !== undefined || values.is_priority !== undefined) {
    const enabled = Boolean(values.is_vip ?? values.is_priority);
    path = '/api/v1/queue/update';
    body = { queueId, queueAction: enabled ? 'vip' : 'unvip' };
  } else {
    throw Object.assign(new Error('Unsupported queue mutation'), { code: 'UNSUPPORTED_QUEUE_MUTATION' });
  }

  const response = await requestJson(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return { data: response.queue ? [response.queue] : (response.data ? [response.data] : null), error: null };
}

function createUnifiedQueueProxy() {
  const originalBuilder = originalFrom('unified_queue');
  return new Proxy(originalBuilder, {
    get(target, property, receiver) {
      if (property === 'insert') {
        return (values) => createThenableBuilder(executeUnifiedQueueMutation).insert(values);
      }
      if (property === 'update') {
        return (values) => createThenableBuilder(executeUnifiedQueueMutation).update(values);
      }
      if (property === 'delete') {
        return () => createThenableBuilder(executeUnifiedQueueMutation).delete();
      }

      const value = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

if (!globalThis.__MMC_LEGACY_SECURE_DATA_ADAPTER__) {
  globalThis.__MMC_LEGACY_SECURE_DATA_ADAPTER__ = true;

  supabase.from = (relation) => {
    if (relation === 'admin_users') return createThenableBuilder(executeAdminUsers);
    if (relation === 'doctors') return createThenableBuilder(executeDoctors);
    if (relation === 'unified_queue') return createUnifiedQueueProxy();
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
    if ([
      'call_next_patient',
      'start_exam',
      'finish_exam_record',
      'finish_exam',
      'complete_exam_and_advance',
      'advance_patient_route',
      'mark_patient_absent',
    ].includes(functionName)) {
      return executeQueueRpc(functionName, args, options);
    }
    return originalRpc(functionName, args, options);
  };
}

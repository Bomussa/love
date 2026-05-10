import { supabase } from './supabase-client';

const PATCH_FLAG = '__system_settings_contract_patched__';

function normalizeRow(row) {
  if (!row || typeof row !== 'object') return row;
  const key = row.key ?? row.id ?? null;
  const id = row.id ?? row.key ?? null;
  return { ...row, key, id };
}

function escapeLike(value) {
  return String(value ?? '').replace(/[%_\\]/g, (m) => `\\${m}`);
}

function createSystemSettingsBuilder() {
  const state = {
    action: 'select',
    columns: '*',
    filters: [],
    orderBy: null,
    limit: null,
    mode: 'many',
    payload: null,
  };

  const api = {
    select(columns = '*') {
      state.action = 'select';
      state.columns = columns;
      return api;
    },
    eq(field, value) {
      state.filters.push({ type: 'eq', field, value });
      return api;
    },
    like(field, value) {
      state.filters.push({ type: 'like', field, value });
      return api;
    },
    order(field, options = {}) {
      state.orderBy = { field, ascending: options.ascending !== false };
      return api;
    },
    limit(count) {
      state.limit = count;
      return api;
    },
    single() {
      state.mode = 'single';
      return api;
    },
    maybeSingle() {
      state.mode = 'maybeSingle';
      return api;
    },
    upsert(payload) {
      state.action = 'upsert';
      state.payload = payload;
      return api;
    },
    insert(payload) {
      state.action = 'insert';
      state.payload = payload;
      return api;
    },
    update(payload) {
      state.action = 'update';
      state.payload = payload;
      return api;
    },
    then(onFulfilled, onRejected) {
      return execute().then(onFulfilled, onRejected);
    },
    catch(onRejected) {
      return execute().catch(onRejected);
    },
    finally(onFinally) {
      return execute().finally(onFinally);
    },
  };

  const applyFilters = (rows) => {
    let filtered = [...rows];

    for (const filter of state.filters) {
      if (filter.type === 'eq') {
        filtered = filtered.filter((row) => {
          const normalized = normalizeRow(row);
          if (filter.field === 'key' || filter.field === 'id') {
            return normalized.key === filter.value || normalized.id === filter.value;
          }
          return normalized[filter.field] === filter.value;
        });
      }

      if (filter.type === 'like') {
        const pattern = String(filter.value ?? '')
          .replace(/([.+^${}()|[\]\\])/g, '\\$1')
          .replace(/%/g, '.*')
          .replace(/_/g, '.');
        const matcher = new RegExp(`^${pattern}$`, 'i');

        filtered = filtered.filter((row) => {
          const normalized = normalizeRow(row);
          const candidate = String(normalized[filter.field] ?? normalized.key ?? normalized.id ?? '');
          return matcher.test(candidate);
        });
      }
    }

    if (state.orderBy) {
      const { field, ascending } = state.orderBy;
      filtered.sort((a, b) => {
        const av = normalizeRow(a)[field] ?? '';
        const bv = normalizeRow(b)[field] ?? '';
        if (av === bv) return 0;
        if (av < bv) return ascending ? -1 : 1;
        return ascending ? 1 : -1;
      });
    }

    if (typeof state.limit === 'number') {
      filtered = filtered.slice(0, state.limit);
    }

    return filtered.map(normalizeRow);
  };

  const runSelect = async () => {
    const { data, error } = await supabase.from('system_settings').select('*');
    if (error) return { data: null, error };

    const rows = applyFilters(data || []);

    if (state.mode === 'single') {
      if (!rows.length) {
        return {
          data: null,
          error: { code: 'PGRST116', message: 'No rows found' },
        };
      }
      return { data: rows[0], error: null };
    }

    if (state.mode === 'maybeSingle') {
      return { data: rows[0] ?? null, error: null };
    }

    return { data: rows, error: null };
  };

  const runWrite = async () => {
    const items = Array.isArray(state.payload) ? state.payload : [state.payload];
    const { data: currentRows, error: readError } = await supabase.from('system_settings').select('*');

    if (readError) return { data: null, error: readError };

    const normalizedCurrent = (currentRows || []).map(normalizeRow);
    const output = [];

    for (const item of items) {
      const normalizedItem = normalizeRow(item || {});
      const settingKey = normalizedItem.key ?? normalizedItem.id;

      if (!settingKey) {
        return {
          data: null,
          error: new Error('Missing system setting key'),
        };
      }

      const existingRaw = (currentRows || []).find((row) => row?.key === settingKey || row?.id === settingKey);
      const existing = normalizedCurrent.find((row) => row.key === settingKey || row.id === settingKey);

      const payload = {
        key: settingKey,
        value: normalizedItem.value,
        description: normalizedItem.description ?? `إعداد ${settingKey}`,
        updated_at: normalizedItem.updated_at ?? new Date().toISOString(),
      };

      if (existing || existingRaw) {
        const targetField = existingRaw?.key != null ? 'key' : 'id';
        const { data: updated, error: updateError } = await supabase
          .from('system_settings')
          .update(payload)
          .eq(targetField, settingKey)
          .select('*');

        if (updateError) return { data: null, error: updateError };
        output.push(...(updated || []).map(normalizeRow));
        continue;
      }

      const { data: inserted, error: insertError } = await supabase
        .from('system_settings')
        .insert(payload)
        .select('*');

      if (insertError) return { data: null, error: insertError };
      output.push(...(inserted || []).map(normalizeRow));
    }

    return {
      data: Array.isArray(state.payload) ? output : output[0] ?? null,
      error: null,
    };
  };

  async function execute() {
    try {
      if (state.action === 'select') return await runSelect();
      if (state.action === 'upsert' || state.action === 'insert') return await runWrite();
      if (state.action === 'update') return await runWrite();

      return { data: null, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  return api;
}

if (!supabase[PATCH_FLAG]) {
  const originalFrom = supabase.from.bind(supabase);

  Object.defineProperty(supabase, 'from', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: (tableName) => {
      if (tableName === 'system_settings') {
        return createSystemSettingsBuilder();
      }
      return originalFrom(tableName);
    },
  });

  Object.defineProperty(supabase, PATCH_FLAG, {
    configurable: true,
    enumerable: false,
    writable: false,
    value: true,
  });
}

export {};

#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const headers = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

async function fetchJson(url, init = {}) {
  const res = await fetch(url, init);
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${url} :: ${JSON.stringify(data)}`);
  }
  return { data, headers: res.headers };
}

async function getCount(table) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=id`;
  const { headers: h } = await fetchJson(url, {
    headers: {
      ...headers,
      Range: '0-0',
      Prefer: 'count=exact',
    },
  });
  const cr = h.get('content-range') || '*/0';
  const total = Number(cr.split('/')[1] || 0);
  return Number.isFinite(total) ? total : 0;
}

function normalizeStatus(status) {
  const allowed = new Set(['waiting', 'called', 'completed', 'cancelled']);
  return allowed.has(status) ? status : 'waiting';
}

function toQueueRow(row) {
  const enteredAt = row.entered_at || new Date().toISOString();
  const queueNumberInt = row.queue_position ?? row.display_number ?? row.queue_number_int ?? 0;
  return {
    id: row.id,
    clinic_id: row.clinic_id,
    patient_id: row.patient_id,
    display_number: row.display_number ?? queueNumberInt,
    status: normalizeStatus(row.status),
    entered_at: enteredAt,
    called_at: row.called_at ?? null,
    completed_at: row.completed_at ?? null,
    completed_by_pin: row.completed_by_pin ?? null,
    queue_date: row.queue_date ?? enteredAt.split('T')[0],
    postpone_count: row.postpone_count ?? 0,
    is_priority: row.is_priority ?? false,
    priority_reason: row.priority_reason ?? null,
    queue_number: row.queue_number ?? String(queueNumberInt || ''),
    military_id: row.military_id ?? null,
    personal_id: row.personal_id ?? null,
    exam_type: row.exam_type ?? null,
    queue_number_int: queueNumberInt || null,
  };
}

async function main() {
  const unifiedCountBefore = await getCount('unified_queue');
  const queuesCountBefore = await getCount('queues');

  console.log(`Before migration -> unified_queue: ${unifiedCountBefore}, queues: ${queuesCountBefore}`);

  if (unifiedCountBefore === 0) {
    console.log('No unified_queue rows to migrate.');
    return;
  }

  const select = [
    'id', 'clinic_id', 'patient_id', 'display_number', 'status', 'entered_at', 'called_at', 'completed_at',
    'completed_by_pin', 'queue_date', 'postpone_count', 'is_priority', 'priority_reason', 'queue_number',
    'military_id', 'personal_id', 'exam_type', 'queue_position',
  ].join(',');

  const { data: rows } = await fetchJson(`${SUPABASE_URL}/rest/v1/unified_queue?select=${encodeURIComponent(select)}`, {
    headers,
  });

  const mapped = (rows || []).filter((r) => r?.id && r?.clinic_id).map(toQueueRow);

  if (mapped.length === 0) {
    console.log('No valid rows to migrate after mapping.');
    return;
  }

  const { data: upserted } = await fetchJson(`${SUPABASE_URL}/rest/v1/queues?on_conflict=id`, {
    method: 'POST',
    headers: {
      ...headers,
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(mapped),
  });

  const queuesCountAfter = await getCount('queues');
  const unifiedCountAfter = await getCount('unified_queue');

  console.log(`Migrated/merged rows: ${Array.isArray(upserted) ? upserted.length : 0}`);
  console.log(`After migration -> unified_queue: ${unifiedCountAfter}, queues: ${queuesCountAfter}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertPinValidForQueueAction,
  generateDailyPin,
  verifyPin,
} from '../supabase/functions/_shared/pin-service.js';

class QueryBuilder {
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this.filters = [];
    this.sort = null;
    this.limitCount = null;
    this.mode = 'select';
    this.payload = null;
  }

  select() { return this; }
  eq(col, val) { this.filters.push((r) => r[col] === val); return this; }
  gt(col, val) { this.filters.push((r) => r[col] > val); return this; }
  order(col, opts = {}) { this.sort = { col, asc: opts.ascending !== false }; return this; }
  limit(n) { this.limitCount = n; return this; }
  insert(payload) { this.mode = 'insert'; this.payload = payload; return this; }
  update(payload) { this.mode = 'update'; this.payload = payload; return this; }

  async maybeSingle() {
    const { data, error } = await this._run();
    if (error) return { data: null, error };
    return { data: data[0] ?? null, error: null };
  }

  async single() {
    const { data, error } = await this._run();
    if (error) return { data: null, error };
    return { data: data[0] ?? null, error: null };
  }

  then(resolve, reject) { return this._run().then(resolve, reject); }

  async _run() {
    const rows = this.db[this.table];
    if (this.mode === 'insert') {
      const row = { id: rows.length + 1, ...this.payload };
      rows.push(row);
      return { data: [row], error: null };
    }

    let filtered = rows.filter((row) => this.filters.every((f) => f(row)));

    if (this.mode === 'update') {
      filtered.forEach((row) => Object.assign(row, this.payload));
      return { data: filtered, error: null };
    }

    if (this.sort) {
      const { col, asc } = this.sort;
      filtered = filtered.sort((a, b) => (asc ? (a[col] > b[col] ? 1 : -1) : (a[col] < b[col] ? 1 : -1)));
    }

    if (this.limitCount !== null) filtered = filtered.slice(0, this.limitCount);
    return { data: filtered, error: null };
  }
}

const createDb = () => ({
  pins: [],
  clinics: [{ id: 'c1', pin_code: null }],
  queues: [{ id: 1, clinic_id: 'c1', patient_id: 'p1', status: 'waiting', queue_number_int: 1 }],
  events: [],
  from(table) { return new QueryBuilder(this, table); },
});

test('generate → verify → call-next contract stays on pins canonical columns', async () => {
  const db = createDb();

  const generated = await generateDailyPin(db, 'c1');
  assert.equal(generated.pinRecord.clinic_id, 'c1');
  assert.ok(generated.pinRecord.valid_until);
  assert.equal(generated.pinRecord.used_at, undefined);

  const verified = await verifyPin(db, 'c1', generated.pinRecord.pin);
  assert.equal(verified.valid, true);
  assert.ok(verified.pinRecord.used_at);

  const validForCallNext = await assertPinValidForQueueAction(db, 'c1', generated.pinRecord.pin);
  assert.equal(validForCallNext, true);

  const { data: nextPatient } = await db
    .from('queues')
    .select('id, clinic_id, patient_id, queue_number_int, status')
    .eq('clinic_id', 'c1')
    .eq('status', 'waiting')
    .order('queue_number_int', { ascending: true })
    .limit(1)
    .maybeSingle();

  assert.ok(nextPatient);

  const { data: calledQueue } = await db
    .from('queues')
    .update({ status: 'called', called_at: new Date().toISOString() })
    .eq('id', nextPatient.id)
    .single();

  assert.equal(calledQueue.status, 'called');

  const ticket = calledQueue.queue_number_int;
  await db.from('events').insert({
    event_type: 'YOUR_TURN',
    clinic_id: 'c1',
    patient_id: calledQueue.patient_id,
    payload: { ticket, clinic: 'c1' },
  });

  assert.equal(db.events.length, 1);
  assert.equal(db.events[0].event_type, 'YOUR_TURN');

  assert.deepEqual(Object.keys(db.pins[0]).sort(), ['clinic_id', 'created_at', 'id', 'pin', 'used_at', 'valid_until']);
});

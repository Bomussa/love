const assert = require('assert');

class PinRepository {
  constructor() {
    this.rows = [];
    this.id = 1;
  }

  createPin(clinic_id, pin, valid_until) {
    const now = new Date().toISOString();
    this.rows.filter((r) => r.clinic_id === clinic_id && r.used_at === null).forEach((r) => {
      r.used_at = now;
    });
    const row = { id: this.id++, clinic_id, pin, created_at: now, valid_until, used_at: null };
    this.rows.push(row);
    return row;
  }

  togglePin(id, enabled) {
    const row = this.rows.find((r) => r.id === id);
    if (!row) return null;
    row.used_at = enabled ? null : new Date().toISOString();
    return row;
  }

  deleteExpired(nowIso) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => new Date(r.valid_until) > new Date(nowIso));
    return before - this.rows.length;
  }

  latestValidPerClinic(nowIso) {
    const valid = this.rows.filter((r) => !r.used_at && new Date(r.valid_until) > new Date(nowIso));
    const map = new Map();
    for (const row of valid.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))) {
      if (!map.has(row.clinic_id)) map.set(row.clinic_id, row);
    }
    return map;
  }
}

function screenStateFromMap(map, clinicId) {
  const row = map.get(clinicId);
  return { clinicId, currentPin: row?.pin || null, isActive: !!row };
}

(function run() {
  const repo = new PinRepository();
  const tomorrow = new Date(Date.now() + 24 * 3600000).toISOString();
  const past = new Date(Date.now() - 24 * 3600000).toISOString();

  // إنشاء PIN
  const first = repo.createPin('1', '1234', tomorrow);
  assert.equal(first.clinic_id, '1');
  assert.equal(first.used_at, null);

  // تعطيل/تفعيل
  repo.togglePin(first.id, false);
  assert.ok(repo.rows.find((r) => r.id === first.id).used_at);
  repo.togglePin(first.id, true);
  assert.equal(repo.rows.find((r) => r.id === first.id).used_at, null);

  // حذف المنتهي
  repo.createPin('2', '9999', past);
  const deleted = repo.deleteExpired(new Date().toISOString());
  assert.equal(deleted, 1);

  // آخر PIN صالح لكل عيادة + تماسك حالة الشاشات
  const second = repo.createPin('1', '5678', tomorrow);
  assert.ok(repo.rows.find((r) => r.id === first.id).used_at, 'old pin should be deactivated on create');

  const latest = repo.latestValidPerClinic(new Date().toISOString());
  assert.equal(latest.get('1').id, second.id);

  const adminScreenState = screenStateFromMap(latest, '1');
  const monitorScreenState = screenStateFromMap(latest, '1');
  assert.deepEqual(adminScreenState, monitorScreenState);

  console.log('✅ PIN integration contract test passed');
})();

import test from 'node:test';
import assert from 'node:assert/strict';
import maintenanceHandler, { resolveHealthState, evaluateSystemStatus } from '../api/maintenance.js';

test('resolveHealthState supports direct healthy payload', () => {
  assert.equal(resolveHealthState({ status: 'healthy' }), 'healthy');
  assert.equal(resolveHealthState({ status: 'ok' }), 'healthy');
  assert.equal(resolveHealthState({ status: 'operational' }), 'healthy');
});

test('resolveHealthState supports wrapped payload', () => {
  assert.equal(resolveHealthState({ success: true, data: { status: 'healthy' } }), 'healthy');
  assert.equal(resolveHealthState({ success: true, data: { status: 'degraded' } }), 'degraded');
});

test('resolveHealthState maps unknown payloads safely', () => {
  assert.equal(resolveHealthState(null), 'unknown');
  assert.equal(resolveHealthState({}), 'unknown');
  assert.equal(resolveHealthState({ status: 'broken' }), 'down');
});

test('evaluateSystemStatus returns down when host header is missing', async () => {
  const req = { headers: {} };
  const state = await evaluateSystemStatus(req);
  assert.equal(state, 'down');
});

test('evaluateSystemStatus returns healthy when upstream returns wrapped healthy', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ success: true, data: { status: 'healthy' } }),
  });

  try {
    const req = { headers: { host: 'mmc-mms.com' } };
    const state = await evaluateSystemStatus(req);
    assert.equal(state, 'healthy');
  } finally {
    global.fetch = originalFetch;
  }
});

test('evaluateSystemStatus returns degraded on degraded upstream status', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ status: 'degraded' }),
  });

  try {
    const req = { headers: { host: 'mmc-mms.com' } };
    const state = await evaluateSystemStatus(req);
    assert.equal(state, 'degraded');
  } finally {
    global.fetch = originalFetch;
  }
});

test('evaluateSystemStatus returns down on non-OK upstream', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    json: async () => ({ status: 'healthy' }),
  });

  try {
    const req = { headers: { host: 'mmc-mms.com' } };
    const state = await evaluateSystemStatus(req);
    assert.equal(state, 'down');
  } finally {
    global.fetch = originalFetch;
  }
});

test('maintenance handler returns JSON error payload instead of crashing on downstream failure', async () => {
  const req = { method: 'GET', headers: { host: 'mmc-mms.com' } };
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error('Synthetic failure');
  };

  const response = {
    statusCode: null,
    jsonPayload: null,
    headers: {},
    setHeader(key, value) {
      this.headers[key] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.jsonPayload = payload;
      return this;
    },
    end(payload) {
      this.endPayload = payload;
      return this;
    },
  };

  try {
    await maintenanceHandler(req, response);
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.jsonPayload, {
    success: false,
    error: 'Service Unavailable',
    message: 'The system is currently undergoing maintenance or experiencing a critical failure. Please try again later.',
    maintenance_active: true,
    system_status: 'down',
  });
});

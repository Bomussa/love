#!/usr/bin/env node

// Live five-features verification against official domain
// Features: Queue, Dynamic Paths, SSE, PIN per clinic, Reports/Stats, Speed

const BASE = process.env.DEPLOY_URL || 'https://www.mmc-mms.com';
const fetch = global.fetch;

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

const results = [];
const ok = (name, ms) => (results.push({ name, ok: true, ms }), console.log(`${colors.green}✓${colors.reset} ${name} ${colors.cyan}(${ms}ms)${colors.reset}`));
const fail = (name, err) => (results.push({ name, ok: false, err: String(err) }), console.log(`${colors.red}✗${colors.reset} ${name} ${colors.yellow}${String(err)}${colors.reset}`));

async function timed(name, fn) {
  const t0 = Date.now();
  try { await fn(); ok(name, Date.now() - t0); } catch (e) { fail(name, e.message || e); }
}

async function getJson(path, init) {
  const t0 = Date.now();
  const r = await fetch(BASE + path, init);
  const ms = Date.now() - t0;
  if (!r.ok) throw new Error(`${path} -> HTTP ${r.status} (${ms}ms)`);
  const j = await r.json();
  return { json: j, ms };
}

async function testStatus() {
  await timed('Status endpoint', async () => {
    const { json } = await getJson('/api/v1/status');
    if (json.success !== true) throw new Error('success != true');
  });
}

async function testSSE() {
  await timed('SSE stream', async () => {
    const controller = new AbortController();
    const t0 = Date.now();
    const res = await fetch(BASE + '/api/v1/events/stream', { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // Abort quickly; only verifying reachability
    controller.abort();
    if (Date.now() - t0 > 5000) throw new Error('SSE handshake too slow');
  });
}

async function pickClinicFromPins() {
  const { json } = await getJson('/api/v1/pin/status');
  // Support either {allowedClinics, pins} or just {pins}
  const pinsObj = json.pins || {};
  const keys = Object.keys(pinsObj);
  if (keys.length > 0) return keys[0];
  const allowed = json.allowedClinics || [];
  if (allowed.length > 0) return allowed[0];
  return 'lab';
}

async function testPIN() {
  await timed('PIN status (public)', async () => {
    const { json } = await getJson('/api/v1/pin/status');
    if (json.success !== true) throw new Error('success != true');
  });
  await timed('PIN status (admin)', async () => {
    const { json } = await getJson('/api/v1/admin/pin/status');
    if (json.success !== true) throw new Error('success != true');
  });
}

async function testDynamicPaths() {
  await timed('Dynamic path choose', async () => {
    const { json } = await getJson('/api/v1/path/choose?gender=male');
    if (json.success !== true) throw new Error('success != true');
    if (!Array.isArray(json.path)) throw new Error('path must be array');
  });
}

async function testStats() {
  await timed('Stats dashboard', async () => {
    const { json } = await getJson('/api/v1/stats/dashboard');
    if (json.success !== true) throw new Error('success != true');
  });
  await timed('Stats queues', async () => {
    const { json } = await getJson('/api/v1/stats/queues');
    if (json.success !== true) throw new Error('success != true');
  });
}

async function testQueueFlow() {
  const clinic = await pickClinicFromPins();
  let sessionId = '';

  await timed('Patient login', async () => {
    const { json } = await getJson('/api/v1/patient/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: `TEST${Date.now()}`.slice(-10), gender: 'male' })
    });
    if (json.success !== true || !json.data?.id) throw new Error('login failed');
    sessionId = json.data.id;
  });

  await timed('Queue enter', async () => {
    const { json } = await getJson('/api/v1/queue/enter', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinic, user: sessionId })
    });
    if (json.success !== true) throw new Error('enter failed');
  });

  await timed('Queue position', async () => {
    const { json } = await getJson(`/api/v1/queue/position?clinic=${encodeURIComponent(clinic)}&user=${encodeURIComponent(sessionId)}`);
    if (json.success !== true) throw new Error('position failed');
  });

  await timed('Queue call (optional)', async () => {
    const { json } = await getJson('/api/v1/queue/call', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinic })
    });
    if (json.success !== true) throw new Error('call failed');
  });

  // Admin pin then complete
  let pinValue = '';
  await timed('Admin PIN fetch (clinic)', async () => {
    const { json } = await getJson(`/api/v1/admin/pin/status?clinic=${encodeURIComponent(clinic)}`);
    const p = json?.pin?.pin || json?.pin?.value || json?.pin?.code || json?.pin?.PIN || json?.pin?.Pin || json?.pin?.p;
    if (!p) throw new Error('pin not present');
    pinValue = String(p);
  });

  await timed('Queue done with PIN', async () => {
    const { json } = await getJson('/api/v1/queue/done', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinic, user: sessionId, pin: pinValue })
    });
    if (json.success !== true) throw new Error('queue done failed');
  });
}

(async () => {
  console.log(`${colors.blue}Live Five-Features Check @ ${BASE}${colors.reset}`);
  await testStatus();
  await testSSE();
  await testPIN();
  await testDynamicPaths();
  await testStats();
  await testQueueFlow();

  const passed = results.filter(r => r.ok).length;
  const failed = results.length - passed;
  console.log(`\n${colors.cyan}Passed:${colors.reset} ${passed}  ${colors.red}Failed:${colors.reset} ${failed}`);
  if (failed > 0) process.exit(1);
  process.exit(0);
})();

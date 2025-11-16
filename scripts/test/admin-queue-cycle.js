#!/usr/bin/env node

// Admin Queue Cycle Test: proves full flow including protected /queue/done
// Usage:
//   ADMIN_COOKIE="mmc_admin_session=..." node scripts/test/admin-queue-cycle.js
// or ADMIN_TOKEN set to pass X-Admin-Token

const BASE = process.env.DEPLOY_URL || 'https://www.mmc-mms.com';
const ADMIN_COOKIE = process.env.ADMIN_COOKIE || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

function authHeaders(h = {}) {
  const headers = { ...h };
  if (ADMIN_COOKIE) headers['Cookie'] = ADMIN_COOKIE;
  if (ADMIN_TOKEN) headers['X-Admin-Token'] = ADMIN_TOKEN;
  return headers;
}

async function getJson(path, init) {
  const r = await fetch(BASE + path, { ...(init || {}), headers: authHeaders((init||{}).headers || {}) });
  if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}`);
  return r.json();
}

(async () => {
  console.log(`${colors.blue}Admin Queue Cycle @ ${BASE}${colors.reset}`);
  try {
    // pick clinic
    const pin = await getJson('/api/v1/admin/pin/status');
    const clinic = Object.keys(pin?.pins || pin || { lab: true })[0] || 'lab';

    // login patient
    const login = await getJson('/api/v1/patient/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: `ADM${Date.now()}`.slice(-10), gender: 'male' })
    });
    const sessionId = login.data?.id;

    // enter queue
    await getJson('/api/v1/queue/enter', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinic, user: sessionId })
    });

    // call
    await getJson('/api/v1/queue/call', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinic })
    });

    // fetch pin
    const pinRes = await getJson(`/api/v1/admin/pin/status?clinic=${encodeURIComponent(clinic)}`);
    const pinValue = String(pinRes?.pin?.pin || pinRes?.pin?.value || pinRes?.pin || '0000');

    // done (protected)
    const done = await getJson('/api/v1/queue/done', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinic, user: sessionId, pin: pinValue })
    });

    if (!done.success) throw new Error('queue done failed');
    console.log(`${colors.green}✓${colors.reset} Full admin cycle confirmed`);
    process.exit(0);
  } catch (e) {
    console.log(`${colors.red}✗${colors.reset} ${e.message || e}`);
    process.exit(1);
  }
})();

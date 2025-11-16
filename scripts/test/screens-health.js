#!/usr/bin/env node
/**
 * Simple screens health probe.
 * Checks availability of public and admin-related paths.
 * Uses DEPLOY_URL or defaults to http://localhost:5173.
 * Accepts optional --json output flag.
 */

const base = process.env.DEPLOY_URL || 'http://localhost:5173';
const pathsPatient = ['/', '/qr', '/standalone.html', '/offline.html'];
// Admin related: some may require auth; 401/403 acceptable, treat 5xx as failure
const pathsAdmin = ['/admin', '/?admin=true', '/test-admin-login.html'];

const results = { base, patient: [], admin: [] };

function classifyStatus(status, group) {
  if (status >= 200 && status < 400) return 'ok';
  if (group === 'admin' && (status === 401 || status === 403)) return 'gated';
  return 'fail';
}

async function probe(path, group) {
  const url = base.replace(/\/$/, '') + path;
  const start = Date.now();
  try {
    const res = await fetch(url, { redirect: 'manual' });
    const status = res.status;
    const cls = classifyStatus(status, group);
    return { path, url, status, classification: cls, ms: Date.now() - start };
  } catch (err) {
    return { path, url, status: 0, classification: 'error', error: err.message, ms: Date.now() - start };
  }
}

async function run() {
  for (const p of pathsPatient) {
    results.patient.push(await probe(p, 'patient'));
  }
  for (const p of pathsAdmin) {
    results.admin.push(await probe(p, 'admin'));
  }

  const summary = {
    patient_ok: results.patient.filter(r => r.classification === 'ok').length,
    patient_total: results.patient.length,
    admin_ok: results.admin.filter(r => r.classification === 'ok' || r.classification === 'gated').length,
    admin_total: results.admin.length,
    admin_gated: results.admin.filter(r => r.classification === 'gated').length,
    failures: [
      ...results.patient.filter(r => r.classification === 'fail' || r.classification === 'error'),
      ...results.admin.filter(r => r.classification === 'fail' || r.classification === 'error')
    ].length
  };

  const jsonFlag = process.argv.includes('--json');
  if (jsonFlag) {
    console.log(JSON.stringify({ summary, details: results }, null, 2));
  } else {
    console.log('\n=== Screens Health Report ===');
    console.log('Base:', base);
    console.log('\nPatient Screens:');
    results.patient.forEach(r => {
      console.log(`  ${r.path.padEnd(22)} ${String(r.status).padEnd(4)} ${r.classification.padEnd(8)} ${r.ms}ms`);
    });
    console.log('\nAdmin Screens:');
    results.admin.forEach(r => {
      console.log(`  ${r.path.padEnd(22)} ${String(r.status).padEnd(4)} ${r.classification.padEnd(8)} ${r.ms}ms`);
    });
    console.log('\nSummary:', summary);
    if (summary.failures > 0) {
      console.log(`\n❌ Failures detected: ${summary.failures}`);
      process.exitCode = 1;
    } else {
      console.log('\n✅ All critical screens reachable (admin gated counted as ok).');
    }
  }
}

run();

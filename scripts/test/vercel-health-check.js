#!/usr/bin/env node
/* Simple post-deploy healthcheck.
 * - Reads DEPLOY_URL from env.
 * - Optional ENDPOINTS (CSV) for extra checks.
 * - STRICT=true to fail on any endpoint failure. Default: false.
 */
const { setTimeout: sleep } = require('timers/promises');

function env(name, def = '') { return process.env[name] || def; }

async function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController();
  const timeout = opts.timeout || 10000;
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal, redirect: 'follow' });
    return res;
  } finally {
    clearTimeout(id);
  }
}

function joinUrl(base, path) {
  const b = base.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

(async () => {
  const base = env('DEPLOY_URL').trim();
  if (!base) {
    console.error('DEPLOY_URL is empty. Set env DEPLOY_URL or pass input url.');
    process.exit(1);
  }

  const strict = /^true$/i.test(env('STRICT'));
  const endpointsCsv = env('ENDPOINTS');
  const endpoints = [ '/', '/api/v1/status', ...(
    endpointsCsv ? endpointsCsv.split(',').map(s => s.trim()).filter(Boolean) : []
  )];

  console.log(`Healthcheck against: ${base}`);
  console.log(`Endpoints: ${endpoints.join(', ')} (STRICT=${strict})`);

  let baseOk = false;
  const results = [];

  for (const ep of endpoints) {
    const url = joinUrl(base, ep);
    const label = ep;
    try {
      const res = await fetchWithTimeout(url, { timeout: 10000 });
      const ok = res.ok;
      const status = res.status;
      results.push({ endpoint: label, ok, status });
      console.log(`${ok ? '✅' : '❌'} ${label} -> ${status}`);
      if (ep === '/' && ok) baseOk = true;
      // polite pacing
      await sleep(150);
    } catch (e) {
      results.push({ endpoint: label, ok: false, status: 0, error: e.message });
      console.log(`❌ ${label} -> error: ${e.message}`);
    }
  }

  const failures = results.filter(r => !r.ok);
  if (!baseOk) {
    console.error('Base path check failed. Marking healthcheck as failed.');
    process.exit(1);
  }
  if (strict && failures.length) {
    console.error(`STRICT mode: ${failures.length} endpoint(s) failed.`);
    process.exit(1);
  }

  console.log('All required checks passed.');
})();

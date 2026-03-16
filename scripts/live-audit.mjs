#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const DOCS_API_FILE = process.env.DOCS_API_FILE || 'docs/API.md';
const LOVE_API_DIR = process.env.LOVE_API_DIR || '../love-api';
const LOCAL_BACKEND_DIR = process.env.LOCAL_BACKEND_DIR || '.';
const AUDIT_BASE_URL = (process.env.AUDIT_BASE_URL || 'https://mmc-mms.com').replace(/\/$/, '');
const AUDIT_TIMEOUT_MS = Number(process.env.AUDIT_TIMEOUT_MS || 20000);
const AUDIT_OUTPUT = process.env.AUDIT_OUTPUT || 'docs/proofs/live-audit-report.json';
const CONTRACT_OUTPUT = process.env.CONTRACT_OUTPUT || 'docs/proofs/endpoint-contract.json';
const AUDIT_AUTH_TOKEN = process.env.AUDIT_AUTH_TOKEN || '';
const ENABLE_REQUESTS = process.env.AUDIT_EXECUTE !== 'false';
const MAX_ENDPOINTS = Number(process.env.AUDIT_MAX_ENDPOINTS || 0);

function exists(p) {
  try { return fs.existsSync(p); } catch { return false; }
}

function readText(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}

function parseDocEndpoints(filePath) {
  const text = readText(filePath);
  const matches = [...text.matchAll(/`(GET|POST|PUT|PATCH|DELETE)\s+([^`\s]+)`/g)];
  return matches.map((m) => ({
    method: m[1].toUpperCase(),
    path: m[2],
    source: 'docs',
  }));
}

function getFunctionMethods(content) {
  const methods = new Set();
  for (const m of content.matchAll(/req\.method\s*(?:===|!==)\s*['\"](GET|POST|PUT|PATCH|DELETE)['\"]/g)) methods.add(m[1]);
  for (const m of content.matchAll(/switch\s*\(req\.method\)\s*\{([\s\S]*?)\}/g)) {
    const body = m[1] || '';
    for (const c of body.matchAll(/case\s*['\"](GET|POST|PUT|PATCH|DELETE)['\"]/g)) methods.add(c[1]);
  }
  if (!methods.size) methods.add('GET');
  return [...methods];
}

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function parseBackendEndpoints(rootDir, originLabel) {
  const endpoints = [];
  const supaFnsDir = path.join(rootDir, 'supabase/functions');
  if (exists(supaFnsDir)) {
    const fnDirs = fs.readdirSync(supaFnsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
    for (const d of fnDirs) {
      const idx = path.join(supaFnsDir, d.name, 'index.ts');
      if (!exists(idx)) continue;
      const content = readText(idx);
      const methods = getFunctionMethods(content);
      for (const method of methods) {
        endpoints.push({
          method,
          path: `/functions/v1/${d.name}`,
          source: originLabel,
        });
      }
    }
  }

  const apiDir = path.join(rootDir, 'api');
  if (exists(apiDir)) {
    for (const file of walk(apiDir).filter((f) => /\.(ts|js)$/.test(f))) {
      const rel = file.replace(rootDir, '').replace(/\\/g, '/');
      const content = readText(file);
      const methods = getFunctionMethods(content);
      const routePath = rel
        .replace(/^\/?api/, '/api')
        .replace(/\/index\.(ts|js)$/, '')
        .replace(/\.(ts|js)$/, '')
        .replace(/\[(.+?)\]/g, ':$1');
      for (const method of methods) endpoints.push({ method, path: routePath, source: originLabel });
    }
  }

  return endpoints;
}

function normalizePath(p) {
  let normalized = p.trim().replace(/\\/g, '');
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  return normalized.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}

function dedupeEndpoints(items) {
  const map = new Map();
  for (const e of items) {
    const key = `${e.method.toUpperCase()} ${normalizePath(e.path)}`;
    if (!map.has(key)) map.set(key, { ...e, path: normalizePath(e.path), sources: [e.source] });
    else {
      const curr = map.get(key);
      curr.sources = [...new Set([...curr.sources, e.source])];
      map.set(key, curr);
    }
  }
  return [...map.values()];
}

function endpointToUrl(base, endpointPath) {
  if (endpointPath.startsWith('/api/') || endpointPath.startsWith('/functions/')) return `${base}${endpointPath}`;
  return `${base}/api${endpointPath}`;
}

function samplePayload(endpoint) {
  const base = {
    trace_id: `audit-${Date.now()}`,
    dry_run: true,
  };
  if (/queue|clinic|patient/i.test(endpoint.path)) {
    return { ...base, clinic_id: 'lab', patient_id: `audit-${Date.now()}` };
  }
  if (/pin/i.test(endpoint.path)) return { ...base, clinic_id: 'lab', pin: '000000' };
  return base;
}

function validateSchema({ status, contentType, bodyText }) {
  const result = { valid: true, errors: [], kind: 'unknown' };
  if ((contentType || '').includes('application/json')) {
    try {
      const parsed = JSON.parse(bodyText || '{}');
      result.kind = Array.isArray(parsed) ? 'array' : typeof parsed;
      if (!(Array.isArray(parsed) || (parsed && typeof parsed === 'object'))) {
        result.valid = false;
        result.errors.push('json_root_not_object_or_array');
      }
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const keys = Object.keys(parsed);
        if (!keys.length) {
          result.valid = false;
          result.errors.push('empty_json_object');
        }
      }
    } catch {
      result.valid = false;
      result.errors.push('invalid_json_payload');
    }
  } else if (status >= 200 && status < 300) {
    result.kind = 'text';
  }
  return result;
}

async function request(url, { method, token, payload }) {
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json', 'x-live-audit': 'true' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUDIT_TIMEOUT_MS);
  const started = performance.now();
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: method === 'GET' ? undefined : JSON.stringify(payload),
      signal: controller.signal,
    });
    const latencyMs = Math.round(performance.now() - started);
    const bodyText = await response.text();
    const schema = validateSchema({ status: response.status, contentType: response.headers.get('content-type') || '', bodyText });
    return {
      ok: response.ok,
      status: response.status,
      latencyMs,
      contentType: response.headers.get('content-type') || '',
      schema,
      bodyPreview: bodyText.slice(0, 240),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      latencyMs: Math.round(performance.now() - started),
      contentType: '',
      schema: { valid: false, errors: ['request_failed'], kind: 'none' },
      bodyPreview: '',
      error: String(error?.message || error),
    };
  } finally {
    clearTimeout(timer);
  }
}

function evaluateScenario(name, result) {
  const isAuthScenario = name !== 'authorized';
  if (name === 'authorized') return result.status >= 200 && result.status < 500;
  if (isAuthScenario) return [401, 403].includes(result.status);
  return false;
}

async function run() {
  const docsEndpoints = parseDocEndpoints(DOCS_API_FILE);
  const backendEndpoints = [
    ...parseBackendEndpoints(LOCAL_BACKEND_DIR, 'love-local-backend'),
    ...(exists(LOVE_API_DIR) ? parseBackendEndpoints(LOVE_API_DIR, 'love-api-backend') : []),
  ];

  const contract = dedupeEndpoints([...docsEndpoints, ...backendEndpoints]);
  const selectedContract = MAX_ENDPOINTS > 0 ? contract.slice(0, MAX_ENDPOINTS) : contract;

  fs.mkdirSync(path.dirname(CONTRACT_OUTPUT), { recursive: true });
  fs.writeFileSync(CONTRACT_OUTPUT, JSON.stringify({ generatedAt: new Date().toISOString(), endpoints: selectedContract }, null, 2));

  const report = {
    generatedAt: new Date().toISOString(),
    config: {
      baseUrl: AUDIT_BASE_URL,
      timeoutMs: AUDIT_TIMEOUT_MS,
      docsApiFile: DOCS_API_FILE,
      loveApiDir: exists(LOVE_API_DIR) ? LOVE_API_DIR : null,
      localBackendDir: LOCAL_BACKEND_DIR,
      executeRequests: ENABLE_REQUESTS,
      passRateThreshold: 98,
      maxFailedChecks: 2,
      endpoints: selectedContract.length,
    },
    contract: selectedContract,
    checks: [],
    summary: {
      totalChecks: 0,
      passedChecks: 0,
      failedChecks: 0,
      passRate: 0,
      acceptancePassed: false,
    },
  };

  if (ENABLE_REQUESTS) {
    const scenarios = [
      { name: 'authorized', token: AUDIT_AUTH_TOKEN || null },
      { name: 'unauthorized', token: null },
      { name: 'invalid_token', token: 'invalid.token.live-audit' },
    ];

    for (const endpoint of selectedContract) {
      const url = endpointToUrl(AUDIT_BASE_URL, endpoint.path);
      for (const scenario of scenarios) {
        const result = await request(url, {
          method: endpoint.method,
          token: scenario.token,
          payload: samplePayload(endpoint),
        });
        const passed = evaluateScenario(scenario.name, result) && result.schema.valid;
        report.summary.totalChecks += 1;
        if (passed) report.summary.passedChecks += 1;
        else report.summary.failedChecks += 1;
        report.checks.push({
          endpoint: `${endpoint.method} ${endpoint.path}`,
          scenario: scenario.name,
          url,
          passed,
          status: result.status,
          latencyMs: result.latencyMs,
          schemaValid: result.schema.valid,
          schemaErrors: result.schema.errors,
          error: result.error,
          contentType: result.contentType,
          bodyPreview: result.bodyPreview,
        });
      }
    }
  }

  report.summary.passRate = report.summary.totalChecks
    ? Number(((report.summary.passedChecks / report.summary.totalChecks) * 100).toFixed(2))
    : 0;
  report.summary.acceptancePassed = report.summary.passRate >= 98 && report.summary.failedChecks <= 2;

  fs.mkdirSync(path.dirname(AUDIT_OUTPUT), { recursive: true });
  fs.writeFileSync(AUDIT_OUTPUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary, null, 2));

  if (ENABLE_REQUESTS && !report.summary.acceptancePassed) {
    process.exit(2);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

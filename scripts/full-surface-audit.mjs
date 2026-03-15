#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ORIGIN = process.env.AUDIT_ORIGIN || 'https://mmc-mms.com';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rujwuruuosffcxazymit.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE || '';

const API_DOC_PATH = path.join(new URL('.', import.meta.url).pathname, '..', 'docs', 'API.md');
const FRONTEND_COMPONENTS_DIR = path.join(new URL('.', import.meta.url).pathname, '..', 'frontend', 'src', 'components');
const FRONTEND_LIB_DIR = path.join(new URL('.', import.meta.url).pathname, '..', 'frontend', 'src', 'lib');

const listFilesRecursively = (dir, exts = new Set(['.js', '.jsx', '.ts', '.tsx'])) => {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const walk = (p) => {
    for (const entry of fs.readdirSync(p, { withFileTypes: true })) {
      const full = path.join(p, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (exts.has(path.extname(entry.name))) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out;
};

const apiDoc = fs.readFileSync(API_DOC_PATH, 'utf8');
const endpointMatches = [
  ...apiDoc.matchAll(/-\s*\\?`(GET|POST|PUT|DELETE|PATCH)\s+(\/api\/v1\/[^`]+)\\?`/g),
  ...apiDoc.matchAll(/-\s*(GET|POST|PUT|DELETE|PATCH)\s+(\/api\/v1\/\S+)/g),
];
const endpoints = endpointMatches
  .map((m) => ({ method: m[1], path: m[2].replace(/\\+$/g, '') }))
  .filter((ep, idx, arr) => arr.findIndex((x) => x.method === ep.method && x.path === ep.path) === idx);

const fixedChecks = [
  `${ORIGIN}`,
  `${ORIGIN}/admin`,
  'https://www.mmc-mms.com',
  'https://www.mmc-mms.com/admin',
];

const tableChecks = [
  'unified_queue', 'clinics', 'patients', 'system_config', 'pins',
  'qa_runs', 'qa_findings', 'repair_runs', 'smart_errors_log', 'smart_fixes_log',
];

const featureCatalog = [
  {
    feature: 'Resilient HTTP layer',
    codes: ['requestJson', 'resilientRequest'],
    locations: ['frontend/src/lib/resilient-request.js', 'frontend/src/lib/api-unified.js'],
  },
  {
    feature: 'Smart QA/Repair workflows',
    codes: ['startDeepQA', 'executeRepair'],
    locations: ['frontend/src/components/QARepairPanel.jsx', 'frontend/src/components/AdminDashboardV2.jsx'],
  },
  {
    feature: 'Audit tooling',
    codes: ['live-audit', 'full-surface-audit'],
    locations: ['scripts/live-audit.mjs', 'scripts/full-surface-audit.mjs'],
  },
  {
    feature: 'Auth break-glass safeguards',
    codes: ['AuthService.login', 'tryBreakGlass'],
    locations: ['frontend/src/lib/auth-service.js'],
  },
];

const curl = (url, headers = []) => {
  const args = ['-L', '--max-time', '25', '-sS'];
  for (const h of headers) args.push('-H', h);
  args.push('-w', '\n__STATUS__:%{http_code}\n__URL__:%{url_effective}\n', url);
  try {
    const out = execFileSync('curl', args, { encoding: 'utf8' });
    const status = Number((out.match(/__STATUS__:(\d+)/) || [])[1] || 0);
    const finalUrl = (out.match(/__URL__:(.*)/) || [])[1]?.trim() || url;
    const body = out.replace(/\n__STATUS__:[\s\S]*$/, '');
    return { ok: status > 0, status, finalUrl, body, error: null };
  } catch (error) {
    return { ok: false, status: 0, finalUrl: url, body: '', error: String(error) };
  }
};

const result = {
  generatedAt: new Date().toISOString(),
  origin: ORIGIN,
  metadata: {
    scannerVersion: '2.0.0',
    apiDocPath: 'docs/API.md',
    filesScannedCount: 0,
    filesScanned: [],
    interactiveFilesCount: 0,
    interactiveFiles: [],
    featureCatalog,
  },
  fixedChecks: [],
  apiEndpoints: [],
  tables: [],
  repairSummary: {
    autoFixesApplied: [],
    remainingErrors: [],
    notes: [],
  },
};

const componentFiles = listFilesRecursively(FRONTEND_COMPONENTS_DIR);
const libFiles = listFilesRecursively(FRONTEND_LIB_DIR);
result.metadata.filesScanned = [...componentFiles, ...libFiles]
  .map((p) => path.relative(path.join(new URL('.', import.meta.url).pathname, '..'), p));
result.metadata.filesScannedCount = result.metadata.filesScanned.length;

result.metadata.interactiveFiles = result.metadata.filesScanned.filter((file) => {
  try {
    const abs = path.join(path.join(new URL('.', import.meta.url).pathname, '..'), file);
    const text = fs.readFileSync(abs, 'utf8');
    return /data-testid|aria-label|onClick|onKeyDown|onDoubleClick/.test(text);
  } catch {
    return false;
  }
});
result.metadata.interactiveFilesCount = result.metadata.interactiveFiles.length;

for (const url of fixedChecks) {
  const r = curl(url);
  result.fixedChecks.push({
    url,
    status: r.status,
    finalUrl: r.finalUrl,
    ok: r.ok && r.status < 500,
    bodyLength: r.body.length,
    error: r.error,
  });
}

for (const ep of endpoints) {
  const url = `${ORIGIN}${ep.path}`;
  const method = ep.method === 'GET' ? 'GET' : 'OPTIONS';
  const headers = method === 'OPTIONS'
    ? [`Access-Control-Request-Method: ${ep.method}`, `Origin: ${ORIGIN}`]
    : [];
  const r = curl(url, headers);
  result.apiEndpoints.push({
    declaredMethod: ep.method,
    probeMethod: method,
    path: ep.path,
    status: r.status,
    ok: r.ok && r.status > 0 && r.status < 500,
    error: r.error,
  });
}

if (SUPABASE_KEY) {
  for (const t of tableChecks) {
    const url = `${SUPABASE_URL}/rest/v1/${t}?select=*&limit=1`;
    const r = curl(url, [`apikey: ${SUPABASE_KEY}`, `Authorization: Bearer ${SUPABASE_KEY}`]);
    result.tables.push({ table: t, status: r.status, ok: r.ok && r.status < 400, error: r.error });
  }
} else {
  result.tables.push({ table: '*', status: 0, ok: false, error: 'Missing SUPABASE key' });
}

const allChecks = [
  ...result.fixedChecks.map((x) => ({ type: 'fixed', key: x.url, ...x })),
  ...result.apiEndpoints.map((x) => ({ type: 'endpoint', key: `${x.declaredMethod} ${x.path}`, ...x })),
  ...result.tables.map((x) => ({ type: 'table', key: x.table, ...x })),
];

const failedChecks = allChecks.filter((x) => !x.ok);
const passedChecks = allChecks.length - failedChecks.length;

result.repairSummary.autoFixesApplied.push({
  fix: 'Normalized endpoint extraction from docs/API.md (escaped markdown support)',
  impact: 'Endpoint coverage is now parsed and included in the audit output',
  status: 'applied',
});
result.repairSummary.notes.push('Non-GET endpoints are probed safely via OPTIONS reachability checks.');
result.repairSummary.remainingErrors = failedChecks.map((f) => ({
  scope: f.type,
  key: f.key,
  status: f.status,
  error: f.error || null,
}));

result.summary = {
  totalChecks: allChecks.length,
  passedChecks,
  failedChecks: failedChecks.length,
  successRate: Number(((passedChecks / Math.max(allChecks.length, 1)) * 100).toFixed(2)),
  canDeploy: Number(((passedChecks / Math.max(allChecks.length, 1)) * 100).toFixed(2)) >= 98,
};

console.log(JSON.stringify(result, null, 2));

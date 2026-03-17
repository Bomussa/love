import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const configPath = path.resolve('tests/integration/unified-integration.config.json');
const reportPath = path.resolve('artifacts/integration-report.json');

const frontendBase = (process.env.FRONTEND_BASE_URL || 'https://mmc-mms.com').replace(/\/$/, '');
const frontendWWWBase = (process.env.FRONTEND_WWW_BASE_URL || 'https://www.mmc-mms.com').replace(/\/$/, '');
const backendBase = (process.env.BACKEND_BASE_URL || frontendBase).replace(/\/$/, '');
const anonToken = process.env.SUPABASE_ANON_KEY || '';
const execFileAsync = promisify(execFile);

const now = new Date().toISOString();

const loadJson = async (p) => JSON.parse(await fs.readFile(p, 'utf8'));

const correlationId = () => `corr-${Date.now()}-${crypto.randomUUID()}`;

const safeText = async (res) => {
  try {
    return await res.text();
  } catch {
    return '';
  }
};

const toSnippet = (text) => text.slice(0, 1000);

const resolveBase = (item, type) => {
  if (item.base === 'frontend-www') {
    return frontendWWWBase;
  }
  if (item.base === 'frontend') {
    return frontendBase;
  }
  if (type === 'frontend') {
    return item.target === 'www' ? frontendWWWBase : frontendBase;
  }
  return backendBase;
};

async function fetchWithCurl(url, headers = {}) {
  const args = ['-sS', '-L', '-m', '30'];
  for (const [key, value] of Object.entries(headers)) {
    if (value) {
      args.push('-H', `${key}: ${value}`);
    }
  }
  args.push('-w', '\n__MMC_STATUS__:%{http_code}', url);

  const { stdout } = await execFileAsync('curl', args, { maxBuffer: 10 * 1024 * 1024 });
  const marker = '\n__MMC_STATUS__:';
  const idx = stdout.lastIndexOf(marker);
  if (idx < 0) {
    throw new Error('curl response did not include status marker');
  }

  const body = stdout.slice(0, idx);
  const status = Number(stdout.slice(idx + marker.length).trim());
  return { status, body };
}

async function runCheck(item, type) {
  const id = correlationId();
  const base = resolveBase(item, type);
  const url = `${base}${type === 'frontend' ? item.url : item.path}`;

  const headers = {
    'x-correlation-id': id,
    'accept': 'application/json,text/html;q=0.9,*/*;q=0.8'
  };

  if (type === 'backend' && anonToken) {
    headers.apikey = anonToken;
    headers.Authorization = `Bearer ${anonToken}`;
  }

  const started = Date.now();
  try {
    let status;
    let body;
    let transport = 'fetch';

    try {
      const res = await fetch(url, { method: item.method || 'GET', headers });
      status = res.status;
      body = await safeText(res);
    } catch {
      const curlRes = await fetchWithCurl(url, headers);
      status = curlRes.status;
      body = curlRes.body;
      transport = 'curl-fallback';
    }

    const ok = status >= 200 && status < 400;

    return {
      id: item.id,
      name: item.name,
      type,
      severity: item.severity || 'P2',
      url,
      status,
      ok,
      latencyMs: Date.now() - started,
      correlationId: id,
      responseSnippet: toSnippet(body),
      bodyHash: crypto.createHash('sha256').update(body).digest('hex'),
      transport
    };
  } catch (error) {
    return {
      id: item.id,
      name: item.name,
      type,
      severity: item.severity || 'P2',
      url,
      status: 0,
      ok: false,
      latencyMs: Date.now() - started,
      correlationId: id,
      error: String(error)
    };
  }
}

async function main() {
  const config = await loadJson(configPath);
  await fs.mkdir(path.dirname(reportPath), { recursive: true });

  const checks = [];
  for (const flow of config.frontendFlows || []) {
    checks.push(await runCheck(flow, 'frontend'));
  }
  for (const endpoint of config.backendEndpoints || []) {
    checks.push(await runCheck(endpoint, 'backend'));
  }

  const total = checks.length;

  const homeCheck = checks.find((item) => item.id === 'ui-home-load');
  const wwwCheck = checks.find((item) => item.id === 'ui-www-domain-parity');
  if (homeCheck?.ok && wwwCheck?.ok && homeCheck.bodyHash !== wwwCheck.bodyHash) {
    wwwCheck.ok = false;
    wwwCheck.status = 409;
    wwwCheck.responseSnippet = 'www shell hash does not match apex shell hash';
    wwwCheck.parityWithApex = false;
  }

  const passed = checks.filter((c) => c.ok).length;
  const failed = total - passed;
  const failedBySeverity = checks
    .filter((c) => !c.ok)
    .reduce((acc, c) => {
      acc[c.severity] = (acc[c.severity] || 0) + 1;
      return acc;
    }, {});

  const successRate = total === 0 ? 0 : Number(((passed / total) * 100).toFixed(2));

  const report = {
    generatedAt: now,
    environment: {
      frontendBase,
      frontendWWWBase,
      backendBase
    },
    summary: {
      total,
      passed,
      failed,
      successRate,
      failedBySeverity,
      releaseGate: {
        minSuccessRate: 98,
        maxFailureRate: 2,
        maxP0: 0,
        maxP1: 0,
        pass: successRate > 98 && (failedBySeverity.P0 || 0) === 0 && (failedBySeverity.P1 || 0) === 0
      }
    },
    checks
  };

  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

  console.log(`Integration checks: ${passed}/${total} passed (${successRate}%).`);
  console.log(`P0 failures: ${failedBySeverity.P0 || 0}, P1 failures: ${failedBySeverity.P1 || 0}`);

  if (!report.summary.releaseGate.pass) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

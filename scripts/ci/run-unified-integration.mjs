import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const configPath = path.resolve('tests/integration/unified-integration.config.json');
const reportPath = path.resolve('artifacts/integration-report.json');

const frontendBase = (process.env.FRONTEND_BASE_URL || 'https://mmc-mms.com').replace(/\/$/, '');
const frontendWWWBase = (process.env.FRONTEND_WWW_BASE_URL || 'https://www.mmc-mms.com').replace(/\/$/, '');
const backendBase = (process.env.BACKEND_BASE_URL || 'https://rujwuruuosffcxazymit.supabase.co').replace(/\/$/, '');
const anonToken = process.env.SUPABASE_ANON_KEY || '';

const now = new Date().toISOString();

const loadJson = async (p) => JSON.parse(await fs.readFile(p, 'utf8'));

const correlationId = () => `corr-${Date.now()}-${crypto.randomUUID()}`;

const safeText = async (res) => {
  try {
    return (await res.text()).slice(0, 1000);
  } catch {
    return '';
  }
};

async function runCheck(item, type) {
  const id = correlationId();
  const base = type === 'frontend' ? (item.target === 'www' ? frontendWWWBase : frontendBase) : backendBase;
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
    const res = await fetch(url, { method: item.method || 'GET', headers });
    const body = await safeText(res);
    const ok = res.status >= 200 && res.status < 400;

    return {
      id: item.id,
      name: item.name,
      type,
      severity: item.severity || 'P2',
      url,
      status: res.status,
      ok,
      latencyMs: Date.now() - started,
      correlationId: id,
      responseSnippet: body
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

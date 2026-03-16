#!/usr/bin/env node
/**
 * Production smoke checks for public Function endpoints.
 * - Supports host list via TARGET_HOSTS (comma-separated)
 * - Supports endpoints via ENDPOINTS_JSON or built-in defaults
 * - Classifies failures: html_fallback, protected_by_auth, bad_status, unexpected_content_type
 * - Adds apex/www homepage parity check
 */

import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const TARGET_HOSTS = (process.env.TARGET_HOSTS || 'https://mmc-mms.com,https://www.mmc-mms.com')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 20000);
const OUTPUT_FILE = process.env.OUTPUT_FILE || '';
const STRICT_FAILURE_RATE = Number(process.env.STRICT_FAILURE_RATE || 10);

const DEFAULT_ENDPOINTS = [
  { id: 'healthz', method: 'GET', path: '/functions/v1/healthz', accept: ['application/json'] },
  { id: 'api-v1-status', method: 'GET', path: '/functions/v1/api-v1-status', accept: ['application/json'] },
  { id: 'events-stream', method: 'GET', path: '/functions/v1/events-stream', accept: ['text/event-stream', 'application/json'] },
  {
    id: 'clinic-exit-dry-run',
    method: 'POST',
    path: '/functions/v1/clinic-exit',
    accept: ['application/json'],
    body: { dry_run: true, clinic_id: 'lab', patient_id: `smoke-${Date.now()}` },
  },
];

function loadEndpoints() {
  if (!process.env.ENDPOINTS_JSON) return DEFAULT_ENDPOINTS;
  try {
    const parsed = JSON.parse(process.env.ENDPOINTS_JSON);
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_ENDPOINTS;
  } catch {
    return DEFAULT_ENDPOINTS;
  }
}

const ENDPOINTS = loadEndpoints();

const REQUIRED_HEALTH_PATH = '/functions/v1/healthz';

function ensureRequiredHealthEndpoint(endpoints) {
  const hasHealth = endpoints.some((endpoint) => endpoint?.path === REQUIRED_HEALTH_PATH && (endpoint?.method || 'GET') === 'GET');
  if (!hasHealth) {
    throw new Error(`Missing required health probe endpoint in smoke config: GET ${REQUIRED_HEALTH_PATH}`);
  }
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

async function curlRequest(url, { method = 'GET', body } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'smoke-'));
  const headersPath = join(dir, 'headers.txt');
  const bodyPath = join(dir, 'body.txt');
  const writeOut = '%{http_code}|%{content_type}|%{url_effective}';

  const args = [
    '-sS',
    '-L',
    '--max-time',
    String(Math.ceil(TIMEOUT_MS / 1000)),
    '-X',
    method,
    '-D',
    headersPath,
    '-o',
    bodyPath,
    '-w',
    writeOut,
    url,
  ];

  if (body) args.push('-H', 'Content-Type: application/json', '--data', JSON.stringify(body));

  const started = Date.now();
  try {
    const { stdout } = await execFileAsync('curl', args, { maxBuffer: 1024 * 1024 });
    const latencyMs = Date.now() - started;

    const [code, contentType = '', effectiveUrl = ''] = String(stdout).trim().split('|');
    const headerText = readFileSync(headersPath, 'utf8');
    const bodyText = readFileSync(bodyPath, 'utf8');
    const status = Number(code || 0);
    const locationMatches = [...headerText.matchAll(/\nlocation:\s*([^\r\n]+)/gi)];
    const finalLocation = locationMatches.length ? locationMatches[locationMatches.length - 1][1].trim() : '';

    return {
      status,
      contentType,
      effectiveUrl,
      location: finalLocation,
      body: bodyText,
      headers: headerText,
      latencyMs,
      error: null,
    };
  } catch (error) {
    return {
      status: 0,
      contentType: '',
      effectiveUrl: '',
      location: '',
      body: '',
      headers: '',
      latencyMs: Date.now() - started,
      error: String(error?.message || error),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function classifyResult(result, endpoint) {
  const statusOk = result.status >= 200 && result.status < 300;
  const bodyPrefix = result.body.slice(0, 200);
  const htmlFallback = result.contentType.includes('text/html') && /<!doctype html>/i.test(bodyPrefix);
  const authProtected = /Authentication Required|x-robots-tag:\s*noindex/i.test(result.body) || /x-robots-tag:\s*noindex/i.test(result.headers);
  const acceptOk = endpoint.accept.some((t) => result.contentType.includes(t));

  if (!statusOk) return { ok: false, reason: 'bad_status', htmlFallback, authProtected };
  if (authProtected) return { ok: false, reason: 'protected_by_auth', htmlFallback, authProtected };
  if (htmlFallback) return { ok: false, reason: 'html_fallback', htmlFallback, authProtected };
  if (!acceptOk) return { ok: false, reason: 'unexpected_content_type', htmlFallback, authProtected };
  return { ok: true, reason: 'ok', htmlFallback, authProtected };
}

async function runHomepageParity() {
  const [apex, www] = await Promise.all([
    curlRequest('https://mmc-mms.com/'),
    curlRequest('https://www.mmc-mms.com/'),
  ]);

  if (apex.error || www.error) {
    return {
      sameContent: false,
      error: `apex=${apex.error || 'none'} www=${www.error || 'none'}`,
    };
  }

  const normalize = (s) => s
    .replace(/https?:\/\/www\.mmc-mms\.com/gi, 'https://mmc-mms.com')
    .replace(/\s+/g, ' ')
    .trim();

  const apexNorm = normalize(apex.body);
  const wwwNorm = normalize(www.body);

  return {
    apexStatus: apex.status,
    wwwStatus: www.status,
    apexHash: sha256(apexNorm),
    wwwHash: sha256(wwwNorm),
    sameContent: sha256(apexNorm) === sha256(wwwNorm),
    apexEffectiveUrl: apex.effectiveUrl,
    wwwEffectiveUrl: www.effectiveUrl,
  };
}

async function main() {
  ensureRequiredHealthEndpoint(ENDPOINTS);
  const report = {
    generatedAt: new Date().toISOString(),
    config: {
      timeoutMs: TIMEOUT_MS,
      strictFailureRate: STRICT_FAILURE_RATE,
      targetHosts: TARGET_HOSTS,
      endpointsCount: ENDPOINTS.length,
    },
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      successRate: 0,
      failReasons: {},
    },
    checks: [],
    homepageParity: null,
  };

  for (const host of TARGET_HOSTS) {
    for (const endpoint of ENDPOINTS) {
      report.summary.total += 1;
      const url = `${host}${endpoint.path}`;
      const result = await curlRequest(url, endpoint);

      if (result.error) {
        report.summary.failed += 1;
        report.summary.failReasons.network_error = (report.summary.failReasons.network_error || 0) + 1;
        report.checks.push({ host, ...endpoint, url, ok: false, reason: 'network_error', latencyMs: result.latencyMs, error: result.error });
        continue;
      }

      const decision = classifyResult(result, endpoint);
      if (decision.ok) {
        report.summary.passed += 1;
      } else {
        report.summary.failed += 1;
        report.summary.failReasons[decision.reason] = (report.summary.failReasons[decision.reason] || 0) + 1;
      }

      report.checks.push({
        host,
        id: endpoint.id,
        method: endpoint.method,
        path: endpoint.path,
        url,
        ok: decision.ok,
        reason: decision.reason,
        status: result.status,
        latencyMs: result.latencyMs,
        contentType: result.contentType,
        effectiveUrl: result.effectiveUrl,
        location: result.location || undefined,
        htmlFallback: decision.htmlFallback,
        authProtected: decision.authProtected,
        bodyPreview: result.body.slice(0, 220),
      });
    }
  }

  report.homepageParity = await runHomepageParity();
  report.summary.successRate = report.summary.total
    ? Number(((report.summary.passed / report.summary.total) * 100).toFixed(2))
    : 0;

  if (OUTPUT_FILE) writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  const failureRate = report.summary.total ? (report.summary.failed / report.summary.total) * 100 : 100;
  if (failureRate > STRICT_FAILURE_RATE) process.exit(2);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

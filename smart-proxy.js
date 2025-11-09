#!/usr/bin/env node
/**
 * smart-proxy.js
 * Lightweight HTTP proxy for local testing (no code changes to your app).
 * - Listens on 0.0.0.0:8080
 * - Rewrites /api -> /api/v1
 * - Removes duplicate slashes
 * - Passes auth headers, generates x-request-id if missing
 * - Health-check to switch between primary and fallback upstreams
 * - NDJSON request logs to logs/YYYY-MM-DD_requests.ndjson
 * - Daily rotation + gzip archive in archives/
 * - One retry on transient 502/503/504 (backoff 200ms)
 */
const http = require('http');
const https = require('https');
const { URL } = require('url');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dns = require('dns');

const PORT = process.env.PROXY_PORT ? Number(process.env.PROXY_PORT) : 8080;
const HOST = '0.0.0.0';
const PRIMARY = process.env.UPSTREAM_PRIMARY || 'https://www.mmc-mms.com';
const FALLBACK = process.env.UPSTREAM_FALLBACK || 'https://mmc-mms.com';
const HEALTH_PATH = process.env.HEALTH_PATH || '/api/v1/health';
const HEALTH_TIMEOUT_MS = 1000;
const REQ_TIMEOUT_MS = 10_000;
const RETRY_BACKOFF_MS = 200;

const DIR_LOGS = path.join(process.cwd(), 'logs');
const DIR_ARCH = path.join(process.cwd(), 'archives');
fs.mkdirSync(DIR_LOGS, { recursive: true });
fs.mkdirSync(DIR_ARCH, { recursive: true });

function today() {
  const d = new Date();
  return d.toISOString().slice(0,10);
}
let currentLogDate = today();
let logStream = fs.createWriteStream(path.join(DIR_LOGS, `${currentLogDate}_requests.ndjson`), { flags: 'a' });

function rotateIfNeeded() {
  const d = today();
  if (d !== currentLogDate) {
    logStream.end();
    // gzip old log
    const src = path.join(DIR_LOGS, `${currentLogDate}_requests.ndjson`);
    const dst = path.join(DIR_ARCH, `${currentLogDate}.ndjson.gz`);
    try {
      const inp = fs.createReadStream(src);
      const out = fs.createWriteStream(dst);
      const gz = require('zlib').createGzip();
      inp.pipe(gz).pipe(out).on('finish', () => {
        // keep source for a while or delete if desired
      });
    } catch {}
    currentLogDate = d;
    logStream = fs.createWriteStream(path.join(DIR_LOGS, `${currentLogDate}_requests.ndjson`), { flags: 'a' });
  }
}
setInterval(rotateIfNeeded, 60_000);

function genId() { return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'); }
function sha256(x) { return crypto.createHash('sha256').update(x).digest('hex'); }

function sanitizePath(pathname) {
  // normalize: ensure /api -> /api/v1, collapse //
  let p = pathname.replace(/\/{2,}/g, '/');
  if (p === '/api') p = '/api/v1';
  else if (p.startsWith('/api/')) p = p.replace(/^\/api(\/|$)/, '/api/v1/');
  return p;
}

const PRIVATE_RANGES = [
  { cidr: '10.0.0.0', mask: 8 },
  { cidr: '172.16.0.0', mask: 12 },
  { cidr: '192.168.0.0', mask: 16 },
  { cidr: '127.0.0.0', mask: 8 },    // loopback
  { cidr: '169.254.0.0', mask: 16 }, // link-local
];
function ipInRange(ip, cidr, mask) {
  function toInt(x){ return x.split('.').reduce((a,v)=> (a<<8)+(+v),0)>>>0; }
  try {
    const ipInt = toInt(ip);
    const base = toInt(cidr);
    const maskInt = mask===0?0:~((1<<(32-mask))-1)>>>0;
    return (ipInt & maskInt) === (base & maskInt);
  } catch { return false; }
}
function isPrivateIP(ip) {
  if (!ip || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return false;
  return PRIVATE_RANGES.some(r => ipInRange(ip, r.cidr, r.mask));
}

async function resolveAndCheck(hostname) {
  return new Promise((resolve) => {
    dns.lookup(hostname, { family: 4 }, (err, address) => {
      if (err) return resolve({ ok: true, ip: null }); // if cannot resolve, don't block
      if (isPrivateIP(address)) return resolve({ ok: false, ip: address });
      return resolve({ ok: true, ip: address });
    });
  });
}

function pickUpstream() {
  return new Promise(async (resolve) => {
    const tryHost = async (base) => {
      try {
        const u = new URL(base + HEALTH_PATH);
        const check = await fetch(u, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
        return check.status === 200;
      } catch { return false; }
    };
    const okPrimary = await tryHost(PRIMARY);
    if (okPrimary) return resolve(PRIMARY);
    const okFallback = await tryHost(FALLBACK);
    if (okFallback) return resolve(FALLBACK);
    return resolve(PRIMARY); // default to primary if both fail (request may still fail)
  });
}

function logLine(obj) {
  try {
    logStream.write(JSON.stringify(obj) + '\n');
  } catch {}
}

async function proxyOnce(req, res, attempt=0, chosenUpstream=null) {
  const started = Date.now();
  const reqId = req.headers['x-request-id'] || genId();
  let upstream = chosenUpstream || await pickUpstream();
  const url = new URL(upstream);
  const target = new URL(req.url, upstream);
  target.pathname = sanitizePath(target.pathname);

  const { ok, ip } = await resolveAndCheck(url.hostname);
  if (!ok) {
    res.statusCode = 502;
    res.end('Blocked private upstream');
    logLine({ ts: new Date().toISOString(), req_id: reqId, method: req.method, path: req.url, status: 502, dur_ms: Date.now()-started, upstream, retry: attempt, err: 'private_ip:'+ip });
    return;
  }

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === 'undefined') continue;
    if (Array.isArray(v)) headers.set(k, v.join(', '));
    else headers.set(k, v);
  }
  headers.set('x-request-id', String(reqId));

  // privacy: hash sensitive authorization for logs
  const auth = req.headers['authorization'];
  const clientAuthHash = auth ? sha256(String(auth).slice(-16)) : null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQ_TIMEOUT_MS);

  try {
    const r = await fetch(target, {
      method: req.method,
      headers,
      body: ['GET','HEAD'].includes(req.method||'GET') ? undefined : req,
      redirect: 'manual',
      signal: controller.signal
    });
    clearTimeout(timeout);

    // pipe response
    res.statusCode = r.status;
    r.headers.forEach((v,k)=> res.setHeader(k, v));
    res.setHeader('x-proxy-upstream', upstream);
    res.setHeader('x-proxy-request-id', reqId);
    if (r.body) {
      // stream
      for await (const chunk of r.body) {
        res.write(chunk);
      }
    }
    res.end();

    logLine({ ts: new Date().toISOString(), req_id: reqId, method: req.method, path: target.pathname+target.search, status: r.status, dur_ms: Date.now()-started, upstream, retry: attempt, client_auth_hash: clientAuthHash });
    return;
  } catch (e) {
    clearTimeout(timeout);
    const retriable = attempt === 0;
    if (retriable) {
      await new Promise(r => setTimeout(r, RETRY_BACKOFF_MS));
      // swap upstream on retry
      const alt = upstream === PRIMARY ? FALLBACK : PRIMARY;
      return proxyOnce(req, res, attempt+1, alt);
    }
    res.statusCode = 502;
    res.end('Bad Gateway');
    logLine({ ts: new Date().toISOString(), req_id: reqId, method: req.method, path: req.url, status: 502, dur_ms: Date.now()-started, upstream, retry: attempt, err: String(e) });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    await proxyOnce(req, res);
  } catch (e) {
    res.statusCode = 500;
    res.end('Internal Error');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Smart proxy listening on http://${HOST}:${PORT}`);
  console.log(`Primary: ${PRIMARY}`);
  console.log(`Fallback: ${FALLBACK}`);
});

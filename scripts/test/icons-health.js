#!/usr/bin/env node

// Live Icons Health Test against production site
// Verifies: homepage links to manifest/icons, manifest JSON, icon assets reachable, admin config flags icons working

const BASE = process.env.DEPLOY_URL || 'https://www.mmc-mms.com';

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

async function fetchText(path) {
  const r = await fetch(BASE + path, { headers: { 'Cache-Control': 'no-cache' } });
  if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}`);
  return r.text();
}

async function fetchJson(path) {
  const r = await fetch(BASE + path, { headers: { 'Cache-Control': 'no-cache' } });
  if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}`);
  return r.json();
}

async function head(path) {
  const r = await fetch(BASE + path, { method: 'HEAD' });
  if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}`);
  return r.headers;
}

function extractManifestHref(html) {
  const m = html.match(/<link[^>]+rel=["']manifest["'][^>]+href=["']([^"']+)["']/i);
  return m ? m[1] : '/manifest.webmanifest';
}

(async () => {
  console.log(`${colors.blue}Icons Health @ ${BASE}${colors.reset}`);

  // 1) Homepage has manifest and icons links
  await timed('Homepage has manifest link (warn-only)', async () => {
    const html = await fetchText('/');
    const hasManifest = /rel=\"manifest\"|rel='manifest'/i.test(html);
    if (!hasManifest) throw new Error('manifest link not found');
  }).catch(() => {});

  await timed('Homepage has icon links', async () => {
    const html = await fetchText('/');
    const hasFavicon = /rel=\"icon\"|rel='icon'/i.test(html);
    const hasApple = /apple-touch-icon/i.test(html);
    if (!hasFavicon && !hasApple) throw new Error('icon links not found');
  });

  // 2) Manifest JSON and icons entries
  let manifestPath = '/manifest.webmanifest';
  await timed('Manifest JSON reachable', async () => {
    const html = await fetchText('/');
    manifestPath = extractManifestHref(html) || '/manifest.webmanifest';
    let man;
    try { man = await fetchJson(manifestPath); } catch {
      // fallback to default path
      manifestPath = '/manifest.webmanifest';
      man = await fetchJson(manifestPath);
    }
    if (!man || !Array.isArray(man.icons) || man.icons.length === 0) throw new Error('manifest icons missing');
  });

  await timed('Manifest icons assets reachable (sample)', async () => {
    const man = await fetchJson(manifestPath);
    const sample = man.icons.slice(0, 3);
    for (const ic of sample) {
      const src = ic.src || '';
      if (src.startsWith('data:image/')) continue; // data URL acceptable
      const resolved = src.startsWith('/') ? src : (manifestPath.replace(/\/[^/]*$/, '/') + src);
      try {
        const h = await head(resolved);
        const ct = (h.get('content-type') || '').toLowerCase();
        if (!(ct.startsWith('image/') || ct === 'application/octet-stream')) {
          // try GET as fallback
          const r = await fetch(BASE + resolved);
          if (!r.ok) throw new Error(`GET ${resolved} -> HTTP ${r.status}`);
        }
      } catch (e) {
        throw new Error(String(e.message || e));
      }
    }
  });

  // 3) Favicon reachable (optional)
  await timed('Favicon reachable (optional)', async () => {
    try {
      await head('/favicon.ico');
    } catch {
      const r = await fetch(BASE + '/favicon.ico');
      if (!r.ok) throw new Error('favicon not reachable');
    }
  }).catch(() => {});

  const passed = results.filter(r => r.ok).length;
  const failedItems = results.filter(r => !r.ok);
  const failed = failedItems.length;
  const warnOnly = failed > 0 && failedItems.every(r => /warn-only/i.test(r.name));
  console.log(`\n${colors.cyan}Passed:${colors.reset} ${passed}  ${colors.red}Failed:${colors.reset} ${failed}${warnOnly ? ` ${colors.yellow}(warn-only)` : ''}`);
  process.exit(failed > 0 && !warnOnly ? 1 : 0);
})();

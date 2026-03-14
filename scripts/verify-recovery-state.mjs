#!/usr/bin/env node

/**
 * Recovery verification for Vercel + Supabase integration.
 *
 * Required env:
 * - VERCEL_TOKEN
 * - VERCEL_PROJECT_ID
 * Optional env:
 * - VERCEL_TEAM_ID
 * - EXPECTED_SUPABASE_URL
 * - SITE_PRIMARY_URL
 * - SITE_WWW_URL
 */

import fs from 'node:fs';

const requiredProjectEnvs = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];

const token = process.env.VERCEL_TOKEN;
const projectId = process.env.VERCEL_PROJECT_ID;
const teamId = process.env.VERCEL_TEAM_ID;
const expectedSupabaseUrl = process.env.EXPECTED_SUPABASE_URL || 'https://rujwuruuosffcxazymit.supabase.co';
const sitePrimary = process.env.SITE_PRIMARY_URL || 'https://mmc-mms.com';
const siteWww = process.env.SITE_WWW_URL || 'https://www.mmc-mms.com';
const strictDomainEquivalence = process.env.STRICT_DOMAIN_EQUIVALENCE === '1';

if (!token || !projectId) {
  console.error('❌ Missing required env: VERCEL_TOKEN and VERCEL_PROJECT_ID');
  process.exit(2);
}

const query = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';

async function api(path) {
  const res = await fetch(`https://api.vercel.com${path}${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${path} failed (${res.status}): ${body.slice(0, 300)}`);
  }

  return res.json();
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim().replace(/\s+/g, ' ') : null;
}

function hasRootElement(html) {
  return /id=["']root["']/i.test(html);
}

function isWafBlockedResponse(response, bodyText) {
  if ([401, 403, 406, 409, 429, 503].includes(response.status)) {
    return true;
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return true;
  }

  if (!bodyText || bodyText.trim().length < 40) {
    return true;
  }

  const wafMarkers = [
    'attention required',
    'access denied',
    'request blocked',
    'cloudflare',
    'security check',
    'ddos protection',
  ];

  const lower = bodyText.toLowerCase();
  return wafMarkers.some((marker) => lower.includes(marker));
}

async function fetchWithDetails(url) {
  const response = await fetch(url, { redirect: 'follow' });
  const body = await response.text();
  return {
    requestedUrl: url,
    finalUrl: response.url,
    finalHost: new URL(response.url).host,
    status: response.status,
    title: parseTitle(body),
    hasRoot: hasRootElement(body),
    wafBlocked: isWafBlockedResponse(response, body),
  };
}

async function main() {
  const report = {
    strict_domain_equivalence: strictDomainEquivalence,
    redirect_ok: null,
    content_equivalent: null,
    failure_reason: null,
  };

  console.log('🔎 Checking local vercel.json...');
  const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  const hasWwwRedirect = Array.isArray(vercelConfig.redirects)
    && vercelConfig.redirects.some((r) => r?.destination?.includes('https://mmc-mms.com'));
  const hasApiRewrite = Array.isArray(vercelConfig.rewrites)
    && vercelConfig.rewrites.some((r) => r?.source === '/api/(.*)');

  assert(hasWwwRedirect, 'Missing www -> apex redirect in vercel.json');
  assert(hasApiRewrite, 'Missing /api rewrite in vercel.json');

  console.log('🔎 Checking Vercel project metadata...');
  const project = await api(`/v9/projects/${projectId}`);
  const projectDomains = (project.domains || []).map((d) => (typeof d === 'string' ? d : d?.name)).filter(Boolean);
  assert(projectDomains.includes('mmc-mms.com'), 'mmc-mms.com is not attached to project');
  assert(projectDomains.includes('www.mmc-mms.com'), 'www.mmc-mms.com is not attached to project');

  console.log('🔎 Checking Vercel environment variables (names only)...');
  const envs = await api(`/v10/projects/${projectId}/env`);
  const envNames = new Set((envs.envs || []).map((e) => e.key));

  const missing = requiredProjectEnvs.filter((name) => !envNames.has(name));
  assert(missing.length === 0, `Missing required env vars: ${missing.join(', ')}`);

  const supabaseUrlDefined = envNames.has('SUPABASE_URL') && envNames.has('VITE_SUPABASE_URL');
  assert(supabaseUrlDefined, 'SUPABASE_URL and/or VITE_SUPABASE_URL is missing');

  console.log('🔎 Checking public endpoints...');
  const wwwRes = await fetch(siteWww, { redirect: 'manual' });
  const primaryRes = await fetch(sitePrimary, { redirect: 'manual' });
  const wwwRedirectOk = wwwRes.status >= 300 && wwwRes.status < 400;

  report.redirect_ok = wwwRedirectOk;

  if (strictDomainEquivalence) {
    console.log('🔎 STRICT_DOMAIN_EQUIVALENCE=1: comparing final content between apex and www...');
    const [primaryDetails, wwwDetails] = await Promise.all([
      fetchWithDetails(sitePrimary),
      fetchWithDetails(siteWww),
    ]);

    const wafBlocked = primaryDetails.wafBlocked || wwwDetails.wafBlocked;
    if (wafBlocked) {
      report.content_equivalent = null;
      report.failure_reason = 'WAF/content-block detected; fallback to redirect check only';
      assert(wwwRedirectOk, `www domain did not return redirect (fallback path). status=${wwwRes.status}`);
    } else {
      const sameFinalHost = primaryDetails.finalHost === wwwDetails.finalHost;
      const sameStatus = primaryDetails.status === wwwDetails.status;
      const sameTitle = primaryDetails.title === wwwDetails.title;
      const sameRoot = primaryDetails.hasRoot === wwwDetails.hasRoot;

      report.content_equivalent = sameFinalHost && sameStatus && sameTitle && sameRoot;

      if (!report.content_equivalent) {
        const reasons = [];
        if (!sameFinalHost) reasons.push(`final_host mismatch (${primaryDetails.finalHost} vs ${wwwDetails.finalHost})`);
        if (!sameStatus) reasons.push(`status mismatch (${primaryDetails.status} vs ${wwwDetails.status})`);
        if (!sameTitle) reasons.push(`title mismatch (${primaryDetails.title ?? 'null'} vs ${wwwDetails.title ?? 'null'})`);
        if (!sameRoot) reasons.push(`root element mismatch (${primaryDetails.hasRoot} vs ${wwwDetails.hasRoot})`);
        report.failure_reason = reasons.join('; ');
      }

      assert(report.content_equivalent, `Strict domain equivalence failed: ${report.failure_reason}`);
    }
  } else {
    assert(wwwRedirectOk, `www domain did not return redirect. status=${wwwRes.status}`);
    report.content_equivalent = null;
  }

  assert(primaryRes.status < 500, `Primary domain is unhealthy. status=${primaryRes.status}`);

  const healthRes = await fetch(`${sitePrimary}/api/api-v1-status`, { redirect: 'manual' });
  assert(healthRes.status < 500, `API health endpoint failed with status=${healthRes.status}`);

  console.log('✅ Recovery verification passed.');
  console.log(`- Domains attached: ${projectDomains.join(', ')}`);
  console.log(`- Required env vars found: ${requiredProjectEnvs.join(', ')}`);
  console.log(`- Expected Supabase URL target: ${expectedSupabaseUrl}`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  const report = {
    strict_domain_equivalence: strictDomainEquivalence,
    redirect_ok: null,
    content_equivalent: null,
    failure_reason: err.message,
  };
  console.log(JSON.stringify(report, null, 2));
  console.error(`❌ Recovery verification failed: ${err.message}`);
  process.exit(1);
});

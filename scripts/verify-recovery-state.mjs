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

async function main() {
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
  assert(wwwRedirectOk, `www domain did not return redirect. status=${wwwRes.status}`);
  assert(primaryRes.status < 500, `Primary domain is unhealthy. status=${primaryRes.status}`);

  const healthRes = await fetch(`${sitePrimary}/api/api-v1-status`, { redirect: 'manual' });
  assert(healthRes.status < 500, `API health endpoint failed with status=${healthRes.status}`);

  console.log('✅ Recovery verification passed.');
  console.log(`- Domains attached: ${projectDomains.join(', ')}`);
  console.log(`- Required env vars found: ${requiredProjectEnvs.join(', ')}`);
  console.log(`- Expected Supabase URL target: ${expectedSupabaseUrl}`);
}

main().catch((err) => {
  console.error(`❌ Recovery verification failed: ${err.message}`);
  process.exit(1);
});

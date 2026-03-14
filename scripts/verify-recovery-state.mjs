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
 * - MIN_SUCCESS_RATE (default: 98)
 * - MAX_FAILURE_RATE (default: 2)
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
const minSuccessRate = Number.parseFloat(process.env.MIN_SUCCESS_RATE || '98');
const maxFailureRate = Number.parseFloat(process.env.MAX_FAILURE_RATE || '2');

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

function normalizeHtml(html) {
  return html.replace(/\s+/g, ' ').trim();
}

async function main() {
  console.log('🔎 Running weighted recovery verification checks...');
  const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  const project = await api(`/v9/projects/${projectId}`);
  const envs = await api(`/v10/projects/${projectId}/env`);

  const projectDomains = (project.domains || []).map((d) => (typeof d === 'string' ? d : d?.name)).filter(Boolean);
  const envNames = new Set((envs.envs || []).map((e) => e.key));

  const checks = [
    {
      name: 'project_settings',
      label: 'Project settings (vercel.json)',
      weight: 20,
      run: async () => {
        const hasWwwRedirect = Array.isArray(vercelConfig.redirects)
          && vercelConfig.redirects.some((r) => r?.destination?.includes('https://mmc-mms.com'));
        const hasApiRewrite = Array.isArray(vercelConfig.rewrites)
          && vercelConfig.rewrites.some((r) => r?.source === '/api/(.*)');

        assert(hasWwwRedirect, 'Missing www -> apex redirect in vercel.json');
        assert(hasApiRewrite, 'Missing /api rewrite in vercel.json');

        return {
          hasWwwRedirect,
          hasApiRewrite,
        };
      },
    },
    {
      name: 'domains',
      label: 'Domains attached to Vercel project',
      weight: 25,
      run: async () => {
        assert(projectDomains.includes('mmc-mms.com'), 'mmc-mms.com is not attached to project');
        assert(projectDomains.includes('www.mmc-mms.com'), 'www.mmc-mms.com is not attached to project');

        return {
          domains: projectDomains,
        };
      },
    },
    {
      name: 'env_vars',
      label: 'Required Vercel environment variables',
      weight: 25,
      run: async () => {
        const missing = requiredProjectEnvs.filter((name) => !envNames.has(name));
        assert(missing.length === 0, `Missing required env vars: ${missing.join(', ')}`);

        const supabaseUrlDefined = envNames.has('SUPABASE_URL') && envNames.has('VITE_SUPABASE_URL');
        assert(supabaseUrlDefined, 'SUPABASE_URL and/or VITE_SUPABASE_URL is missing');

        return {
          required: requiredProjectEnvs,
          presentCount: requiredProjectEnvs.length,
          expectedSupabaseUrl,
        };
      },
    },
    {
      name: 'api_health',
      label: 'Primary site and API health',
      weight: 20,
      run: async () => {
        const primaryRes = await fetch(sitePrimary, { redirect: 'manual' });
        assert(primaryRes.status < 500, `Primary domain is unhealthy. status=${primaryRes.status}`);

        const healthRes = await fetch(`${sitePrimary}/api/api-v1-status`, { redirect: 'manual' });
        assert(healthRes.status < 500, `API health endpoint failed with status=${healthRes.status}`);

        return {
          primaryStatus: primaryRes.status,
          healthStatus: healthRes.status,
        };
      },
    },
    {
      name: 'content_equivalence',
      label: 'www/apex content equivalence',
      weight: 10,
      run: async () => {
        const wwwRes = await fetch(siteWww, { redirect: 'manual' });
        const wwwRedirectOk = wwwRes.status >= 300 && wwwRes.status < 400;
        assert(wwwRedirectOk, `www domain did not return redirect. status=${wwwRes.status}`);

        const [wwwFollowRes, primaryFollowRes] = await Promise.all([
          fetch(siteWww, { redirect: 'follow' }),
          fetch(sitePrimary, { redirect: 'follow' }),
        ]);

        const wwwFinalHost = new URL(wwwFollowRes.url).host;
        const primaryHost = new URL(sitePrimary).host;
        assert(wwwFinalHost === primaryHost, `www final host mismatch. got=${wwwFinalHost}, expected=${primaryHost}`);

        const [wwwBody, primaryBody] = await Promise.all([wwwFollowRes.text(), primaryFollowRes.text()]);
        const areEqual = normalizeHtml(wwwBody) === normalizeHtml(primaryBody);
        assert(areEqual, 'Final HTML content differs between www and apex');

        return {
          wwwRedirectStatus: wwwRes.status,
          wwwFinalUrl: wwwFollowRes.url,
          primaryFinalUrl: primaryFollowRes.url,
          htmlEquivalent: areEqual,
        };
      },
    },
  ];

  const checkResults = [];
  let passedWeight = 0;
  const totalWeight = checks.reduce((sum, check) => sum + check.weight, 0);

  for (const check of checks) {
    try {
      const details = await check.run();
      passedWeight += check.weight;
      checkResults.push({
        name: check.name,
        label: check.label,
        weight: check.weight,
        passed: true,
        details,
      });
    } catch (error) {
      checkResults.push({
        name: check.name,
        label: check.label,
        weight: check.weight,
        passed: false,
        error: error.message,
      });
    }
  }

  const successRate = Number(((passedWeight / totalWeight) * 100).toFixed(2));
  const failureRate = Number((100 - successRate).toFixed(2));
  const gatePassed = successRate >= minSuccessRate && failureRate <= maxFailureRate;

  const report = {
    gate: {
      passed: gatePassed,
      min_success_rate: minSuccessRate,
      max_failure_rate: maxFailureRate,
      success_rate: successRate,
      failure_rate: failureRate,
      passed_weight: passedWeight,
      total_weight: totalWeight,
    },
    checks: checkResults,
  };

  console.log(JSON.stringify(report, null, 2));

  if (!gatePassed) {
    process.exit(1);
  }

  console.log('✅ Recovery verification gate passed.');
}

main().catch((err) => {
  console.error(`❌ Recovery verification failed: ${err.message}`);
  process.exit(1);
});

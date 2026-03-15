#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rujwuruuosffcxazymit.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE;

const requiredTables = [
  'unified_queue', 'clinics', 'patients', 'system_config', 'pins',
  'qa_runs', 'qa_findings', 'repair_runs', 'smart_errors_log', 'smart_fixes_log',
];

const endpoints = [
  'https://mmc-mms.com',
  'https://www.mmc-mms.com',
  'https://mmc-mms.com/admin',
  'https://www.mmc-mms.com/admin',
  'https://mmc-mms.com/api/v1/health',
];

const safeFetch = async (url, headers = {}) => {
  try {
    const response = await fetch(url, { headers, redirect: 'follow' });
    const text = await response.text();
    return { ok: true, status: response.status, url: response.url, text };
  } catch (error) {
    try {
      const args = ['-L', '--max-time', '25', '-sS'];
      Object.entries(headers).forEach(([key, value]) => {
        args.push('-H', `${key}: ${value}`);
      });
      args.push('-w', '\n__STATUS__:%{http_code}\n__URL__:%{url_effective}\n', url);
      const out = execFileSync('curl', args, { encoding: 'utf8' });
      const status = Number((out.match(/__STATUS__:(\d+)/) || [])[1] || 0);
      const finalUrl = (out.match(/__URL__:(.*)/) || [])[1]?.trim() || url;
      const text = out.replace(/\n__STATUS__:[\s\S]*$/, '');
      return { ok: status > 0, status, url: finalUrl, text };
    } catch {
      return { ok: false, status: 0, url, text: '', error: String(error) };
    }
  }
};

const results = { timestamp: new Date().toISOString(), domains: [], tables: [] };

for (const endpoint of endpoints) {
  const res = await safeFetch(endpoint);
  results.domains.push({
    endpoint,
    status: res.status,
    finalUrl: res.url,
    ok: res.ok && res.status < 500,
    bodyLength: res.text.length,
    hasHtml: res.text.includes('<html'),
    error: res.error || null,
  });
}

if (SUPABASE_KEY) {
  for (const table of requiredTables) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`;
    const res = await safeFetch(url, {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    });
    results.tables.push({
      table,
      status: res.status,
      ok: res.ok && res.status < 400,
      error: res.error || null,
      preview: res.text.slice(0, 160),
    });
  }
} else {
  results.tables.push({ table: '*', status: 0, ok: false, error: 'Missing SUPABASE key' });
}

const totalChecks = results.domains.length + results.tables.length;
const passedChecks = results.domains.filter((x) => x.ok).length + results.tables.filter((x) => x.ok).length;
const successRate = totalChecks ? Number(((passedChecks / totalChecks) * 100).toFixed(2)) : 0;
results.summary = {
  totalChecks,
  passedChecks,
  failedChecks: totalChecks - passedChecks,
  successRate,
  canDeploy: successRate >= 98,
};

console.log(JSON.stringify(results, null, 2));

#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const ORIGIN = process.env.AUDIT_ORIGIN || 'https://mmc-mms.com';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rujwuruuosffcxazymit.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY || '';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE || '';

const out = {
  generatedAt: new Date().toISOString(),
  domainChecks: [],
  supabaseReadChecks: [],
  supabaseWriteRollbackChecks: [],
  notes: [],
};

const curlRequest = ({ url, method = 'GET', headers = {}, body = null }) => {
  const args = ['-L', '--max-time', '30', '-sS', '-X', method];
  Object.entries(headers).forEach(([k, v]) => args.push('-H', `${k}: ${v}`));
  if (body !== null) args.push('--data-raw', typeof body === 'string' ? body : JSON.stringify(body));
  args.push('-w', '\n__STATUS__:%{http_code}\n__URL__:%{url_effective}\n', url);
  try {
    const raw = execFileSync('curl', args, { encoding: 'utf8' });
    const status = Number((raw.match(/__STATUS__:(\d+)/) || [])[1] || 0);
    const finalUrl = (raw.match(/__URL__:(.*)/) || [])[1]?.trim() || url;
    const text = raw.replace(/\n__STATUS__:[\s\S]*$/, '');
    return { ok: status > 0, status, finalUrl, text, error: null };
  } catch (error) {
    return { ok: false, status: 0, finalUrl: url, text: '', error: String(error) };
  }
};

const authHeaders = (key) => ({
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
});

for (const url of [`${ORIGIN}`, `${ORIGIN}/admin`, 'https://www.mmc-mms.com', 'https://www.mmc-mms.com/admin']) {
  const r = curlRequest({ url });
  out.domainChecks.push({
    url,
    status: r.status,
    finalUrl: r.finalUrl,
    ok: r.ok && r.status < 500,
    bodyLength: r.text.length,
    hasHtml: r.text.includes('<html'),
    error: r.error,
  });
}

const tables = ['unified_queue', 'clinics', 'patients', 'system_config', 'pins', 'qa_runs', 'qa_findings', 'repair_runs', 'smart_errors_log', 'smart_fixes_log'];
if (!ANON) {
  out.notes.push('SUPABASE_ANON_KEY missing: read checks skipped');
} else {
  for (const table of tables) {
    const r = curlRequest({ url: `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`, headers: authHeaders(ANON) });
    out.supabaseReadChecks.push({ table, status: r.status, ok: r.ok && r.status < 400, preview: r.text.slice(0, 160), error: r.error });
  }
}

if (!SERVICE) {
  out.notes.push('SUPABASE_SERVICE_ROLE missing: write rollback checks skipped');
} else {
  const userPayload = { username: `verify_user_${Date.now()}`, password_hash: 'Verify@123', full_name: 'Verification User', role: 'staff', is_active: true };
  const userIns = curlRequest({
    url: `${SUPABASE_URL}/rest/v1/users`, method: 'POST',
    headers: { ...authHeaders(SERVICE), Prefer: 'return=representation' }, body: userPayload,
  });
  let userId = null;
  try { userId = JSON.parse(userIns.text)?.[0]?.id || null; } catch {}
  let userDelStatus = 0;
  if (userId) {
    userDelStatus = curlRequest({ url: `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(userId)}`, method: 'DELETE', headers: authHeaders(SERVICE) }).status;
  }
  out.supabaseWriteRollbackChecks.push({ check: 'users_insert_delete', insertStatus: userIns.status, deleteStatus: userDelStatus, ok: userIns.status >= 200 && userIns.status < 300 && userDelStatus >= 200 && userDelStatus < 300 });

  const pinPayload = { clinic_code: 'DNT', pin: String(Math.floor(1000 + Math.random() * 8999)), expires_at: new Date(Date.now() + 86400000).toISOString(), is_active: true, used_count: 0, max_uses: 1 };
  const pinIns = curlRequest({ url: `${SUPABASE_URL}/rest/v1/pins`, method: 'POST', headers: { ...authHeaders(SERVICE), Prefer: 'return=representation' }, body: pinPayload });
  let pinId = null;
  try { pinId = JSON.parse(pinIns.text)?.[0]?.id || null; } catch {}
  let pinDelStatus = 0;
  if (pinId) {
    pinDelStatus = curlRequest({ url: `${SUPABASE_URL}/rest/v1/pins?id=eq.${encodeURIComponent(pinId)}`, method: 'DELETE', headers: authHeaders(SERVICE) }).status;
  }
  out.supabaseWriteRollbackChecks.push({ check: 'pins_insert_delete', insertStatus: pinIns.status, deleteStatus: pinDelStatus, ok: pinIns.status >= 200 && pinIns.status < 300 && pinDelStatus >= 200 && pinDelStatus < 300 });

  const qRead = curlRequest({ url: `${SUPABASE_URL}/rest/v1/unified_queue?select=id,status&limit=1`, headers: authHeaders(SERVICE) });
  let queuePatchStatus = 0;
  let queueOk = false;
  try {
    const first = JSON.parse(qRead.text)?.[0];
    if (first?.id && first?.status) {
      queuePatchStatus = curlRequest({
        url: `${SUPABASE_URL}/rest/v1/unified_queue?id=eq.${encodeURIComponent(first.id)}`,
        method: 'PATCH', headers: authHeaders(SERVICE), body: { status: first.status },
      }).status;
      queueOk = queuePatchStatus >= 200 && queuePatchStatus < 300;
    }
  } catch {}
  out.supabaseWriteRollbackChecks.push({ check: 'unified_queue_noop_patch', patchStatus: queuePatchStatus, ok: queueOk });
}

const all = [...out.domainChecks, ...out.supabaseReadChecks, ...out.supabaseWriteRollbackChecks];
const passed = all.filter((x) => x.ok).length;
out.summary = {
  totalChecks: all.length,
  passedChecks: passed,
  failedChecks: all.length - passed,
  successRate: Number(((passed / Math.max(1, all.length)) * 100).toFixed(2)),
  canDeploy: Number(((passed / Math.max(1, all.length)) * 100).toFixed(2)) >= 98,
};

console.log(JSON.stringify(out, null, 2));

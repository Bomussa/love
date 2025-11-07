import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const JSON = (res: VercelResponse, code: number, body: unknown) =>
  res.status(code).setHeader('content-type','application/json; charset=utf-8').send(JSON.stringify(body));

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // رول-باك فوري
  if (process.env.PROXY_FORCE_DISABLE === '1') return JSON(res, 503, { error: 'proxy_disabled' });

  // مسارات مسموحة فقط (whitelist)
  const allowed = (process.env.ALLOWED_API_PATHS || 'core,queue,pin,login,clinics,routes')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

  const parts = ([] as string[]).concat((req.query.path ?? []) as string[]);
  let p = parts.join('/').replace(/\/+/g,'/').replace(/^\/|\/$/g,'').toLowerCase();
  if (!p) p = 'core';
  const root = p.split('/')[0];
  if (!allowed.includes(root)) return JSON(res, 404, { error: 'blocked_by_whitelist', path: p, allowed });

  // بيئة Runtime الصحيحة
  const SUPABASE_URL  = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const ANON          = process.env.SUPABASE_ANON_KEY || '';
  if (!SUPABASE_URL || !ANON) return JSON(res, 500, { error: 'missing_runtime_env', need: ['SUPABASE_URL','SUPABASE_ANON_KEY'] });

  // Aliases ثابتة إن لزم
  const aliases: Record<string,string> = { signin:'login', queues:'queue' };
  const orig = p; if (aliases[root]) p = p.replace(root, aliases[root]);

  // الوجهة الوحيدة المسموح بها (Supabase Edge Functions)
  const url = new URL(`${SUPABASE_URL}/functions/v1/functions-proxy`);
  url.searchParams.set('path', p);

  const headers: Record<string,string> = {
    'apikey': ANON,
    'authorization': `Bearer ${ANON}`,
  };
  if (req.headers['content-type']) headers['content-type'] = String(req.headers['content-type']);

  const doFetch = async () => {
    const t0 = Date.now();
    try {
      const r = await fetch(url.toString(), {
        method: req.method,
        headers,
        body: (req.method === 'GET' || req.method === 'HEAD') ? undefined : (req as any).body,
        redirect: 'manual',
      } as RequestInit);
      return { r, dt: Date.now()-t0, err: null as null | string };
    } catch (e:any) {
      return { r: null as any, dt: Date.now()-t0, err: String(e) };
    }
  };

  // محاولة واحدة + Retry 200ms للأخطاء العابرة/5xx
  let attempts = 0;
  let res1 = await doFetch(); attempts++;
  if ((!res1.r || res1.r.status >= 500) && attempts === 1) {
    await new Promise(r => setTimeout(r, 200));
    res1 = await doFetch(); attempts++;
  }

  // تسجيل موحّد اختياري (server-only)
  try {
    const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (SVC) {
      const admin = createClient(SUPABASE_URL, SVC);
      await admin.from('api_monitor.logs').insert([{
        path: p,
        rewritten_from: orig === p ? null : orig,
        status: res1.r ? res1.r.status : 0,
        duration_ms: res1.dt,
        attempts_count: attempts,
        upstream_error: res1.err,
        ts: new Date().toISOString(),
        source: 'vercel_proxy',
      }]).select().single();
    }
  } catch { /* لا تُفشل الطلب بسبب التسجيل */ }

  if (!res1.r) return JSON(res, 502, { error:'upstream_unreachable', duration_ms: res1.dt });

  const buf = Buffer.from(await res1.r.arrayBuffer());
  const origin = String(process.env.FRONTEND_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');

  res.status(res1.r.status);
  for (const [k, v] of res1.r.headers.entries())
    if (k.toLowerCase() !== 'content-length') res.setHeader(k, v);
  return res.send(buf);
}

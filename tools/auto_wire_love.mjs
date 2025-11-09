/**
 * Idempotent patcher:
 *  - Ensure vercel.json redirects /api -> /api/v1
 *  - Ensure server-only Supabase admin client
 *  - Add minimal /api/v1/health endpoint (App Router or Pages Router)
 *  - No UI changes
 */
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const ensureDir = (p) => fs.mkdirSync(p, { recursive: true });
const readJSON = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const writeJSON = (f, o) => fs.writeFileSync(f, JSON.stringify(o, null, 2) + '\n', 'utf8');

function upsertVercelJson() {
  const file = path.join(root, 'vercel.json');
  const desiredRedirects = [
    { source: '/api', destination: '/api/v1', permanent: false },
    { source: '/api/(.*)', destination: '/api/v1/$1', permanent: false },
  ];
  const desiredRewrites = [{ source: '/api/v1/(.*)', destination: '/api/v1/$1' }];
  const cur = readJSON(file) || {};
  cur.version = 2;
  const red = Array.isArray(cur.redirects) ? cur.redirects : [];
  const rew = Array.isArray(cur.rewrites) ? cur.rewrites : [];
  const has = (arr, r) => arr.some(x => x.source === r.source && x.destination === r.destination);
  desiredRedirects.forEach(r => { if (!has(red, r)) red.push(r); });
  desiredRewrites.forEach(r => { if (!has(rew, r)) rew.push(r); });
  cur.redirects = red; cur.rewrites = rew;
  writeJSON(file, cur);
  console.log('✓ vercel.json updated/created');
}

function ensureSupabaseAdmin() {
  const file = path.join(root, 'src', 'lib', 'supabaseAdmin.ts');
  if (fs.existsSync(file)) return console.log('• supabaseAdmin.ts exists — skipping');
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `import 'server-only';
import { createClient } from '@supabase/supabase-js';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
`, 'utf8');
  console.log('✓ src/lib/supabaseAdmin.ts created');
}

function addHealthEndpoint() {
  const appDir = path.join(root, 'src', 'app');
  if (fs.existsSync(appDir)) {
    const f = path.join(root, 'src', 'app', 'api', 'v1', 'health', 'route.ts');
    ensureDir(path.dirname(f));
    if (!fs.existsSync(f)) fs.writeFileSync(f, `import { NextResponse } from 'next/server';
export async function GET(){ return NextResponse.json({ ok: true, ts: Date.now() }, { status: 200 }); }`, 'utf8');
    console.log('✓ App Router health route ready');
    return;
  }
  const f = path.join(root, 'pages', 'api', 'v1', 'health.ts');
  ensureDir(path.dirname(f));
  if (!fs.existsSync(f)) fs.writeFileSync(f, `import type { NextApiRequest, NextApiResponse } from 'next';
export default function handler(_req:NextApiRequest,res:NextApiResponse){ res.status(200).json({ ok:true, ts:Date.now() }); }`, 'utf8');
  console.log('✓ Pages API health route ready');
}

function main(){ upsertVercelJson(); ensureSupabaseAdmin(); addHealthEndpoint(); console.log('All patches applied.'); }
main();

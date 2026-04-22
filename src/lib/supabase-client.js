import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error('Missing Supabase env vars');
}

export const supabase = createClient(url, key);

let status = 'connected';
let attempts = 0;
let timer = null;

async function retry(fn, max = 5) {
  for (let i = 0; i < max; i++) {
    try {
      const r = await fn();
      status = 'connected';
      attempts = 0;
      return r;
    } catch (e) {
      attempts = i + 1;
      status = i === max - 1 ? 'disconnected' : 'reconnecting';
      if (i === max - 1) throw e;
      await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }
}

export async function safeQuery(table, fn) {
  return retry(async () => {
    const res = await fn(supabase.from(table));
    if (res.error) throw res.error;
    return res;
  });
}

export async function testConnection() {
  try {
    const { error } = await supabase.from('clinics').select('id').limit(1);
    if (error) throw error;
    status = 'connected';
    return true;
  } catch {
    status = 'disconnected';
    return false;
  }
}

export function getConnectionStatus() {
  return { status, attempts };
}

export function startMonitor(ms = 30000) {
  if (timer) return;
  timer = setInterval(async () => {
    if (!(await testConnection())) await retry(testConnection);
  }, ms);
}

export function stopMonitor() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

export default supabase;

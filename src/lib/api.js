export function getApiBase() {
  const env = (typeof import.meta !== 'undefined' && (import.meta as any).env) ? (import.meta as any).env : {};
  return env.VITE_API_BASE || (typeof window !== 'undefined' && (window as any).API_BASE) || '/api/v1';
}

export async function apiFetch(path, opts = {}) {
  const base = getApiBase().replace(//$/, '');
  const url = path.startsWith('/') ? `${base}${path}` : `${base}/${path}`;
  const o = { method: 'GET', headers: { 'Accept': 'application/json' }, ...opts };
  if (o.body && typeof o.body === 'object' && !(o.body instanceof FormData)) {
    o.headers['Content-Type'] = o.headers['Content-Type'] || 'application/json';
    o.body = JSON.stringify(o.body);
  }
  const res = await fetch(url, o);
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) { const txt = await res.text().catch(()=>''); throw new Error(`API_ERROR ${res.status}: ${txt.slice(0,180)}`); }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

// src/lib/api.ts
const BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'https://mmc-mms.com/api/v1';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export async function api<T=unknown>(path: string, opts: {method?: Method; body?: any; headers?: Record<string,string>} = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
    credentials: 'omit',
    mode: 'cors'
  });
  if (!res.ok) {
    const text = await res.text().catch(()=> '');
    throw new Error(`API ${res.status} ${res.statusText} → ${url}\n${text}`);
  }
  const ct = res.headers.get('content-type') || '';
  return (ct.includes('application/json') ? await res.json() : (await res.text())) as T;
}

// أمثلة استخدام:
export const healthStatus = () => api('/health/status');
export const loadPIN       = () => api('/pin/today');
export const loadQueue     = () => api('/queue/summary');

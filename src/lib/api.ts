// src/lib/api.ts
export type Json = Record<string, any>;
const isFilePath = (p: string) => /^/(api|data|locales)//.test(p);
export async function api<T = Json>(
  path: string,
  opts: RequestInit & { json?: Json } = {}
): Promise<{ ok: boolean; status: number; data: T }> {
  const url = isFilePath(path) ? path : `/api${path.startsWith('/') ? '' : '/'}${path}`;
  const init: RequestInit = {
    method: opts.method || 'GET',
    credentials: 'include',
    headers: {
      ...(opts.json ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.headers || {})
    },
    body: opts.json ? JSON.stringify(opts.json) : (opts as any).body
  };
  const res = await fetch(url, init);
  let data: any = null;
  try { data = await res.json(); } catch {}
  const logicalOk =
    res.ok && (data?.ok === true || data?.success === true || data === true || data?.status === 'ok');
  return { ok: logicalOk, status: res.status, data };
}

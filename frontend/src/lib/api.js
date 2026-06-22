function normalizeApiBase(base) {
  const trimmed = String(base || '').trim().replace(/\/$/, '');
  if (!trimmed) return '/api/v1';
  if (trimmed.endsWith('/api/v1') || trimmed.endsWith('/api')) return trimmed;
  if (trimmed.startsWith('http')) return `${trimmed}/api/v1`;
  return trimmed;
}

const API = normalizeApiBase(
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.API_ORIGIN
);

export async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  return res.json();
}

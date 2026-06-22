const API = (import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '');

export async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  return res.json();
}

const API = import.meta.env.VITE_API_URL || 'https://love-api-bomussa.vercel.app/api/v1';

export async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  return res.json();
}

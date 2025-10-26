export function getApiBase() {
  const env = (import.meta?.env?.VITE_API_BASE || window.__API_BASE__ || '').toString().trim();
  const origin = env || (typeof window !== 'undefined' ? window.location.origin : '');
  return origin.replace(/\/$/, '') + '/api/v1';
}
// Centralized API base resolution. No UI changes.
export function getApiBase() {
  const envBase = (import.meta?.env?.VITE_API_BASE || '').toString().trim();
  if (envBase) return envBase.replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    if (import.meta?.env?.DEV) return 'http://localhost:3000';
    return window.location.origin.replace(/\/$/, '');
  }
  return '';
}

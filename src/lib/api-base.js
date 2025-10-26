// Centralized API Base Resolution Helper
// Provides unified API base URL with version path included

/**
 * Get the API base URL with version path
 * @returns {string} The complete API base (e.g., "http://localhost:3000/api/v1" or "https://app.vercel.app/api/v1")
 */
export function getApiBase() {
  // Check for VITE_API_BASE or window.__API_BASE__ (for runtime configuration)
  const env = (import.meta?.env?.VITE_API_BASE || window?.__API_BASE__ || '').toString().trim();
  
  // Use env if set, otherwise use window.location.origin (for production)
  const origin = env || (typeof window !== 'undefined' ? window.location.origin : '');
  
  // Normalize: remove trailing slash and append /api/v1
  return origin.replace(/\/$/, '') + '/api/v1';
}

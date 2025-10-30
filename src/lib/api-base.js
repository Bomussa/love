/**
 * Centralized API base for Supabase Edge Functions and optional legacy Vercel fallback.
 * Ensures NO duplicate '/api/v1' in Supabase URLs.
 */

const env = (k) => (typeof process !== 'undefined' && process.env[k]) || (typeof import !== 'undefined' && typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[k]) || ''

const SUPABASE_URL = (env('VITE_SUPABASE_URL') || '').replace(//+$/,'')

// ✅ Correct base for Supabase Functions (no /api/v1)
export const SUPABASE_FN_BASE = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : ''

// Helper to build function URL safely
export const fnUrl = (name) => {
  if (!SUPABASE_FN_BASE) throw new Error('Supabase URL is missing: set VITE_SUPABASE_URL')
  const n = String(name).replace(/^/+|/+$/g,'')
  return `${SUPABASE_FN_BASE}/${n}`
}

// Optional: legacy Vercel base (disabled by default)
export const LEGACY_VERCEL_BASE = '' // e.g., '/api/v1' if ever used again

export default { SUPABASE_URL, SUPABASE_FN_BASE, fnUrl, LEGACY_VERCEL_BASE }

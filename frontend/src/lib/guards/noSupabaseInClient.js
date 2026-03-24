export function assertNoSupabaseInClient() {
  if (typeof window !== 'undefined' && window.__SUPABASE_USED__) {
    throw new Error('Direct Supabase usage in client is forbidden - Use API Client instead');
  }
}

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || 'https://rujwuruuosffcxazymit.supabase.co';
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

function createFallbackClient() {
  const noopQuery = {
    select: () => noopQuery,
    eq: () => noopQuery,
    gt: () => noopQuery,
    order: async () => ({ data: [], error: null }),
    update: () => ({ eq: async () => ({ data: null, error: null }) }),
  };
  return {
    from: () => noopQuery,
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {},
  };
}

export const supabase = supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : createFallbackClient();

export default supabase;

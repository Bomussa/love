import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://rujwuruuosffcxazymit.supabase.co';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

if (!supabaseServiceKey) {
  console.error('⚠️ Missing SUPABASE_SERVICE_ROLE_KEY - API will not function properly');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Helper function to verify connection
export async function verifySupabaseConnection() {
  try {
    const { data, error } = await supabase.from('clinics').select('id').limit(1);
    if (error) throw error;
    return { connected: true, message: 'Supabase connection verified' };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

// Helper function for safe RPC calls
export async function callRPC(functionName: string, params: Record<string, any>) {
  try {
    const { data, error } = await supabase.rpc(functionName, params);
    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

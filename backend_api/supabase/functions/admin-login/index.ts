import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { scryptSync, timingSafeEqual } from 'node:crypto';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function verifyPasswordHash(password: string, passwordHash?: string | null) {
  if (!passwordHash || !passwordHash.includes(':')) return false;
  const [salt, storedHash] = passwordHash.split(':');
  if (!salt || !storedHash) return false;

  const derived = scryptSync(password, salt, 64).toString('hex');
  if (derived.length !== storedHash.length) return false;

  return timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(storedHash, 'hex'));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return new Response(JSON.stringify({ success: false, error: 'Username and password required' }), {
        status: 400,
        headers: { 'content-type': 'application/json', ...corsHeaders }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ success: false, error: 'Server is not configured' }), {
        status: 503,
        headers: { 'content-type': 'application/json', ...corsHeaders }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('id, username, role, password_hash')
      .eq('username', username)
      .single();

    if (adminError || !admin || !verifyPasswordHash(password, admin.password_hash)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'content-type': 'application/json', ...corsHeaders }
      });
    }

    const token = `admin_${admin.id}_${Date.now()}`;

    return new Response(JSON.stringify({
      success: true,
      token,
      user: {
        id: admin.id,
        username: admin.username,
        role: admin.role || 'admin'
      }
    }), {
      headers: { 'content-type': 'application/json', ...corsHeaders }
    });
  } catch (err: any) {
    console.error('Admin login error:', err);
    return new Response(JSON.stringify({ success: false, error: err?.message || 'Internal server error' }), {
      status: 500,
      headers: { 'content-type': 'application/json', ...corsHeaders }
    });
  }
});

const { createClient } = require('@supabase/supabase-js');

function getEnv() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY');
  }

  return { url, serviceKey };
}

function getDb() {
  const { url, serviceKey } = getEnv();
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

module.exports = { getDb };

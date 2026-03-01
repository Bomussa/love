/**
 * Health Check Endpoint
 * GET /api/v1/health
 */

import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }});
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    let dbStatus = 'unknown';
    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { error } = await supabase.from('patients').select('count', { count: 'exact', head: true });
        dbStatus = error ? 'error' : 'connected';
      } catch {
        dbStatus = 'error';
      }
    }

    return jsonResponse({
      success: true,
      status: 'healthy',
      mode: 'online',
      backend: 'up',
      database: dbStatus,
      timestamp: new Date().toISOString(),
      env: {
        supabase: !!(supabaseUrl && supabaseKey),
        postgres: !!process.env.POSTGRES_URL
      }
    });
  } catch (error: any) {
    return jsonResponse({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
}

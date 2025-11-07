/**
 * Health Status Endpoint - Vercel Serverless Function
 * GET /api/v1/health/status
 */

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check Supabase connection
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    let supabaseConnected = false;
    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data, error } = await supabase.from('admins').select('count').limit(1);
        supabaseConnected = !error;
      } catch (e) {
        supabaseConnected = false;
      }
    }

    // Check environment variables
    const envOk = {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
      supabase_connected: supabaseConnected
    };

    const healthStatus = {
      status: 'ok',
      platform: 'vercel',
      functions_enabled: true,
      environment: envOk,
      timestamp: new Date().toISOString()
    };

    return res.status(200).json(healthStatus);

  } catch (error) {
    console.error('Error in api/v1/health/status.js:', error);
    return res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

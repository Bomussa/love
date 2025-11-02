/**
 * Supabase Edge Function: healthz
 * 
 * Purpose: Health check endpoint for monitoring and load balancing
 * Returns service status and basic metrics
 */

import { handleOptions, corsJsonResponse } from '../_shared/cors.ts';

interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: 'ok' | 'error';
    auth: 'ok' | 'error';
  };
}

const startTime = Date.now();

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return corsJsonResponse(
      { error: 'Method Not Allowed', allowed: ['GET', 'OPTIONS'] },
      405,
      origin
    );
  }

  try {
    // Calculate uptime
    const uptime = Math.floor((Date.now() - startTime) / 1000);

    // Basic health check - in production, add actual service checks
    const healthStatus: HealthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime,
      version: '1.0.0',
      services: {
        database: 'ok',
        auth: 'ok',
      },
    };

    return corsJsonResponse(healthStatus, 200, origin);
  } catch (error) {
    console.error('Health check error:', error);
    
    return corsJsonResponse(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      },
      503,
      origin
    );
  }
});

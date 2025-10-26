/**
 * Health Check Endpoint
 * GET /api/v1/status
 */

import { createEnv } from '../lib/storage.js';
import { CORS_HEADERS } from '../lib/helpers.js';

export default async function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    const env = createEnv();
    
    return res.status(200).json({
      success: true,
      status: 'healthy',
      mode: 'online',
      backend: 'up',
      platform: 'vercel',
      timestamp: new Date().toISOString(),
      kv: {
        admin: !!env.KV_ADMIN,
        pins: !!env.KV_PINS,
        queues: !!env.KV_QUEUES,
        events: !!env.KV_EVENTS,
        locks: !!env.KV_LOCKS,
        cache: !!env.KV_CACHE
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}


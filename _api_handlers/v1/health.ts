/**
 * Health Check Endpoint
 * 
 * Purpose: Simple endpoint to verify API is working
 * Returns: 200 OK with system status
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Return success response
  return res.status(200).json({
    success: true,
    status: 'healthy',
    message: 'MMC-MMS API is operational',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'production',
    features: {
      database: 'Supabase',
      authentication: 'Active',
      queue_system: 'Active',
      notifications: 'Active',
      reporting: 'Active'
    }
  });
}

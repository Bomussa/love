/**
 * Admin Status Endpoint
 * GET /api/v1/admin/status
 */

import { createEnv } from '../../lib/storage.js';
import { getValidClinics } from '../../lib/helpers.js';

export default async function handler(req, res) {
  try {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
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
    const today = new Date().toISOString().split('T')[0];
    const validClinics = getValidClinics();
    const clinicsData = {};

    // Get data for all clinics
    for (const clinic of validClinics) {
      // Get PIN
      const pinKey = `pin:${clinic}:${today}`;
      const pinData = await env.KV_PINS.get(pinKey, { type: 'json' });

      // Get queue
      const queueKey = `queue:list:${clinic}`;
      const queueData = await env.KV_QUEUES.get(queueKey, { type: 'json' }) || [];

      // Get status
      const statusKey = `queue:status:${clinic}`;
      const status = await env.KV_QUEUES.get(statusKey, { type: 'json' }) || {
        current: null,
        served: []
      };

      clinicsData[clinic] = {
        pin: pinData?.pin || null,
        current: status.current,
        waiting: queueData.length,
        served: status.served?.length || 0,
        queue: queueData
      };
    }

    return res.status(200).json({
      success: true,
      date: today,
      clinics: clinicsData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}


  } catch (error) {
    console.error('Error in api/v1/admin/status.js:', error);
    return res.status(500).json({ success: false, error: error.message });
  }

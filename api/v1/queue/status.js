/**
 * Queue Status Endpoint
 * GET /api/v1/queue/status?clinic=lab
 */

import { createEnv } from '../../lib/storage.js';

export default async function handler(req, res) {
  try {
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
    const { clinic } = req.query;
    
    if (!clinic) {
      return res.status(400).json({
        success: false,
        error: 'Missing clinic parameter'
      });
    }

    const env = createEnv();
    const queueKey = `queue:list:${clinic}`;
    const queueData = await env.KV_QUEUES.get(queueKey, { type: 'json' }) || [];

    const statusKey = `queue:status:${clinic}`;
    const status = await env.KV_QUEUES.get(statusKey, { type: 'json' }) || {
      current: null,
      served: []
    };

    return res.status(200).json({
      success: true,
      clinic: clinic,
      list: queueData,
      current_serving: status.current,
      total_waiting: queueData.length,
      current: status.current,
      waiting: queueData.length
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}


  } catch (error) {
    console.error('Error in api/v1/queue/status.js:', error);
    return res.status(500).json({ success: false, error: error.message });
  }

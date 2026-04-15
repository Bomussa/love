import { createEnv } from '../../lib/storage.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { patientId } = req.query;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        error: 'Missing patientId parameter'
      });
    }

    const env = createEnv();
    const route = await env.KV_QUEUES.get(`route:${patientId}`, { type: 'json' });

    if (!route) {
      return res.status(404).json({
        success: false,
        error: 'Route not found'
      });
    }

    return res.status(200).json({
      success: true,
      route
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}


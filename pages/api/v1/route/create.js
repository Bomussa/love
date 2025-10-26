import { createEnv } from '../lib/storage.js';
import { createOptimizedRoute } from '../lib/routing.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { patientId, examType, gender } = req.body;

    if (!patientId || !examType || !gender) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const route = await createOptimizedRoute(examType, gender);
    route.patientId = patientId;
    route.createdAt = new Date().toISOString();

    const env = createEnv();
    await env.KV_QUEUES.put(
      `route:${patientId}`,
      JSON.stringify(route),
      { expirationTtl: 86400 }
    );

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


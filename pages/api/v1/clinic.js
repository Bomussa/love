import { createEnv } from '../lib/storage.js';
import { updateClinicStatus, getNextClinic } from '../lib/routing.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { patientId, clinicId } = req.body;

    if (!patientId || !clinicId) {
      return res.status(400).json({
        success: false,
        error: 'Missing patientId or clinicId'
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

    const updatedRoute = updateClinicStatus(route, clinicId, 'completed');
    
    await env.KV_QUEUES.put(
      `route:${patientId}`,
      JSON.stringify(updatedRoute),
      { expirationTtl: 86400 }
    );

    const nextClinic = getNextClinic(updatedRoute, clinicId);

    return res.status(200).json({
      success: true,
      message: 'Clinic exit successful',
      route: updatedRoute,
      nextClinic
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}


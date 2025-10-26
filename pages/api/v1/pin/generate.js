import { createEnv } from '../../lib/storage.js';
import { generatePIN, validateClinic } from '../../lib/helpers.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { clinic } = req.body;

    if (!clinic) {
      return res.status(400).json({
        success: false,
        error: 'Missing clinic'
      });
    }

    if (!validateClinic(clinic)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid clinic'
      });
    }

    const env = createEnv();
    const today = new Date().toISOString().split('T')[0];
    const pin = generatePIN();
    const pinKey = `pin:${clinic}:${today}`;
    
    const pinData = {
      clinic,
      pin,
      date: today,
      generatedAt: new Date().toISOString()
    };

    await env.KV_PINS.put(pinKey, JSON.stringify(pinData), {
      expirationTtl: 86400
    });

    return res.status(200).json({
      success: true,
      clinic,
      pin,
      generatedAt: pinData.generatedAt
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}


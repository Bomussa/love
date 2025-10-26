/**
 * PIN Status Endpoint
 * GET /api/v1/pin/status
 */

import { createEnv } from '../lib/storage.js';
import { getValidClinics, generatePIN } from '../lib/helpers.js';

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
    const today = new Date().toISOString().split('T')[0];
    const validClinics = getValidClinics();
    const pins = {};

    // Get or generate PINs for all clinics
    for (const clinic of validClinics) {
      const pinKey = `pin:${clinic}:${today}`;
      let pinData = await env.KV_PINS.get(pinKey, { type: 'json' });

      if (!pinData) {
        // Generate new PIN
        const newPin = generatePIN();
        pinData = {
          clinic,
          pin: newPin,
          date: today,
          generatedAt: new Date().toISOString()
        };

        await env.KV_PINS.put(pinKey, JSON.stringify(pinData), {
          expirationTtl: 86400 // 24 hours
        });
      }

      pins[clinic] = pinData.pin;
    }

    return res.status(200).json({
      success: true,
      pins,
      date: today
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}


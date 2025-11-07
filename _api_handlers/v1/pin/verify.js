/**
 * PIN Verify Endpoint
 * POST /api/v1/pin/verify
 */

import { createEnv } from '../../lib/storage.js';
import { validateClinic } from '../../lib/helpers.js';

export default async function handler(req, res) {
  try {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    const { clinic, pin, clinicId } = req.body;
    const clinicName = clinic || clinicId;

    if (!clinicName || !pin) {
      return res.status(400).json({
        success: false,
        error: 'Missing clinic or pin'
      });
    }

    if (!validateClinic(clinicName)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid clinic'
      });
    }

    const env = createEnv();
    const today = new Date().toISOString().split('T')[0];
    const pinKey = `pin:${clinicName}:${today}`;
    
    const pinData = await env.KV_PINS.get(pinKey, { type: 'json' });

    if (!pinData) {
      return res.status(404).json({
        success: false,
        error: 'PIN not found for this clinic today'
      });
    }

    const isValid = pinData.pin === String(pin);

    if (isValid) {
      return res.status(200).json({
        success: true,
        valid: true,
        clinic: clinicName,
        message: 'PIN is valid'
      });
    } else {
      return res.status(401).json({
        success: false,
        valid: false,
        error: 'Invalid PIN'
      });
    }

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}


  } catch (error) {
    console.error('Error in api/v1/pin/verify.js:', error);
    return res.status(500).json({ success: false, error: error.message });
  }

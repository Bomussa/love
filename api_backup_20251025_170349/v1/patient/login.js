/**
 * Patient Login Endpoint
 * POST /api/v1/patient/login
 */

import { createEnv } from '../../lib/storage.js';
import { validatePatientId, validateGender } from '../../lib/helpers.js';

export default async function handler(req, res) {
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
    const { patientId, gender } = req.body;

    // Validate
    if (!patientId || !gender) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: patientId and gender'
      });
    }

    if (!validatePatientId(patientId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid patientId format. Must be 2-12 digits.'
      });
    }

    if (!validateGender(gender)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid gender. Must be "male" or "female".'
      });
    }

    // Create session
    const env = createEnv();
    const sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const patientData = {
      id: sessionId,
      patientId: patientId,
      gender: gender,
      loginTime: new Date().toISOString(),
      status: 'logged_in'
    };

    // Store in KV
    await env.KV_CACHE.put(
      `patient:${sessionId}`,
      JSON.stringify(patientData),
      { expirationTtl: 86400 }
    );

    return res.status(200).json({
      success: true,
      data: patientData,
      message: 'Login successful'
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}


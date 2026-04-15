/**
 * Patient API - Unified Endpoint
 * Handles: /api/v1/patient/login
 */

import { createEnv } from '../api/lib/storage.js';
import { validatePatientId, validateGender } from '../api/lib/helpers.js';

export default async function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Extract action from URL
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const action = pathParts[pathParts.length - 1]; // last part: 'login'

    // Route to appropriate handler
    switch (action) {
      case 'login':
        return await handleLogin(req, res);
      default:
        return res.status(404).json({
          success: false,
          error: 'Endpoint not found'
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

// Handler: POST /api/v1/patient/login
async function handleLogin(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

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
}


/**
 * PIN API - Unified Endpoint
 * Handles: /api/v1/pin/generate, /status, /verify
 */

import { createEnv } from '../lib/storage.js';
import { generatePIN, validateClinic, getValidClinics } from '../lib/helpers.js';

export default async function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const action = pathParts[pathParts.length - 1];

    switch (action) {
      case 'generate':
        return await handleGenerate(req, res);
      case 'status':
        return await handleStatus(req, res);
      case 'verify':
        return await handleVerify(req, res);
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

// Handler: POST /api/v1/pin/generate
async function handleGenerate(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

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
}

// Handler: GET /api/v1/pin/status
async function handleStatus(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  const env = createEnv();
  const today = new Date().toISOString().split('T')[0];
  const validClinics = getValidClinics();
  const pins = {};

  for (const clinic of validClinics) {
    const pinKey = `pin:${clinic}:${today}`;
    let pinData = await env.KV_PINS.get(pinKey, { type: 'json' });

    if (!pinData) {
      const newPin = generatePIN();
      pinData = {
        clinic,
        pin: newPin,
        date: today,
        generatedAt: new Date().toISOString()
      };

      await env.KV_PINS.put(pinKey, JSON.stringify(pinData), {
        expirationTtl: 86400
      });
    }

    pins[clinic] = pinData.pin;
  }

  return res.status(200).json({
    success: true,
    pins,
    date: today
  });
}

// Handler: POST /api/v1/pin/verify
async function handleVerify(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

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
}


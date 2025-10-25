/**
 * Route API - Unified Endpoint
 * Handles: /api/v1/route/create, /get
 */

import { createEnv } from '../lib/storage.js';
import { createOptimizedRoute } from '../lib/routing.js';

export default async function handler(req, res) {
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
      case 'create':
        return await handleCreate(req, res);
      case 'get':
        return await handleGet(req, res);
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

async function handleCreate(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

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
}

async function handleGet(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const patientId = url.searchParams.get('patientId');

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
}


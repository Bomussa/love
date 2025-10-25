/**
 * Stats API - Unified Endpoint
 * Handles: /api/v1/stats/dashboard, /queues
 */

import { getDashboardStats } from '../lib/reports.js';
import { getRouteStatistics } from '../lib/routing.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
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
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const statsType = pathParts[pathParts.length - 1];

    switch (statsType) {
      case 'dashboard':
        return await handleDashboard(req, res);
      case 'queues':
        return await handleQueues(req, res);
      default:
        return res.status(404).json({
          success: false,
          error: 'Stats type not found'
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

async function handleDashboard(req, res) {
  const stats = await getDashboardStats();

  return res.status(200).json({
    success: true,
    stats,
    timestamp: new Date().toISOString()
  });
}

async function handleQueues(req, res) {
  const stats = await getRouteStatistics();

  return res.status(200).json({
    success: true,
    stats,
    timestamp: new Date().toISOString()
  });
}


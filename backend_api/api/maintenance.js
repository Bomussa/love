// love-api/api/maintenance.js
// Vercel Serverless Function for Automatic Maintenance Mode

import { createEnv } from '../lib/env.js';

function resolveHealthState(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'unknown';
  }

  // Support both direct payloads and wrapped responses: { success, data: { status } }
  const status = payload.status ?? payload?.data?.status;
  if (typeof status !== 'string') {
    return 'unknown';
  }

  const normalized = status.toLowerCase();
  if (normalized === 'operational' || normalized === 'healthy' || normalized === 'ok') {
    return 'healthy';
  }

  if (normalized === 'degraded') {
    return 'degraded';
  }

  return 'down';
}

export async function evaluateSystemStatus(req) {
  try {
    const host = req.headers.host;
    if (!host) {
      return 'down';
    }

    const protocol = host.includes('localhost') ? 'http' : 'https';
    const statusResponse = await fetch(`${protocol}://${host}/api/v1/status`);

    if (!statusResponse.ok) {
      return 'down';
    }

    const payload = await statusResponse.json();
    const healthState = resolveHealthState(payload);

    if (healthState === 'healthy') {
      return 'healthy';
    }

    if (healthState === 'degraded') {
      return 'degraded';
    }

    return 'down';
  } catch {
    return 'down';
  }
}

export { resolveHealthState };

// This function will be triggered by a cron job or a health check failure
// It checks the system status and returns a maintenance page if needed.
export default async (req, res) => {
  const env = createEnv();
  const { method } = req;

  if (method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  }

  // 1. Check for a global maintenance flag
  const isGlobalMaintenanceActive = env.MAINTENANCE_MODE;

  // 2. Check the health of critical services
  const systemStatus = await evaluateSystemStatus(req);

  // Decision Logic for Maintenance Mode
  const shouldActivateMaintenance = isGlobalMaintenanceActive || systemStatus === 'down';

  if (shouldActivateMaintenance) {
    return res.status(503).json({
      success: false,
      error: 'Service Unavailable',
      message: 'The system is currently undergoing maintenance or experiencing a critical failure. Please try again later.',
      maintenance_active: true,
      system_status: systemStatus,
    });
  }

  return res.status(200).json({
    success: true,
    message: 'System is operational. No maintenance required.',
    maintenance_active: false,
    system_status: systemStatus,
  });
};

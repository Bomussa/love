/**
 * Queue Call Next Endpoint
 * POST /api/v1/queue/call
 */

import { createEnv } from '../../lib/storage.js';
import { validateClinic, withLock, emitQueueEvent } from '../../lib/helpers.js';

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
    const { clinic, clinicId } = req.body;
    const clinicName = clinic || clinicId;

    if (!clinicName) {
      return res.status(400).json({
        success: false,
        error: 'Missing clinic'
      });
    }

    if (!validateClinic(clinicName)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid clinic'
      });
    }

    const env = createEnv();

    // Use distributed lock
    const result = await withLock(env, `queue:${clinicName}`, async () => {
      // Get current queue
      const queueKey = `queue:list:${clinicName}`;
      const queueData = await env.KV_QUEUES.get(queueKey, { type: 'json' }) || [];

      if (queueData.length === 0) {
        return {
          success: false,
          error: 'Queue is empty'
        };
      }

      // Get first patient
      const nextPatient = queueData[0];

      // Update status
      const statusKey = `queue:status:${clinicName}`;
      const status = await env.KV_QUEUES.get(statusKey, { type: 'json' }) || {
        current: null,
        served: []
      };

      status.current = nextPatient.number;
      status.lastCalled = new Date().toISOString();

      await env.KV_QUEUES.put(statusKey, JSON.stringify(status), {
        expirationTtl: 86400
      });

      // Emit event
      await emitQueueEvent(env, clinicName, nextPatient.user, 'CALLED', 1);

      return {
        success: true,
        clinic: clinicName,
        current: nextPatient,
        remaining: queueData.length - 1
      };
    });

    return res.status(200).json(result);

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}


  } catch (error) {
    console.error('Error in api/v1/queue/call.js:', error);
    return res.status(500).json({ success: false, error: error.message });
  }

/**
 * Queue Done Endpoint
 * POST /api/v1/queue/done
 */

import { createEnv } from '../../lib/storage.js';
import { withLock, emitQueueEvent } from '../../lib/helpers.js';

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
    const { clinic, user, pin, clinicId, patientId, ticket } = req.body;

    // Support both formats
    const clinicName = clinic || clinicId;
    const userId = user || patientId;

    if (!clinicName || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing clinic or user'
      });
    }

    const env = createEnv();

    // Use distributed lock
    const result = await withLock(env, `queue:${clinicName}`, async () => {
      // Get current queue
      const queueKey = `queue:list:${clinicName}`;
      const queueData = await env.KV_QUEUES.get(queueKey, { type: 'json' }) || [];

      // Find user in queue
      const userIndex = queueData.findIndex(e => e.user === userId);
      
      if (userIndex === -1) {
        return {
          success: false,
          error: 'User not found in queue'
        };
      }

      // Remove user from queue
      const removedEntry = queueData.splice(userIndex, 1)[0];

      // Save updated queue
      await env.KV_QUEUES.put(queueKey, JSON.stringify(queueData), {
        expirationTtl: 86400
      });

      // Update status
      const statusKey = `queue:status:${clinicName}`;
      const status = await env.KV_QUEUES.get(statusKey, { type: 'json' }) || {
        current: null,
        served: []
      };

      status.served = status.served || [];
      status.served.push({
        ...removedEntry,
        completedAt: new Date().toISOString()
      });

      // Set next patient as current
      if (queueData.length > 0) {
        status.current = queueData[0].number;
      } else {
        status.current = null;
      }

      await env.KV_QUEUES.put(statusKey, JSON.stringify(status), {
        expirationTtl: 86400
      });

      // Delete user entry
      await env.KV_QUEUES.delete(`queue:user:${clinicName}:${userId}`);

      // Emit event
      await emitQueueEvent(env, clinicName, userId, 'COMPLETED', 0);

      return {
        success: true,
        clinic: clinicName,
        user: userId,
        message: 'Successfully removed from queue',
        next_in_queue: queueData.length > 0 ? queueData[0] : null
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


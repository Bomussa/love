/**
 * Queue Enter Endpoint
 * POST /api/v1/queue/enter
 */

import { createEnv } from '../../lib/storage.js';
import { validateClinic, generateUniqueNumber, emitQueueEvent, withLock } from '../../lib/helpers.js';

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
    const { clinic, user, isAutoEntry } = req.body;

    if (!clinic || !user) {
      return res.status(400).json({
        success: false,
        error: 'Missing clinic or user'
      });
    }

    if (!validateClinic(clinic)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid clinic'
      });
    }

    const env = createEnv();

    // Use distributed lock to prevent race conditions
    const result = await withLock(env, `queue:${clinic}`, async () => {
      // Get current queue
      const queueKey = `queue:list:${clinic}`;
      const queueData = await env.KV_QUEUES.get(queueKey, { type: 'json' }) || [];

      // Check if user already in queue
      const existingEntry = queueData.find(e => e.user === user);
      if (existingEntry) {
        const position = queueData.indexOf(existingEntry) + 1;
        return {
          success: true,
          clinic: clinic,
          user: user,
          number: existingEntry.number,
          status: 'ALREADY_IN_QUEUE',
          ahead: position - 1,
          display_number: position,
          position: position,
          message: 'You are already in the queue'
        };
      }

      // Generate unique number
      const uniqueNumber = generateUniqueNumber();

      // Add to queue
      const entry = {
        number: uniqueNumber,
        user: user,
        status: isAutoEntry ? 'IN_PROGRESS' : 'WAITING',
        enteredAt: new Date().toISOString()
      };

      queueData.push(entry);

      // Save queue
      await env.KV_QUEUES.put(queueKey, JSON.stringify(queueData), {
        expirationTtl: 86400
      });

      // Save user entry
      await env.KV_QUEUES.put(
        `queue:user:${clinic}:${user}`,
        JSON.stringify(entry),
        { expirationTtl: 86400 }
      );

      // Calculate ahead and position
      const ahead = queueData.length - 1;
      const position = queueData.length;

      // Emit event for real-time updates
      await emitQueueEvent(env, clinic, user, 'ENTERED', position);

      return {
        success: true,
        clinic: clinic,
        user: user,
        number: uniqueNumber,
        status: 'WAITING',
        ahead: ahead,
        display_number: position,
        position: position
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
    console.error('Error in api/v1/queue/enter.js:', error);
    return res.status(500).json({ success: false, error: error.message });
  }

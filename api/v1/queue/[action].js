/**
 * Queue API - Unified Endpoint
 * Handles: /api/v1/queue/call, /done, /enter, /status
 */

import { createEnv } from '../lib/storage.js';
import { validateClinic, generateUniqueNumber, emitQueueEvent, withLock } from '../lib/helpers.js';

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
    const action = pathParts[pathParts.length - 1];

    // Route to appropriate handler
    switch (action) {
      case 'call':
        return await handleCall(req, res);
      case 'done':
        return await handleDone(req, res);
      case 'enter':
        return await handleEnter(req, res);
      case 'status':
        return await handleStatus(req, res);
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

// Handler: POST /api/v1/queue/call
async function handleCall(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

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

  const result = await withLock(env, `queue:${clinicName}`, async () => {
    const queueKey = `queue:list:${clinicName}`;
    const queueData = await env.KV_QUEUES.get(queueKey, { type: 'json' }) || [];

    if (queueData.length === 0) {
      return {
        success: false,
        error: 'Queue is empty'
      };
    }

    const nextPatient = queueData[0];

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

    await emitQueueEvent(env, clinicName, nextPatient.user, 'CALLED', 1);

    return {
      success: true,
      clinic: clinicName,
      current: nextPatient,
      remaining: queueData.length - 1
    };
  });

  return res.status(200).json(result);
}

// Handler: POST /api/v1/queue/done
async function handleDone(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  const { clinic, user, clinicId, patientId } = req.body;
  const clinicName = clinic || clinicId;
  const userId = user || patientId;

  if (!clinicName || !userId) {
    return res.status(400).json({
      success: false,
      error: 'Missing clinic or user'
    });
  }

  const env = createEnv();

  const result = await withLock(env, `queue:${clinicName}`, async () => {
    const queueKey = `queue:list:${clinicName}`;
    const queueData = await env.KV_QUEUES.get(queueKey, { type: 'json' }) || [];

    const userIndex = queueData.findIndex(e => e.user === userId);
    
    if (userIndex === -1) {
      return {
        success: false,
        error: 'User not found in queue'
      };
    }

    const removedEntry = queueData.splice(userIndex, 1)[0];

    await env.KV_QUEUES.put(queueKey, JSON.stringify(queueData), {
      expirationTtl: 86400
    });

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

    if (queueData.length > 0) {
      status.current = queueData[0].number;
    } else {
      status.current = null;
    }

    await env.KV_QUEUES.put(statusKey, JSON.stringify(status), {
      expirationTtl: 86400
    });

    await env.KV_QUEUES.delete(`queue:user:${clinicName}:${userId}`);
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
}

// Handler: POST /api/v1/queue/enter
async function handleEnter(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

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

  const result = await withLock(env, `queue:${clinic}`, async () => {
    const queueKey = `queue:list:${clinic}`;
    const queueData = await env.KV_QUEUES.get(queueKey, { type: 'json' }) || [];

    const existingEntry = queueData.find(e => e.user === user);
    if (existingEntry) {
      return {
        success: false,
        error: 'User already in queue',
        position: queueData.indexOf(existingEntry) + 1
      };
    }

    const number = await generateUniqueNumber(env, clinic);
    const newEntry = {
      number,
      user,
      enteredAt: new Date().toISOString(),
      isAutoEntry: isAutoEntry || false
    };

    queueData.push(newEntry);

    await env.KV_QUEUES.put(queueKey, JSON.stringify(queueData), {
      expirationTtl: 86400
    });

    await env.KV_QUEUES.put(
      `queue:user:${clinic}:${user}`,
      JSON.stringify(newEntry),
      { expirationTtl: 86400 }
    );

    await emitQueueEvent(env, clinic, user, 'ENTERED', queueData.length);

    return {
      success: true,
      clinic,
      number,
      position: queueData.length,
      enteredAt: newEntry.enteredAt
    };
  });

  return res.status(200).json(result);
}

// Handler: GET /api/v1/queue/status
async function handleStatus(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const clinic = url.searchParams.get('clinic');
  
  if (!clinic) {
    return res.status(400).json({
      success: false,
      error: 'Missing clinic parameter'
    });
  }

  const env = createEnv();
  const queueKey = `queue:list:${clinic}`;
  const queueData = await env.KV_QUEUES.get(queueKey, { type: 'json' }) || [];

  const statusKey = `queue:status:${clinic}`;
  const status = await env.KV_QUEUES.get(statusKey, { type: 'json' }) || {
    current: null,
    served: []
  };

  return res.status(200).json({
    success: true,
    clinic: clinic,
    list: queueData,
    current_serving: status.current,
    total_waiting: queueData.length,
    total_served: status.served?.length || 0,
    timestamp: new Date().toISOString()
  });
}


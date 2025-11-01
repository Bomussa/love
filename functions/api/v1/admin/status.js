// Admin Status - Get system status
// GET /api/v1/admin/status

import { jsonResponse } from '../../../_shared/utils.js';

export async function onRequestGet(context) {
  const { env } = context;

  try {
    // Check KV bindings
    const kvBindings = {
      KV_PINS: !!env.KV_PINS,
      KV_QUEUES: !!env.KV_QUEUES,
      KV_ADMIN: !!env.KV_ADMIN,
      KV_EVENTS: !!env.KV_EVENTS,
      KV_LOCKS: !!env.KV_LOCKS,
      KV_CACHE: !!env.KV_CACHE
    };

    const allBound = Object.values(kvBindings).every(v => v);

    // Get system stats
    const clinics = ['lab', 'xray', 'eyes', 'internal', 'ent', 'derma', 'ortho', 'dental'];
    let totalWaiting = 0;
    let totalDone = 0;

    if (env.KV_QUEUES) {
      for (const clinic of clinics) {
        const queueKey = `queue:${clinic}`;
        const queueData = await env.KV_QUEUES.get(queueKey, { type: 'json' });

        if (queueData) {
          totalWaiting += queueData.patients.filter(p => p.status === 'WAITING').length;
          totalDone += queueData.patients.filter(p => p.status === 'DONE').length;
        }
      }
    }

    return jsonResponse({
      success: true,
      online: true,
      version: '1.0.0',
      kv_sync: allBound,
      kv_bindings: kvBindings,
      stats: {
        total_waiting: totalWaiting,
        total_done: totalDone,
        active_clinics: clinics.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return jsonResponse({
      success: false,
      online: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
}


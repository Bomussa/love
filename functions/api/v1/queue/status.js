// Queue Status - Get current queue status for a clinic
// Returns current serving number, total length, and waiting count

import { jsonResponse, checkKVAvailability } from '../../../_shared/utils.js';

export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'GET') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }
  
  try {
    const url = new URL(request.url);
    const clinic = url.searchParams.get('clinic');
    
    if (!clinic) {
      return jsonResponse({
        success: false,
        error: 'Missing clinic parameter'
      }, 400);
    }
    
    // Check KV availability
    const kvError = checkKVAvailability(env.KV_QUEUES, 'KV_QUEUES');
    if (kvError) {
      return jsonResponse(kvError, 500);
    }
    
    const kv = env.KV_QUEUES;
    
    // Get queue list
    const listKey = `queue:list:${clinic}`;
    const queueList = await kv.get(listKey, { type: 'json' }) || [];
    
    // Get current patient
    const currentKey = `queue:current:${clinic}`;
    const currentData = await kv.get(currentKey, { type: 'json' });
    
    // Count by status
    const waiting = queueList.filter(item => item.status === 'WAITING').length;
    const inService = queueList.filter(item => item.status === 'IN_SERVICE').length;
    const completed = queueList.filter(item => item.status === 'DONE' || item.status === 'COMPLETED').length;
    const total = queueList.length;
    
    return jsonResponse({
      success: true,
      clinic: clinic,
      current: currentData ? currentData.number : null,
      current_display: currentData ? currentData.number : 0,
      total: total,
      waiting: waiting,
      in_service: inService,
      completed: completed
    });
    
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
}


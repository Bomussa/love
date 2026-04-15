// Admin Live Feed - Real-time activity display
// GET /api/v1/admin/live-feed?limit=50

import { jsonResponse } from '../../../_shared/utils.js';
import { getActivityFeed, getGlobalStats } from '../../../_shared/activity-logger.js';

export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'GET') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }
  
  try {
    // Parse query parameters
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    
    // Get real-time activity feed
    const activities = await getActivityFeed(env, limit);
    
    // Get global statistics
    const stats = await getGlobalStats(env);
    
    // Get current queue status for all clinics
    const clinics = ['vitals', 'lab', 'xray', 'ecg', 'audio', 'eyes', 
                     'internal', 'ent', 'surgery', 'dental', 'psychiatry', 
                     'derma', 'bones'];
    
    const queuesStatus = {};
    for (const clinic of clinics) {
      const listKey = `queue:list:${clinic}`;
      const queueList = await env.KV_QUEUES.get(listKey, 'json') || [];
      
      queuesStatus[clinic] = {
        current: queueList.length > 0 ? queueList[0].number : 0,
        waiting: queueList.length,
        queue: queueList.map(item => ({
          number: item.number,
          user: item.user,
          status: item.status,
          entered_at: item.entered_at
        }))
      };
    }
    
    return jsonResponse({
      success: true,
      timestamp: new Date().toISOString(),
      activities: activities,
      stats: stats,
      queues: queuesStatus,
      total_activities: activities.length
    });
    
  } catch (error) {
    return jsonResponse({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
}

// Handle OPTIONS for CORS
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}


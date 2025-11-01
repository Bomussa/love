// Clinic Statistics - Get permanent statistics for specific clinic
// GET /api/v1/admin/clinic-stats?clinic=lab

import { jsonResponse } from '../../../_shared/utils.js';
import { getClinicStats } from '../../../_shared/activity-logger.js';

export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'GET') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }
  
  try {
    const url = new URL(request.url);
    const clinic = url.searchParams.get('clinic');
    
    if (!clinic) {
      // Get all clinics stats
      const clinics = ['vitals', 'lab', 'xray', 'ecg', 'audio', 'eyes', 
                       'internal', 'ent', 'surgery', 'dental', 'psychiatry', 
                       'derma', 'bones'];
      
      const allStats = {};
      for (const c of clinics) {
        const stats = await getClinicStats(env, c);
        if (stats) {
          allStats[c] = stats;
        }
      }
      
      return jsonResponse({
        success: true,
        clinics: allStats,
        timestamp: new Date().toISOString()
      });
    }
    
    // Get specific clinic stats
    const stats = await getClinicStats(env, clinic);
    
    if (!stats) {
      return jsonResponse({
        success: false,
        error: 'Clinic statistics not found'
      }, 404);
    }
    
    // Get current queue for this clinic
    const listKey = `queue:list:${clinic}`;
    const queueList = await env.KV_QUEUES.get(listKey, 'json') || [];
    
    // Get today's temporary stats
    const today = new Date().toISOString().split('T')[0];
    const todayStatsKey = `stats:clinic:${clinic}:${today}`;
    const todayStats = await env.KV_ADMIN.get(todayStatsKey, 'json');
    
    return jsonResponse({
      success: true,
      clinic: clinic,
      permanent: stats,
      today: todayStats,
      current_queue: {
        waiting: queueList.length,
        current: queueList.length > 0 ? queueList[0].number : 0,
        queue: queueList
      },
      timestamp: new Date().toISOString()
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


// Real-time Queue Position Verification
// GET /api/v1/queue/position?clinic=xxx&user=yyy
// Returns accurate, real-time position in queue

import { jsonResponse, corsResponse, checkKVAvailability } from '../../../_shared/utils.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  
  try {
    const url = new URL(request.url);
    const clinic = url.searchParams.get('clinic');
    const user = url.searchParams.get('user');
    
    if (!clinic || !user) {
      return jsonResponse({
        success: false,
        error: 'clinic and user required'
      }, 400);
    }
    
    // Check KV availability
    const kvError = checkKVAvailability(env.KV_QUEUES, 'KV_QUEUES');
    if (kvError) {
      return jsonResponse(kvError, 500);
    }
    
    const kv = env.KV_QUEUES;
    
    // Get user's queue entry
    const userKey = `queue:user:${clinic}:${user}`;
    const userQueue = await kv.get(userKey, 'json');
    
    if (!userQueue) {
      return jsonResponse({
        success: false,
        error: 'User not in queue'
      }, 404);
    }
    
    // If already done, return completed status
    if (userQueue.status === 'DONE') {
      return jsonResponse({
        success: true,
        status: 'DONE',
        display_number: -1,
        ahead: 0,
        total_waiting: 0,
        message: 'Examination completed'
      });
    }
    
    // Get queue list
    const listKey = `queue:list:${clinic}`;
    const queueList = await kv.get(listKey, 'json') || [];
    
    // Get only WAITING patients
    const waitingPatients = queueList.filter(item => item.status === 'WAITING');
    
    // Sort by entry time to ensure correct order
    waitingPatients.sort((a, b) => {
      const timeA = new Date(a.entered_at).getTime();
      const timeB = new Date(b.entered_at).getTime();
      return timeA - timeB;
    });
    
    // Find user position in waiting list
    const myIndex = waitingPatients.findIndex(item => item.user === user);
    
    // If not found in waiting list, check if in service
    if (myIndex === -1) {
      if (userQueue.status === 'IN_SERVICE') {
        return jsonResponse({
          success: true,
          status: 'IN_SERVICE',
          display_number: 0,
          ahead: 0,
          total_waiting: waitingPatients.length,
          message: 'Currently in service'
        });
      }
      
      return jsonResponse({
        success: true,
        status: 'DONE',
        display_number: -1,
        ahead: 0,
        total_waiting: 0,
        message: 'Not found in active queue'
      });
    }
    
    // Position is index + 1 (1-based)
    const myPosition = myIndex + 1;
    
    // Calculate how many are ahead (0-based)
    const ahead = myIndex;
    
    // Determine display number:
    // -1 = Done (انتهى)
    // 0 = Currently being served (داخل العيادة)
    // 1+ = Waiting (في الانتظار)
    let displayNumber;
    if (ahead === 0) {
      // First in queue = currently being served or next
      displayNumber = 0;
    } else {
      // Waiting = show position (1, 2, 3, ...)
      displayNumber = ahead;
    }
    
    // Estimate waiting time (average 5 minutes per patient)
    const estimatedMinutes = ahead * 5;
    
    return jsonResponse({
      success: true,
      clinic: clinic,
      user: user,
      status: ahead === 0 ? 'NEXT' : 'WAITING',
      display_number: displayNumber,
      ahead: ahead,
      total_waiting: waitingPatients.length,
      estimated_wait_minutes: estimatedMinutes,
      verified_at: new Date().toISOString(),
      verification_method: 'real_time_kv_check'
    });
    
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

// Handle OPTIONS for CORS
export async function onRequestOptions() {
  return corsResponse(['GET', 'OPTIONS']);
}


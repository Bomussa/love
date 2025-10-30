// Queue Call - Call next patient in queue
// POST /api/v1/queue/call
// Body: { clinic }

import { jsonResponse, validateRequiredFields, checkKVAvailability } from '../../../_shared/utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json().catch(() => ({}));
    const { clinic } = body;

    // Validate required fields
    const validationError = validateRequiredFields(body, ['clinic']);
    if (validationError) {
      return jsonResponse(validationError, 400);
    }

    // Check KV availability
    const kvError = checkKVAvailability(env.KV_QUEUES, 'KV_QUEUES');
    if (kvError) {
      return jsonResponse(kvError, 500);
    }

    const kv = env.KV_QUEUES;
    
    // Get queue list
    const listKey = `queue:list:${clinic}`;
    const queueList = await kv.get(listKey, 'json') || [];
    
    // Filter only waiting patients
    const waitingPatients = queueList.filter(item => item.status === 'WAITING');
    
    if (waitingPatients.length === 0) {
      return jsonResponse({
        success: false,
        error: 'No patients waiting'
      }, 404);
    }
    
    // Get first waiting patient
    const nextPatient = waitingPatients[0];
    
    // Update patient status to IN_SERVICE
    const userKey = `queue:user:${clinic}:${nextPatient.user}`;
    const userData = await kv.get(userKey, 'json');
    
    if (userData) {
      userData.status = 'IN_SERVICE';
      userData.called_at = new Date().toISOString();
      
      await kv.put(userKey, JSON.stringify(userData), {
        expirationTtl: 86400
      });
    }
    
    // Update in queue list
    const updatedList = queueList.map(item => {
      if (item.user === nextPatient.user) {
        return { ...item, status: 'IN_SERVICE' };
      }
      return item;
    });
    
    await kv.put(listKey, JSON.stringify(updatedList), {
      expirationTtl: 86400
    });
    
    // Save current number
    const currentKey = `queue:current:${clinic}`;
    await kv.put(currentKey, JSON.stringify({
      number: nextPatient.number,
      user: nextPatient.user,
      called_at: new Date().toISOString()
    }), {
      expirationTtl: 86400
    });
    
    // Log event
    if (env.KV_EVENTS) {
      const eventKey = `event:${clinic}:${Date.now()}`;
      await env.KV_EVENTS.put(eventKey, JSON.stringify({
        type: 'CALL_NEXT',
        clinic: clinic,
        number: nextPatient.number,
        user: nextPatient.user,
        timestamp: new Date().toISOString()
      }), {
        expirationTtl: 3600 // 1 hour
      });
    }

    return jsonResponse({
      success: true,
      clinic: clinic,
      number: nextPatient.number,
      waiting: waitingPatients.length - 1
    });

  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
}


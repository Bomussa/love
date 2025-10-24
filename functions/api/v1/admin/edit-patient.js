// Admin Edit Patient - Modify patient data
// POST /api/v1/admin/edit-patient
// Body: { adminKey, patientId, action, data }

import { jsonResponse, corsResponse } from '../../../_shared/utils.js';

export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }
  
  try {
    const body = await request.json();
    const { adminKey, patientId, action, data } = body;
    
    // Verify admin key
    if (!adminKey || adminKey !== env.ADMIN_KEY) {
      return jsonResponse({
        success: false,
        error: 'Unauthorized - Invalid admin key'
      }, 401);
    }
    
    if (!patientId || !action) {
      return jsonResponse({
        success: false,
        error: 'patientId and action are required'
      }, 400);
    }
    
    let result = {};
    
    switch (action) {
      case 'reset_path':
        // Reset patient path
        const pathKey = `path:${patientId}`;
        await env.KV_ADMIN.delete(pathKey);
        
        result = {
          action: 'reset_path',
          patientId: patientId,
          message: 'Patient path reset successfully'
        };
        break;
        
      case 'remove_from_queue':
        // Remove patient from specific clinic queue
        const { clinic } = data;
        
        if (!clinic) {
          return jsonResponse({
            success: false,
            error: 'clinic is required for remove_from_queue action'
          }, 400);
        }
        
        const userKey = `queue:user:${clinic}:${patientId}`;
        const userEntry = await env.KV_QUEUES.get(userKey, 'json');
        
        if (!userEntry) {
          return jsonResponse({
            success: false,
            error: 'Patient not found in queue'
          }, 404);
        }
        
        // Mark as done (don't delete, for history)
        userEntry.status = 'REMOVED_BY_ADMIN';
        userEntry.removed_at = new Date().toISOString();
        
        await env.KV_QUEUES.put(userKey, JSON.stringify(userEntry), {
          expirationTtl: 86400
        });
        
        // Update counter
        const counterKey = `counter:${clinic}`;
        const counters = await env.KV_QUEUES.get(counterKey, 'json');
        
        if (counters && userEntry.status === 'WAITING') {
          counters.exited += 1;
          await env.KV_QUEUES.put(counterKey, JSON.stringify(counters), {
            expirationTtl: 86400
          });
        }
        
        result = {
          action: 'remove_from_queue',
          patientId: patientId,
          clinic: clinic,
          message: 'Patient removed from queue successfully'
        };
        break;
        
      case 'force_complete_clinic':
        // Force mark clinic as completed
        const { clinic: targetClinic } = data;
        
        if (!targetClinic) {
          return jsonResponse({
            success: false,
            error: 'clinic is required for force_complete_clinic action'
          }, 400);
        }
        
        const queueKey = `queue:user:${targetClinic}:${patientId}`;
        const entry = await env.KV_QUEUES.get(queueKey, 'json');
        
        if (!entry) {
          return jsonResponse({
            success: false,
            error: 'Patient not found in clinic queue'
          }, 404);
        }
        
        entry.status = 'DONE';
        entry.exit_time = new Date().toISOString();
        entry.forced_by_admin = true;
        
        await env.KV_QUEUES.put(queueKey, JSON.stringify(entry), {
          expirationTtl: 86400
        });
        
        // Update counter
        const clinicCounterKey = `counter:${targetClinic}`;
        const clinicCounters = await env.KV_QUEUES.get(clinicCounterKey, 'json');
        
        if (clinicCounters) {
          clinicCounters.exited += 1;
          await env.KV_QUEUES.put(clinicCounterKey, JSON.stringify(clinicCounters), {
            expirationTtl: 86400
          });
        }
        
        result = {
          action: 'force_complete_clinic',
          patientId: patientId,
          clinic: targetClinic,
          message: 'Clinic marked as completed'
        };
        break;
        
      case 'update_path':
        // Update patient path
        const { route } = data;
        
        if (!route || !Array.isArray(route)) {
          return jsonResponse({
            success: false,
            error: 'route array is required for update_path action'
          }, 400);
        }
        
        const currentPathKey = `path:${patientId}`;
        let currentPath = await env.KV_ADMIN.get(currentPathKey, 'json');
        
        if (!currentPath) {
          return jsonResponse({
            success: false,
            error: 'Patient path not found'
          }, 404);
        }
        
        currentPath.route = route;
        currentPath.last_updated = new Date().toISOString();
        currentPath.updated_by_admin = true;
        
        await env.KV_ADMIN.put(currentPathKey, JSON.stringify(currentPath), {
          expirationTtl: 86400
        });
        
        result = {
          action: 'update_path',
          patientId: patientId,
          new_route: route,
          message: 'Patient path updated successfully'
        };
        break;
        
      default:
        return jsonResponse({
          success: false,
          error: `Unknown action: ${action}`
        }, 400);
    }
    
    // Log admin action
    const logEvent = {
      type: 'ADMIN_ACTION',
      action: action,
      patientId: patientId,
      data: data,
      timestamp: new Date().toISOString(),
      result: result
    };
    
    await env.KV_EVENTS.put(
      `event:admin:${action}:${Date.now()}`,
      JSON.stringify(logEvent),
      { expirationTtl: 86400 * 7 } // Keep for 7 days
    );
    
    return jsonResponse({
      success: true,
      ...result,
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

export async function onRequestOptions() {
  return corsResponse(['POST', 'OPTIONS']);
}


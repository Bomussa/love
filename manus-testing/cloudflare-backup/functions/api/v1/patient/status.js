// Patient Status - Complete patient status with all clinics
 * MIGRATED TO SUPABASE
// GET /api/v1/patient/status?patientId=12345678

import { jsonResponse } from '../../../_shared/utils.js';

export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'GET') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }
  
  try {
    const url = new URL(request.url);
    const patientId = url.searchParams.get('patientId');
    
    if (!patientId) {
      return jsonResponse({
        success: false,
        error: 'patientId is required'
      }, 400);
    }
    
    // Get patient path
    const pathKey = `path:${patientId}`;
    const path = await env.KV_ADMIN.get(pathKey, 'json');
    
    if (!path) {
      return jsonResponse({
        success: false,
        error: 'المراجع غير مسجل في النظام',
        message: 'Patient not registered'
      }, 404);
    }
    
    // Get positions in all clinics in path
    const clinicsStatus = [];
    
    for (let i = 0; i < path.route.length; i++) {
      const clinic = path.route[i];
      
      // Check if completed
      const completed = path.progress?.some(
        p => p.clinic === clinic && p.pin_verified
      );
      
      if (completed) {
        // Clinic completed
        const progressEntry = path.progress.find(p => p.clinic === clinic);
        clinicsStatus.push({
          clinic: clinic,
          order: i + 1,
          status: 'COMPLETED',
          completed_at: progressEntry.completed_at,
          duration_minutes: progressEntry.duration_minutes
        });
      } else {
        // Check if in queue
        const listKey = `queue:list:${clinic}`;
        const queueList = await env.KV_QUEUES.get(listKey, 'json') || [];
        const patientIndex = queueList.findIndex(item => item.user === patientId);
        
        if (patientIndex !== -1) {
          // In queue - calculate dynamic position
          const patientEntry = queueList[patientIndex];
          const displayPosition = patientIndex + 1;
          const aheadOfMe = patientIndex;
          
          clinicsStatus.push({
            clinic: clinic,
            order: i + 1,
            status: 'IN_QUEUE',
            display_position: displayPosition,
            ahead: aheadOfMe,
            total_waiting: queueList.length,
            permanent_number: patientEntry.number,
            entered_at: patientEntry.entered_at
          });
        } else {
          // Not yet entered
          const isCurrent = (path.current_index === i);
          clinicsStatus.push({
            clinic: clinic,
            order: i + 1,
            status: isCurrent ? 'READY_TO_ENTER' : 'LOCKED',
            can_enter: isCurrent
          });
        }
      }
    }
    
    // Calculate overall progress
    const completedCount = path.progress?.length || 0;
    const totalClinics = path.route.length;
    const progressPercentage = Math.round((completedCount / totalClinics) * 100);
    
    // Find current clinic
    const currentClinic = clinicsStatus.find(c => c.status === 'IN_QUEUE' || c.status === 'READY_TO_ENTER');
    
    return jsonResponse({
      success: true,
      patientId: patientId,
      
      overview: {
        total_clinics: totalClinics,
        completed: completedCount,
        remaining: totalClinics - completedCount,
        progress_percentage: progressPercentage,
        current_clinic: currentClinic?.clinic,
        current_status: currentClinic?.status
      },
      
      current: currentClinic,
      
      clinics: clinicsStatus,
      
      path: path.route,
      
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


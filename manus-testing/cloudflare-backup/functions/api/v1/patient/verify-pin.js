// Patient Verify PIN V2 - Counter-based exit
 * MIGRATED TO SUPABASE
// POST /api/v1/patient/verify-pin
// Body: { patientId, clinic, pin, queueNumber }
// Increments exited counter

import { jsonResponse, corsResponse, validateRequiredFields, checkKVAvailability } from '../../../_shared/utils.js';
import { logActivity } from '../../../_shared/activity-logger.js';
import { validateVerifyPIN } from '../../../_shared/db-validator.js';

export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }
  
  try {
    const body = await request.json();
    const { patientId, clinic, pin, queueNumber } = body;
    
    const validationError = validateRequiredFields(body, ['patientId', 'clinic', 'pin', 'queueNumber']);
    if (validationError) {
      return jsonResponse(validationError, 400);
    }
    
    const kvQueuesError = checkKVAvailability(env.KV_QUEUES, 'KV_QUEUES');
    if (kvQueuesError) return jsonResponse(kvQueuesError, 500);
    
    const kvPinsError = checkKVAvailability(env.KV_PINS, 'KV_PINS');
    if (kvPinsError) return jsonResponse(kvPinsError, 500);
    
    const kvAdminError = checkKVAvailability(env.KV_ADMIN, 'KV_ADMIN');
    if (kvAdminError) return jsonResponse(kvAdminError, 500);
    
    const kvEventsError = checkKVAvailability(env.KV_EVENTS, 'KV_EVENTS');
    if (kvEventsError) return jsonResponse(kvEventsError, 500);
    
    // Complete validation
    const validation = await validateVerifyPIN(env, patientId, clinic, pin, queueNumber);
    
    if (!validation.valid) {
      return jsonResponse({
        success: false,
        error: validation.error,
        code: validation.code,
        details: validation
      }, validation.code === 'PATIENT_NOT_FOUND' ? 404 : 403);
    }
    
    const userEntry = validation.entry;
    const patientPath = validation.path;
    
    const now = new Date();
    const exitTime = now.toISOString();
    const entryTime = new Date(userEntry.entry_time || userEntry.entered_at);
    const durationMs = now - entryTime;
    const durationMinutes = Math.round(durationMs / 60000);
    
    // ============================================================
    // INCREMENT EXITED COUNTER
    // ============================================================
    const counterKey = `counter:${clinic}`;
    let counters = await env.KV_QUEUES.get(counterKey, 'json') || {
      clinic: clinic,
      entered: 0,
      exited: 0
    };
    
    counters.exited += 1;
    
    await env.KV_QUEUES.put(counterKey, JSON.stringify(counters), {
      expirationTtl: 86400
    });
    
    // Calculate waiting
    const waiting = counters.entered - counters.exited;
    
    // ============================================================
    // MARK USER AS DONE
    // ============================================================
    userEntry.status = 'DONE';
    userEntry.exit_time = exitTime;
    userEntry.duration_minutes = durationMinutes;
    userEntry.pin_verified = true;
    userEntry.pin_verified_at = exitTime;
    
    const userKey = `queue:user:${clinic}:${patientId}`;
    await env.KV_QUEUES.put(userKey, JSON.stringify(userEntry), {
      expirationTtl: 86400
    });
    
    // Log EXIT activity
    await logActivity(env, 'EXIT', {
      patientId: patientId,
      clinic: clinic,
      queueNumber: parseInt(queueNumber),
      duration: durationMinutes,
      pinVerified: true,
      details: {
        entered_count: counters.entered,
        exited_count: counters.exited,
        waiting_count: waiting
      }
    });
    
    // ============================================================
    // UPDATE STATISTICS
    // ============================================================
    const today = new Date().toISOString().split('T')[0];
    const statsKey = `stats:clinic:${clinic}:${today}`;
    let stats = await env.KV_ADMIN.get(statsKey, 'json') || {
      clinic: clinic,
      date: today,
      total_entered: 0,
      total_completed: 0,
      total_duration_minutes: 0,
      avg_duration_minutes: 0
    };
    
    stats.total_completed += 1;
    stats.total_duration_minutes += durationMinutes;
    stats.avg_duration_minutes = Math.round(stats.total_duration_minutes / stats.total_completed);
    stats.last_updated = exitTime;
    
    await env.KV_ADMIN.put(statsKey, JSON.stringify(stats), {
      expirationTtl: 86400 * 7
    });
    
    // ============================================================
    // FIND NEXT CLINIC
    // ============================================================
    const currentIndex = patientPath.route.indexOf(clinic);
    if (currentIndex === -1) {
      return jsonResponse({ 
        success: false, 
        error: 'العيادة الحالية غير موجودة في المسار',
        message: 'Current clinic not in route'
      }, 400);
    }
    
    const hasNextClinic = currentIndex < patientPath.route.length - 1;
    
    if (!hasNextClinic) {
      // Last clinic
      patientPath.status = 'COMPLETED';
      patientPath.completed_at = exitTime;
      
      const pathKey = `path:${patientId}`;
      await env.KV_ADMIN.put(pathKey, JSON.stringify(patientPath), {
        expirationTtl: 86400
      });
      
      return jsonResponse({
        success: true,
        clinic_completed: clinic,
        pin_verified: true,
        journey_completed: true,
        message: 'تم إنهاء جميع الفحوصات بنجاح',
        total_clinics_completed: patientPath.route.length,
        duration_minutes: durationMinutes,
        counters: {
          entered: counters.entered,
          exited: counters.exited,
          waiting: waiting
        }
      });
    }
    
    // ============================================================
    // AUTO-ENTER NEXT CLINIC
    // ============================================================
    const nextClinic = patientPath.route[currentIndex + 1];
    
    // Get next clinic counters
    const nextCounterKey = `counter:${nextClinic}`;
    let nextCounters = await env.KV_QUEUES.get(nextCounterKey, 'json') || {
      clinic: nextClinic,
      entered: 0,
      exited: 0,
      reset_at: exitTime
    };
    
    // Check if already entered
    const nextUserKey = `queue:user:${nextClinic}:${patientId}`;
    const nextExisting = await env.KV_QUEUES.get(nextUserKey, 'json');
    
    let nextQueueNumber;
    
    if (nextExisting && nextExisting.status !== 'DONE') {
      nextQueueNumber = nextExisting.number;
    } else {
      // Increment counter
      nextCounters.entered += 1;
      nextQueueNumber = nextCounters.entered;
      
      await env.KV_QUEUES.put(nextCounterKey, JSON.stringify(nextCounters), {
        expirationTtl: 86400
      });
      
      // Save user entry
      const nextUserEntry = {
        number: nextQueueNumber,
        status: 'WAITING',
        entered_at: exitTime,
        entry_time: exitTime,
        clinic: nextClinic,
        user: patientId,
        auto_entered: true,
        previous_clinic: clinic
      };
      
      await env.KV_QUEUES.put(nextUserKey, JSON.stringify(nextUserEntry), {
        expirationTtl: 86400
      });
      
      // Log auto-enter
      await logActivity(env, 'ENTER', {
        patientId: patientId,
        clinic: nextClinic,
        queueNumber: nextQueueNumber,
        details: {
          auto_entered: true,
          previous_clinic: clinic,
          entered_count: nextCounters.entered,
          exited_count: nextCounters.exited,
          waiting_count: nextCounters.entered - nextCounters.exited
        }
      });
    }
    
    // ============================================================
    // UPDATE PATIENT PATH
    // ============================================================
    if (!patientPath.progress) {
      patientPath.progress = [];
    }
    
    patientPath.progress.push({
      clinic: clinic,
      completed_at: exitTime,
      duration_minutes: durationMinutes,
      queue_number: queueNumber,
      pin_verified: true
    });
    
    patientPath.current_clinic = nextClinic;
    patientPath.current_index = currentIndex + 1;
    patientPath.last_updated = exitTime;
    
    const pathKey = `path:${patientId}`;
    await env.KV_ADMIN.put(pathKey, JSON.stringify(patientPath), {
      expirationTtl: 86400
    });
    
    // ============================================================
    // CREATE NOTIFICATION
    // ============================================================
    const notificationEvent = {
      type: 'CLINIC_COMPLETED_NEXT',
      patientId: patientId,
      completed_clinic: clinic,
      next_clinic: nextClinic,
      next_queue_number: nextQueueNumber,
      timestamp: exitTime,
      message: `تم إنهاء ${clinic}. توجه إلى ${nextClinic} - رقمك: ${nextQueueNumber}`
    };
    
    await env.KV_EVENTS.put(
      `event:notification:${patientId}:${Date.now()}`,
      JSON.stringify(notificationEvent),
      { expirationTtl: 3600 }
    );
    
    const remainingClinics = patientPath.route.length - (currentIndex + 1) - 1;
    const nextWaiting = nextCounters.entered - nextCounters.exited;
    
    return jsonResponse({
      success: true,
      pin_verified: true,
      clinic_completed: clinic,
      duration_minutes: durationMinutes,
      next_clinic: nextClinic,
      next_queue_number: nextQueueNumber,
      remaining_clinics: remainingClinics,
      total_progress: `${currentIndex + 1}/${patientPath.route.length}`,
      notification: {
        title: 'انتقل إلى العيادة التالية',
        message: `توجه إلى ${nextClinic}`,
        queue_number: nextQueueNumber,
        clinic: nextClinic
      },
      current_clinic_counters: {
        entered: counters.entered,
        exited: counters.exited,
        waiting: waiting
      },
      next_clinic_counters: {
        entered: nextCounters.entered,
        exited: nextCounters.exited,
        waiting: nextWaiting
      },
      stats_updated: true,
      auto_entered_next: true
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


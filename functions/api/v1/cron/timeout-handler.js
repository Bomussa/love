/**
 * CRON Handler - Patient Timeout Handler
 * Triggered by: Cloudflare Cron (every 1 minute)
 * Cron Expression: star star star star star (every minute)
 * MIGRATED TO SUPABASE
 * 
 * Purpose:
 * - Move patients who exceeded 4 minutes to end of queue
 * - Only applies to patients in WAITING or CALLED status
 * - Respects timeoutHandlerEnabled setting
 * 
 * Logic:
 * 1. Get system settings
 * 2. Check if timeoutHandlerEnabled is true
 * 3. For each clinic:
 *    - Find patients who exceeded patientMaxWaitSeconds (240s)
 *    - Move them to end of queue
 *    - Update their status to TIMEOUT
 *    - Log the action
 */

import { jsonResponse, checkKVAvailability } from '../../../_shared/utils.js';
import { logActivity } from '../../../_shared/activity-logger.js';

function getQatarDate() {
  const now = new Date();
  const qatarTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Qatar' }));
  return qatarTime.toISOString().split('T')[0];
}

export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }
  
  try {
    // 1. التحقق من توفر KV
    const kvError = checkKVAvailability(env.KV_ADMIN, 'KV_ADMIN');
    if (kvError) {
      return jsonResponse(kvError, 500);
    }
    
    // 2. جلب إعدادات النظام
    let settings = await env.KV_ADMIN.get('system:settings', { type: 'json' });
    
    // إذا لم توجد إعدادات، استخدم القيم الافتراضية
    if (!settings) {
      settings = {
        timeoutHandlerEnabled: true,
        patientMaxWaitSeconds: 240
      };
    }
    
    // 3. التحقق من تفعيل نظام الـTimeout
    if (!settings.timeoutHandlerEnabled) {
      return jsonResponse({
        success: true,
        message: 'Timeout handler is disabled',
        skipped: true,
        timestamp: new Date().toISOString()
      });
    }
    
    const today = getQatarDate();
    const now = new Date();
    const nowISO = now.toISOString();
    const maxWaitSeconds = settings.patientMaxWaitSeconds || 240;
    
    // 4. جلب قائمة العيادات
    const clinicsConfig = await env.KV_ADMIN?.get('clinics:config', { type: 'json' });
    
    if (!clinicsConfig || !clinicsConfig.clinics) {
      return jsonResponse({
        success: false,
        error: 'Clinics configuration not found'
      }, 500);
    }
    
    const results = [];
    let totalTimedOut = 0;
    
    // 5. معالجة كل عيادة
    for (const clinic of clinicsConfig.clinics) {
      try {
        const clinicId = clinic.id || clinic.name;
        
        // جلب قائمة الدور
        const listKey = `queue:list:${clinicId}`;
        let queueList = await env.KV_QUEUES.get(listKey, { type: 'json' });
        
        if (!queueList || queueList.length === 0) {
          results.push({
            clinic: clinicId,
            status: 'empty',
            message: 'No queue data'
          });
          continue;
        }
        
        const timedOutPatients = [];
        let modified = false;
        
        // 6. فحص كل مراجع
        for (const patient of queueList) {
          // فقط المراجعين في حالة WAITING أو CALLED
          if (patient.status !== 'WAITING' && patient.status !== 'CALLED') {
            continue;
          }
          
          // حساب الوقت المنقضي منذ الدخول
          const enteredAt = new Date(patient.entered_at || patient.timestamp);
          const elapsedSeconds = (now - enteredAt) / 1000;
          
          // إذا تجاوز المهلة القصوى
          if (elapsedSeconds > maxWaitSeconds) {
            // نقل المراجع لنهاية الدور
            patient.status = 'TIMEOUT';
            patient.timeout_at = nowISO;
            patient.original_number = patient.number;
            patient.timeout_reason = `Exceeded ${maxWaitSeconds}s wait time`;
            
            // إعادة ترتيب: نقله لنهاية الدور
            // سنحتفظ برقمه الأصلي لكن نضعه في النهاية
            
            timedOutPatients.push({
              user: patient.user,
              original_number: patient.number,
              elapsed: Math.floor(elapsedSeconds)
            });
            
            modified = true;
            
            // تحديث بيانات المراجع في KV
            const userKey = `queue:user:${clinicId}:${patient.user}`;
            const userData = await env.KV_QUEUES.get(userKey, { type: 'json' });
            
            if (userData) {
              userData.status = 'TIMEOUT';
              userData.timeout_at = nowISO;
              userData.original_number = userData.number;
              
              await env.KV_QUEUES.put(userKey, JSON.stringify(userData), {
                expirationTtl: 86400
              });
            }
          }
        }
        
        // 7. إعادة ترتيب القائمة: المتأخرين في النهاية
        if (modified) {
          // فصل المتأخرين عن الباقي
          const activePatients = queueList.filter(p => p.status !== 'TIMEOUT');
          const timeoutPatients = queueList.filter(p => p.status === 'TIMEOUT');
          
          // إعادة دمج: الباقي أولاً ثم المتأخرين
          const reorderedQueue = [...activePatients, ...timeoutPatients];
          
          // حفظ القائمة المحدثة
          await env.KV_QUEUES.put(listKey, JSON.stringify(reorderedQueue), {
            expirationTtl: 86400
          });
          
          // تسجيل الأحداث
          for (const timedOut of timedOutPatients) {
            if (env.KV_EVENTS) {
              const eventKey = `event:${clinicId}:${Date.now()}-${timedOut.user}`;
              await env.KV_EVENTS.put(eventKey, JSON.stringify({
                type: 'PATIENT_TIMEOUT',
                clinic: clinicId,
                user: timedOut.user,
                original_number: timedOut.original_number,
                elapsed: timedOut.elapsed,
                timestamp: nowISO
              }), {
                expirationTtl: 3600
              });
            }
            
            // تسجيل النشاط
            await logActivity(env, 'TIMEOUT', {
              clinic: clinicId,
              user: timedOut.user,
              original_number: timedOut.original_number,
              elapsed: timedOut.elapsed,
              timestamp: nowISO
            });
          }
          
          totalTimedOut += timedOutPatients.length;
          
          results.push({
            clinic: clinicId,
            status: 'processed',
            timed_out: timedOutPatients.length,
            patients: timedOutPatients
          });
        } else {
          results.push({
            clinic: clinicId,
            status: 'ok',
            message: 'No timeouts detected'
          });
        }
        
      } catch (clinicError) {
        results.push({
          clinic: clinic.id || clinic.name,
          status: 'error',
          error: clinicError.message
        });
      }
    }
    
    return jsonResponse({
      success: true,
      message: 'Timeout handler completed',
      processed: results.length,
      total_timed_out: totalTimedOut,
      max_wait_seconds: maxWaitSeconds,
      results: results,
      timestamp: nowISO
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
  return new Response(null, { status: 204 });
}


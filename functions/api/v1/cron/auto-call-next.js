/**
 * CRON Handler - Auto Call Next Patient
 * Triggered by: Cloudflare Cron (every 2 minutes)
 * Cron Expression: star-slash-2 star star star star (every 2 minutes)
 * 
 * Purpose:
 * - Automatically call next patient in queue every 2 minutes
 * - Only for clinics with no patient currently in service
 * - Respects autoCallEnabled setting
 * 
 * Logic:
 * 1. Get system settings
 * 2. Check if autoCallEnabled is true
 * 3. For each clinic:
 *    - Check if no patient in service
 *    - Check if there are waiting patients
 *    - Call next patient automatically
 *    - Update timestamps
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
      settings = { autoCallEnabled: true };
    }
    
    // 3. التحقق من تفعيل النداء التلقائي
    if (!settings.autoCallEnabled) {
      return jsonResponse({
        success: true,
        message: 'Auto-call is disabled',
        skipped: true,
        timestamp: new Date().toISOString()
      });
    }
    
    const today = getQatarDate();
    const now = new Date().toISOString();
    
    // 4. جلب قائمة العيادات
    const clinicsConfig = await env.KV_ADMIN?.get('clinics:config', { type: 'json' });
    
    if (!clinicsConfig || !clinicsConfig.clinics) {
      return jsonResponse({
        success: false,
        error: 'Clinics configuration not found'
      }, 500);
    }
    
    const results = [];
    
    // 5. معالجة كل عيادة
    for (const clinic of clinicsConfig.clinics) {
      try {
        const clinicId = clinic.id || clinic.name;
        
        // جلب العداد الحالي
        const counterKey = `counter:${clinicId}`;
        let counters = await env.KV_QUEUES.get(counterKey, { type: 'json' });
        
        if (!counters) {
          results.push({
            clinic: clinicId,
            status: 'no_queue',
            message: 'No queue data found'
          });
          continue;
        }
        
        // التحقق من وجود مراجعين في الانتظار
        const waiting = counters.entered - counters.exited;
        
        if (waiting <= 0) {
          results.push({
            clinic: clinicId,
            status: 'empty',
            message: 'No patients waiting'
          });
          continue;
        }
        
        // التحقق من وجود مراجع في الخدمة حالياً
        const currentKey = `queue:current:${clinicId}`;
        const currentPatient = await env.KV_QUEUES.get(currentKey, { type: 'json' });
        
        if (currentPatient) {
          // التحقق من الوقت المنقضي منذ النداء
          const calledAt = new Date(currentPatient.called_at);
          const elapsed = (new Date() - calledAt) / 1000; // بالثواني
          
          // إذا مر أقل من دقيقتين، لا نستدعي التالي
          const queueInterval = settings.queueIntervalSeconds || 120;
          
          if (elapsed < queueInterval) {
            results.push({
              clinic: clinicId,
              status: 'in_service',
              message: `Patient ${currentPatient.number} still in service`,
              elapsed: Math.floor(elapsed),
              remaining: Math.floor(queueInterval - elapsed)
            });
            continue;
          }
        }
        
        // 6. استدعاء المراجع التالي
        const nextNumber = counters.exited + 1;
        
        // البحث عن المراجع التالي
        const listKey = `queue:list:${clinicId}`;
        let queueList = await env.KV_QUEUES.get(listKey, { type: 'json' }) || [];
        
        const nextPatient = queueList.find(p => p.number === nextNumber && p.status === 'WAITING');
        
        if (!nextPatient) {
          results.push({
            clinic: clinicId,
            status: 'no_next',
            message: 'Next patient not found in queue'
          });
          continue;
        }
        
        // تحديث حالة المراجع
        nextPatient.status = 'CALLED';
        nextPatient.called_at = now;
        
        // حفظ القائمة المحدثة
        await env.KV_QUEUES.put(listKey, JSON.stringify(queueList), {
          expirationTtl: 86400
        });
        
        // تحديث المراجع الحالي
        await env.KV_QUEUES.put(currentKey, JSON.stringify({
          number: nextPatient.number,
          user: nextPatient.user,
          called_at: now,
          auto_called: true
        }), {
          expirationTtl: 86400
        });
        
        // تحديث حالة المراجع في KV
        const userKey = `queue:user:${clinicId}:${nextPatient.user}`;
        const userData = await env.KV_QUEUES.get(userKey, { type: 'json' });
        
        if (userData) {
          userData.status = 'CALLED';
          userData.called_at = now;
          userData.auto_called = true;
          
          await env.KV_QUEUES.put(userKey, JSON.stringify(userData), {
            expirationTtl: 86400
          });
        }
        
        // تسجيل الحدث
        if (env.KV_EVENTS) {
          const eventKey = `event:${clinicId}:${Date.now()}`;
          await env.KV_EVENTS.put(eventKey, JSON.stringify({
            type: 'AUTO_CALL_NEXT',
            clinic: clinicId,
            number: nextPatient.number,
            user: nextPatient.user,
            timestamp: now
          }), {
            expirationTtl: 3600
          });
        }
        
        // تسجيل النشاط
        await logActivity(env, 'AUTO_CALL', {
          clinic: clinicId,
          number: nextPatient.number,
          user: nextPatient.user,
          timestamp: now
        });
        
        results.push({
          clinic: clinicId,
          status: 'called',
          number: nextPatient.number,
          user: nextPatient.user,
          message: 'Patient called successfully'
        });
        
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
      message: 'Auto-call process completed',
      processed: results.length,
      called: results.filter(r => r.status === 'called').length,
      results: results,
      timestamp: now
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


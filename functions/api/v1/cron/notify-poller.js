/**
 * CRON Handler - Notify Poller (every minute)
 * Triggered by: every 1 minute (CRON format: star-slash-1 star star star star)
 * MIGRATED TO SUPABASE
 * 
 * Tasks:
 * - Check for patients near their turn
 * - Send notifications via NOTIFY_KEY webhook
 * - Update status to NEAR_TURN
 */

import { jsonResponse } from '../../../_shared/utils.js';

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
    const today = getQatarDate();
    const notifyUrl = env.NOTIFY_KEY;
    
    if (!notifyUrl) {
      return jsonResponse({
        success: false,
        error: 'NOTIFY_KEY not configured'
      }, 500);
    }
    
    const clinicsConfig = await env.KV_ADMIN?.get('clinics:config', { type: 'json' });
    
    if (!clinicsConfig || !clinicsConfig.clinics) {
      return jsonResponse({
        success: false,
        error: 'Clinics configuration not found'
      }, 500);
    }
    
    const notifications = [];
    
    for (const clinic of clinicsConfig.clinics) {
      const queueKey = `queue:${clinic.name}:${today}`;
      let queueData = await env.KV_QUEUES.get(queueKey, { type: 'json' });
      
      if (!queueData || queueData.length === 0) continue;
      
      // Find patients in service
      const inService = queueData.filter(item => item.status === 'IN_SERVICE');
      
      // Find next 3 waiting patients
      const waiting = queueData.filter(item => item.status === 'WAITING');
      const nextPatients = waiting.slice(0, 3);
      
      // Update to NEAR_TURN if not already
      let updated = false;
      
      for (const patient of nextPatients) {
        if (patient.status !== 'NEAR_TURN') {
          patient.status = 'NEAR_TURN';
          patient.updated_at = new Date().toISOString();
          updated = true;
          
          // Send notification
          try {
            await fetch(notifyUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'NEAR_TURN',
                clinic: clinic.name,
                pin: patient.pin,
                ahead: nextPatients.indexOf(patient),
                timestamp: new Date().toISOString()
              })
            });
            
            notifications.push({
              clinic: clinic.name,
              pin: patient.pin,
              status: 'sent'
            });
          } catch (error) {
            notifications.push({
              clinic: clinic.name,
              pin: patient.pin,
              status: 'failed',
              error: error.message
            });
          }
        }
      }
      
      // Save updated queue if changed
      if (updated) {
        await env.KV_QUEUES.put(queueKey, JSON.stringify(queueData), {
          expirationTtl: 86400
        });
      }
    }
    
    return jsonResponse({
      success: true,
      date: today,
      notifications_sent: notifications.length,
      notifications,
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
  return new Response(null, { status: 204 });
}


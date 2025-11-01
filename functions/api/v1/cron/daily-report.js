/**
 * CRON Handler - Daily Report at 23:59 Asia/Qatar
 * Triggered by: 59 23 * * * (11:59 PM)
 * 
 * Tasks:
 * - Generate daily statistics
 * - Save report to R2_BUCKET_REPORTS (if available)
 * - Archive to KV_EVENTS
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
    const report = {
      date: today,
      generated_at: new Date().toISOString(),
      clinics: [],
      totals: {
        patients_served: 0,
        pins_issued: 0,
        avg_wait_seconds: 0,
        avg_service_seconds: 0
      }
    };
    
    const clinicsConfig = await env.KV_ADMIN?.get('clinics:config', { type: 'json' });
    
    if (!clinicsConfig || !clinicsConfig.clinics) {
      return jsonResponse({
        success: false,
        error: 'Clinics configuration not found'
      }, 500);
    }
    
    let totalWaitTime = 0;
    let totalServiceTime = 0;
    let totalPatients = 0;
    
    for (const clinic of clinicsConfig.clinics) {
      const queueKey = `queue:${clinic.name}:${today}`;
      const queueData = await env.KV_QUEUES.get(queueKey, { type: 'json' }) || [];
      
      const pinKey = `pins:${clinic.name}:${today}`;
      const pinData = await env.KV_PINS.get(pinKey, { type: 'json' });
      
      const served = queueData.filter(item => item.status === 'DONE');
      const avgWait = served.length > 0
        ? served.reduce((sum, item) => sum + (item.wait_seconds || 0), 0) / served.length
        : 0;
      
      const avgService = served.length > 0
        ? served.reduce((sum, item) => sum + (item.service_seconds || 0), 0) / served.length
        : 0;
      
      const clinicReport = {
        name: clinic.name,
        patients_served: served.length,
        pins_issued: pinData?.issued || 0,
        avg_wait_seconds: Math.round(avgWait),
        avg_service_seconds: Math.round(avgService),
        queue_length: queueData.length
      };
      
      report.clinics.push(clinicReport);
      
      totalPatients += served.length;
      totalWaitTime += avgWait * served.length;
      totalServiceTime += avgService * served.length;
      report.totals.pins_issued += pinData?.issued || 0;
    }
    
    report.totals.patients_served = totalPatients;
    report.totals.avg_wait_seconds = totalPatients > 0 
      ? Math.round(totalWaitTime / totalPatients) 
      : 0;
    report.totals.avg_service_seconds = totalPatients > 0 
      ? Math.round(totalServiceTime / totalPatients) 
      : 0;
    
    // Save to R2 if available
    if (env.R2_BUCKET_REPORTS) {
      try {
        const reportKey = `reports/${today}.json`;
        await env.R2_BUCKET_REPORTS.put(reportKey, JSON.stringify(report, null, 2), {
          httpMetadata: {
            contentType: 'application/json'
          }
        });
      } catch (error) {
        console.error('R2 save failed:', error);
      }
    }
    
    // Archive to KV_EVENTS
    if (env.KV_EVENTS) {
      const eventKey = `event:report:${today}`;
      await env.KV_EVENTS.put(eventKey, JSON.stringify(report), {
        expirationTtl: 2592000 // 30 days
      });
    }
    
    return jsonResponse({
      success: true,
      report,
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


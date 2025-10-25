/**
 * CRON Handler - Daily Report at 23:59 Asia/Qatar
 * Triggered by: 59 23 * * * (11:59 PM)
 * MIGRATED TO SUPABASE
 * 
 * Tasks:
 * - Generate daily statistics
 * - Save report to reports table
 */

import { jsonResponse } from '../../../_shared/utils.js';
import { getSupabaseClient } from '../../../lib/supabase.js';

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
    const supabase = getSupabaseClient(env);
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
    
    // Get all clinics
    const { data: clinics, error: clinicsError } = await supabase
      .from('clinics')
      .select('*')
      .eq('is_active', true);
    
    if (clinicsError) {
      throw new Error(`Failed to fetch clinics: ${clinicsError.message}`);
    }
    
    if (!clinics || clinics.length === 0) {
      return jsonResponse({
        success: false,
        error: 'No active clinics found'
      }, 500);
    }
    
    let totalWaitTime = 0;
    let totalServiceTime = 0;
    let totalPatients = 0;
    
    for (const clinic of clinics) {
      // Get today's queue data
      const { data: queueData, error: queueError } = await supabase
        .from('queue')
        .select('*')
        .eq('clinic_id', clinic.id)
        .gte('entered_at', `${today}T00:00:00`)
        .lt('entered_at', `${today}T23:59:59`);
      
      if (queueError) {
        console.error(`Error fetching queue for ${clinic.id}:`, queueError);
        continue;
      }
      
      const served = queueData.filter(item => item.status === 'completed');
      const waiting = queueData.filter(item => item.status === 'waiting');
      const cancelled = queueData.filter(item => item.status === 'cancelled');
      
      let clinicWaitTime = 0;
      let clinicServiceTime = 0;
      
      for (const patient of served) {
        if (patient.called_at && patient.entered_at) {
          const wait = new Date(patient.called_at) - new Date(patient.entered_at);
          clinicWaitTime += wait;
        }
        
        if (patient.completed_at && patient.called_at) {
          const service = new Date(patient.completed_at) - new Date(patient.called_at);
          clinicServiceTime += service;
        }
      }
      
      const clinicReport = {
        clinic_id: clinic.id,
        clinic_name: clinic.name,
        patients_served: served.length,
        patients_waiting: waiting.length,
        patients_cancelled: cancelled.length,
        avg_wait_seconds: served.length > 0 ? Math.round(clinicWaitTime / served.length / 1000) : 0,
        avg_service_seconds: served.length > 0 ? Math.round(clinicServiceTime / served.length / 1000) : 0
      };
      
      report.clinics.push(clinicReport);
      
      totalPatients += served.length;
      totalWaitTime += clinicWaitTime;
      totalServiceTime += clinicServiceTime;
    }
    
    // Calculate totals
    report.totals.patients_served = totalPatients;
    report.totals.avg_wait_seconds = totalPatients > 0 ? Math.round(totalWaitTime / totalPatients / 1000) : 0;
    report.totals.avg_service_seconds = totalPatients > 0 ? Math.round(totalServiceTime / totalPatients / 1000) : 0;
    
    // Save report to database
    const { error: insertError } = await supabase
      .from('reports')
      .insert({
        report_date: today,
        report_type: 'daily',
        data: report,
        generated_at: new Date().toISOString()
      });
    
    if (insertError) {
      console.error('Failed to save report:', insertError);
    }
    
    return jsonResponse({
      success: true,
      report: report
    });
    
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
}


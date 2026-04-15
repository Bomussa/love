// Admin Export Report - Export statistics and reports
// GET /api/v1/admin/export-report?type=daily&date=2025-10-24&format=json

import { jsonResponse } from '../../../_shared/utils.js';

const CLINICS = [
  'lab', 'xray', 'vitals', 'ecg', 'audio', 'eyes', 
  'internal', 'ent', 'surgery', 'dental', 'psychiatry', 
  'derma', 'bones'
];

export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'GET') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }
  
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'daily';
    const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
    const format = url.searchParams.get('format') || 'json';
    
    let report = {};
    
    if (type === 'daily') {
      // Daily report
      report = {
        type: 'daily',
        date: date,
        generated_at: new Date().toISOString(),
        clinics: {}
      };
      
      let totalEntered = 0;
      let totalCompleted = 0;
      let totalDuration = 0;
      
      for (const clinic of CLINICS) {
        const statsKey = `stats:clinic:${clinic}:${date}`;
        const stats = await env.KV_ADMIN.get(statsKey, 'json');
        
        if (stats) {
          report.clinics[clinic] = stats;
          totalEntered += stats.total_entered || 0;
          totalCompleted += stats.total_completed || 0;
          totalDuration += stats.total_duration_minutes || 0;
        } else {
          report.clinics[clinic] = {
            clinic: clinic,
            total_entered: 0,
            total_completed: 0,
            avg_duration_minutes: 0
          };
        }
      }
      
      report.summary = {
        total_entered: totalEntered,
        total_completed: totalCompleted,
        total_duration_minutes: totalDuration,
        avg_duration_minutes: totalCompleted > 0 ? Math.round(totalDuration / totalCompleted) : 0
      };
      
    } else if (type === 'permanent') {
      // Permanent statistics
      report = {
        type: 'permanent',
        generated_at: new Date().toISOString(),
        clinics: {}
      };
      
      for (const clinic of CLINICS) {
        const statsKey = `stats:clinic:${clinic}:permanent`;
        const stats = await env.KV_ADMIN.get(statsKey, 'json');
        
        if (stats) {
          report.clinics[clinic] = stats;
        }
      }
      
      // Global stats
      const globalStatsKey = `stats:global:permanent`;
      const globalStats = await env.KV_ADMIN.get(globalStatsKey, 'json');
      
      if (globalStats) {
        report.global = globalStats;
      }
      
    } else if (type === 'current') {
      // Current queues status
      report = {
        type: 'current',
        timestamp: new Date().toISOString(),
        clinics: {}
      };
      
      for (const clinic of CLINICS) {
        const counterKey = `counter:${clinic}`;
        const counters = await env.KV_QUEUES.get(counterKey, 'json');
        
        if (counters) {
          report.clinics[clinic] = {
            clinic: clinic,
            entered: counters.entered,
            exited: counters.exited,
            waiting: counters.entered - counters.exited
          };
        } else {
          report.clinics[clinic] = {
            clinic: clinic,
            entered: 0,
            exited: 0,
            waiting: 0
          };
        }
      }
    }
    
    // Format response
    if (format === 'csv') {
      // Convert to CSV
      let csv = '';
      
      if (type === 'daily' || type === 'permanent') {
        csv = 'Clinic,Total Entered,Total Completed,Avg Duration (min)\n';
        for (const [clinic, stats] of Object.entries(report.clinics)) {
          csv += `${clinic},${stats.total_entered || stats.totalEntered || 0},${stats.total_completed || stats.totalCompleted || 0},${stats.avg_duration_minutes || stats.avgDuration || 0}\n`;
        }
      } else if (type === 'current') {
        csv = 'Clinic,Entered,Exited,Waiting\n';
        for (const [clinic, stats] of Object.entries(report.clinics)) {
          csv += `${clinic},${stats.entered},${stats.exited},${stats.waiting}\n`;
        }
      }
      
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="report_${type}_${date}.csv"`,
          'Access-Control-Allow-Origin': '*'
        }
      });
      
    } else {
      // JSON format
      return jsonResponse({
        success: true,
        report: report
      });
    }
    
  } catch (error) {
    return jsonResponse({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
}

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


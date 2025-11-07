import { getSupabaseClient } from "./supabase-enhanced.js";
const supabase = getSupabaseClient(process.env);

/**
 * Reports System - نظام التقارير والإحصائيات
 */

import { createEnv } from './storage.js';
import { getValidClinics } from './helpers.js';

/**
 * توليد تقرير يومي
 */
export async function generateDailyReport(date) {
  const env = createEnv();
  const dateKey = date || new Date().toISOString().split('T')[0];
  const clinics = getValidClinics();
  const clinicsData = {};
  
  let totalPatients = 0;
  let totalServed = 0;
  let totalWaiting = 0;

  for (const clinic of clinics) {
    const queueKey = `queue:list:${clinic}`;
    const queueData = await env.KV_QUEUES.get(queueKey, { type: 'json' }) || [];
    
    const statusKey = `queue:status:${clinic}`;
    const status = await env.KV_QUEUES.get(statusKey, { type: 'json' }) || { served: [] };
    
    const served = status.served?.length || 0;
    const waiting = queueData.length;
    
    clinicsData[clinic] = {
      clinic,
      served,
      waiting,
      total: served + waiting,
      avgWaitTime: waiting > 0 ? Math.round(waiting * 15) : 0
    };
    
    totalPatients += served + waiting;
    totalServed += served;
    totalWaiting += waiting;
  }

  return {
    date: dateKey,
    type: 'daily',
    clinics: clinicsData,
    summary: {
      totalPatients,
      totalServed,
      totalWaiting,
      completionRate: totalPatients > 0 ? Math.round((totalServed / totalPatients) * 100) : 0
    },
    generatedAt: new Date().toISOString()
  };
}

/**
 * توليد تقرير أسبوعي
 */
export async function generateWeeklyReport(weekStart) {
  const env = createEnv();
  const startDate = weekStart ? new Date(weekStart) : new Date();
  const reports = [];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateKey = date.toISOString().split('T')[0];
    
    const dailyReport = await generateDailyReport(dateKey);
    reports.push(dailyReport);
  }
  
  const totalPatients = reports.reduce((sum, r) => sum + r.summary.totalPatients, 0);
  const totalServed = reports.reduce((sum, r) => sum + r.summary.totalServed, 0);
  const totalWaiting = reports.reduce((sum, r) => sum + r.summary.totalWaiting, 0);

  return {
    weekStart: startDate.toISOString().split('T')[0],
    type: 'weekly',
    days: reports,
    summary: {
      totalPatients,
      totalServed,
      totalWaiting,
      avgPatientsPerDay: Math.round(totalPatients / 7),
      completionRate: totalPatients > 0 ? Math.round((totalServed / totalPatients) * 100) : 0
    },
    generatedAt: new Date().toISOString()
  };
}

/**
 * توليد تقرير شهري
 */
export async function generateMonthlyReport(year, month) {
  const env = createEnv();
  const y = year || new Date().getFullYear();
  const m = month || new Date().getMonth() + 1;
  
  const daysInMonth = new Date(y, m, 0).getDate();
  const reports = [];
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(y, m - 1, day);
    const dateKey = date.toISOString().split('T')[0];
    
    const dailyReport = await generateDailyReport(dateKey);
    reports.push(dailyReport);
  }
  
  const totalPatients = reports.reduce((sum, r) => sum + r.summary.totalPatients, 0);
  const totalServed = reports.reduce((sum, r) => sum + r.summary.totalServed, 0);
  const totalWaiting = reports.reduce((sum, r) => sum + r.summary.totalWaiting, 0);

  return {
    year: y,
    month: m,
    type: 'monthly',
    days: reports,
    summary: {
      totalPatients,
      totalServed,
      totalWaiting,
      avgPatientsPerDay: Math.round(totalPatients / daysInMonth),
      completionRate: totalPatients > 0 ? Math.round((totalServed / totalPatients) * 100) : 0
    },
    generatedAt: new Date().toISOString()
  };
}

/**
 * توليد تقرير سنوي
 */
export async function generateAnnualReport(year) {
  const env = createEnv();
  const y = year || new Date().getFullYear();
  const reports = [];
  
  for (let month = 1; month <= 12; month++) {
    const monthlyReport = await generateMonthlyReport(y, month);
    reports.push(monthlyReport);
  }
  
  const totalPatients = reports.reduce((sum, r) => sum + r.summary.totalPatients, 0);
  const totalServed = reports.reduce((sum, r) => sum + r.summary.totalServed, 0);
  const totalWaiting = reports.reduce((sum, r) => sum + r.summary.totalWaiting, 0);

  return {
    year: y,
    type: 'annual',
    months: reports,
    summary: {
      totalPatients,
      totalServed,
      totalWaiting,
      avgPatientsPerMonth: Math.round(totalPatients / 12),
      avgPatientsPerDay: Math.round(totalPatients / 365),
      completionRate: totalPatients > 0 ? Math.round((totalServed / totalPatients) * 100) : 0
    },
    generatedAt: new Date().toISOString()
  };
}

/**
 * الحصول على إحصائيات لوحة التحكم
 */
export async function getDashboardStats() {
  const env = createEnv();
  const clinics = getValidClinics();
  const stats = {
    clinics: {},
    totals: {
      waiting: 0,
      served: 0,
      active: 0
    }
  };

  for (const clinic of clinics) {
    const queueKey = `queue:list:${clinic}`;
    const queueData = await env.KV_QUEUES.get(queueKey, { type: 'json' }) || [];
    
    const statusKey = `queue:status:${clinic}`;
    const status = await env.KV_QUEUES.get(statusKey, { type: 'json' }) || { served: [] };
    
    const waiting = queueData.length;
    const served = status.served?.length || 0;
    const isActive = waiting > 0 || served > 0;
    
    stats.clinics[clinic] = {
      waiting,
      served,
      current: status.current,
      isActive
    };
    
    stats.totals.waiting += waiting;
    stats.totals.served += served;
    if (isActive) stats.totals.active++;
  }

  return stats;
}


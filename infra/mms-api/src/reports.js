/**
 * نظام التقارير - Reports System
 * 
 * يوفر تقارير يومية، أسبوعية، شهرية، وسنوية
 */

// توليد تقرير يومي
export async function generateDailyReport(env, date = new Date()) {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  const reportKey = `report:daily:${dateStr}`;
  
  // التحقق من وجود تقرير محفوظ
  const cached = await env.KV_CACHE.get(reportKey, { type: 'json' });
  if (cached) return cached;
  
  const clinics = ['lab', 'xray', 'vitals', 'ecg', 'audio', 'eyes', 'internal', 'ent', 'surgery', 'dental', 'psychiatry', 'derma', 'bones'];
  const report = {
    date: dateStr,
    type: 'daily',
    generated_at: new Date().toISOString(),
    clinics: {},
    summary: {
      total_patients: 0,
      total_served: 0,
      total_waiting: 0,
      avg_wait_time: 0
    }
  };
  
  for (const clinic of clinics) {
    const queueKey = `queue:list:${clinic}`;
    const queueData = await env.KV_QUEUES.get(queueKey, { type: 'json' }) || [];
    
    const served = queueData.filter(p => p.status === 'SERVED').length;
    const waiting = queueData.filter(p => p.status === 'WAITING').length;
    
    report.clinics[clinic] = {
      total: queueData.length,
      served,
      waiting,
      avg_wait_time: calculateAvgWaitTime(queueData)
    };
    
    report.summary.total_patients += queueData.length;
    report.summary.total_served += served;
    report.summary.total_waiting += waiting;
  }
  
  // حفظ التقرير
  await env.KV_CACHE.put(reportKey, JSON.stringify(report), {
    expirationTtl: 86400 * 30 // 30 يوم
  });
  
  return report;
}

// توليد تقرير أسبوعي
export async function generateWeeklyReport(env, weekStart = new Date()) {
  const weekStr = getWeekString(weekStart);
  const reportKey = `report:weekly:${weekStr}`;
  
  const cached = await env.KV_CACHE.get(reportKey, { type: 'json' });
  if (cached) return cached;
  
  const report = {
    week: weekStr,
    type: 'weekly',
    generated_at: new Date().toISOString(),
    daily_reports: [],
    summary: {
      total_patients: 0,
      total_served: 0,
      avg_daily_patients: 0
    }
  };
  
  // جمع تقارير الأسبوع
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    const dailyReport = await generateDailyReport(env, date);
    report.daily_reports.push(dailyReport);
    report.summary.total_patients += dailyReport.summary.total_patients;
    report.summary.total_served += dailyReport.summary.total_served;
  }
  
  report.summary.avg_daily_patients = Math.round(report.summary.total_patients / 7);
  
  await env.KV_CACHE.put(reportKey, JSON.stringify(report), {
    expirationTtl: 86400 * 90 // 90 يوم
  });
  
  return report;
}

// توليد تقرير شهري
export async function generateMonthlyReport(env, year, month) {
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const reportKey = `report:monthly:${monthStr}`;
  
  const cached = await env.KV_CACHE.get(reportKey, { type: 'json' });
  if (cached) return cached;
  
  const daysInMonth = new Date(year, month, 0).getDate();
  const report = {
    month: monthStr,
    type: 'monthly',
    generated_at: new Date().toISOString(),
    daily_reports: [],
    summary: {
      total_patients: 0,
      total_served: 0,
      avg_daily_patients: 0,
      busiest_day: null,
      quietest_day: null
    }
  };
  
  let maxPatients = 0;
  let minPatients = Infinity;
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dailyReport = await generateDailyReport(env, date);
    report.daily_reports.push(dailyReport);
    
    const patients = dailyReport.summary.total_patients;
    report.summary.total_patients += patients;
    report.summary.total_served += dailyReport.summary.total_served;
    
    if (patients > maxPatients) {
      maxPatients = patients;
      report.summary.busiest_day = dailyReport.date;
    }
    if (patients < minPatients) {
      minPatients = patients;
      report.summary.quietest_day = dailyReport.date;
    }
  }
  
  report.summary.avg_daily_patients = Math.round(report.summary.total_patients / daysInMonth);
  
  await env.KV_CACHE.put(reportKey, JSON.stringify(report), {
    expirationTtl: 86400 * 365 // سنة
  });
  
  return report;
}

// توليد تقرير سنوي
export async function generateAnnualReport(env, year) {
  const reportKey = `report:annual:${year}`;
  
  const cached = await env.KV_CACHE.get(reportKey, { type: 'json' });
  if (cached) return cached;
  
  const report = {
    year,
    type: 'annual',
    generated_at: new Date().toISOString(),
    monthly_reports: [],
    summary: {
      total_patients: 0,
      total_served: 0,
      avg_monthly_patients: 0,
      busiest_month: null,
      quietest_month: null
    }
  };
  
  let maxPatients = 0;
  let minPatients = Infinity;
  
  for (let month = 1; month <= 12; month++) {
    const monthlyReport = await generateMonthlyReport(env, year, month);
    report.monthly_reports.push(monthlyReport);
    
    const patients = monthlyReport.summary.total_patients;
    report.summary.total_patients += patients;
    report.summary.total_served += monthlyReport.summary.total_served;
    
    if (patients > maxPatients) {
      maxPatients = patients;
      report.summary.busiest_month = monthlyReport.month;
    }
    if (patients < minPatients) {
      minPatients = patients;
      report.summary.quietest_month = monthlyReport.month;
    }
  }
  
  report.summary.avg_monthly_patients = Math.round(report.summary.total_patients / 12);
  
  await env.KV_CACHE.put(reportKey, JSON.stringify(report), {
    expirationTtl: 86400 * 365 * 5 // 5 سنوات
  });
  
  return report;
}

// دوال مساعدة
function calculateAvgWaitTime(queueData) {
  if (!queueData || queueData.length === 0) return 0;
  
  const served = queueData.filter(p => p.status === 'SERVED' && p.servedAt && p.joinedAt);
  if (served.length === 0) return 0;
  
  const totalWait = served.reduce((sum, p) => {
    const wait = new Date(p.servedAt) - new Date(p.joinedAt);
    return sum + wait;
  }, 0);
  
  return Math.round(totalWait / served.length / 1000 / 60); // دقائق
}

function getWeekString(date) {
  const year = date.getFullYear();
  const week = getWeekNumber(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}


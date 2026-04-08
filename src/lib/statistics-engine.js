/**
 * =====================================================================
 * Statistics Engine - المحرك الموحد للإحصاءات (Fixed for public.queues)
 * =====================================================================
 * مصدر واحد لكل الإحصاءات في التطبيق
 * - أرقام اليوم: لحظية من queues (تُصفَّر يومياً تلقائياً بناءً على وقت قطر)
 * - إحصاءات تاريخية: يومية / أسبوعية / شهرية / 6 أشهر / سنة
 * - منطق صحيح: الإجمالي = منتظرون + يُخدَّمون + مكتملون
 * =====================================================================
 */

import { supabase } from './supabase-client';
import { getQatarStartOfDay, getQatarEndOfDay, getQatarDate } from './date-utils';

// ============================================================
// دوال الوقت المساعدة (تستخدم الآن date-utils)
// ============================================================

/** تاريخ اليوم بصيغة YYYY-MM-DD (قطر) */
function getTodayDate() {
  return getQatarDate().toISOString().split('T')[0];
}

/** تاريخ قبل N يوم */
function getDaysAgo(n) {
  const d = getQatarDate();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** بداية الأسبوع الحالي (الأحد) */
function getWeekStart() {
  const d = getQatarDate();
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** بداية الشهر الحالي */
function getMonthStart() {
  const d = getQatarDate();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** بداية فترة زمنية حسب النوع */
function getPeriodStart(period) {
  switch (period) {
    case 'today':    return getQatarStartOfDay();
    case 'week':     return getWeekStart();
    case 'month':    return getMonthStart();
    case 'halfYear': return getDaysAgo(180);
    case 'year':     return getDaysAgo(365);
    default:         return getQatarStartOfDay();
  }
}

// ============================================================
// الإحصاءات اليومية اللحظية (الأرقام الحية)
// ============================================================

/**
 * جلب إحصاءات اليوم الحالي - لحظية من queues
 * المنطق الصحيح: الإجمالي = منتظرون + يُخدَّمون + مكتملون
 */
export async function getTodayStats() {
  try {
    const startOfDay = getQatarStartOfDay();
    const endOfDay = getQatarEndOfDay();

    // جلب كل سجلات اليوم من جدول queues
    const { data, error } = await supabase
      .from('queues')
      .select('status, clinic_id, created_at, completed_at, called_at, patient_id, exam_type')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    if (error) throw error;

    const rows = data || [];

    const waiting   = rows.filter(r => r.status === 'waiting').length;
    const serving   = rows.filter(r => ['serving', 'called'].includes(r.status)).length;
    const completed = rows.filter(r => r.status === 'completed').length;
    const cancelled = rows.filter(r => r.status === 'cancelled').length;
    const total     = waiting + serving + completed; // الإجمالي الصحيح

    // متوسط وقت الانتظار (للمكتملين فقط)
    const completedRows = rows.filter(r =>
      r.status === 'completed' && r.created_at && r.completed_at
    );
    let avgWaitMinutes = 0;
    if (completedRows.length > 0) {
      const totalWait = completedRows.reduce((acc, r) => {
        return acc + (new Date(r.completed_at) - new Date(r.created_at));
      }, 0);
      avgWaitMinutes = Math.round(totalWait / completedRows.length / 60000);
    }

    // عيادات نشطة (بها مرضى الآن)
    const activeClinics = new Set(
      rows.filter(r => ['serving', 'called'].includes(r.status)).map(r => r.clinic_id)
    ).size;

    // إحصاء حسب العيادة
    const byClinic = {};
    rows.forEach(r => {
      if (!byClinic[r.clinic_id]) {
        byClinic[r.clinic_id] = { waiting: 0, serving: 0, completed: 0, total: 0 };
      }
      if (r.status === 'waiting') byClinic[r.clinic_id].waiting++;
      else if (['serving', 'called'].includes(r.status)) byClinic[r.clinic_id].serving++;
      else if (r.status === 'completed') byClinic[r.clinic_id].completed++;
      byClinic[r.clinic_id].total = byClinic[r.clinic_id].waiting +
        byClinic[r.clinic_id].serving + byClinic[r.clinic_id].completed;
    });

    return {
      success: true,
      period: 'today',
      total,
      waiting,
      serving,
      completed,
      cancelled,
      avgWaitMinutes,
      activeClinics,
      byClinic,
      rawCount: rows.length,
    };
  } catch (error) {
    console.error('[StatEngine] getTodayStats error:', error);
    return {
      success: false, error: error.message,
      total: 0, waiting: 0, serving: 0, completed: 0,
      cancelled: 0, avgWaitMinutes: 0, activeClinics: 0, byClinic: {},
    };
  }
}

// ============================================================
// الإحصاءات التاريخية (يومية / أسبوعية / شهرية / 6أشهر / سنة)
// ============================================================

/**
 * جلب إحصاءات لفترة زمنية محددة من queues
 * @param {string} period - 'today' | 'week' | 'month' | 'halfYear' | 'year'
 */
export async function getPeriodStats(period = 'today') {
  try {
    const startISO = getPeriodStart(period);
    const endISO = getQatarEndOfDay();

    const { data, error } = await supabase
      .from('queues')
      .select('status, clinic_id, created_at, completed_at, called_at, patient_id, exam_type')
      .gte('created_at', startISO)
      .lte('created_at', endISO)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const rows = data || [];

    const waiting   = rows.filter(r => r.status === 'waiting').length;
    const serving   = rows.filter(r => ['serving', 'called'].includes(r.status)).length;
    const completed = rows.filter(r => r.status === 'completed').length;
    const cancelled = rows.filter(r => r.status === 'cancelled').length;
    const total     = waiting + serving + completed;

    // المرضى الفريدون
    const uniquePatients = new Set(rows.map(r => r.patient_id).filter(Boolean)).size;

    // متوسط وقت الانتظار
    const completedRows = rows.filter(r =>
      r.status === 'completed' && r.created_at && r.completed_at
    );
    let avgWaitMinutes = 0;
    if (completedRows.length > 0) {
      const totalWait = completedRows.reduce((acc, r) =>
        acc + (new Date(r.completed_at) - new Date(r.created_at)), 0);
      avgWaitMinutes = Math.round(totalWait / completedRows.length / 60000);
    }

    // إحصاء حسب العيادة
    const byClinic = {};
    rows.forEach(r => {
      if (!byClinic[r.clinic_id]) {
        byClinic[r.clinic_id] = { waiting: 0, serving: 0, completed: 0, total: 0 };
      }
      if (r.status === 'waiting') byClinic[r.clinic_id].waiting++;
      else if (['serving', 'called'].includes(r.status)) byClinic[r.clinic_id].serving++;
      else if (r.status === 'completed') byClinic[r.clinic_id].completed++;
      byClinic[r.clinic_id].total = byClinic[r.clinic_id].waiting +
        byClinic[r.clinic_id].serving + byClinic[r.clinic_id].completed;
    });

    // بيانات الرسم البياني (يومية مجمعة)
    const chartData = buildChartData(rows, period);

    // إحصاء حسب نوع الفحص
    const byExamType = {};
    rows.forEach(r => {
      const type = r.exam_type || 'غير محدد';
      if (!byExamType[type]) byExamType[type] = 0;
      byExamType[type]++;
    });

    return {
      success: true,
      period,
      startDate: startISO.split('T')[0],
      total,
      waiting,
      serving,
      completed,
      cancelled,
      uniquePatients,
      avgWaitMinutes,
      byClinic,
      byExamType,
      chartData,
      rawCount: rows.length,
    };
  } catch (error) {
    console.error('[StatEngine] getPeriodStats error:', error);
    return {
      success: false, error: error.message,
      period, total: 0, waiting: 0, serving: 0, completed: 0,
      uniquePatients: 0, avgWaitMinutes: 0, byClinic: {}, byExamType: {}, chartData: [],
    };
  }
}

// ============================================================
// بناء بيانات الرسم البياني
// ============================================================

function buildChartData(rows, period) {
  const grouped = {};

  rows.forEach(r => {
    let key;
    const date = new Date(r.created_at);

    if (period === 'today') {
      // تجميع بالساعة
      key = `${String(date.getHours()).padStart(2, '0')}:00`;
    } else {
      // تجميع باليوم
      key = date.toISOString().split('T')[0];
    }

    if (!grouped[key]) {
      grouped[key] = { label: key, total: 0, waiting: 0, serving: 0, completed: 0 };
    }

    grouped[key].total++;
    if (r.status === 'waiting') grouped[key].waiting++;
    else if (['serving', 'called'].includes(r.status)) grouped[key].serving++;
    else if (r.status === 'completed') grouped[key].completed++;
  });

  return Object.values(grouped).sort((a, b) => a.label.localeCompare(b.label));
}

// ============================================================
// إحصاءات متعددة الفترات دفعة واحدة
// ============================================================

/**
 * جلب ملخص سريع لكل الفترات
 */
export async function getAllPeriodsSnapshot() {
  try {
    const yearAgo = getDaysAgo(365);

    // جلب كل البيانات دفعة واحدة (سنة كاملة) من جدول queues
    const { data, error } = await supabase
      .from('queues')
      .select('status, patient_id, created_at, completed_at, clinic_id')
      .gte('created_at', yearAgo)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const rows = data || [];

    const periods = {
      today:    { label: 'اليوم',    start: getQatarStartOfDay() },
      week:     { label: 'الأسبوع',  start: getWeekStart() },
      month:    { label: 'الشهر',    start: getMonthStart() },
      halfYear: { label: '6 أشهر',   start: getDaysAgo(180) },
      year:     { label: 'السنة',    start: getDaysAgo(365) },
    };

    const result = {};

    for (const [key, config] of Object.entries(periods)) {
      const periodRows = rows.filter(r => new Date(r.created_at) >= new Date(config.start));
      const waiting   = periodRows.filter(r => r.status === 'waiting').length;
      const serving   = periodRows.filter(r => ['serving', 'called'].includes(r.status)).length;
      const completed = periodRows.filter(r => r.status === 'completed').length;
      const total     = waiting + serving + completed;
      const uniquePatients = new Set(periodRows.map(r => r.patient_id).filter(Boolean)).size;

      const completedRows = periodRows.filter(r =>
        r.status === 'completed' && r.created_at && r.completed_at
      );
      let avgWaitMinutes = 0;
      if (completedRows.length > 0) {
        const totalWait = completedRows.reduce((acc, r) =>
          acc + (new Date(r.completed_at) - new Date(r.created_at)), 0);
        avgWaitMinutes = Math.round(totalWait / completedRows.length / 60000);
      }

      result[key] = {
        label: config.label,
        total,
        waiting,
        serving,
        completed,
        uniquePatients,
        avgWaitMinutes,
        chartData: buildChartData(periodRows, key),
      };
    }

    return { success: true, periods: result, fetchedAt: new Date().toISOString() };
  } catch (error) {
    console.error('[StatEngine] getAllPeriodsSnapshot error:', error);
    return { success: false, error: error.message, periods: {} };
  }
}

// ============================================================
// تصدير دوال مساعدة
// ============================================================

export const PERIOD_LABELS = {
  today:    'اليوم',
  week:     'هذا الأسبوع',
  month:    'هذا الشهر',
  halfYear: 'آخر 6 أشهر',
  year:     'هذه السنة',
};

export const PERIOD_LABELS_EN = {
  today:    'Today',
  week:     'This Week',
  month:    'This Month',
  halfYear: 'Last 6 Months',
  year:     'This Year',
};

export default {
  getTodayStats,
  getPeriodStats,
  getAllPeriodsSnapshot,
  PERIOD_LABELS,
  PERIOD_LABELS_EN,
};

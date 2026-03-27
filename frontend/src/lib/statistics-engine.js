/**
 * =====================================================================
 * Statistics Engine - المحرك الموحد للإحصاءات
 * =====================================================================
 * مصدر واحد لكل الإحصاءات في التطبيق
 * - أرقام اليوم: لحظية من unified_queue (تُصفَّر يومياً تلقائياً)
 * - إحصاءات تاريخية: يومية / أسبوعية / شهرية / 6 أشهر / سنة
 * - منطق صحيح: الإجمالي = منتظرون + يُخدَّمون + مكتملون
 * =====================================================================
 */

import { apiClient } from "./lib/api/client";

// ============================================================
// دوال الوقت المساعدة
// ============================================================

/** بداية اليوم الحالي (UTC+3 للسعودية) */
function getTodayStart() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

/** بداية يوم محدد */
function getDayStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** نهاية يوم محدد */
function getDayEnd(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

/** تاريخ اليوم بصيغة YYYY-MM-DD */
function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

/** تاريخ قبل N يوم */
function getDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** بداية الأسبوع الحالي (الأحد) */
function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** بداية الشهر الحالي */
function getMonthStart() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** بداية فترة زمنية حسب النوع */
function getPeriodStart(period) {
  switch (period) {
    case 'today':    return getTodayStart();
    case 'week':     return getWeekStart();
    case 'month':    return getMonthStart();
    case 'halfYear': return getDaysAgo(180);
    case 'year':     return getDaysAgo(365);
    default:         return getTodayStart();
  }
}

// ============================================================
// الإحصاءات اليومية اللحظية (الأرقام الحية)
// ============================================================

/**
 * جلب إحصاءات اليوم الحالي - لحظية من unified_queue
 * المنطق الصحيح: الإجمالي = منتظرون + يُخدَّمون + مكتملون
 */
export async function getTodayStats() {
  try {
    const today = getTodayDate();

    // جلب كل سجلات اليوم دفعة واحدة
    const { data, error } = await supabase
      .from('unified_queue')
      .select('status, clinic_id, entered_at, completed_at, called_at, patient_id, exam_type')
      .eq('queue_date', today);

    if (error) throw error;

    const rows = data || [];

    const waiting   = rows.filter(r => r.status === 'waiting').length;
    const serving   = rows.filter(r => ['serving', 'called'].includes(r.status)).length;
    const completed = rows.filter(r => r.status === 'completed').length;
    const cancelled = rows.filter(r => r.status === 'cancelled').length;
    const total     = waiting + serving + completed; // الإجمالي الصحيح

    // متوسط وقت الانتظار (للمكتملين فقط)
    const completedRows = rows.filter(r =>
      r.status === 'completed' && r.entered_at && r.completed_at
    );
    let avgWaitMinutes = 0;
    if (completedRows.length > 0) {
      const totalWait = completedRows.reduce((acc, r) => {
        return acc + (new Date(r.completed_at) - new Date(r.entered_at));
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
      date: today,
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
 * جلب إحصاءات لفترة زمنية محددة من unified_queue
 * @param {string} period - 'today' | 'week' | 'month' | 'halfYear' | 'year'
 */
export async function getPeriodStats(period = 'today') {
  try {
    const startISO = getPeriodStart(period);
    const today = getTodayDate();

    const { data, error } = await supabase
      .from('unified_queue')
      .select('status, clinic_id, entered_at, completed_at, called_at, patient_id, exam_type, queue_date')
      .gte('entered_at', startISO)
      .order('entered_at', { ascending: true });

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
      r.status === 'completed' && r.entered_at && r.completed_at
    );
    let avgWaitMinutes = 0;
    if (completedRows.length > 0) {
      const totalWait = completedRows.reduce((acc, r) =>
        acc + (new Date(r.completed_at) - new Date(r.entered_at)), 0);
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
      endDate: today,
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
    const date = new Date(r.entered_at);

    if (period === 'today') {
      // تجميع بالساعة
      key = `${String(date.getHours()).padStart(2, '0')}:00`;
    } else if (period === 'week') {
      // تجميع باليوم
      key = r.queue_date || date.toISOString().split('T')[0];
    } else if (period === 'month') {
      // تجميع باليوم
      key = r.queue_date || date.toISOString().split('T')[0];
    } else if (period === 'halfYear') {
      // تجميع بالأسبوع
      const weekNum = Math.floor(date.getDate() / 7) + 1;
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-W${weekNum}`;
    } else if (period === 'year') {
      // تجميع بالشهر
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
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
    const today = getTodayDate();
    const yearAgo = getDaysAgo(365);

    // جلب كل البيانات دفعة واحدة (سنة كاملة)
    const { data, error } = await supabase
      .from('unified_queue')
      .select('status, patient_id, entered_at, completed_at, queue_date, clinic_id')
      .gte('entered_at', yearAgo)
      .order('entered_at', { ascending: true });

    if (error) throw error;

    const rows = data || [];

    const periods = {
      today:    { label: 'اليوم',    start: getTodayStart() },
      week:     { label: 'الأسبوع',  start: getWeekStart() },
      month:    { label: 'الشهر',    start: getMonthStart() },
      halfYear: { label: '6 أشهر',   start: getDaysAgo(180) },
      year:     { label: 'السنة',    start: getDaysAgo(365) },
    };

    const result = {};

    for (const [key, config] of Object.entries(periods)) {
      const periodRows = rows.filter(r => new Date(r.entered_at) >= new Date(config.start));
      const waiting   = periodRows.filter(r => r.status === 'waiting').length;
      const serving   = periodRows.filter(r => ['serving', 'called'].includes(r.status)).length;
      const completed = periodRows.filter(r => r.status === 'completed').length;
      const total     = waiting + serving + completed;
      const uniquePatients = new Set(periodRows.map(r => r.patient_id).filter(Boolean)).size;

      const completedRows = periodRows.filter(r =>
        r.status === 'completed' && r.entered_at && r.completed_at
      );
      let avgWaitMinutes = 0;
      if (completedRows.length > 0) {
        const totalWait = completedRows.reduce((acc, r) =>
          acc + (new Date(r.completed_at) - new Date(r.entered_at)), 0);
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

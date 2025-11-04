// lib/queueManager.js - مدير الكيو اللحظي مع المهلة الزمنية والاستدعاء التلقائي
import db from './db.js';
import { getSetting, getSystemConfig } from './settings.js';

/**
 * نوع بيانات لقطة الكيو
 * @typedef {Object} QueueSnapshot
 * @property {number} waiting - عدد المنتظرين
 * @property {number} called - عدد المستدعين
 * @property {number} in - عدد الموجودين داخل العيادة
 * @property {number} done - عدد المنتهين
 * @property {number} no_show - عدد الغائبين
 */

/**
 * جلب لقطة حالية للكيو في عيادة معينة
 * @param {number} clinicId - معرف العيادة
 * @returns {Promise<QueueSnapshot>} لقطة الكيو
 */
export async function getQueueSnapshot(clinicId) {
  try {
    const { rows } = await db.query(`
      SELECT status, COUNT(*)::int as cnt
      FROM queue_status 
      WHERE clinic_id = $1 AND DATE(created_at) = CURRENT_DATE
      GROUP BY status
    `, [clinicId]);
    
    const snapshot = { waiting: 0, called: 0, in: 0, done: 0, no_show: 0 };
    rows.forEach(row => {
      snapshot[row.status] = row.cnt;
    });
    
    return snapshot;
  } catch (error) {
    console.error(`Error getting queue snapshot for clinic ${clinicId}:`, error);
    return { waiting: 0, called: 0, in: 0, done: 0, no_show: 0 };
  }
}

/**
 * جلب تفاصيل الكيو مع أرقام المراجعين
 * @param {number} clinicId - معرف العيادة
 * @returns {Promise<Object>} تفاصيل الكيو
 */
export async function getQueueDetails(clinicId) {
  try {
    const { rows } = await db.query(`
      SELECT 
        id, patient_id, number, status, 
        called_at, expires_at, started_at, finished_at,
        exam_type, gender, priority, notes,
        created_at
      FROM queue_status 
      WHERE clinic_id = $1 AND DATE(created_at) = CURRENT_DATE
      ORDER BY 
        CASE status 
          WHEN 'in' THEN 1 
          WHEN 'called' THEN 2 
          WHEN 'waiting' THEN 3 
          WHEN 'done' THEN 4 
          WHEN 'no_show' THEN 5 
        END,
        number ASC
    `, [clinicId]);
    
    const snapshot = await getQueueSnapshot(clinicId);
    
    return {
      ...snapshot,
      patients: rows,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error getting queue details for clinic ${clinicId}:`, error);
    return {
      waiting: 0, called: 0, in: 0, done: 0, no_show: 0,
      patients: [],
      lastUpdated: new Date().toISOString()
    };
  }
}

/**
 * استدعاء المراجع التالي في الكيو (يتم تشغيلها كل دقيقة)
 * @param {number} clinicId - معرف العيادة
 * @returns {Promise<Object>} نتيجة الاستدعاء
 */
export async function callNextPatient(clinicId) {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    const config = await getSystemConfig();
    const graceMinutes = config.graceMinutes;
    
    // التحقق من السعة الحالية
    const { rows: loadRows } = await client.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN status='called' THEN 1 ELSE 0 END), 0)::int as called,
        COALESCE(SUM(CASE WHEN status='in' THEN 1 ELSE 0 END), 0)::int as current_in
      FROM queue_status 
      WHERE clinic_id = $1 AND DATE(created_at) = CURRENT_DATE
    `, [clinicId]);
    
    const currentCalled = loadRows[0]?.called || 0;
    const currentIn = loadRows[0]?.current_in || 0;
    const totalEngaged = currentCalled + currentIn;
    
    // التحقق من عدم تجاوز السعة القصوى
    if (totalEngaged >= config.maxCapacity) {
      await client.query('COMMIT');
      return {
        success: false,
        reason: 'capacity_full',
        message: 'العيادة وصلت للسعة القصوى',
        currentLoad: { called: currentCalled, in: currentIn, total: totalEngaged }
      };
    }
    
    // البحث عن أول مراجع في الانتظار
    const { rows: nextRows } = await client.query(`
      SELECT id, patient_id, number 
      FROM queue_status
      WHERE clinic_id = $1 AND status = 'waiting' AND DATE(created_at) = CURRENT_DATE
      ORDER BY priority DESC, number ASC 
      LIMIT 1
    `, [clinicId]);

    if (nextRows.length === 0) {
      await client.query('COMMIT');
      return {
        success: false,
        reason: 'no_waiting',
        message: 'لا يوجد مراجعين في الانتظار',
        currentLoad: { called: currentCalled, in: currentIn, total: totalEngaged }
      };
    }

    const patient = nextRows[0];
    const now = new Date();
    const expiresAt = new Date(now.getTime() + graceMinutes * 60 * 1000);

    // تحديث حالة المراجع إلى "مستدعى"
    await client.query(`
      UPDATE queue_status
      SET status = 'called', called_at = $2, expires_at = $3, updated_at = NOW()
      WHERE id = $1
    `, [patient.id, now, expiresAt]);

    // تحديث إحصائيات الحمل
    await client.query(`
      INSERT INTO clinic_load(clinic_id, current_called, current_in, last_called_at, updated_at)
      VALUES($1, $2, $3, $4, NOW())
      ON CONFLICT (clinic_id) DO UPDATE SET
        current_called = $2,
        current_in = $3,
        last_called_at = $4,
        updated_at = NOW()
    `, [clinicId, currentCalled + 1, currentIn, now]);

    // إنشاء إشعار للمراجع
    await client.query(`
      SELECT create_notification(
        'approaching_turn',
        $1,
        $2,
        jsonb_build_object(
          'grace_minutes', $3,
          'expires_at', $4,
          'number', $5
        )
      )
    `, [patient.patient_id, clinicId, graceMinutes, expiresAt.toISOString(), patient.number]);

    await client.query('COMMIT');

    return {
      success: true,
      patient: {
        id: patient.id,
        patientId: patient.patient_id,
        number: patient.number,
        calledAt: now.toISOString(),
        expiresAt: expiresAt.toISOString()
      },
      currentLoad: { called: currentCalled + 1, in: currentIn, total: totalEngaged + 1 }
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Error calling next patient for clinic ${clinicId}:`, error);
    return {
      success: false,
      reason: 'database_error',
      message: 'خطأ في قاعدة البيانات',
      error: error.message
    };
  } finally {
    client.release();
  }
}

/**
 * تسجيل وصول المراجع للعيادة (تحويل من called إلى in)
 * @param {number} clinicId - معرف العيادة
 * @param {string} patientId - معرف المراجع
 * @returns {Promise<boolean>} نجح التسجيل أم لا
 */
export async function checkInAtClinic(clinicId, patientId) {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    const { rows } = await client.query(`
      UPDATE queue_status
      SET status = 'in', started_at = NOW(), updated_at = NOW()
      WHERE clinic_id = $1 AND patient_id = $2 AND status = 'called'
      RETURNING id, number
    `, [clinicId, patientId]);

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return false;
    }

    // تحديث إحصائيات الحمل
    const { rows: loadRows } = await client.query(`
      SELECT current_called, current_in FROM clinic_load WHERE clinic_id = $1
    `, [clinicId]);
    
    const currentLoad = loadRows[0] || { current_called: 0, current_in: 0 };
    
    await client.query(`
      UPDATE clinic_load
      SET 
        current_called = GREATEST(current_called - 1, 0),
        current_in = current_in + 1,
        updated_at = NOW()
      WHERE clinic_id = $1
    `, [clinicId]);

    // إنشاء إشعار "حان دورك الآن"
    await client.query(`
      SELECT create_notification(
        'your_turn_now',
        $1,
        $2,
        jsonb_build_object('number', $3)
      )
    `, [patientId, clinicId, rows[0].number]);

    await client.query('COMMIT');
    return true;

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Error checking in patient ${patientId} at clinic ${clinicId}:`, error);
    return false;
  } finally {
    client.release();
  }
}

/**
 * إنهاء فحص المراجع في العيادة الحالية
 * @param {number} clinicId - معرف العيادة
 * @param {string} patientId - معرف المراجع
 * @returns {Promise<boolean>} نجح الإنهاء أم لا
 */
export async function completeClinicForPatient(clinicId, patientId) {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    const { rows } = await client.query(`
      UPDATE queue_status
      SET status = 'done', finished_at = NOW(), updated_at = NOW()
      WHERE clinic_id = $1 AND patient_id = $2 AND status IN ('in', 'called')
      RETURNING id, number
    `, [clinicId, patientId]);

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return false;
    }

    // تحديث إحصائيات الحمل
    await client.query(`
      UPDATE clinic_load
      SET 
        current_in = GREATEST(current_in - 1, 0),
        total_served_today = total_served_today + 1,
        last_completed_at = NOW(),
        updated_at = NOW()
      WHERE clinic_id = $1
    `, [clinicId]);

    // تحديث الإحصائيات اليومية
    await client.query(`
      INSERT INTO daily_clinic_stats(clinic_id, date, completed_patients)
      VALUES($1, CURRENT_DATE, 1)
      ON CONFLICT (clinic_id, date) DO UPDATE SET
        completed_patients = daily_clinic_stats.completed_patients + 1
    `, [clinicId]);

    // إنشاء إشعار إنهاء الفحص
    await client.query(`
      SELECT create_notification(
        'complete_checkup',
        $1,
        $2,
        jsonb_build_object('number', $3)
      )
    `, [patientId, clinicId, rows[0].number]);

    await client.query('COMMIT');
    return true;

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Error completing clinic for patient ${patientId} at clinic ${clinicId}:`, error);
    return false;
  } finally {
    client.release();
  }
}

/**
 * معالجة المراجعين الذين انتهت مهلتهم (تحويل إلى no_show)
 * @param {number} clinicId - معرف العيادة
 * @returns {Promise<number>} عدد المراجعين الذين تم تحويلهم لـ no_show
 */
export async function expireNoShows(clinicId) {
  try {
    const { rows } = await db.query(`
      UPDATE queue_status
      SET status = 'no_show', updated_at = NOW()
      WHERE clinic_id = $1 AND status = 'called' AND expires_at < NOW()
      RETURNING patient_id, number
    `, [clinicId]);

    if (rows.length > 0) {
      // تحديث إحصائيات الحمل
      await db.query(`
        UPDATE clinic_load
        SET 
          current_called = GREATEST(current_called - $2, 0),
          updated_at = NOW()
        WHERE clinic_id = $1
      `, [clinicId, rows.length]);

      // تحديث الإحصائيات اليومية
      await db.query(`
        INSERT INTO daily_clinic_stats(clinic_id, date, no_show_patients)
        VALUES($1, CURRENT_DATE, $2)
        ON CONFLICT (clinic_id, date) DO UPDATE SET
          no_show_patients = daily_clinic_stats.no_show_patients + $2
      `, [clinicId, rows.length]);

      // إنشاء إشعارات للمراجعين الغائبين
      for (const patient of rows) {
        await db.query(`
          SELECT create_notification(
            'no_show_warning',
            $1,
            $2,
            jsonb_build_object('number', $3)
          )
        `, [patient.patient_id, clinicId, patient.number]);
      }
    }

    return rows.length;
  } catch (error) {
    console.error(`Error expiring no-shows for clinic ${clinicId}:`, error);
    return 0;
  }
}

/**
 * جلب الإحصائيات اليومية لعيادة معينة
 * @param {number} clinicId - معرف العيادة
 * @param {string} date - التاريخ (اختياري، افتراضياً اليوم)
 * @returns {Promise<Object>} الإحصائيات اليومية
 */
export async function getDailyStats(clinicId, date = null) {
  try {
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    const { rows } = await db.query(`
      SELECT 
        total_patients, completed_patients, no_show_patients,
        average_wait_time, average_service_time, peak_load_time,
        efficiency_score
      FROM daily_clinic_stats
      WHERE clinic_id = $1 AND date = $2
    `, [clinicId, targetDate]);

    if (rows.length === 0) {
      return {
        date: targetDate,
        totalPatients: 0,
        completedPatients: 0,
        noShowPatients: 0,
        averageWaitTime: 0,
        averageServiceTime: 0,
        peakLoadTime: null,
        efficiencyScore: 1.0
      };
    }

    const stats = rows[0];
    return {
      date: targetDate,
      totalPatients: stats.total_patients,
      completedPatients: stats.completed_patients,
      noShowPatients: stats.no_show_patients,
      averageWaitTime: stats.average_wait_time,
      averageServiceTime: stats.average_service_time,
      peakLoadTime: stats.peak_load_time,
      efficiencyScore: parseFloat(stats.efficiency_score)
    };
  } catch (error) {
    console.error(`Error getting daily stats for clinic ${clinicId}:`, error);
    return {
      date: date || new Date().toISOString().split('T')[0],
      totalPatients: 0,
      completedPatients: 0,
      noShowPatients: 0,
      averageWaitTime: 0,
      averageServiceTime: 0,
      peakLoadTime: null,
      efficiencyScore: 1.0
    };
  }
}

export default {
  getQueueSnapshot,
  getQueueDetails,
  callNextPatient,
  checkInAtClinic,
  completeClinicForPatient,
  expireNoShows,
  getDailyStats
};

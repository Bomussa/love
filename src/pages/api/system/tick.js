// pages/api/system/tick.js - المجدول التلقائي (يتم استدعاؤه كل دقيقة)

// --- Safety layer: per-clinic lightweight lock ---
const clinicLastProcessed = new Map();

import db from '../../../lib/supabase-db.js';
import { callNextPatient, expireNoShows } from '../../../frontend/src/lib/queueManager.js';
import { isWorkingHours } from '../../../frontend/src/lib/settings.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  const results = {
    workingHours: false,
    processedClinics: 0,
    expiredNoShows: 0,
    calledPatients: 0,
    errors: [],
    clinicResults: []
  };

  try {
    // التحقق من ساعات العمل
    results.workingHours = await isWorkingHours();

    if (!results.workingHours) {
      return res.json({
        success: true,
        message: 'خارج ساعات العمل - لم يتم تشغيل المجدول',
        results,
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });
    }

    // جلب جميع العيادات المفتوحة
    const { rows: clinics } = await db.query(`
      SELECT id, name FROM clinics WHERE status = 'open' ORDER BY id
    `);

    results.processedClinics = clinics.length;

    // معالجة كل عيادة
    for (const clinic of clinics) {
      // --- Safety layer: skip if processed in last 1s ---
      const now = Date.now();
      const last = clinicLastProcessed.get(clinic.id) || 0;
      if (now - last < 1000) continue; // Skip if processed in last 1s
      clinicLastProcessed.set(clinic.id, now);

      const clinicResult = {
        clinicId: clinic.id,
        clinicName: clinic.name,
        expiredCount: 0,
        callResult: null,
        error: null
      };

      try {
        // معالجة المراجعين الذين انتهت مهلتهم
        const expiredCount = await expireNoShows(clinic.id);
        clinicResult.expiredCount = expiredCount;
        results.expiredNoShows += expiredCount;

        // استدعاء مراجع جديد
        const callResult = await callNextPatient(clinic.id);
        clinicResult.callResult = callResult;

        if (callResult.success) {
          results.calledPatients++;
        }

      } catch (error) {
        clinicResult.error = error.message;
        results.errors.push(`Clinic ${clinic.id}: ${error.message}`);
        // console.error(`Error processing clinic ${clinic.id}:`, error);
      }

      results.clinicResults.push(clinicResult);
    }

    // تنظيف الإشعارات المنتهية الصلاحية
    try {
      const { rows: cleanupResult } = await db.query(`
        SELECT cleanup_expired_notifications() as deleted_count
      `);

      results.cleanedNotifications = cleanupResult[0]?.deleted_count || 0;
    } catch (error) {
      results.errors.push(`Notification cleanup: ${error.message}`);
    }

    // تحديث إحصائيات الكفاءة اليومية
    try {
      await updateDailyEfficiencyScores();
    } catch (error) {
      results.errors.push(`Efficiency update: ${error.message}`);
    }

    const executionTime = Date.now() - startTime;

    return res.json({
      success: true,
      message: `تم تشغيل المجدول بنجاح - معالجة ${results.processedClinics} عيادة`,
      results,
      executionTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    // console.error('Error in system tick:', error);

    const executionTime = Date.now() - startTime;

    return res.status(500).json({
      success: false,
      error: 'System tick failed',
      message: error.message,
      results,
      executionTime,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * تحديث نقاط الكفاءة اليومية لجميع العيادات
 */
async function updateDailyEfficiencyScores() {
  try {
    await db.query(`
      UPDATE clinic_load 
      SET efficiency_score = calculate_efficiency_score(
        (SELECT COALESCE(completed_patients, 0) FROM daily_clinic_stats 
         WHERE clinic_id = clinic_load.clinic_id AND date = CURRENT_DATE),
        (SELECT COALESCE(no_show_patients, 0) FROM daily_clinic_stats 
         WHERE clinic_id = clinic_load.clinic_id AND date = CURRENT_DATE),
        (SELECT COALESCE(average_wait_time, 0) FROM daily_clinic_stats 
         WHERE clinic_id = clinic_load.clinic_id AND date = CURRENT_DATE),
        (SELECT capacity FROM clinics WHERE id = clinic_load.clinic_id)
      ),
      updated_at = NOW()
    `);
  } catch (error) {
    // console.error('Error updating efficiency scores:', error);
    throw error;
  }
}

// تكوين الواجهة
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

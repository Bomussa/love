// lib/routingManager.js - مدير التوجيه الديناميكي مع الأوزان والسعة
import db from './db.js';
import { getSystemConfig } from './settings.js';

/**
 * نوع بيانات نقاط العيادة
 * @typedef {Object} ClinicScore
 * @property {number} id - معرف العيادة
 * @property {string} name - اسم العيادة
 * @property {number} loadRatio - نسبة الحمل (0-1)
 * @property {number} distributedToday - عدد المراجعين الموزعين اليوم
 * @property {number} capacity - السعة القصوى
 * @property {number} currentLoad - الحمل الحالي
 * @property {number} score - النقاط الإجمالية للترتيب
 */

/**
 * اختيار أفضل عيادة للخطوة التالية بناءً على الحمل والتوزيع
 * @param {string} examType - نوع الفحص
 * @param {string} gender - جنس المراجع
 * @param {number} currentStep - رقم الخطوة الحالية
 * @returns {Promise<number|null>} معرف العيادة المختارة أو null
 */
export async function pickClinicForNextStep(examType, gender, currentStep = 1) {
  try {
    // جلب العيادات المتاحة لهذا النوع من الفحص والجنس
    const { rows: availableClinics } = await db.query(`
      SELECT DISTINCT
        c.id, c.name, c.capacity, c.status,
        ert.step_order, ert.estimated_duration_minutes
      FROM clinics c
      JOIN exam_route_templates ert ON ert.clinic_id = c.id
      WHERE ert.exam_type = $1 
        AND ert.gender = $2 
        AND ert.step_order = $3
        AND c.status = 'open'
      ORDER BY ert.step_order
    `, [examType, gender, currentStep]);

    if (availableClinics.length === 0) {
      console.warn(`No available clinics for ${examType}, ${gender}, step ${currentStep}`);
      return null;
    }

    // جلب الحمل الحالي لكل عيادة
    const clinicIds = availableClinics.map(c => c.id);
    const { rows: loadData } = await db.query(`
      SELECT 
        c.id,
        COALESCE(cl.current_called, 0) + COALESCE(cl.current_in, 0) as current_load,
        COALESCE(cl.distributed_today, 0) as distributed_today,
        COALESCE(cl.efficiency_score, 1.0) as efficiency_score,
        c.capacity
      FROM clinics c
      LEFT JOIN clinic_load cl ON cl.clinic_id = c.id
      WHERE c.id = ANY($1)
    `, [clinicIds]);

    // حساب النقاط لكل عيادة
    const scoredClinics = availableClinics.map(clinic => {
      const loadInfo = loadData.find(l => l.id === clinic.id) || {
        current_load: 0,
        distributed_today: 0,
        efficiency_score: 1.0
      };

      const capacity = clinic.capacity || 6;
      const loadRatio = loadInfo.current_load / capacity;
      const distributedToday = loadInfo.distributed_today;
      const efficiencyScore = parseFloat(loadInfo.efficiency_score);

      // حساب النقاط (أقل نقاط = أفضل اختيار)
      let score = 0;
      
      // وزن الحمل الحالي (70% من النقاط)
      score += loadRatio * 0.7;
      
      // وزن التوزيع اليومي (20% من النقاط)
      const maxDistributed = Math.max(...loadData.map(l => l.distributed_today), 1);
      score += (distributedToday / maxDistributed) * 0.2;
      
      // وزن الكفاءة (10% من النقاط - كفاءة أقل = نقاط أكثر)
      score += (1 - efficiencyScore) * 0.1;

      return {
        id: clinic.id,
        name: clinic.name,
        loadRatio,
        distributedToday,
        capacity,
        currentLoad: loadInfo.current_load,
        efficiencyScore,
        score,
        estimatedDuration: clinic.estimated_duration_minutes
      };
    });

    // ترتيب العيادات حسب النقاط (الأقل أولاً)
    scoredClinics.sort((a, b) => {
      // أولوية للعيادات التي لم تصل للسعة القصوى
      if (a.currentLoad >= a.capacity && b.currentLoad < b.capacity) return 1;
      if (b.currentLoad >= b.capacity && a.currentLoad < a.capacity) return -1;
      
      // ثم حسب النقاط
      return a.score - b.score;
    });

    const selectedClinic = scoredClinics[0];
    
    console.log(`Selected clinic ${selectedClinic.name} (ID: ${selectedClinic.id}) for ${examType}/${gender}/step${currentStep}`, {
      loadRatio: selectedClinic.loadRatio.toFixed(2),
      distributedToday: selectedClinic.distributedToday,
      score: selectedClinic.score.toFixed(3)
    });

    return selectedClinic.id;

  } catch (error) {
    console.error('Error picking clinic for next step:', error);
    return null;
  }
}

/**
 * تسجيل توزيع مراجع جديد على عيادة
 * @param {number} clinicId - معرف العيادة
 * @returns {Promise<boolean>} نجح التسجيل أم لا
 */
export async function markDistributed(clinicId) {
  try {
    await db.query(`
      INSERT INTO clinic_load(clinic_id, current_called, current_in, distributed_today, updated_at)
      VALUES($1, 0, 0, 1, NOW())
      ON CONFLICT (clinic_id) DO UPDATE SET
        distributed_today = clinic_load.distributed_today + 1,
        updated_at = NOW()
    `, [clinicId]);

    // تحديث الإحصائيات اليومية
    await db.query(`
      INSERT INTO daily_clinic_stats(clinic_id, date, total_patients)
      VALUES($1, CURRENT_DATE, 1)
      ON CONFLICT (clinic_id, date) DO UPDATE SET
        total_patients = daily_clinic_stats.total_patients + 1
    `, [clinicId]);

    return true;
  } catch (error) {
    console.error(`Error marking distributed for clinic ${clinicId}:`, error);
    return false;
  }
}

/**
 * جلب المسار الكامل لنوع فحص وجنس معين
 * @param {string} examType - نوع الفحص
 * @param {string} gender - جنس المراجع
 * @returns {Promise<Array>} مصفوفة خطوات المسار
 */
export async function getExamRoute(examType, gender) {
  try {
    const { rows } = await db.query(`
      SELECT 
        ert.step_order,
        ert.clinic_id,
        c.name as clinic_name,
        c.floor,
        ert.is_required,
        ert.estimated_duration_minutes
      FROM exam_route_templates ert
      JOIN clinics c ON c.id = ert.clinic_id
      WHERE ert.exam_type = $1 AND ert.gender = $2
      ORDER BY ert.step_order
    `, [examType, gender]);

    return rows.map(row => ({
      stepOrder: row.step_order,
      clinicId: row.clinic_id,
      clinicName: row.clinic_name,
      floor: row.floor,
      isRequired: row.is_required,
      estimatedDuration: row.estimated_duration_minutes
    }));
  } catch (error) {
    console.error(`Error getting exam route for ${examType}/${gender}:`, error);
    return [];
  }
}

/**
 * إنشاء مسار جديد لمراجع
 * @param {string} patientId - معرف المراجع
 * @param {string} examType - نوع الفحص
 * @param {string} gender - جنس المراجع
 * @returns {Promise<boolean>} نجح الإنشاء أم لا
 */
export async function createPatientRoute(patientId, examType, gender) {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');

    // حذف أي مسار سابق للمراجع (في حالة إعادة البدء)
    await client.query(`
      DELETE FROM patient_routes WHERE patient_id = $1
    `, [patientId]);

    // جلب قالب المسار
    const routeTemplate = await getExamRoute(examType, gender);
    
    if (routeTemplate.length === 0) {
      throw new Error(`No route template found for ${examType}/${gender}`);
    }

    // إنشاء خطوات المسار
    for (const step of routeTemplate) {
      await client.query(`
        INSERT INTO patient_routes(
          patient_id, exam_type, gender, step_order, clinic_id, status
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        patientId, examType, gender, 
        step.stepOrder, step.clinicId, 
        step.stepOrder === 1 ? 'active' : 'pending'
      ]);
    }

    await client.query('COMMIT');
    return true;

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Error creating patient route for ${patientId}:`, error);
    return false;
  } finally {
    client.release();
  }
}

/**
 * الانتقال للخطوة التالية في المسار
 * @param {string} patientId - معرف المراجع
 * @returns {Promise<Object|null>} معلومات الخطوة التالية أو null
 */
export async function moveToNextStep(patientId) {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');

    // جلب الخطوة النشطة الحالية
    const { rows: currentStep } = await client.query(`
      SELECT id, step_order, clinic_id, exam_type, gender
      FROM patient_routes
      WHERE patient_id = $1 AND status = 'active'
      ORDER BY step_order ASC
      LIMIT 1
    `, [patientId]);

    if (currentStep.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const current = currentStep[0];

    // تحديث الخطوة الحالية إلى مكتملة
    await client.query(`
      UPDATE patient_routes
      SET status = 'done', completed_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `, [current.id]);

    // البحث عن الخطوة التالية
    const { rows: nextStep } = await client.query(`
      SELECT id, step_order, clinic_id
      FROM patient_routes
      WHERE patient_id = $1 AND status = 'pending' AND step_order > $2
      ORDER BY step_order ASC
      LIMIT 1
    `, [patientId, current.step_order]);

    if (nextStep.length === 0) {
      // انتهى المسار
      await client.query(`
        SELECT create_notification(
          'route_complete',
          $1,
          NULL,
          '{}'::jsonb
        )
      `, [patientId]);

      await client.query('COMMIT');
      return { completed: true, message: 'تم إنهاء جميع الفحوصات المطلوبة' };
    }

    const next = nextStep[0];

    // تفعيل الخطوة التالية
    await client.query(`
      UPDATE patient_routes
      SET status = 'active', started_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `, [next.id]);

    // جلب معلومات العيادة التالية
    const { rows: clinicInfo } = await client.query(`
      SELECT name, floor FROM clinics WHERE id = $1
    `, [next.clinic_id]);

    await client.query('COMMIT');

    return {
      completed: false,
      nextStep: {
        stepOrder: next.step_order,
        clinicId: next.clinic_id,
        clinicName: clinicInfo[0]?.name,
        floor: clinicInfo[0]?.floor
      }
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Error moving to next step for patient ${patientId}:`, error);
    return null;
  } finally {
    client.release();
  }
}

/**
 * جلب حالة المسار الحالية للمراجع
 * @param {string} patientId - معرف المراجع
 * @returns {Promise<Object>} حالة المسار
 */
export async function getPatientRouteStatus(patientId) {
  try {
    const { rows } = await db.query(`
      SELECT 
        pr.step_order,
        pr.clinic_id,
        c.name as clinic_name,
        c.floor,
        pr.status,
        pr.started_at,
        pr.completed_at,
        pr.exam_type,
        pr.gender
      FROM patient_routes pr
      JOIN clinics c ON c.id = pr.clinic_id
      WHERE pr.patient_id = $1
      ORDER BY pr.step_order
    `, [patientId]);

    if (rows.length === 0) {
      return { exists: false, steps: [] };
    }

    const steps = rows.map(row => ({
      stepOrder: row.step_order,
      clinicId: row.clinic_id,
      clinicName: row.clinic_name,
      floor: row.floor,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at
    }));

    const activeStep = steps.find(s => s.status === 'active');
    const completedSteps = steps.filter(s => s.status === 'done').length;
    const totalSteps = steps.length;
    const progress = (completedSteps / totalSteps) * 100;

    return {
      exists: true,
      examType: rows[0].exam_type,
      gender: rows[0].gender,
      steps,
      activeStep,
      progress: Math.round(progress),
      completedSteps,
      totalSteps,
      isComplete: completedSteps === totalSteps
    };
  } catch (error) {
    console.error(`Error getting route status for patient ${patientId}:`, error);
    return { exists: false, steps: [], error: error.message };
  }
}

/**
 * جلب إحصائيات التوزيع لجميع العيادات
 * @returns {Promise<Array>} إحصائيات التوزيع
 */
export async function getDistributionStats() {
  try {
    const { rows } = await db.query(`
      SELECT 
        c.id,
        c.name,
        c.capacity,
        c.status,
        COALESCE(cl.current_called, 0) as current_called,
        COALESCE(cl.current_in, 0) as current_in,
        COALESCE(cl.distributed_today, 0) as distributed_today,
        COALESCE(cl.total_served_today, 0) as total_served_today,
        COALESCE(cl.efficiency_score, 1.0) as efficiency_score,
        cl.updated_at
      FROM clinics c
      LEFT JOIN clinic_load cl ON cl.clinic_id = c.id
      ORDER BY c.name
    `);

    return rows.map(row => ({
      clinicId: row.id,
      name: row.name,
      capacity: row.capacity,
      status: row.status,
      currentCalled: row.current_called,
      currentIn: row.current_in,
      currentTotal: row.current_called + row.current_in,
      distributedToday: row.distributed_today,
      totalServedToday: row.total_served_today,
      loadRatio: (row.current_called + row.current_in) / row.capacity,
      efficiencyScore: parseFloat(row.efficiency_score),
      lastUpdated: row.updated_at
    }));
  } catch (error) {
    console.error('Error getting distribution stats:', error);
    return [];
  }
}

export default {
  pickClinicForNextStep,
  markDistributed,
  getExamRoute,
  createPatientRoute,
  moveToNextStep,
  getPatientRouteStatus,
  getDistributionStats
};

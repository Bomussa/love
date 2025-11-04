// lib/workflow.js - مدير تدفق العمل الشامل للمراجعين
import db from './db.js';
import { createPatientRoute, moveToNextStep, pickClinicForNextStep, markDistributed } from './routingManager.js';
import { completeClinicForPatient } from './queueManager.js';
import { getSystemConfig } from './settings.js';

/**
 * إضافة مراجع جديد إلى النظام وبدء مساره
 * @param {Object} patientData - بيانات المراجع
 * @returns {Promise<Object>} نتيجة الإضافة
 */
export async function enqueuePatient(patientData) {
  const { patientId, examType, gender, priority = 0 } = patientData;
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');

    // التحقق من وجود المراجع في النظام اليوم
    const { rows: existingRows } = await client.query(`
      SELECT id FROM queue_status 
      WHERE patient_id = $1 AND DATE(created_at) = CURRENT_DATE
      LIMIT 1
    `, [patientId]);

    if (existingRows.length > 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        reason: 'already_exists',
        message: 'المراجع موجود بالفعل في النظام اليوم'
      };
    }

    // إنشاء مسار المراجع
    const routeCreated = await createPatientRoute(patientId, examType, gender);
    if (!routeCreated) {
      await client.query('ROLLBACK');
      return {
        success: false,
        reason: 'route_creation_failed',
        message: 'فشل في إنشاء مسار المراجع'
      };
    }

    // اختيار العيادة الأولى
    const firstClinicId = await pickClinicForNextStep(examType, gender, 1);
    if (!firstClinicId) {
      await client.query('ROLLBACK');
      return {
        success: false,
        reason: 'no_clinic_available',
        message: 'لا توجد عيادة متاحة للخطوة الأولى'
      };
    }

    // إضافة المراجع إلى كيو العيادة الأولى
    const queueResult = await enqueuePatientToClinic(patientId, firstClinicId, {
      examType,
      gender,
      priority
    });

    if (!queueResult.success) {
      await client.query('ROLLBACK');
      return queueResult;
    }

    await client.query('COMMIT');

    return {
      success: true,
      patientId,
      firstClinic: {
        id: firstClinicId,
        queueNumber: queueResult.queueNumber
      },
      message: 'تم إضافة المراجع بنجاح وبدء مساره'
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error enqueuing patient:', error);
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
 * إضافة مراجع إلى كيو عيادة معينة
 * @param {string} patientId - معرف المراجع
 * @param {number} clinicId - معرف العيادة
 * @param {Object} options - خيارات إضافية
 * @returns {Promise<Object>} نتيجة الإضافة
 */
export async function enqueuePatientToClinic(patientId, clinicId, options = {}) {
  const { examType = '', gender = '', priority = 0, notes = '' } = options;
  
  try {
    // جلب آخر رقم في الكيو
    const { rows: lastNumberRows } = await db.query(`
      SELECT COALESCE(MAX(number), 0) as last_number
      FROM queue_status 
      WHERE clinic_id = $1 AND DATE(created_at) = CURRENT_DATE
    `, [clinicId]);

    const nextNumber = (lastNumberRows[0]?.last_number || 0) + 1;

    // إضافة المراجع إلى الكيو
    const { rows: insertRows } = await db.query(`
      INSERT INTO queue_status(
        clinic_id, patient_id, number, status, 
        exam_type, gender, priority, notes
      ) VALUES ($1, $2, $3, 'waiting', $4, $5, $6, $7)
      RETURNING id
    `, [clinicId, patientId, nextNumber, examType, gender, priority, notes]);

    // تسجيل التوزيع
    await markDistributed(clinicId);

    return {
      success: true,
      queueId: insertRows[0].id,
      queueNumber: nextNumber,
      clinicId,
      status: 'waiting'
    };

  } catch (error) {
    console.error('Error enqueuing patient to clinic:', error);
    return {
      success: false,
      reason: 'database_error',
      message: 'فشل في إضافة المراجع للكيو',
      error: error.message
    };
  }
}

/**
 * إنهاء فحص المراجع والانتقال للعيادة التالية
 * @param {number} clinicId - معرف العيادة الحالية
 * @param {string} patientId - معرف المراجع
 * @returns {Promise<Object>} نتيجة الانتقال
 */
export async function routeToNextClinic(patientId, currentClinicId) {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');

    // إنهاء الفحص في العيادة الحالية
    const completed = await completeClinicForPatient(currentClinicId, patientId);
    if (!completed) {
      await client.query('ROLLBACK');
      return {
        success: false,
        reason: 'completion_failed',
        message: 'فشل في إنهاء الفحص في العيادة الحالية'
      };
    }

    // الانتقال للخطوة التالية في المسار
    const nextStepResult = await moveToNextStep(patientId);
    
    if (!nextStepResult) {
      await client.query('ROLLBACK');
      return {
        success: false,
        reason: 'routing_failed',
        message: 'فشل في تحديد الخطوة التالية'
      };
    }

    if (nextStepResult.completed) {
      // انتهى المسار
      await client.query('COMMIT');
      return {
        success: true,
        completed: true,
        message: nextStepResult.message
      };
    }

    // إضافة المراجع إلى كيو العيادة التالية
    const { rows: patientInfo } = await client.query(`
      SELECT exam_type, gender, priority 
      FROM patient_routes 
      WHERE patient_id = $1 
      LIMIT 1
    `, [patientId]);

    const info = patientInfo[0] || { exam_type: '', gender: '', priority: 0 };
    
    const queueResult = await enqueuePatientToClinic(
      patientId, 
      nextStepResult.nextStep.clinicId,
      {
        examType: info.exam_type,
        gender: info.gender,
        priority: info.priority
      }
    );

    if (!queueResult.success) {
      await client.query('ROLLBACK');
      return {
        success: false,
        reason: 'next_queue_failed',
        message: 'فشل في إضافة المراجع لكيو العيادة التالية'
      };
    }

    await client.query('COMMIT');

    return {
      success: true,
      completed: false,
      nextClinic: {
        ...nextStepResult.nextStep,
        queueNumber: queueResult.queueNumber
      },
      message: `تم توجيه المراجع إلى ${nextStepResult.nextStep.clinicName}`
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error routing to next clinic:', error);
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
 * معالجة رمز العيادة المدخل من المراجع
 * @param {string} clinicCode - رمز العيادة
 * @param {string} patientId - معرف المراجع
 * @returns {Promise<Object>} نتيجة المعالجة
 */
export async function processClinicCode(clinicCode, patientId) {
  try {
    // التحقق من صحة رمز العيادة
    const { rows: clinicRows } = await db.query(`
      SELECT id, name FROM clinics WHERE id = $1 AND status = 'open'
    `, [parseInt(clinicCode, 10)]);

    if (clinicRows.length === 0) {
      return {
        success: false,
        reason: 'invalid_code',
        message: 'رمز العيادة غير صحيح أو العيادة مغلقة'
      };
    }

    const clinic = clinicRows[0];

    // التحقق من وجود المراجع في كيو هذه العيادة
    const { rows: queueRows } = await db.query(`
      SELECT id, status, number 
      FROM queue_status 
      WHERE clinic_id = $1 AND patient_id = $2 AND status IN ('called', 'in')
      AND DATE(created_at) = CURRENT_DATE
      ORDER BY created_at DESC
      LIMIT 1
    `, [clinic.id, patientId]);

    if (queueRows.length === 0) {
      return {
        success: false,
        reason: 'not_in_queue',
        message: 'المراجع غير موجود في كيو هذه العيادة أو لم يتم استدعاؤه بعد'
      };
    }

    const queueEntry = queueRows[0];

    if (queueEntry.status === 'called') {
      // تسجيل وصول المراجع للعيادة
      const { checkInAtClinic } = await import('./queueManager.js');
      const checkedIn = await checkInAtClinic(clinic.id, patientId);
      
      if (checkedIn) {
        return {
          success: true,
          action: 'checked_in',
          clinic: {
            id: clinic.id,
            name: clinic.name
          },
          queueNumber: queueEntry.number,
          message: `تم تسجيل وصولك إلى ${clinic.name}. يرجى انتظار دورك.`
        };
      } else {
        return {
          success: false,
          reason: 'checkin_failed',
          message: 'فشل في تسجيل الوصول. يرجى المحاولة مرة أخرى.'
        };
      }
    } else if (queueEntry.status === 'in') {
      // إنهاء الفحص والانتقال للعيادة التالية
      const routingResult = await routeToNextClinic(patientId, clinic.id);
      
      if (routingResult.success) {
        return {
          success: true,
          action: routingResult.completed ? 'route_completed' : 'routed_to_next',
          clinic: {
            id: clinic.id,
            name: clinic.name
          },
          nextClinic: routingResult.nextClinic,
          message: routingResult.message
        };
      } else {
        return {
          success: false,
          reason: 'routing_failed',
          message: routingResult.message
        };
      }
    }

    return {
      success: false,
      reason: 'invalid_status',
      message: 'حالة المراجع في الكيو غير صحيحة'
    };

  } catch (error) {
    console.error('Error processing clinic code:', error);
    return {
      success: false,
      reason: 'database_error',
      message: 'خطأ في معالجة رمز العيادة',
      error: error.message
    };
  }
}

/**
 * جلب حالة المراجع الشاملة في النظام
 * @param {string} patientId - معرف المراجع
 * @returns {Promise<Object>} حالة المراجع الشاملة
 */
export async function getPatientStatus(patientId) {
  try {
    // جلب حالة المسار
    const { getPatientRouteStatus } = await import('./routingManager.js');
    const routeStatus = await getPatientRouteStatus(patientId);

    if (!routeStatus.exists) {
      return {
        exists: false,
        message: 'المراجع غير موجود في النظام'
      };
    }

    // جلب حالة الكيو الحالية
    const activeStep = routeStatus.activeStep;
    let currentQueue = null;
    
    if (activeStep) {
      const { rows: queueRows } = await db.query(`
        SELECT 
          id, number, status, called_at, expires_at, started_at,
          (SELECT COUNT(*) FROM queue_status 
           WHERE clinic_id = $1 AND status = 'waiting' AND number < $2
           AND DATE(created_at) = CURRENT_DATE) as position_in_queue
        FROM queue_status 
        WHERE clinic_id = $1 AND patient_id = $2 AND DATE(created_at) = CURRENT_DATE
        ORDER BY created_at DESC
        LIMIT 1
      `, [activeStep.clinicId, patientId]);

      if (queueRows.length > 0) {
        const queue = queueRows[0];
        currentQueue = {
          clinicId: activeStep.clinicId,
          clinicName: activeStep.clinicName,
          floor: activeStep.floor,
          number: queue.number,
          status: queue.status,
          positionInQueue: queue.position_in_queue,
          calledAt: queue.called_at,
          expiresAt: queue.expires_at,
          startedAt: queue.started_at
        };
      }
    }

    // جلب الإشعارات الحديثة
    const { rows: notificationRows } = await db.query(`
      SELECT 
        notification_type, title, message, title_ar, message_ar,
        created_at, is_read, priority
      FROM notifications_log 
      WHERE recipient_id = $1 AND created_at > NOW() - INTERVAL '1 day'
      ORDER BY created_at DESC
      LIMIT 5
    `, [patientId]);

    const notifications = notificationRows.map(n => ({
      type: n.notification_type,
      title: n.title_ar || n.title,
      message: n.message_ar || n.message,
      createdAt: n.created_at,
      isRead: n.is_read,
      priority: n.priority
    }));

    return {
      exists: true,
      patientId,
      examType: routeStatus.examType,
      gender: routeStatus.gender,
      progress: routeStatus.progress,
      completedSteps: routeStatus.completedSteps,
      totalSteps: routeStatus.totalSteps,
      isComplete: routeStatus.isComplete,
      currentQueue,
      allSteps: routeStatus.steps,
      notifications,
      lastUpdated: new Date().toISOString()
    };

  } catch (error) {
    console.error(`Error getting patient status for ${patientId}:`, error);
    return {
      exists: false,
      error: error.message,
      message: 'خطأ في جلب حالة المراجع'
    };
  }
}

/**
 * معالجة حالات الطوارئ
 * @param {string} patientId - معرف المراجع
 * @param {string} emergencyCode - رمز الطوارئ
 * @returns {Promise<Object>} نتيجة معالجة الطوارئ
 */
export async function handleEmergency(patientId, emergencyCode) {
  try {
    const config = await getSystemConfig();
    
    if (emergencyCode !== config.emergencyPin) {
      return {
        success: false,
        reason: 'invalid_emergency_code',
        message: 'رمز الطوارئ غير صحيح'
      };
    }

    // رفع أولوية المراجع في جميع الكيوهات
    await db.query(`
      UPDATE queue_status 
      SET priority = 3, updated_at = NOW()
      WHERE patient_id = $1 AND status IN ('waiting', 'called')
      AND DATE(created_at) = CURRENT_DATE
    `, [patientId]);

    // إنشاء إشعار طوارئ
    await db.query(`
      SELECT create_notification(
        'emergency_alert',
        $1,
        NULL,
        jsonb_build_object('emergency_code', $2)
      )
    `, [patientId, emergencyCode]);

    return {
      success: true,
      message: 'تم تفعيل حالة الطوارئ. سيتم إعطاء المراجع أولوية قصوى.'
    };

  } catch (error) {
    console.error('Error handling emergency:', error);
    return {
      success: false,
      reason: 'database_error',
      message: 'خطأ في معالجة حالة الطوارئ',
      error: error.message
    };
  }
}

export default {
  enqueuePatient,
  enqueuePatientToClinic,
  routeToNextClinic,
  processClinicCode,
  getPatientStatus,
  handleEmergency
};

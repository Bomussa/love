/**
 * RPC Functions Manager - مدير استدعاء الدوال من Supabase
 * يوفر واجهة موحدة وآمنة لاستدعاء جميع الدوال (RPC Functions)
 * مع معالجة الأخطاء والإعادة التلقائية والتسجيل
 */

import { supabase } from './supabase-client';

class RPCFunctionsManager {
  constructor() {
    this.callLog = [];
    this.functionStatus = new Map();
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
    };
  }

  /**
   * استدعاء دالة RPC مع معالجة الأخطاء والإعادة التلقائية
   */
  async callRPC(functionName, params = {}) {
    const startTime = Date.now();
    let lastError = null;

    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        console.log(`📞 استدعاء الدالة: ${functionName} (المحاولة ${attempt})`);

        const { data, error } = await supabase.rpc(functionName, params);

        if (error) {
          lastError = error;
          console.warn(`⚠️ خطأ في الدالة ${functionName}:`, error.message);

          // إذا كان الخطأ يتعلق بعدم وجود الدالة، لا نعيد المحاولة
          if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
            throw new Error(`الدالة '${functionName}' غير موجودة في قاعدة البيانات`);
          }

          // إعادة المحاولة مع تأخير متزايد
          if (attempt < this.retryConfig.maxRetries) {
            const delay = Math.min(
              this.retryConfig.baseDelay * Math.pow(2, attempt - 1),
              this.retryConfig.maxDelay
            );
            console.log(`⏳ إعادة المحاولة بعد ${delay}ms...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
        } else {
          const duration = Date.now() - startTime;
          console.log(`✅ نجحت الدالة ${functionName} في ${duration}ms`);
          this.logFunctionCall(functionName, params, data, null, duration);
          this.updateFunctionStatus(functionName, 'success');
          return { success: true, data };
        }
      } catch (error) {
        lastError = error;
        console.error(`❌ استثناء في الدالة ${functionName}:`, error.message);
      }
    }

    // فشل بعد جميع المحاولات
    const duration = Date.now() - startTime;
    this.logFunctionCall(functionName, params, null, lastError, duration);
    this.updateFunctionStatus(functionName, 'error', lastError.message);

    return {
      success: false,
      error: lastError.message || 'فشل استدعاء الدالة',
      functionName,
    };
  }

  /**
   * تسجيل استدعاء الدالة
   */
  logFunctionCall(functionName, params, result, error, duration) {
    const log = {
      functionName,
      params: this.sanitizeParams(params),
      result: this.sanitizeResult(result),
      error: error ? error.message : null,
      duration,
      timestamp: new Date().toISOString(),
      status: error ? 'error' : 'success',
    };

    this.callLog.push(log);

    // الاحتفاظ بآخر 500 سجل فقط
    if (this.callLog.length > 500) {
      this.callLog.shift();
    }
  }

  /**
   * تحديث حالة الدالة
   */
  updateFunctionStatus(functionName, status, errorMessage = null) {
    if (!this.functionStatus.has(functionName)) {
      this.functionStatus.set(functionName, {
        name: functionName,
        status: 'unknown',
        lastCalled: null,
        lastError: null,
        successCount: 0,
        errorCount: 0,
      });
    }

    const funcStatus = this.functionStatus.get(functionName);
    funcStatus.status = status;
    funcStatus.lastCalled = new Date().toISOString();

    if (status === 'success') {
      funcStatus.successCount++;
    } else {
      funcStatus.errorCount++;
      funcStatus.lastError = errorMessage;
    }
  }

  /**
   * تنظيف المعاملات الحساسة قبل التسجيل
   */
  sanitizeParams(params) {
    const sanitized = { ...params };
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'pin'];

    for (const key of sensitiveKeys) {
      if (key in sanitized) {
        sanitized[key] = '***REDACTED***';
      }
    }

    return sanitized;
  }

  /**
   * تنظيف النتائج الحساسة قبل التسجيل
   */
  sanitizeResult(result) {
    if (!result) return null;
    if (typeof result !== 'object') return result;

    const sanitized = { ...result };
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'pin'];

    for (const key of sensitiveKeys) {
      if (key in sanitized) {
        sanitized[key] = '***REDACTED***';
      }
    }

    return sanitized;
  }

  /**
   * الحصول على حالة جميع الدوال
   */
  getAllFunctionStatus() {
    const status = [];
    for (const [name, funcStatus] of this.functionStatus) {
      status.push(funcStatus);
    }
    return status;
  }

  /**
   * الحصول على سجل الاستدعاءات
   */
  getCallLog(limit = 50) {
    return this.callLog.slice(-limit);
  }

  /**
   * مسح السجلات
   */
  clearLogs() {
    this.callLog = [];
    this.functionStatus.clear();
  }
}

// إنشاء مثيل عام من المدير
export const rpcManager = new RPCFunctionsManager();

// ============================================================================
// دوال مساعدة لاستدعاء الدوال الشائعة
// ============================================================================

/**
 * التحقق من الرقم السري للعيادة
 */
export async function verifyClinicPin(clinicCode, pin) {
  return rpcManager.callRPC('verify_clinic_pin', {
    clinic_code: clinicCode,
    pin: pin,
  });
}

/**
 * بدء زيارة المريض
 */
export async function startPatientVisit(patientId, clinicId, examTypeId) {
  return rpcManager.callRPC('start_patient_visit', {
    patient_id: patientId,
    clinic_id: clinicId,
    exam_type_id: examTypeId,
  });
}

/**
 * تحديث آخر استخدام API
 */
export async function updateApiLastUsed(apiName) {
  return rpcManager.callRPC('update_api_last_used', {
    api_name: apiName,
  });
}

/**
 * تحديث حالة العملية
 */
export async function updateOperationProgress(operationId, progress, status) {
  return rpcManager.callRPC('update_operation_progress', {
    operation_id: operationId,
    progress: progress,
    status: status,
  });
}

/**
 * تعيين رقم العرض
 */
export async function setDisplayNumber(queueId, displayNumber) {
  return rpcManager.callRPC('set_display_number', {
    queue_id: queueId,
    display_number: displayNumber,
  });
}

/**
 * التحقق من الرقم السري الآمن
 */
export async function verifyClinicPinSecure(clinicCode, pinHash) {
  return rpcManager.callRPC('verify_clinic_pin_secure', {
    clinic_code: clinicCode,
    pin_hash: pinHash,
  });
}

/**
 * تحديث وقت آخر تحديث
 */
export async function updateTouchedAt(tableName, recordId) {
  return rpcManager.callRPC('touch_updated_at', {
    table_name: tableName,
    record_id: recordId,
  });
}

/**
 * اختيار الرسائل الميتة للمعالجة
 */
export async function selectDeadLettersForProcessing(limit = 100) {
  return rpcManager.callRPC('select_dead_letters_for_processing', {
    limit: limit,
  });
}

/**
 * الحصول على حالة الطابور
 */
export async function getQueueStatus(clinicId) {
  return rpcManager.callRPC('get_queue_status', {
    clinic_id: clinicId,
  });
}

/**
 * استدعاء المريض التالي
 */
export async function callNextPatient(clinicId) {
  return rpcManager.callRPC('call_next_patient', {
    clinic_id: clinicId,
  });
}

/**
 * إكمال زيارة المريض
 */
export async function completePatientVisit(visitId) {
  return rpcManager.callRPC('complete_patient_visit', {
    visit_id: visitId,
  });
}

/**
 * الحصول على الإحصائيات اليومية
 */
export async function getDailyStatistics(clinicId, date) {
  return rpcManager.callRPC('get_daily_statistics', {
    clinic_id: clinicId,
    date: date,
  });
}

export default rpcManager;

/**
 * نظام سلامة البيانات المتكامل
 * Data Integrity System (DIS)
 *
 * ✅ منع التكرار (Deduplication)
 * ✅ منع الازدواجية (Unique Constraints)
 * ✅ منع التعارض (Conflict Prevention)
 * ✅ ضمان اكتمال البيانات (Data Completeness)
 * ✅ منع الأخطاء (Error Prevention)
 * ✅ سد الثغرات (Security & Integrity)
 * ✅ عزل الخدمات (Service Isolation)
 */

// ============================================================================
// إعدادات سلامة البيانات
// ============================================================================
const INTEGRITY_CONFIG = {
  // قواعد التفرد لكل جدول
  uniqueConstraints: {
    queues: ['patient_id', 'clinic_id', 'status'], // مراجع واحد في عيادة واحدة بحالة نشطة
    clinics: ['name'],
    notifications: ['patient_id', 'title', 'sent_at'],
    pins: ['clinic_id', 'pin_code'],
    patient_routes: ['patient_id', 'exam_type'],
  },

  // الحقول المطلوبة لكل جدول
  requiredFields: {
    queues: ['patient_id', 'clinic_id', 'status'],
    clinics: ['name', 'status'],
    notifications: ['title', 'message', 'type'],
    pins: ['clinic_id', 'pin_code'],
    patient_routes: ['patient_id', 'exam_type'],
  },

  // قواعد التحقق من الصحة
  validationRules: {
    queues: {
      status: ['waiting', 'serving', 'completed', 'skipped', 'cancelled'],
      display_number: { type: 'number', min: 1 },
    },
    clinics: {
      status: ['active', 'inactive', 'closed'],
      order_index: { type: 'number', min: 0 },
    },
    notifications: {
      type: ['call', 'update', 'alert', 'info'],
    },
  },

  // حدود البيانات
  limits: {
    queues: { maxPerPatientPerClinic: 1, maxActivePerPatient: 10 },
    notifications: { maxPerPatient: 100 },
    pins: { maxPerClinic: 1 },
  },
};

// ============================================================================
// Deduplication Engine - محرك منع التكرار
// ============================================================================
class DeduplicationEngine {
  constructor() {
    this.hashCache = new Map();
    this.recentOperations = new Map();
  }

  /**
   * إنشاء hash للبيانات
   */
  generateHash(data, fields) {
    const values = fields.map((f) => data[f] || '').join('|');
    return this.simpleHash(values);
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash &= hash;
    }
    return hash.toString(36);
  }

  /**
   * التحقق من التكرار
   */
  isDuplicate(tableName, data, existingData = []) {
    const constraints = INTEGRITY_CONFIG.uniqueConstraints[tableName];
    if (!constraints || constraints.length === 0) return { isDuplicate: false };

    const newHash = this.generateHash(data, constraints);

    // التحقق من البيانات الموجودة
    for (const existing of existingData) {
      if (existing.id === data.id) continue; // تجاهل نفس السجل

      const existingHash = this.generateHash(existing, constraints);
      if (newHash === existingHash) {
        return {
          isDuplicate: true,
          existingRecord: existing,
          conflictFields: constraints,
        };
      }
    }

    return { isDuplicate: false };
  }

  /**
   * منع العمليات المتكررة (Idempotency)
   */
  isRecentOperation(operationKey, windowMs = 5000) {
    const lastTime = this.recentOperations.get(operationKey);
    const now = Date.now();

    if (lastTime && (now - lastTime) < windowMs) {
      return true;
    }

    this.recentOperations.set(operationKey, now);

    // تنظيف العمليات القديمة
    if (this.recentOperations.size > 1000) {
      const cutoff = now - windowMs;
      for (const [key, time] of this.recentOperations) {
        if (time < cutoff) {
          this.recentOperations.delete(key);
        }
      }
    }

    return false;
  }

  /**
   * إزالة التكرارات من مصفوفة
   */
  removeDuplicates(tableName, dataArray) {
    const constraints = INTEGRITY_CONFIG.uniqueConstraints[tableName];
    if (!constraints || constraints.length === 0) return dataArray;

    const seen = new Map();
    const unique = [];

    for (const item of dataArray) {
      const hash = this.generateHash(item, constraints);
      if (!seen.has(hash)) {
        seen.set(hash, true);
        unique.push(item);
      }
    }

    return unique;
  }
}

// ============================================================================
// Validation Engine - محرك التحقق من الصحة
// ============================================================================
class ValidationEngine {
  /**
   * التحقق من اكتمال البيانات
   */
  validateCompleteness(tableName, data) {
    const required = INTEGRITY_CONFIG.requiredFields[tableName];
    if (!required) return { valid: true };

    const missing = [];
    for (const field of required) {
      if (data[field] === undefined || data[field] === null || data[field] === '') {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      return {
        valid: false,
        error: `الحقول المطلوبة ناقصة: ${missing.join(', ')}`,
        missingFields: missing,
      };
    }

    return { valid: true };
  }

  /**
   * التحقق من صحة القيم
   */
  validateValues(tableName, data) {
    const rules = INTEGRITY_CONFIG.validationRules[tableName];
    if (!rules) return { valid: true };

    const errors = [];

    for (const [field, rule] of Object.entries(rules)) {
      const value = data[field];
      if (value === undefined || value === null) continue;

      // التحقق من القيم المسموحة
      if (Array.isArray(rule)) {
        if (!rule.includes(value)) {
          errors.push(`${field}: القيمة "${value}" غير مسموحة. القيم المسموحة: ${rule.join(', ')}`);
        }
      }
      // التحقق من النوع والحدود
      else if (typeof rule === 'object') {
        if (rule.type === 'number') {
          if (typeof value !== 'number') {
            errors.push(`${field}: يجب أن يكون رقماً`);
          } else {
            if (rule.min !== undefined && value < rule.min) {
              errors.push(`${field}: يجب أن يكون أكبر من أو يساوي ${rule.min}`);
            }
            if (rule.max !== undefined && value > rule.max) {
              errors.push(`${field}: يجب أن يكون أقل من أو يساوي ${rule.max}`);
            }
          }
        }
      }
    }

    if (errors.length > 0) {
      return {
        valid: false,
        error: errors.join('; '),
        errors,
      };
    }

    return { valid: true };
  }

  /**
   * التحقق من الحدود
   */
  async validateLimits(tableName, data, existingData = []) {
    const limits = INTEGRITY_CONFIG.limits[tableName];
    if (!limits) return { valid: true };

    // التحقق من حد المراجع في العيادة
    if (tableName === 'queues' && limits.maxPerPatientPerClinic) {
      const activeInClinic = existingData.filter((q) => q.patient_id === data.patient_id
        && q.clinic_id === data.clinic_id
        && ['waiting', 'serving'].includes(q.status)
        && q.id !== data.id);

      if (activeInClinic.length >= limits.maxPerPatientPerClinic) {
        return {
          valid: false,
          error: 'المراجع موجود بالفعل في هذه العيادة',
          existingRecord: activeInClinic[0],
        };
      }
    }

    return { valid: true };
  }

  /**
   * تنظيف البيانات
   */
  sanitize(data) {
    const sanitized = {};

    for (const [key, value] of Object.entries(data)) {
      // تجاهل الحقول الفارغة
      if (value === undefined || value === null) continue;

      // تنظيف النصوص
      if (typeof value === 'string') {
        sanitized[key] = value.trim();
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

// ============================================================================
// Conflict Resolver - محلل التعارضات
// ============================================================================
class ConflictResolver {
  /**
   * اكتشاف التعارضات
   */
  detectConflict(localData, serverData) {
    if (!localData || !serverData) return { hasConflict: false };

    const localTime = new Date(localData.updated_at || 0).getTime();
    const serverTime = new Date(serverData.updated_at || 0).getTime();

    // إذا كان كلاهما تم تعديله بعد آخر مزامنة
    if (localData.local_version && serverTime > localData.synced_at) {
      return {
        hasConflict: true,
        localTime,
        serverTime,
        localData,
        serverData,
      };
    }

    return { hasConflict: false };
  }

  /**
   * حل التعارض تلقائياً
   */
  resolve(conflict, strategy = 'latest-wins') {
    switch (strategy) {
      case 'latest-wins':
        return conflict.localTime > conflict.serverTime
          ? conflict.localData
          : conflict.serverData;

      case 'server-wins':
        return conflict.serverData;

      case 'client-wins':
        return conflict.localData;

      case 'merge':
        return this.mergeData(conflict.localData, conflict.serverData);

      default:
        return conflict.serverData;
    }
  }

  /**
   * دمج البيانات
   */
  mergeData(local, server) {
    const merged = { ...server };

    // الحقول التي يمكن دمجها
    const mergeableFields = ['metadata', 'notes', 'tags'];

    for (const field of mergeableFields) {
      if (local[field] && server[field]) {
        if (Array.isArray(local[field]) && Array.isArray(server[field])) {
          merged[field] = [...new Set([...server[field], ...local[field]])];
        } else if (typeof local[field] === 'object' && typeof server[field] === 'object') {
          merged[field] = { ...server[field], ...local[field] };
        }
      }
    }

    return merged;
  }
}

// ============================================================================
// Service Isolator - عازل الخدمات
// ============================================================================
class ServiceIsolator {
  constructor() {
    this.serviceStates = new Map();
    this.errorCounts = new Map();
  }

  /**
   * تسجيل حالة الخدمة
   */
  setServiceState(serviceName, state) {
    this.serviceStates.set(serviceName, {
      state,
      timestamp: Date.now(),
    });
  }

  /**
   * التحقق من صحة الخدمة
   */
  isServiceHealthy(serviceName) {
    const state = this.serviceStates.get(serviceName);
    return !state || state.state !== 'failed';
  }

  /**
   * تسجيل خطأ
   */
  recordError(serviceName) {
    const count = (this.errorCounts.get(serviceName) || 0) + 1;
    this.errorCounts.set(serviceName, count);

    // إذا تجاوز الحد، عزل الخدمة
    if (count >= 5) {
      this.setServiceState(serviceName, 'failed');
      console.warn(`⚠️ Service ${serviceName} isolated due to errors`);
    }
  }

  /**
   * إعادة تعيين الخدمة
   */
  resetService(serviceName) {
    this.errorCounts.delete(serviceName);
    this.serviceStates.delete(serviceName);
  }

  /**
   * تنفيذ معزول
   */
  async executeIsolated(serviceName, fn, fallback = null) {
    if (!this.isServiceHealthy(serviceName)) {
      console.warn(`⚠️ Service ${serviceName} is isolated, using fallback`);
      return fallback ? await fallback() : null;
    }

    try {
      const result = await fn();
      // نجاح - تقليل عداد الأخطاء
      const count = this.errorCounts.get(serviceName) || 0;
      if (count > 0) {
        this.errorCounts.set(serviceName, count - 1);
      }
      return result;
    } catch (error) {
      this.recordError(serviceName);
      throw error;
    }
  }
}

// ============================================================================
// Data Integrity System - النظام الرئيسي
// ============================================================================
class DataIntegritySystem {
  constructor() {
    this.dedup = new DeduplicationEngine();
    this.validator = new ValidationEngine();
    this.conflictResolver = new ConflictResolver();
    this.isolator = new ServiceIsolator();
    this.operationLocks = new Map();
  }

  /**
   * التحقق الشامل قبل الحفظ
   */
  async validateBeforeSave(tableName, data, existingData = []) {
    const errors = [];

    // 1. تنظيف البيانات
    const sanitizedData = this.validator.sanitize(data);

    // 2. التحقق من الاكتمال
    const completeness = this.validator.validateCompleteness(tableName, sanitizedData);
    if (!completeness.valid) {
      errors.push(completeness.error);
    }

    // 3. التحقق من صحة القيم
    const values = this.validator.validateValues(tableName, sanitizedData);
    if (!values.valid) {
      errors.push(values.error);
    }

    // 4. التحقق من التكرار
    const duplicate = this.dedup.isDuplicate(tableName, sanitizedData, existingData);
    if (duplicate.isDuplicate) {
      errors.push(`البيانات مكررة. السجل الموجود: ${duplicate.existingRecord?.id}`);
    }

    // 5. التحقق من الحدود
    const limits = await this.validator.validateLimits(tableName, sanitizedData, existingData);
    if (!limits.valid) {
      errors.push(limits.error);
    }

    if (errors.length > 0) {
      return {
        valid: false,
        errors,
        data: sanitizedData,
      };
    }

    return {
      valid: true,
      data: sanitizedData,
    };
  }

  /**
   * منع العمليات المتزامنة على نفس السجل
   */
  async withLock(lockKey, fn) {
    // انتظار إذا كان هناك قفل
    while (this.operationLocks.has(lockKey)) {
      await new Promise((r) => setTimeout(r, 50));
    }

    this.operationLocks.set(lockKey, Date.now());

    try {
      return await fn();
    } finally {
      this.operationLocks.delete(lockKey);
    }
  }

  /**
   * حفظ آمن مع جميع الفحوصات
   */
  async safeSave(tableName, data, existingData = [], saveFn) {
    const lockKey = `${tableName}_${data.id || 'new'}`;

    return this.withLock(lockKey, async () => {
      // التحقق من العملية المكررة
      const opKey = `${tableName}_${JSON.stringify(data)}`;
      if (this.dedup.isRecentOperation(opKey)) {
        console.warn('⚠️ Duplicate operation prevented');
        return { success: false, error: 'عملية مكررة', duplicate: true };
      }

      // التحقق الشامل
      const validation = await this.validateBeforeSave(tableName, data, existingData);
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors,
          data: validation.data,
        };
      }

      // تنفيذ الحفظ بشكل معزول
      return this.isolator.executeIsolated(
        tableName,
        () => saveFn(validation.data),
        () => ({ success: false, error: 'الخدمة غير متاحة مؤقتاً' }),
      );
    });
  }

  /**
   * قراءة آمنة مع إزالة التكرارات
   */
  async safeRead(tableName, readFn) {
    return this.isolator.executeIsolated(
      tableName,
      async () => {
        const result = await readFn();
        if (result.data && Array.isArray(result.data)) {
          result.data = this.dedup.removeDuplicates(tableName, result.data);
        }
        return result;
      },
      () => ({ data: [], error: 'الخدمة غير متاحة' }),
    );
  }

  /**
   * مزامنة آمنة مع حل التعارضات
   */
  async safeSync(tableName, localData, serverData) {
    const conflict = this.conflictResolver.detectConflict(localData, serverData);

    if (conflict.hasConflict) {
      console.log(`🔄 Conflict detected in ${tableName}`);
      return this.conflictResolver.resolve(conflict, 'latest-wins');
    }

    return serverData || localData;
  }

  /**
   * الحصول على حالة النظام
   */
  getStatus() {
    return {
      activeLocks: this.operationLocks.size,
      services: Object.fromEntries(this.isolator.serviceStates),
      errorCounts: Object.fromEntries(this.isolator.errorCounts),
    };
  }

  /**
   * إعادة تعيين خدمة
   */
  resetService(serviceName) {
    this.isolator.resetService(serviceName);
  }

  /**
   * إعادة تعيين الكل
   */
  resetAll() {
    this.operationLocks.clear();
    this.dedup.recentOperations.clear();
    for (const service of this.isolator.serviceStates.keys()) {
      this.isolator.resetService(service);
    }
  }
}

// ============================================================================
// إنشاء المثيل الرئيسي
// ============================================================================
export const DIS = new DataIntegritySystem();

// ============================================================================
// دوال الوصول السريع
// ============================================================================

export async function validateData(tableName, data, existingData = []) {
  return DIS.validateBeforeSave(tableName, data, existingData);
}

export async function safeSave(tableName, data, existingData, saveFn) {
  return DIS.safeSave(tableName, data, existingData, saveFn);
}

export async function safeRead(tableName, readFn) {
  return DIS.safeRead(tableName, readFn);
}

export async function safeSync(tableName, localData, serverData) {
  return DIS.safeSync(tableName, localData, serverData);
}

export function getIntegrityStatus() {
  return DIS.getStatus();
}

export function resetIntegrityService(serviceName) {
  DIS.resetService(serviceName);
}

export default DIS;

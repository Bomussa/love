/**
 * نظام مرونة الخدمات الاحترافي
 * Service Resilience System (SRS)
 *
 * حلول احترافية عالمية للتعامل مع فشل الخدمات
 * مستوحى من: Netflix Hystrix, AWS, Google Cloud
 *
 * ✅ Circuit Breaker - قاطع الدائرة
 * ✅ Retry with Exponential Backoff - إعادة المحاولة
 * ✅ Fallback Strategies - استراتيجيات بديلة
 * ✅ Graceful Degradation - التدهور اللطيف
 * ✅ Health Checks - فحص الصحة
 * ✅ Offline Support - دعم عدم الاتصال
 * ✅ Request Queue - طابور الطلبات
 * ✅ Bulkhead Pattern - عزل الخدمات
 */

// ============================================================================
// إعدادات النظام
// ============================================================================
const CONFIG = {
  // Circuit Breaker
  circuitBreaker: {
    failureThreshold: 5, // عدد الفشل قبل فتح الدائرة
    successThreshold: 3, // عدد النجاح لإغلاق الدائرة
    timeout: 30000, // مهلة الدائرة المفتوحة (30 ثانية)
    halfOpenRequests: 3, // عدد الطلبات في حالة نصف مفتوح
  },

  // Retry
  retry: {
    maxAttempts: 5, // الحد الأقصى للمحاولات
    baseDelay: 1000, // التأخير الأساسي (1 ثانية)
    maxDelay: 30000, // الحد الأقصى للتأخير (30 ثانية)
    backoffMultiplier: 2, // مضاعف التأخير
  },

  // Health Check
  healthCheck: {
    interval: 30000, // فترة الفحص (30 ثانية)
    timeout: 5000, // مهلة الفحص (5 ثواني)
  },

  // Offline Queue
  offlineQueue: {
    maxSize: 100, // الحد الأقصى للطابور
    retryInterval: 5000, // فترة إعادة المحاولة (5 ثواني)
  },
};

// ============================================================================
// Circuit Breaker - قاطع الدائرة
// ============================================================================
class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.options = { ...CONFIG.circuitBreaker, ...options };
    this.halfOpenRequests = 0;
  }

  async execute(fn, fallback = null) {
    // التحقق من حالة الدائرة
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
        this.halfOpenRequests = 0;
        console.log(`🔄 [${this.name}] Circuit HALF_OPEN - محاولة إعادة الاتصال`);
      } else {
        console.warn(`⚡ [${this.name}] Circuit OPEN - استخدام البديل`);
        return this.executeFallback(fallback);
      }
    }

    if (this.state === 'HALF_OPEN' && this.halfOpenRequests >= this.options.halfOpenRequests) {
      return this.executeFallback(fallback);
    }

    try {
      if (this.state === 'HALF_OPEN') {
        this.halfOpenRequests++;
      }

      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      console.error(`❌ [${this.name}] Error:`, error.message);
      return this.executeFallback(fallback, error);
    }
  }

  onSuccess() {
    this.failureCount = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.options.successThreshold) {
        this.state = 'CLOSED';
        this.successCount = 0;
        console.log(`✅ [${this.name}] Circuit CLOSED - الاتصال مستعاد`);
      }
    }
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.successCount = 0;

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      console.warn(`🔴 [${this.name}] Circuit OPEN - فشل في HALF_OPEN`);
    } else if (this.failureCount >= this.options.failureThreshold) {
      this.state = 'OPEN';
      console.warn(`🔴 [${this.name}] Circuit OPEN - تجاوز حد الفشل`);
    }
  }

  shouldAttemptReset() {
    return Date.now() - this.lastFailureTime >= this.options.timeout;
  }

  async executeFallback(fallback, error = null) {
    if (typeof fallback === 'function') {
      return await fallback(error);
    }
    if (fallback !== null) {
      return fallback;
    }
    throw error || new Error(`Service ${this.name} unavailable`);
  }

  getState() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }
}

// ============================================================================
// Retry Handler - معالج إعادة المحاولة
// ============================================================================
class RetryHandler {
  constructor(options = {}) {
    this.options = { ...CONFIG.retry, ...options };
  }

  async execute(fn, options = {}) {
    const maxAttempts = options.maxAttempts || this.options.maxAttempts;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt < maxAttempts) {
          const delay = this.calculateDelay(attempt);
          console.warn(`⚠️ Attempt ${attempt}/${maxAttempts} failed. Retrying in ${delay}ms...`);
          await this.delay(delay);
        }
      }
    }

    throw lastError;
  }

  calculateDelay(attempt) {
    const delay = this.options.baseDelay * this.options.backoffMultiplier ** (attempt - 1);
    // إضافة jitter لتجنب thundering herd
    const jitter = Math.random() * 0.3 * delay;
    return Math.min(delay + jitter, this.options.maxDelay);
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Health Monitor - مراقب الصحة
// ============================================================================
class HealthMonitor {
  constructor() {
    this.services = new Map();
    this.listeners = new Set();
    this.checkInterval = null;
  }

  registerService(name, healthCheckFn) {
    this.services.set(name, {
      name,
      healthCheckFn,
      status: 'unknown',
      lastCheck: null,
      consecutiveFailures: 0,
    });
  }

  async checkHealth(serviceName) {
    const service = this.services.get(serviceName);
    if (!service) return null;

    try {
      const startTime = Date.now();
      await Promise.race([
        service.healthCheckFn(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Health check timeout')), CONFIG.healthCheck.timeout)),
      ]);

      const responseTime = Date.now() - startTime;
      service.status = 'healthy';
      service.lastCheck = new Date();
      service.consecutiveFailures = 0;
      service.responseTime = responseTime;

      return { healthy: true, responseTime };
    } catch (error) {
      service.status = 'unhealthy';
      service.lastCheck = new Date();
      service.consecutiveFailures++;
      service.lastError = error.message;

      return { healthy: false, error: error.message };
    }
  }

  async checkAllServices() {
    const results = {};
    for (const [name] of this.services) {
      results[name] = await this.checkHealth(name);
    }
    this.notifyListeners(results);
    return results;
  }

  startMonitoring() {
    if (this.checkInterval) return;

    this.checkInterval = setInterval(() => {
      this.checkAllServices();
    }, CONFIG.healthCheck.interval);

    // فحص فوري
    this.checkAllServices();
  }

  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyListeners(results) {
    for (const listener of this.listeners) {
      try {
        listener(results);
      } catch (e) {
        console.error('Health listener error:', e);
      }
    }
  }

  getStatus() {
    const status = {};
    for (const [name, service] of this.services) {
      status[name] = {
        status: service.status,
        lastCheck: service.lastCheck,
        consecutiveFailures: service.consecutiveFailures,
        responseTime: service.responseTime,
        lastError: service.lastError,
      };
    }
    return status;
  }
}

// ============================================================================
// Offline Queue - طابور عدم الاتصال
// ============================================================================
class OfflineQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.isOnline = navigator.onLine;

    // مراقبة حالة الاتصال
    window.addEventListener('online', () => this.onOnline());
    window.addEventListener('offline', () => this.onOffline());

    // استعادة الطابور من localStorage
    this.loadQueue();
  }

  onOnline() {
    this.isOnline = true;
    console.log('🌐 Online - معالجة الطابور المعلق');
    this.processQueue();
  }

  onOffline() {
    this.isOnline = false;
    console.log('📴 Offline - حفظ الطلبات في الطابور');
  }

  async add(request) {
    if (this.queue.length >= CONFIG.offlineQueue.maxSize) {
      // إزالة أقدم طلب
      this.queue.shift();
    }

    this.queue.push({
      id: Date.now() + Math.random(),
      request,
      timestamp: new Date().toISOString(),
      attempts: 0,
    });

    this.saveQueue();

    if (this.isOnline) {
      this.processQueue();
    }

    return { queued: true, queueSize: this.queue.length };
  }

  async processQueue() {
    if (this.processing || !this.isOnline || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0 && this.isOnline) {
      const item = this.queue[0];

      try {
        await item.request.execute();
        this.queue.shift();
        this.saveQueue();
        console.log(`✅ Processed queued request: ${item.id}`);
      } catch (error) {
        item.attempts++;
        if (item.attempts >= 3) {
          this.queue.shift();
          console.error(`❌ Failed after 3 attempts: ${item.id}`);
        } else {
          // الانتظار قبل المحاولة التالية
          await new Promise((r) => setTimeout(r, CONFIG.offlineQueue.retryInterval));
        }
      }
    }

    this.processing = false;
  }

  saveQueue() {
    try {
      // حفظ فقط البيانات القابلة للتسلسل
      const serializable = this.queue.map((item) => ({
        id: item.id,
        timestamp: item.timestamp,
        attempts: item.attempts,
        requestData: item.request.data || null,
      }));
      localStorage.setItem('offline_queue', JSON.stringify(serializable));
    } catch (e) {
      console.warn('Failed to save offline queue:', e);
    }
  }

  loadQueue() {
    try {
      const saved = localStorage.getItem('offline_queue');
      if (saved) {
        // لا نستعيد الطلبات القديمة لأنها قد تكون غير صالحة
        localStorage.removeItem('offline_queue');
      }
    } catch (e) {
      console.warn('Failed to load offline queue:', e);
    }
  }

  getQueueSize() {
    return this.queue.length;
  }

  clearQueue() {
    this.queue = [];
    this.saveQueue();
  }
}

// ============================================================================
// Bulkhead - عزل الخدمات
// ============================================================================
class Bulkhead {
  constructor(name, maxConcurrent = 10) {
    this.name = name;
    this.maxConcurrent = maxConcurrent;
    this.currentCount = 0;
    this.queue = [];
  }

  async execute(fn) {
    if (this.currentCount >= this.maxConcurrent) {
      // إضافة للطابور
      return new Promise((resolve, reject) => {
        this.queue.push({ fn, resolve, reject });
      });
    }

    return this.run(fn);
  }

  async run(fn) {
    this.currentCount++;

    try {
      return await fn();
    } finally {
      this.currentCount--;
      this.processQueue();
    }
  }

  processQueue() {
    if (this.queue.length > 0 && this.currentCount < this.maxConcurrent) {
      const { fn, resolve, reject } = this.queue.shift();
      this.run(fn).then(resolve).catch(reject);
    }
  }

  getStats() {
    return {
      name: this.name,
      current: this.currentCount,
      max: this.maxConcurrent,
      queued: this.queue.length,
    };
  }
}

// ============================================================================
// Fallback Manager - مدير البدائل
// ============================================================================
class FallbackManager {
  constructor() {
    this.fallbacks = new Map();
    this.cache = new Map();
  }

  registerFallback(serviceName, fallbackFn) {
    this.fallbacks.set(serviceName, fallbackFn);
  }

  async getFallback(serviceName, context = {}) {
    // 1. محاولة استخدام الكاش
    const cached = this.cache.get(serviceName);
    if (cached && Date.now() - cached.timestamp < 60000) {
      console.log(`📦 [${serviceName}] Using cached fallback`);
      return cached.data;
    }

    // 2. محاولة استخدام الدالة البديلة
    const fallbackFn = this.fallbacks.get(serviceName);
    if (fallbackFn) {
      try {
        const result = await fallbackFn(context);
        return result;
      } catch (e) {
        console.warn(`⚠️ [${serviceName}] Fallback function failed:`, e);
      }
    }

    // 3. إرجاع قيمة افتراضية
    return this.getDefaultFallback(serviceName);
  }

  getDefaultFallback(serviceName) {
    const defaults = {
      queues: [],
      clinics: [],
      notifications: [],
      statistics: { total: 0, waiting: 0, completed: 0 },
    };
    return defaults[serviceName] || null;
  }

  updateCache(serviceName, data) {
    this.cache.set(serviceName, {
      data,
      timestamp: Date.now(),
    });
  }

  clearCache(serviceName = null) {
    if (serviceName) {
      this.cache.delete(serviceName);
    } else {
      this.cache.clear();
    }
  }
}

// ============================================================================
// Service Resilience Manager - المدير الرئيسي
// ============================================================================
class ServiceResilienceManager {
  constructor() {
    this.circuitBreakers = new Map();
    this.retryHandler = new RetryHandler();
    this.healthMonitor = new HealthMonitor();
    this.offlineQueue = new OfflineQueue();
    this.bulkheads = new Map();
    this.fallbackManager = new FallbackManager();
    this.isInitialized = false;
  }

  initialize() {
    if (this.isInitialized) return;

    // بدء مراقبة الصحة
    this.healthMonitor.startMonitoring();

    this.isInitialized = true;
    console.log('🛡️ Service Resilience Manager initialized');
  }

  /**
   * تنفيذ طلب مع جميع طبقات الحماية
   */
  async executeWithResilience(serviceName, fn, options = {}) {
    // الحصول على أو إنشاء Circuit Breaker
    if (!this.circuitBreakers.has(serviceName)) {
      this.circuitBreakers.set(serviceName, new CircuitBreaker(serviceName));
    }
    const circuitBreaker = this.circuitBreakers.get(serviceName);

    // الحصول على أو إنشاء Bulkhead
    if (!this.bulkheads.has(serviceName)) {
      this.bulkheads.set(serviceName, new Bulkhead(serviceName));
    }
    const bulkhead = this.bulkheads.get(serviceName);

    // تحديد الدالة البديلة
    const fallback = options.fallback || (() => this.fallbackManager.getFallback(serviceName));

    // تنفيذ مع جميع طبقات الحماية
    return circuitBreaker.execute(
      () => bulkhead.execute(
        () => this.retryHandler.execute(fn, options),
      ),
      fallback,
    );
  }

  /**
   * تسجيل خدمة للمراقبة
   */
  registerService(name, healthCheckFn, fallbackFn = null) {
    this.healthMonitor.registerService(name, healthCheckFn);

    if (fallbackFn) {
      this.fallbackManager.registerFallback(name, fallbackFn);
    }
  }

  /**
   * الحصول على حالة النظام
   */
  getSystemStatus() {
    const circuitBreakerStatus = {};
    for (const [name, cb] of this.circuitBreakers) {
      circuitBreakerStatus[name] = cb.getState();
    }

    const bulkheadStatus = {};
    for (const [name, bh] of this.bulkheads) {
      bulkheadStatus[name] = bh.getStats();
    }

    return {
      initialized: this.isInitialized,
      online: navigator.onLine,
      circuitBreakers: circuitBreakerStatus,
      bulkheads: bulkheadStatus,
      health: this.healthMonitor.getStatus(),
      offlineQueueSize: this.offlineQueue.getQueueSize(),
    };
  }

  /**
   * إعادة تعيين Circuit Breaker
   */
  resetCircuitBreaker(serviceName) {
    const cb = this.circuitBreakers.get(serviceName);
    if (cb) {
      cb.reset();
      console.log(`🔄 [${serviceName}] Circuit breaker reset`);
    }
  }

  /**
   * إعادة تعيين جميع Circuit Breakers
   */
  resetAllCircuitBreakers() {
    for (const [name, cb] of this.circuitBreakers) {
      cb.reset();
    }
    console.log('🔄 All circuit breakers reset');
  }

  /**
   * إضافة مستمع لتغييرات الصحة
   */
  onHealthChange(callback) {
    return this.healthMonitor.addListener(callback);
  }

  /**
   * إيقاف النظام
   */
  shutdown() {
    this.healthMonitor.stopMonitoring();
    this.isInitialized = false;
    console.log('🛑 Service Resilience Manager shutdown');
  }
}

// ============================================================================
// إنشاء المثيل الرئيسي
// ============================================================================
export const SRM = new ServiceResilienceManager();

// تهيئة تلقائية
if (typeof window !== 'undefined') {
  SRM.initialize();
}

// ============================================================================
// دوال الوصول السريع
// ============================================================================

/**
 * تنفيذ طلب مع حماية كاملة
 */
export async function resilientFetch(serviceName, fn, options = {}) {
  return SRM.executeWithResilience(serviceName, fn, options);
}

/**
 * تسجيل خدمة
 */
export function registerService(name, healthCheckFn, fallbackFn = null) {
  SRM.registerService(name, healthCheckFn, fallbackFn);
}

/**
 * الحصول على حالة النظام
 */
export function getResilienceStatus() {
  return SRM.getSystemStatus();
}

/**
 * إعادة تعيين Circuit Breaker
 */
export function resetService(serviceName) {
  SRM.resetCircuitBreaker(serviceName);
}

/**
 * مراقبة تغييرات الصحة
 */
export function onHealthChange(callback) {
  return SRM.onHealthChange(callback);
}

export default SRM;

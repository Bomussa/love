/**
 * نظام الاتصال الدائم والمستمر بقاعدة البيانات
 * Persistent Database Connection System
 *
 * المميزات:
 * ✅ اتصال دائم بدون انقطاع
 * ✅ إعادة المحاولة التلقائية مع Exponential Backoff
 * ✅ كل خدمة لها اتصالها الخاص
 * ✅ مراقبة مستمرة للاتصال
 * ✅ تحديث لحظي للبيانات
 * ✅ معالجة جميع أنواع الأخطاء
 */

import { createClient } from '@supabase/supabase-js';

// إعدادات Supabase
const SUPABASE_URL = 'https://rujwuruuosffcxazymit.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1and1cnV1b3NmZmN4YXp5bWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzODcyNjUsImV4cCI6MjA3Njk2MzI2NX0.HnrSwc7OZTqZRzCwzBH8hqtgtHMBix4yxy0RKvRDX10';

// إعدادات إعادة المحاولة المتقدمة
const RETRY_CONFIG = {
  maxRetries: 10, // عدد محاولات إعادة الاتصال
  baseDelay: 500, // التأخير الأساسي (نصف ثانية)
  maxDelay: 60000, // الحد الأقصى للتأخير (دقيقة)
  jitterFactor: 0.3, // عامل التشويش لتجنب thundering herd
  healthCheckInterval: 15000, // فحص الصحة كل 15 ثانية
  reconnectOnError: true, // إعادة الاتصال عند أي خطأ
};

// أنواع الخدمات
export const ServiceTypes = {
  QUEUES: 'queues',
  CLINICS: 'clinics',
  PATIENTS: 'patients',
  NOTIFICATIONS: 'notifications',
  ROUTES: 'routes',
  STATS: 'stats',
  ADMIN: 'admin',
};

// حالات الاتصال
export const ConnectionStates = {
  CONNECTED: 'connected',
  CONNECTING: 'connecting',
  RECONNECTING: 'reconnecting',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
};

/**
 * مدير الاتصال لخدمة واحدة
 */
class ServiceConnectionManager {
  constructor(serviceName) {
    this.serviceName = serviceName;
    this.state = ConnectionStates.DISCONNECTED;
    this.retryCount = 0;
    this.lastError = null;
    this.lastSuccessTime = null;
    this.listeners = new Set();
    this.healthCheckTimer = null;
    this.isMonitoring = false;

    // إنشاء عميل Supabase خاص بهذه الخدمة
    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
      global: {
        headers: {
          'x-client-info': `mmc-service-${serviceName}`,
        },
      },
    });
  }

  /**
   * حساب التأخير مع Exponential Backoff و Jitter
   */
  calculateDelay(attempt) {
    const exponentialDelay = Math.min(
      RETRY_CONFIG.baseDelay * 2 ** attempt,
      RETRY_CONFIG.maxDelay,
    );
    // إضافة jitter لتجنب thundering herd
    const jitter = exponentialDelay * RETRY_CONFIG.jitterFactor * Math.random();
    return Math.floor(exponentialDelay + jitter);
  }

  /**
   * تحديث حالة الاتصال وإشعار المستمعين
   */
  updateState(newState, error = null) {
    const oldState = this.state;
    this.state = newState;
    this.lastError = error;

    if (newState === ConnectionStates.CONNECTED) {
      this.lastSuccessTime = new Date();
      this.retryCount = 0;
    }

    // إشعار جميع المستمعين
    this.listeners.forEach((listener) => {
      try {
        listener({
          service: this.serviceName,
          oldState,
          newState,
          error,
          retryCount: this.retryCount,
          lastSuccessTime: this.lastSuccessTime,
        });
      } catch (e) {
        console.error(`[${this.serviceName}] Error in listener:`, e);
      }
    });
  }

  /**
   * إضافة مستمع لتغييرات حالة الاتصال
   */
  addStateListener(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * تنفيذ استعلام مع إعادة المحاولة التلقائية
   */
  async executeWithRetry(queryFn, options = {}) {
    const maxRetries = options.maxRetries || RETRY_CONFIG.maxRetries;
    const tableName = options.tableName || 'unknown';

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // تحديث الحالة
        if (attempt > 0) {
          this.updateState(ConnectionStates.RECONNECTING);
        } else if (this.state !== ConnectionStates.CONNECTED) {
          this.updateState(ConnectionStates.CONNECTING);
        }

        // تنفيذ الاستعلام
        const result = await queryFn(this.client);

        // التحقق من الخطأ في النتيجة
        if (result.error) {
          throw result.error;
        }

        // نجاح!
        this.updateState(ConnectionStates.CONNECTED);

        if (attempt > 0) {
          console.log(`✅ [${this.serviceName}] نجحت المحاولة ${attempt + 1} للجدول ${tableName}`);
        }

        return result;
      } catch (error) {
        this.retryCount = attempt + 1;
        const delay = this.calculateDelay(attempt);

        console.warn(
          `⚠️ [${this.serviceName}] محاولة ${attempt + 1}/${maxRetries + 1} فشلت للجدول ${tableName}:`,
          error.message,
          `| إعادة المحاولة بعد ${delay}ms`,
        );

        // إذا كانت آخر محاولة
        if (attempt === maxRetries) {
          this.updateState(ConnectionStates.ERROR, error);
          console.error(`❌ [${this.serviceName}] فشل نهائي بعد ${maxRetries + 1} محاولات`);

          // لا نرمي الخطأ - نعيد نتيجة فارغة مع علامة الخطأ
          return {
            data: null,
            error,
            _connectionFailed: true,
            _service: this.serviceName,
            _retryCount: this.retryCount,
          };
        }

        // انتظار قبل إعادة المحاولة
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * فحص صحة الاتصال
   */
  async healthCheck() {
    try {
      const { data, error } = await this.client
        .from('clinics')
        .select('id')
        .limit(1);

      if (error) throw error;

      this.updateState(ConnectionStates.CONNECTED);
      return { healthy: true, service: this.serviceName };
    } catch (error) {
      this.updateState(ConnectionStates.ERROR, error);
      return { healthy: false, service: this.serviceName, error: error.message };
    }
  }

  /**
   * بدء مراقبة الاتصال
   */
  startMonitoring() {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.healthCheckTimer = setInterval(async () => {
      if (document.hidden) return; // لا تفحص إذا كانت الصفحة مخفية

      const health = await this.healthCheck();
      if (!health.healthy && RETRY_CONFIG.reconnectOnError) {
        console.log(`🔄 [${this.serviceName}] جاري إعادة الاتصال...`);
        await this.reconnect();
      }
    }, RETRY_CONFIG.healthCheckInterval);

    console.log(`🔍 [${this.serviceName}] بدء مراقبة الاتصال`);
  }

  /**
   * إيقاف مراقبة الاتصال
   */
  stopMonitoring() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    this.isMonitoring = false;
    console.log(`⏹️ [${this.serviceName}] إيقاف مراقبة الاتصال`);
  }

  /**
   * إعادة الاتصال
   */
  async reconnect() {
    this.updateState(ConnectionStates.RECONNECTING);
    return this.healthCheck();
  }

  /**
   * الحصول على حالة الاتصال
   */
  getStatus() {
    return {
      service: this.serviceName,
      state: this.state,
      retryCount: this.retryCount,
      lastError: this.lastError?.message || null,
      lastSuccessTime: this.lastSuccessTime,
      isMonitoring: this.isMonitoring,
    };
  }
}

/**
 * مدير الاتصالات المركزي
 */
class PersistentConnectionManager {
  constructor() {
    this.services = new Map();
    this.globalListeners = new Set();
    this.initialized = false;
  }

  /**
   * الحصول على مدير اتصال لخدمة معينة
   */
  getService(serviceName) {
    if (!this.services.has(serviceName)) {
      const manager = new ServiceConnectionManager(serviceName);
      this.services.set(serviceName, manager);

      // إضافة مستمع عام
      manager.addStateListener((event) => {
        this.globalListeners.forEach((listener) => {
          try {
            listener(event);
          } catch (e) {
            console.error('Error in global listener:', e);
          }
        });
      });
    }
    return this.services.get(serviceName);
  }

  /**
   * تهيئة جميع الخدمات
   */
  async initialize() {
    if (this.initialized) return;

    console.log('🚀 تهيئة نظام الاتصال الدائم...');

    // إنشاء مديري اتصال لجميع الخدمات
    Object.values(ServiceTypes).forEach((serviceName) => {
      const manager = this.getService(serviceName);
      manager.startMonitoring();
    });

    // فحص صحة جميع الخدمات
    const healthResults = await this.checkAllHealth();
    console.log('📊 نتائج فحص الصحة:', healthResults);

    this.initialized = true;
    return healthResults;
  }

  /**
   * فحص صحة جميع الخدمات
   */
  async checkAllHealth() {
    const results = {};
    for (const [name, manager] of this.services) {
      results[name] = await manager.healthCheck();
    }
    return results;
  }

  /**
   * إضافة مستمع عام لجميع الخدمات
   */
  addGlobalListener(listener) {
    this.globalListeners.add(listener);
    return () => this.globalListeners.delete(listener);
  }

  /**
   * الحصول على حالة جميع الخدمات
   */
  getAllStatus() {
    const status = {};
    for (const [name, manager] of this.services) {
      status[name] = manager.getStatus();
    }
    return status;
  }

  /**
   * إعادة الاتصال لجميع الخدمات
   */
  async reconnectAll() {
    console.log('🔄 إعادة الاتصال لجميع الخدمات...');
    const results = {};
    for (const [name, manager] of this.services) {
      results[name] = await manager.reconnect();
    }
    return results;
  }

  /**
   * إيقاف جميع المراقبات
   */
  stopAll() {
    for (const manager of this.services.values()) {
      manager.stopMonitoring();
    }
  }
}

// إنشاء مثيل واحد (Singleton)
export const connectionManager = new PersistentConnectionManager();

/**
 * دوال مساعدة للاستخدام المباشر
 */

// استعلام آمن للطوابير
export async function safeQueuesQuery(queryFn) {
  const manager = connectionManager.getService(ServiceTypes.QUEUES);
  return manager.executeWithRetry(
    (client) => queryFn(client.from('unified_queue')),
    { tableName: 'queues' },
  );
}

// استعلام آمن للعيادات
export async function safeClinicsQuery(queryFn) {
  const manager = connectionManager.getService(ServiceTypes.CLINICS);
  return manager.executeWithRetry(
    (client) => queryFn(client.from('clinics')),
    { tableName: 'clinics' },
  );
}

// استعلام آمن للإشعارات
export async function safeNotificationsQuery(queryFn) {
  const manager = connectionManager.getService(ServiceTypes.NOTIFICATIONS);
  return manager.executeWithRetry(
    (client) => queryFn(client.from('notifications')),
    { tableName: 'notifications' },
  );
}

// استعلام آمن للأرقام السرية
  return manager.executeWithRetry(
  );
}

// استعلام آمن للمسارات
export async function safeRoutesQuery(queryFn) {
  const manager = connectionManager.getService(ServiceTypes.ROUTES);
  return manager.executeWithRetry(
    (client) => queryFn(client.from('patient_routes')),
    { tableName: 'patient_routes' },
  );
}

// استعلام آمن عام
export async function safeQuery(tableName, queryFn) {
  const serviceType = tableName.includes('queue') ? ServiceTypes.QUEUES
    : tableName.includes('clinic') ? ServiceTypes.CLINICS
      : tableName.includes('notification') ? ServiceTypes.NOTIFICATIONS
          : tableName.includes('route') ? ServiceTypes.ROUTES
            : ServiceTypes.ADMIN;

  const manager = connectionManager.getService(serviceType);
  return manager.executeWithRetry(
    (client) => queryFn(client.from(tableName)),
    { tableName },
  );
}

// الحصول على عميل Supabase لخدمة معينة
export function getServiceClient(serviceName) {
  return connectionManager.getService(serviceName).client;
}

// تهيئة النظام عند بدء التطبيق
export async function initializePersistentConnection() {
  return connectionManager.initialize();
}

// تصدير افتراضي
export default connectionManager;

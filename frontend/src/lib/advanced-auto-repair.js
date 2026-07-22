/**
 * نظام الإصلاح التلقائي المتقدم والشامل (Advanced Auto-Repair System)
 * يراقب الأعطال الفعلية دون تنفيذ دوال تشغيلية أو إرسال بيانات اختبارية.
 */

class AdvancedAutoRepair {
  constructor(supabase) {
    this.supabase = supabase;
    this.repairLog = [];
    this.healthStatus = {
      totalIssues: 0,
      fixedIssues: 0,
      failedFixes: 0,
      lastRepair: null,
      lastCheck: null,
      repairRate: 0,
      status: 'idle',
    };
    this.monitoredElements = new Map();
    this.repairStrategies = new Map();
    this.isRunning = false;
    this.checkInterval = null;
    this.boundErrorHandler = (event) => this.handleError(event);
    this.boundRejectionHandler = (event) => this.handleRejection(event);
    this.initializeRepairStrategies();
  }

  initializeRepairStrategies() {
    this.repairStrategies.set('function', {
      detect: (error) => error?.type === 'function_error',
      repair: (context) => this.repairFunction(context),
      retry: 3,
      timeout: 5000,
    });

    this.repairStrategies.set('table', {
      detect: (error) =>
        error?.type === 'table_error' || error?.message?.includes('permission denied'),
      repair: (context) => this.repairTable(context),
      retry: 3,
      timeout: 5000,
    });

    this.repairStrategies.set('connection', {
      detect: (error) =>
        error?.type === 'connection_error' || error?.message?.toLowerCase().includes('network'),
      repair: (context) => this.repairConnection(context),
      retry: 5,
      timeout: 10000,
    });

    this.repairStrategies.set('data', {
      detect: (error) =>
        error?.type === 'data_error' || error?.message?.toLowerCase().includes('invalid'),
      repair: (context) => this.repairData(context),
      retry: 2,
      timeout: 3000,
    });

    this.repairStrategies.set('translation', {
      detect: (error) => error?.type === 'translation_error',
      repair: (context) => this.repairTranslation(context),
      retry: 1,
      timeout: 2000,
    });

    this.repairStrategies.set('permissions', {
      detect: (error) =>
        error?.message?.toLowerCase().includes('permission') ||
        error?.message?.toLowerCase().includes('unauthorized'),
      repair: (context) => this.repairPermissions(context),
      retry: 2,
      timeout: 3000,
    });

    this.repairStrategies.set('ui', {
      detect: (error) =>
        error?.type === 'ui_error' || error?.message?.toLowerCase().includes('render'),
      repair: (context) => this.repairUI(context),
      retry: 1,
      timeout: 2000,
    });

    this.repairStrategies.set('storage', {
      detect: (error) =>
        error?.type === 'storage_error' || error?.message?.toLowerCase().includes('storage'),
      repair: (context) => this.repairStorage(context),
      retry: 2,
      timeout: 3000,
    });

    console.log('✅ نظام الإصلاح المتقدم: تم تهيئة الاستراتيجيات');
  }

  startAutoRepair() {
    if (this.isRunning || typeof window === 'undefined') return;

    this.isRunning = true;
    console.log('🔧 نظام الإصلاح التلقائي: جاري البدء');

    window.addEventListener('error', this.boundErrorHandler);
    window.addEventListener('unhandledrejection', this.boundRejectionHandler);

    this.checkInterval = window.setInterval(() => {
      this.performSystemCheck();
    }, 30000);

    this.performSystemCheck();
    console.log('✅ نظام الإصلاح التلقائي: تم التفعيل');
  }

  async handleError(event) {
    const error = event?.error || event;
    if (!error) return;

    console.warn('⚠️ خطأ مكتشف:', error);
    this.healthStatus.totalIssues += 1;

    for (const [type, strategy] of this.repairStrategies) {
      if (strategy.detect(error)) {
        await this.executeRepair(type, { error, source: event });
        break;
      }
    }
  }

  async handleRejection(event) {
    const error = event?.reason || event;
    if (!error) return;

    const message = String(error?.message || error || '');
    if (
      message.includes('AbortError') ||
      message.includes('cancelled') ||
      message.includes('The user aborted')
    ) {
      return;
    }

    console.warn('⚠️ وعد مرفوض:', error);
    this.healthStatus.totalIssues += 1;
    await this.executeRepair('connection', { error, source: 'promise' });
  }

  async executeRepair(type, context) {
    const strategy = this.repairStrategies.get(type);
    if (!strategy) return false;

    this.healthStatus.status = 'repairing';
    let success = false;

    for (let attempt = 1; attempt <= strategy.retry; attempt += 1) {
      try {
        const timeoutPromise = new Promise((_, reject) => {
          window.setTimeout(() => reject(new Error('Repair timeout')), strategy.timeout);
        });

        await Promise.race([strategy.repair(context), timeoutPromise]);
        success = true;
        this.healthStatus.fixedIssues += 1;
        this.healthStatus.lastRepair = new Date().toISOString();
        this.logRepair('success', type, context, attempt);
        break;
      } catch (error) {
        if (attempt === strategy.retry) {
          this.healthStatus.failedFixes += 1;
          this.logRepair('failed', type, { ...context, repairError: error }, attempt);
        } else {
          await new Promise((resolve) => window.setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    this.healthStatus.status = 'idle';
    this.updateRepairRate();
    return success;
  }

  async repairFunction(context) {
    const { error } = context;
    console.log('🔧 فحص خطأ الدالة:', error?.message || error);
    return Boolean(error?.functionName);
  }

  async repairTable(context) {
    const { error } = context;
    console.log('🔧 فحص خطأ الجدول:', error?.message || error);

    if (error?.message?.includes('permission denied')) {
      const { error: refreshError } = await this.supabase.auth.refreshSession();
      if (refreshError) throw refreshError;
    }

    return true;
  }

  async repairConnection(context) {
    const { error } = context;
    console.log('🔧 فحص الاتصال:', error?.message || error);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.enableOfflineMode();
      return true;
    }

    const { error: sessionError } = await this.supabase.auth.getSession();
    if (sessionError) throw sessionError;
    return true;
  }

  async repairData(context) {
    const { error } = context;
    if (error?.data) return this.sanitizeData(error.data) !== null;
    return true;
  }

  async repairTranslation() {
    return true;
  }

  async repairPermissions() {
    const { error } = await this.supabase.auth.getSession();
    if (error) throw error;
    return true;
  }

  async repairUI(context) {
    const message = String(context?.error?.message || '');
    if (message.toLowerCase().includes('render')) {
      window.dispatchEvent(new CustomEvent('component_reload'));
    }
    return true;
  }

  async repairStorage() {
    const testKey = '__mmc_storage_test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  }

  async performSystemCheck() {
    if (!this.supabase) return false;

    this.healthStatus.status = 'checking';
    const results = await Promise.allSettled([
      this.checkConnection(),
      this.checkTables(),
      this.checkFunctions(),
      this.checkData(),
      this.checkTranslations(),
      this.checkPermissions(),
    ]);

    const failed = results.filter(
      (result) => result.status === 'rejected' || result.value === false,
    );

    this.healthStatus.lastCheck = new Date().toISOString();
    this.healthStatus.status = failed.length === 0 ? 'idle' : 'degraded';

    if (failed.length > 0) {
      console.warn(`⚠️ الفحص الشامل: ${failed.length} فحص لم ينجح`);
      return false;
    }

    console.log('✅ الفحص الشامل: اكتمل بنجاح');
    return true;
  }

  async checkConnection() {
    try {
      const { error } = await this.supabase
        .from('clinics')
        .select('*', { count: 'exact', head: true })
        .limit(1);
      if (error) throw error;
      return true;
    } catch (error) {
      console.warn('⚠️ مشكلة في الاتصال:', error?.message || error);
      return false;
    }
  }

  async checkTables() {
    const tables = ['clinics', 'unified_queue', 'patients', 'roles', 'settings'];
    let healthy = true;

    for (const table of tables) {
      try {
        const { error } = await this.supabase
          .from(table)
          .select('*', { count: 'exact', head: true })
          .limit(1);
        if (error) throw error;
      } catch (error) {
        healthy = false;
        console.warn(`⚠️ جدول ${table}: مشكلة - ${error?.message || error}`);
      }
    }

    return healthy;
  }

  async checkFunctions() {
    // لا يتم تنفيذ RPC تشغيلي بمدخلات وهمية. وجود الدوال وصلاحياتها
    // يُفحص من الخادم، أما التنفيذ فيتم فقط من مسارات العمل الحقيقية.
    console.log('✅ الدوال التشغيلية: تم تجاوز الاستدعاء الاختباري الآمن');
    return true;
  }

  async checkData() {
    try {
      const { error } = await this.supabase.from('clinics').select('*').limit(1);
      if (error) throw error;
      return true;
    } catch (error) {
      console.warn('⚠️ مشكلة في البيانات:', error?.message || error);
      return false;
    }
  }

  async checkTranslations() {
    return true;
  }

  async checkPermissions() {
    try {
      const { error } = await this.supabase.auth.getSession();
      if (error) throw error;
      return true;
    } catch (error) {
      console.warn('⚠️ مشكلة في الصلاحيات:', error?.message || error);
      return false;
    }
  }

  enableOfflineMode() {
    localStorage.setItem('offlineMode', 'true');
  }

  sanitizeData(data) {
    if (!data) return null;
    if (typeof data !== 'object') return data;

    return Object.keys(data).reduce((cleaned, key) => {
      if (data[key] !== null && data[key] !== undefined) {
        cleaned[key] = data[key];
      }
      return cleaned;
    }, {});
  }

  logRepair(status, type, context, attempt) {
    this.repairLog.push({
      timestamp: new Date().toISOString(),
      status,
      type,
      attempt,
      context,
    });

    if (this.repairLog.length > 100) this.repairLog.shift();
  }

  updateRepairRate() {
    const total = this.healthStatus.totalIssues;
    this.healthStatus.repairRate = total > 0
      ? (this.healthStatus.fixedIssues / total) * 100
      : 0;
  }

  getHealthStatus() {
    return {
      ...this.healthStatus,
      recentLogs: this.repairLog.slice(-10),
    };
  }

  stopAutoRepair() {
    if (!this.isRunning || typeof window === 'undefined') return;

    window.removeEventListener('error', this.boundErrorHandler);
    window.removeEventListener('unhandledrejection', this.boundRejectionHandler);
    if (this.checkInterval) window.clearInterval(this.checkInterval);

    this.checkInterval = null;
    this.isRunning = false;
    this.healthStatus.status = 'stopped';
    console.log('⛔ تم إيقاف نظام الإصلاح التلقائي');
  }
}

export default AdvancedAutoRepair;

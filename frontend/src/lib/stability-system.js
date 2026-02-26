/**
 * ═══════════════════════════════════════════════════════════════
 * STABILITY SYSTEM — نظام الاستقرار الشامل
 * اللجنة الطبية العسكرية — MMC-MMS
 * ═══════════════════════════════════════════════════════════════
 *
 * الهدف: ضمان عمل التطبيق 24/7 بدون توقف مع حماية بيانات المراجعين
 *
 * المكونات:
 * 1. OfflineGuard      — كشف انقطاع الاتصال وعرض تحذير فوري
 * 2. SmartCache        — كاش ذكي للبيانات الحيوية (30 دقيقة TTL)
 * 3. MemoryGuard       — مراقبة الذاكرة وتنظيف تلقائي عند 35%
 * 4. DataValidator     — التحقق من صحة البيانات قبل العرض
 * 5. AutoRecovery      — استعادة تلقائية عند أي خلل
 * 6. StabilityMonitor  — مراقبة مستمرة وتسجيل الأحداث
 * ═══════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────
// 1. OFFLINE GUARD — كشف انقطاع الاتصال
// ─────────────────────────────────────────────
class OfflineGuard {
  constructor() {
    this.isOnline = navigator.onLine;
    this.listeners = new Set();
    this.reconnectTimer = null;
    this._init();
  }

  _init() {
    window.addEventListener('online', () => this._handleOnline());
    window.addEventListener('offline', () => this._handleOffline());

    // فحص دوري كل 10 ثوانٍ للتأكد من الاتصال
    setInterval(() => this._pingCheck(), 10000);
  }

  async _pingCheck() {
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 3000);
      await fetch('https://rujwuruuosffcxazymit.supabase.co/rest/v1/', {
        method: 'HEAD',
        signal: ctrl.signal,
        headers: { 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1and1cnV1b3NmZmN4YXp5bWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzODcyNjUsImV4cCI6MjA3Njk2MzI2NX0.HnrSwc7OZTqZRzCwzBH8hqtgtHMBix4yxy0RKvRDX10' }
      });
      clearTimeout(timeout);
      if (!this.isOnline) this._handleOnline();
    } catch {
      if (this.isOnline) this._handleOffline();
    }
  }

  _handleOnline() {
    this.isOnline = true;
    this.listeners.forEach(fn => fn({ type: 'online' }));
    stabilityMonitor.log('ONLINE', 'تم استعادة الاتصال بالإنترنت');
  }

  _handleOffline() {
    this.isOnline = false;
    this.listeners.forEach(fn => fn({ type: 'offline' }));
    stabilityMonitor.log('OFFLINE', 'انقطع الاتصال — يعمل من الكاش المحلي');
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getStatus() {
    return this.isOnline ? 'online' : 'offline';
  }
}

// ─────────────────────────────────────────────
// 2. SMART CACHE — كاش ذكي للبيانات الحيوية
// ─────────────────────────────────────────────
class SmartCache {
  constructor() {
    this.CACHE_KEY = 'mmc_smart_cache';
    this.TTL = 30 * 60 * 1000; // 30 دقيقة
    this.MAX_SIZE = 50; // أقصى 50 مدخل
    this.cache = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(this.CACHE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  _save() {
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(this.cache));
    } catch (e) {
      // localStorage ممتلئ — تنظيف
      this.clear();
    }
  }

  set(key, data) {
    // إذا تجاوز الحجم الأقصى، احذف الأقدم
    const keys = Object.keys(this.cache);
    if (keys.length >= this.MAX_SIZE) {
      const oldest = keys.sort((a, b) => this.cache[a].ts - this.cache[b].ts)[0];
      delete this.cache[oldest];
    }

    this.cache[key] = {
      data,
      ts: Date.now(),
      ttl: this.TTL
    };
    this._save();
  }

  get(key) {
    const entry = this.cache[key];
    if (!entry) return null;

    // تحقق من انتهاء الصلاحية
    if (Date.now() - entry.ts > entry.ttl) {
      delete this.cache[key];
      this._save();
      return null;
    }

    return entry.data;
  }

  getOrFetch(key, fetchFn, ttlOverride = null) {
    const cached = this.get(key);
    if (cached !== null) return Promise.resolve({ data: cached, fromCache: true });

    return fetchFn().then(data => {
      if (data && !this._isEmpty(data)) {
        if (ttlOverride) this.cache[key] = { data, ts: Date.now(), ttl: ttlOverride };
        else this.set(key, data);
      }
      return { data, fromCache: false };
    });
  }

  _isEmpty(data) {
    if (Array.isArray(data)) return data.length === 0;
    if (typeof data === 'object') return Object.keys(data).length === 0;
    return !data;
  }

  clear(keyPattern = null) {
    if (keyPattern) {
      Object.keys(this.cache).forEach(k => {
        if (k.includes(keyPattern)) delete this.cache[k];
      });
    } else {
      this.cache = {};
    }
    this._save();
  }

  getStats() {
    const keys = Object.keys(this.cache);
    const now = Date.now();
    const valid = keys.filter(k => now - this.cache[k].ts < this.cache[k].ttl);
    const expired = keys.length - valid.length;
    const sizeBytes = JSON.stringify(this.cache).length;

    return {
      total: keys.length,
      valid: valid.length,
      expired,
      sizeKB: Math.round(sizeBytes / 1024),
      keys: valid
    };
  }
}

// ─────────────────────────────────────────────
// 3. MEMORY GUARD — مراقبة الذاكرة وتنظيف عند 35%
// ─────────────────────────────────────────────
class MemoryGuard {
  constructor() {
    this.THRESHOLD = 0.35; // 35% من الحد الأقصى
    this.CHECK_INTERVAL = 60000; // كل دقيقة
    this.lastCleanup = null;
    this.cleanupLog = [];
    this._start();
  }

  _start() {
    setInterval(() => this._check(), this.CHECK_INTERVAL);
    // فحص فوري عند البدء
    setTimeout(() => this._check(), 5000);
  }

  _getMemoryUsage() {
    // قياس localStorage
    let lsSize = 0;
    try {
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          lsSize += localStorage[key].length + key.length;
        }
      }
    } catch {}

    // قياس sessionStorage
    let ssSize = 0;
    try {
      for (let key in sessionStorage) {
        if (sessionStorage.hasOwnProperty(key)) {
          ssSize += sessionStorage[key].length + key.length;
        }
      }
    } catch {}

    // قياس ذاكرة JavaScript (إذا متاح)
    let jsHeap = null;
    if (performance && performance.memory) {
      jsHeap = {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit,
        ratio: performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit
      };
    }

    // تقدير نسبة localStorage (حد 5MB)
    const LS_LIMIT = 5 * 1024 * 1024; // 5MB
    const lsRatio = lsSize / LS_LIMIT;

    return {
      localStorage: { sizeBytes: lsSize, sizeKB: Math.round(lsSize / 1024), ratio: lsRatio },
      sessionStorage: { sizeBytes: ssSize, sizeKB: Math.round(ssSize / 1024) },
      jsHeap,
      critical: lsRatio > this.THRESHOLD || (jsHeap && jsHeap.ratio > this.THRESHOLD)
    };
  }

  _check() {
    const mem = this._getMemoryUsage();

    if (mem.critical) {
      stabilityMonitor.log('MEMORY_WARNING',
        `الذاكرة تجاوزت ${Math.round(this.THRESHOLD * 100)}% — بدء التنظيف التلقائي`,
        { localStorage: mem.localStorage.sizeKB + 'KB', ratio: Math.round(mem.localStorage.ratio * 100) + '%' }
      );
      this._cleanup(mem);
    }
  }

  _cleanup(mem) {
    const before = mem.localStorage.sizeKB;
    const cleaned = [];

    // 1. تنظيف الكاش المنتهي الصلاحية
    smartCache.clear();
    cleaned.push('smart_cache');

    // 2. تنظيف سجلات الأخطاء القديمة (أبقِ آخر 50 فقط)
    this._trimKey('mmc_error_log', 50);
    cleaned.push('error_log');

    // 3. تنظيف سجل النشاط القديم (أبقِ آخر 100 فقط)
    this._trimKey('mmc_activity_log', 100);
    cleaned.push('activity_log');

    // 4. تنظيف الجلسات المنتهية
    this._cleanExpiredSessions();
    cleaned.push('expired_sessions');

    // 5. تنظيف البيانات المؤقتة
    const tempKeys = Object.keys(localStorage).filter(k =>
      k.startsWith('temp_') || k.startsWith('draft_') || k.endsWith('_tmp')
    );
    tempKeys.forEach(k => localStorage.removeItem(k));
    if (tempKeys.length > 0) cleaned.push(`temp_keys(${tempKeys.length})`);

    const after = this._getMemoryUsage().localStorage.sizeKB;
    const freed = before - after;

    this.lastCleanup = {
      timestamp: new Date().toISOString(),
      before: before + 'KB',
      after: after + 'KB',
      freed: freed + 'KB',
      cleaned
    };
    this.cleanupLog.push(this.lastCleanup);

    // أبقِ آخر 20 عملية تنظيف فقط
    if (this.cleanupLog.length > 20) this.cleanupLog = this.cleanupLog.slice(-20);

    stabilityMonitor.log('MEMORY_CLEANUP',
      `تم تحرير ${freed}KB من الذاكرة`,
      this.lastCleanup
    );
  }

  _trimKey(key, maxItems) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > maxItems) {
        localStorage.setItem(key, JSON.stringify(arr.slice(-maxItems)));
      }
    } catch {
      localStorage.removeItem(key);
    }
  }

  _cleanExpiredSessions() {
    try {
      const session = localStorage.getItem('mmc_admin_session');
      if (session) {
        const s = JSON.parse(session);
        if (s.expiresAt && new Date(s.expiresAt) < new Date()) {
          localStorage.removeItem('mmc_admin_session');
        }
      }
    } catch {
      localStorage.removeItem('mmc_admin_session');
    }
  }

  getStatus() {
    const mem = this._getMemoryUsage();
    return {
      ...mem,
      lastCleanup: this.lastCleanup,
      threshold: Math.round(this.THRESHOLD * 100) + '%',
      cleanupCount: this.cleanupLog.length
    };
  }

  // تنظيف يدوي فوري
  forceCleanup() {
    const mem = this._getMemoryUsage();
    this._cleanup(mem);
    return this.lastCleanup;
  }
}

// ─────────────────────────────────────────────
// 4. DATA VALIDATOR — التحقق من صحة البيانات
// ─────────────────────────────────────────────
class DataValidator {
  // التحقق من أن البيانات حقيقية وليست وهمية
  isValidPatient(data) {
    if (!data || typeof data !== 'object') return false;
    // يجب أن يكون له رقم ملف أو رقم هوية
    const hasId = data.file_number || data.national_id || data.id;
    const hasName = data.full_name || data.name;
    return !!(hasId && hasName);
  }

  isValidQueue(data) {
    if (!data || typeof data !== 'object') return false;
    return !!(data.queue_number && data.clinic_id);
  }

  isValidClinic(data) {
    if (!data || typeof data !== 'object') return false;
    return !!(data.id && data.name);
  }

  // التحقق من مصفوفة البيانات
  validateArray(arr, validatorFn) {
    if (!Array.isArray(arr)) return { valid: [], invalid: [], ratio: 0 };
    const valid = arr.filter(item => validatorFn(item));
    const invalid = arr.filter(item => !validatorFn(item));
    return {
      valid,
      invalid,
      ratio: arr.length > 0 ? valid.length / arr.length : 1,
      isHealthy: arr.length === 0 || valid.length / arr.length >= 0.95 // 95% صحيحة
    };
  }

  // منع عرض البيانات الوهمية
  sanitize(data, fallback = null) {
    if (data === null || data === undefined) return fallback;
    if (typeof data === 'string' && (data.includes('mock') || data.includes('test') || data.includes('dummy'))) {
      stabilityMonitor.log('DATA_WARNING', 'تم اكتشاف بيانات وهمية وتم منع عرضها', { data });
      return fallback;
    }
    return data;
  }
}

// ─────────────────────────────────────────────
// 5. AUTO RECOVERY — استعادة تلقائية عند الخلل
// ─────────────────────────────────────────────
class AutoRecovery {
  constructor() {
    this.recoveryAttempts = new Map();
    this.MAX_ATTEMPTS = 3;
    this.COOLDOWN = 30000; // 30 ثانية بين المحاولات
  }

  async attempt(key, recoveryFn) {
    const attempts = this.recoveryAttempts.get(key) || { count: 0, lastAttempt: 0 };

    // تحقق من cooldown
    if (Date.now() - attempts.lastAttempt < this.COOLDOWN) {
      return { success: false, reason: 'cooldown' };
    }

    // تحقق من الحد الأقصى
    if (attempts.count >= this.MAX_ATTEMPTS) {
      stabilityMonitor.log('RECOVERY_FAILED',
        `فشل الاستعادة التلقائية لـ ${key} بعد ${this.MAX_ATTEMPTS} محاولات`
      );
      return { success: false, reason: 'max_attempts' };
    }

    try {
      stabilityMonitor.log('RECOVERY_ATTEMPT', `محاولة استعادة: ${key} (${attempts.count + 1}/${this.MAX_ATTEMPTS})`);
      await recoveryFn();

      // نجح — إعادة تعيين العداد
      this.recoveryAttempts.delete(key);
      stabilityMonitor.log('RECOVERY_SUCCESS', `تمت الاستعادة بنجاح: ${key}`);
      return { success: true };
    } catch (error) {
      this.recoveryAttempts.set(key, {
        count: attempts.count + 1,
        lastAttempt: Date.now()
      });
      return { success: false, reason: error.message };
    }
  }

  reset(key) {
    this.recoveryAttempts.delete(key);
  }
}

// ─────────────────────────────────────────────
// 6. STABILITY MONITOR — مراقبة وتسجيل الأحداث
// ─────────────────────────────────────────────
class StabilityMonitor {
  constructor() {
    this.LOG_KEY = 'mmc_stability_log';
    this.MAX_LOGS = 200;
    this.startTime = Date.now();
    this.eventCounts = {};
  }

  log(type, message, data = null) {
    const entry = {
      id: `${type}_${Date.now()}`,
      type,
      message,
      data,
      ts: new Date().toISOString(),
      uptime: Math.round((Date.now() - this.startTime) / 1000) + 's'
    };

    // تحديث عداد الأحداث
    this.eventCounts[type] = (this.eventCounts[type] || 0) + 1;

    // حفظ في localStorage
    try {
      const logs = this._getLogs();
      logs.push(entry);
      if (logs.length > this.MAX_LOGS) logs.splice(0, logs.length - this.MAX_LOGS);
      localStorage.setItem(this.LOG_KEY, JSON.stringify(logs));
    } catch {}

    // طباعة في console للتطوير
    const emoji = { ONLINE: '🟢', OFFLINE: '🔴', MEMORY_WARNING: '⚠️', MEMORY_CLEANUP: '🧹',
                    RECOVERY_ATTEMPT: '🔄', RECOVERY_SUCCESS: '✅', RECOVERY_FAILED: '❌',
                    DATA_WARNING: '🚫', ERROR: '💥' }[type] || 'ℹ️';
    console.log(`[StabilitySystem] ${emoji} ${type}: ${message}`, data || '');
  }

  _getLogs() {
    try {
      return JSON.parse(localStorage.getItem(this.LOG_KEY) || '[]');
    } catch {
      return [];
    }
  }

  getLogs(limit = 50) {
    return this._getLogs().slice(-limit);
  }

  getStats() {
    const logs = this._getLogs();
    const now = Date.now();
    const uptimeSeconds = Math.round((now - this.startTime) / 1000);
    const uptimeMinutes = Math.round(uptimeSeconds / 60);

    return {
      uptime: uptimeMinutes + ' دقيقة',
      uptimeSeconds,
      totalLogs: logs.length,
      eventCounts: this.eventCounts,
      lastEvent: logs[logs.length - 1] || null,
      offlineEvents: (this.eventCounts['OFFLINE'] || 0),
      recoveryEvents: (this.eventCounts['RECOVERY_SUCCESS'] || 0),
      memoryCleanups: (this.eventCounts['MEMORY_CLEANUP'] || 0),
      isHealthy: (this.eventCounts['OFFLINE'] || 0) === 0 && (this.eventCounts['ERROR'] || 0) === 0
    };
  }

  clearLogs() {
    localStorage.removeItem(this.LOG_KEY);
    this.eventCounts = {};
  }
}

// ─────────────────────────────────────────────
// INITIALIZATION — تهيئة النظام
// ─────────────────────────────────────────────

// إنشاء المثيلات بالترتيب الصحيح
export const stabilityMonitor = new StabilityMonitor();
export const smartCache = new SmartCache();
export const memoryGuard = new MemoryGuard();
export const offlineGuard = new OfflineGuard();
export const dataValidator = new DataValidator();
export const autoRecovery = new AutoRecovery();

// تسجيل بدء النظام
stabilityMonitor.log('SYSTEM_START', 'نظام الاستقرار بدأ العمل', {
  version: '1.0.0',
  timestamp: new Date().toISOString(),
  online: navigator.onLine
});

// ─────────────────────────────────────────────
// STABILITY API — واجهة موحدة للاستخدام
// ─────────────────────────────────────────────
const StabilitySystem = {
  // الحالة الكاملة للنظام
  getFullStatus() {
    return {
      online: offlineGuard.getStatus(),
      memory: memoryGuard.getStatus(),
      cache: smartCache.getStats(),
      monitor: stabilityMonitor.getStats(),
      timestamp: new Date().toISOString()
    };
  },

  // جلب بيانات مع كاش ذكي + fallback
  async fetchWithFallback(cacheKey, fetchFn, fallbackData = null) {
    // إذا أوفلاين — استخدم الكاش
    if (!offlineGuard.isOnline) {
      const cached = smartCache.get(cacheKey);
      if (cached) {
        stabilityMonitor.log('CACHE_HIT', `استخدام الكاش (أوفلاين): ${cacheKey}`);
        return { data: cached, source: 'cache', online: false };
      }
      return { data: fallbackData, source: 'fallback', online: false };
    }

    // أونلاين — جلب من الخادم مع كاش
    try {
      const result = await fetchFn();
      if (result && !dataValidator._isEmpty(result)) {
        smartCache.set(cacheKey, result);
      }
      return { data: result, source: 'server', online: true };
    } catch (error) {
      // فشل الجلب — استخدم الكاش
      const cached = smartCache.get(cacheKey);
      stabilityMonitor.log('FETCH_FALLBACK', `فشل الجلب، استخدام الكاش: ${cacheKey}`, { error: error.message });
      return { data: cached || fallbackData, source: cached ? 'cache' : 'fallback', online: true };
    }
  },

  // تنظيف يدوي فوري
  forceCleanup() {
    return memoryGuard.forceCleanup();
  },

  // سجل الأحداث
  getLogs: (limit) => stabilityMonitor.getLogs(limit),
  log: (type, msg, data) => stabilityMonitor.log(type, msg, data)
};

export default StabilitySystem;

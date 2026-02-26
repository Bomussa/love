/**
 * MemoryManager - نظام إدارة الذاكرة التلقائي
 * Memory Manager - Automatic Memory Management System
 *
 * الخوارزميات المستخدمة / Algorithms Used:
 * - LRU (Least Recently Used) - حذف الأقدم أولاً
 * - Circuit Breaker - منع حلقات الحذف اللانهائية
 * - Watchdog Timer - مراقبة دورية كل 30 ثانية
 * - Bulkhead Pattern - عزل البيانات الحيوية
 *
 * العتبات / Thresholds:
 * - 80% → تحذير / Warning
 * - 90% → حذف تلقائي للبيانات القديمة / Auto-delete old data
 * - 95% → حذف شامل مع إبقاء البيانات الحيوية / Full cleanup keep critical only
 */

import { supabase } from './supabase-client.js';

// ===== الثوابت / Constants =====
const THRESHOLDS = {
  WARNING: 0.80,    // 80% - تحذير
  AUTO_CLEAN: 0.90, // 90% - حذف تلقائي
  CRITICAL: 0.95,   // 95% - حذف شامل
};

const CIRCUIT_BREAKER = {
  MAX_FAILURES: 3,
  RESET_TIMEOUT: 60000, // 60 ثانية
};

const WATCHDOG_INTERVAL = 30000; // 30 ثانية

// البيانات الحيوية التي لا تُحذف أبداً
const CRITICAL_KEYS = [
  'auth_token', 'admin_session', 'language', 'theme',
  'settings', 'clinic_pins', 'supabase_session',
];

// مفاتيح localStorage القابلة للحذف مرتبة حسب الأولوية (الأقل أهمية أولاً)
const DELETABLE_PREFIXES = [
  'cache_', 'temp_', 'log_', 'debug_', 'preview_',
  'draft_', 'history_', 'backup_', 'old_',
];

// ===== Circuit Breaker State =====
let cbState = {
  status: 'CLOSED', // CLOSED | OPEN | HALF_OPEN
  failures: 0,
  lastFailure: null,
  lastSuccess: null,
};

// ===== MemoryManager Class =====
class MemoryManager {
  constructor() {
    this.watchdogTimer = null;
    this.isRunning = false;
    this.stats = {
      totalCleanups: 0,
      totalBytesFreed: 0,
      lastCleanup: null,
      warnings: 0,
    };
  }

  // ===== تشغيل نظام المراقبة / Start Monitoring =====
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[MemoryManager] Started - Watchdog active every 30s');
    this._runWatchdog();
    this.watchdogTimer = setInterval(() => this._runWatchdog(), WATCHDOG_INTERVAL);
  }

  // ===== إيقاف المراقبة / Stop Monitoring =====
  stop() {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    this.isRunning = false;
    console.log('[MemoryManager] Stopped');
  }

  // ===== قراءة استخدام الذاكرة / Get Memory Usage =====
  getMemoryUsage() {
    // محاولة قراءة ذاكرة المتصفح الحقيقية
    if (performance && performance.memory) {
      const { usedJSHeapSize, jsHeapSizeLimit } = performance.memory;
      return {
        used: usedJSHeapSize,
        limit: jsHeapSizeLimit,
        ratio: usedJSHeapSize / jsHeapSizeLimit,
        source: 'performance.memory',
        usedMB: Math.round(usedJSHeapSize / 1024 / 1024),
        limitMB: Math.round(jsHeapSizeLimit / 1024 / 1024),
      };
    }

    // Fallback: تقدير من localStorage
    let localStorageSize = 0;
    try {
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          localStorageSize += (localStorage[key].length + key.length) * 2;
        }
      }
    } catch (e) {}

    const MAX_LOCALSTORAGE = 5 * 1024 * 1024; // 5MB
    return {
      used: localStorageSize,
      limit: MAX_LOCALSTORAGE,
      ratio: localStorageSize / MAX_LOCALSTORAGE,
      source: 'localStorage',
      usedMB: Math.round(localStorageSize / 1024 / 1024 * 100) / 100,
      limitMB: 5,
    };
  }

  // ===== الـ Watchdog الرئيسي / Main Watchdog =====
  _runWatchdog() {
    try {
      const mem = this.getMemoryUsage();
      const ratio = mem.ratio;

      // إرسال حدث للمكونات
      window.dispatchEvent(new CustomEvent('memory-update', { detail: { ...mem, stats: this.stats } }));

      if (ratio >= THRESHOLDS.CRITICAL) {
        console.warn(`[MemoryManager] CRITICAL: ${Math.round(ratio * 100)}% - Full cleanup`);
        this._fullCleanup();
        this.stats.warnings++;
      } else if (ratio >= THRESHOLDS.AUTO_CLEAN) {
        console.warn(`[MemoryManager] HIGH: ${Math.round(ratio * 100)}% - Auto cleanup`);
        this._autoCleanup('partial');
        this.stats.warnings++;
      } else if (ratio >= THRESHOLDS.WARNING) {
        console.warn(`[MemoryManager] WARNING: ${Math.round(ratio * 100)}% - Monitor`);
        window.dispatchEvent(new CustomEvent('memory-warning', { detail: { ratio, level: 'warning' } }));
        this.stats.warnings++;
      }
    } catch (e) {
      console.error('[MemoryManager] Watchdog error:', e);
    }
  }

  // ===== حذف تلقائي جزئي / Partial Auto Cleanup =====
  _autoCleanup(mode = 'partial') {
    if (!this._circuitBreakerAllow()) {
      console.warn('[MemoryManager] Circuit Breaker OPEN - cleanup blocked');
      return { success: false, reason: 'circuit_breaker_open' };
    }

    const before = this.getMemoryUsage();
    let deleted = 0;
    let deletedKeys = [];

    try {
      // 1. حذف مفاتيح localStorage القابلة للحذف (LRU)
      const allKeys = Object.keys(localStorage);
      const deletableKeys = allKeys.filter(key =>
        !CRITICAL_KEYS.some(ck => key.includes(ck)) &&
        DELETABLE_PREFIXES.some(p => key.startsWith(p))
      );

      // ترتيب حسب الأقدم (LRU)
      const sortedKeys = deletableKeys.sort((a, b) => {
        try {
          const aData = JSON.parse(localStorage.getItem(a) || '{}');
          const bData = JSON.parse(localStorage.getItem(b) || '{}');
          return (aData._ts || 0) - (bData._ts || 0);
        } catch { return 0; }
      });

      // حذف 50% من المفاتيح القابلة للحذف
      const toDelete = mode === 'partial'
        ? sortedKeys.slice(0, Math.ceil(sortedKeys.length * 0.5))
        : sortedKeys;

      toDelete.forEach(key => {
        try {
          localStorage.removeItem(key);
          deletedKeys.push(key);
          deleted++;
        } catch (e) {}
      });

      // 2. تشغيل GC إذا متاح
      if (window.gc) window.gc();

      const after = this.getMemoryUsage();
      const freed = before.used - after.used;

      this.stats.totalCleanups++;
      this.stats.totalBytesFreed += Math.max(0, freed);
      this.stats.lastCleanup = new Date().toISOString();

      // تسجيل في Supabase
      this._logCleanup({
        mode,
        deleted_keys: deleted,
        freed_bytes: freed,
        before_ratio: before.ratio,
        after_ratio: after.ratio,
        deleted_list: deletedKeys.slice(0, 20),
      });

      this._circuitBreakerSuccess();

      window.dispatchEvent(new CustomEvent('memory-cleaned', {
        detail: { deleted, freed, before: before.ratio, after: after.ratio }
      }));

      return { success: true, deleted, freed };
    } catch (e) {
      this._circuitBreakerFailure();
      console.error('[MemoryManager] Cleanup error:', e);
      return { success: false, error: e.message };
    }
  }

  // ===== حذف شامل / Full Cleanup =====
  _fullCleanup() {
    const result = this._autoCleanup('full');

    // حذف إضافي: sessionStorage
    try {
      const sessionKeys = Object.keys(sessionStorage);
      sessionKeys.forEach(key => {
        if (!CRITICAL_KEYS.some(ck => key.includes(ck))) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (e) {}

    window.dispatchEvent(new CustomEvent('memory-critical-cleaned', {
      detail: { ...result, level: 'critical' }
    }));

    return result;
  }

  // ===== حذف يدوي محدد / Manual Specific Delete =====
  deleteSpecific(keys = []) {
    if (!Array.isArray(keys) || keys.length === 0) {
      return { success: false, reason: 'no_keys_provided' };
    }

    let deleted = 0;
    let skipped = [];

    keys.forEach(key => {
      if (CRITICAL_KEYS.some(ck => key.includes(ck))) {
        skipped.push(key);
        return;
      }
      try {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
        deleted++;
      } catch (e) {}
    });

    this._logCleanup({
      mode: 'manual_specific',
      deleted_keys: deleted,
      skipped_keys: skipped.length,
      requested_keys: keys,
    });

    return { success: true, deleted, skipped };
  }

  // ===== حذف جدول Supabase / Delete Supabase Table =====
  async deleteSupabaseTable(tableName, filter = null, confirm = false) {
    if (!confirm) {
      return { success: false, reason: 'confirmation_required', message: 'Pass confirm=true to proceed' };
    }

    if (!tableName) {
      return { success: false, reason: 'table_name_required' };
    }

    try {
      let query = supabase.from(tableName).delete();

      if (filter && filter.column && filter.value) {
        query = query.eq(filter.column, filter.value);
      } else {
        // حذف كل السجلات - يتطلب filter خاص
        query = query.neq('id', '00000000-0000-0000-0000-000000000000');
      }

      const { error, count } = await query;

      if (error) throw error;

      await this._logCleanup({
        mode: 'supabase_table_delete',
        table: tableName,
        filter: filter,
        deleted_count: count,
      });

      window.dispatchEvent(new CustomEvent('memory-table-deleted', {
        detail: { table: tableName, count, filter }
      }));

      return { success: true, table: tableName, deleted: count };
    } catch (e) {
      console.error('[MemoryManager] Supabase delete error:', e);
      return { success: false, error: e.message };
    }
  }

  // ===== تسجيل عملية الحذف في Supabase =====
  async _logCleanup(details) {
    try {
      await supabase.from('smart_fixes_log').insert({
        fix_id: `mem_${Date.now()}`,
        fix_type: 'memory_cleanup',
        description: `Memory cleanup: ${details.mode || 'auto'}`,
        status: 'success',
        details: details,
        duration_ms: 0,
        applied_at: new Date().toISOString(),
      });
    } catch (e) {
      // لا نوقف النظام بسبب فشل التسجيل
    }
  }

  // ===== Circuit Breaker =====
  _circuitBreakerAllow() {
    if (cbState.status === 'CLOSED') return true;
    if (cbState.status === 'OPEN') {
      const now = Date.now();
      if (now - cbState.lastFailure > CIRCUIT_BREAKER.RESET_TIMEOUT) {
        cbState.status = 'HALF_OPEN';
        return true;
      }
      return false;
    }
    return true; // HALF_OPEN
  }

  _circuitBreakerSuccess() {
    cbState.failures = 0;
    cbState.status = 'CLOSED';
    cbState.lastSuccess = Date.now();
  }

  _circuitBreakerFailure() {
    cbState.failures++;
    cbState.lastFailure = Date.now();
    if (cbState.failures >= CIRCUIT_BREAKER.MAX_FAILURES) {
      cbState.status = 'OPEN';
      console.error('[MemoryManager] Circuit Breaker OPEN - too many failures');
    }
  }

  // ===== إحصاءات النظام / System Stats =====
  getStats() {
    const mem = this.getMemoryUsage();
    return {
      memory: mem,
      circuitBreaker: { ...cbState },
      watchdog: {
        running: this.isRunning,
        interval: WATCHDOG_INTERVAL,
      },
      thresholds: THRESHOLDS,
      stats: this.stats,
      criticalKeys: CRITICAL_KEYS,
    };
  }

  // ===== الحصول على مفاتيح localStorage القابلة للحذف =====
  getDeletableKeys() {
    try {
      return Object.keys(localStorage).filter(key =>
        !CRITICAL_KEYS.some(ck => key.includes(ck))
      ).map(key => ({
        key,
        size: (localStorage.getItem(key) || '').length * 2,
        deletable: DELETABLE_PREFIXES.some(p => key.startsWith(p)),
      }));
    } catch (e) {
      return [];
    }
  }
}

// ===== تصدير Instance وحيد / Singleton Export =====
export const memoryManager = new MemoryManager();
export default MemoryManager;

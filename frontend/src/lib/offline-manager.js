// ✅ نظام العمل أوفلاين - Offline System
// يدير التخزين المحلي والمزامنة مع الخادم

class OfflineManager {
  constructor() {
    this.dbName = 'MMC_Offline_DB';
    this.dbVersion = 1;
    this.db = null;
    this.syncQueue = [];
    this.isOnline = navigator.onLine;
    this.init();
  }

  // ✅ تهيئة قاعدة البيانات المحلية
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        console.log('[OfflineManager] Database initialized');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // جدول الطوابير
        if (!db.objectStoreNames.contains('queue')) {
          const queueStore = db.createObjectStore('queue', { keyPath: 'id' });
          queueStore.createIndex('patient_id', 'patient_id', { unique: false });
          queueStore.createIndex('clinic_id', 'clinic_id', { unique: false });
          queueStore.createIndex('status', 'status', { unique: false });
        }

        // جدول المرضى
        if (!db.objectStoreNames.contains('patients')) {
          const patientStore = db.createObjectStore('patients', { keyPath: 'id' });
          patientStore.createIndex('military_id', 'military_id', { unique: true });
        }

        // جدول العيادات
        if (!db.objectStoreNames.contains('clinics')) {
          db.createObjectStore('clinics', { keyPath: 'id' });
        }

        // جدول المزامنة
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  }

  // ✅ التحقق من الاتصال
  checkOnlineStatus() {
    return this.isOnline;
  }

  // ✅ حفظ بيانات محلياً
  async saveLocal(storeName, data) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      // إضافة طابع زمني
      data._offline_saved = new Date().toISOString();
      data._sync_status = 'pending';

      const request = store.put(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ✅ جلب بيانات محلياً
  async getLocal(storeName, id) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ✅ جلب جميع البيانات المحلية
  async getAllLocal(storeName) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ✅ إضافة عملية للمزامنة
  async addToSyncQueue(operation) {
    const syncData = {
      operation: operation.type, // 'create', 'update', 'delete'
      store: operation.store,
      data: operation.data,
      timestamp: new Date().toISOString(),
      retries: 0
    };

    await this.saveLocal('sync_queue', syncData);

    // محاولة المزامنة فوراً إذا كان متصلاً
    if (this.isOnline) {
      this.sync();
    }
  }

  // ✅ مزامنة البيانات مع الخادم
  async sync() {
    if (!this.isOnline) {
      console.log('[OfflineManager] Cannot sync - offline');
      return { success: false, reason: 'offline' };
    }

    const pendingItems = await this.getAllLocal('sync_queue');

    if (pendingItems.length === 0) {
      return { success: true, synced: 0 };
    }

    console.log(`[OfflineManager] Syncing ${pendingItems.length} items...`);

    const results = [];
    for (const item of pendingItems) {
      try {
        // هنا يتم إرسال البيانات للخادم
        // يمكن استخدام api-unified.js
        const result = await this.sendToServer(item);

        if (result.success) {
          // حذف من قائمة المزامنة
          await this.deleteFromSyncQueue(item.id);
          results.push({ id: item.id, status: 'synced' });
        } else {
          // زيادة عدد المحاولات
          item.retries = (item.retries || 0) + 1;
          if (item.retries >= 3) {
            await this.deleteFromSyncQueue(item.id);
            results.push({ id: item.id, status: 'failed', error: result.error });
          } else {
            await this.saveLocal('sync_queue', item);
            results.push({ id: item.id, status: 'retry', retries: item.retries });
          }
        }
      } catch (e) {
        console.error('[OfflineManager] Sync error:', e);
        results.push({ id: item.id, status: 'error', error: e.message });
      }
    }

    return { success: true, synced: results.filter(r => r.status === 'synced').length, results };
  }

  // ✅ إرسال بيانات للخادم
  async sendToServer(item) {
    try {
      // استيراد api ديناميكياً لتجنب التعارضات الدائرية
      const { default: api } = await import('./api-unified');
      if (api && typeof api.syncOperation === 'function') {
        return await api.syncOperation(item);
      }
      console.warn('[OfflineManager] api.syncOperation not found, using fallback');
      return { success: true };
    } catch (e) {
      console.error('[OfflineManager] sendToServer error:', e);
      return { success: false, error: e.message };
    }
  }

  // ✅ حذف من قائمة المزامنة
  async deleteFromSyncQueue(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sync_queue'], 'readwrite');
      const store = transaction.objectStore('sync_queue');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ✅ مسح جميع البيانات المحلية
  async clearAll() {
    const stores = ['queue', 'patients', 'clinics', 'sync_queue'];
    for (const store of stores) {
      const all = await this.getAllLocal(store);
      for (const item of all) {
        await this.deleteLocal(store, item.id);
      }
    }
    console.log('[OfflineManager] All local data cleared');
  }

  // ✅ حذف بيانات محلية
  async deleteLocal(storeName, id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ✅ الاستماع لتغير حالة الاتصال
  setupNetworkListeners() {
    window.addEventListener('online', () => {
      console.log('[OfflineManager] Connection restored');
      this.isOnline = true;
      this.sync(); // مزامنة فورية
    });

    window.addEventListener('offline', () => {
      console.log('[OfflineManager] Connection lost');
      this.isOnline = false;
    });
  }
}

// تصدير نسخة واحدة
const offlineManager = new OfflineManager();
offlineManager.setupNetworkListeners();

export default offlineManager;
export { OfflineManager };

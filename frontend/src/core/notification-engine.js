// === Real-time UI Toasts for Queue Events (Safe Dynamic Import) ===
import eventBus from './event-bus.js';
import { apiClient } from "@/lib/api/client";

// Cache for operational notification templates
let _opNotifCache = null;
let _opNotifCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getOperationalTemplates() {
  const now = Date.now();
  if (_opNotifCache && (now - _opNotifCacheTime) < CACHE_TTL) {
    return _opNotifCache;
  }
  try {
    // Using apiClient to fetch settings or specific notifications endpoint
    // To maintain compatibility with existing logic, we'll try to fetch clinics or settings
    const data = await apiClient.get('settings');
    if (data) {
      _opNotifCache = {};
      data.forEach(n => { if (n.key) _opNotifCache[n.key] = n.value; });
      _opNotifCacheTime = now;
    }
  } catch (e) {
    console.warn('[NotificationEngine] Failed to load operational templates:', e);
  }
  return _opNotifCache || {};
}


let toast;
(async () => {
  try {
    const { toast: importedToast } = await import('react-hot-toast');
    toast = importedToast;
  } catch (err) {
    toast = {
      success: (msg) => console.info('[Toast ✅]', msg),
      error: (msg) => console.error('[Toast ❌]', msg),
      loading: (msg) => console.info('[Toast ⏳]', msg),
    };
  }

  // Real-time listeners for frontend notifications
  eventBus.on('queue:near_turn', (data) => {
    if (toast) toast.success(`يقترب دورك في ${data?.clinicName || 'العيادة'}`);
  });

  eventBus.on('queue:your_turn', (data) => {
    if (toast) {
      toast.loading(`الآن دورك في ${data?.clinicName || 'العيادة'}`);
      if (navigator.vibrate) navigator.vibrate(200);
      new Audio('/sounds/notify.mp3').play().catch(() => { });
    }
  });

  eventBus.on('queue:step_done', (data) => {
    if (toast) {
      toast.success(
        data?.nextClinic
          ? `تم إنهاء الفحص، توجه إلى ${data.nextClinic}`
          : 'تم إنهاء الفحص، انتظر التعليمات',
      );
    }
  });

  // Manual test helper
  window.testNotify = () => {
    if (toast) {
      toast.success('🔔 اختبار إشعار ناجح!');
      if (navigator.vibrate) navigator.vibrate(100);
    }
  };
})();

// محرك الإشعارات الفوري - Real-time Notifications
// يعمل لحظياً بدون أي تأخير

const NOTIFICATION_TYPES = {
  START_HINT: 'START_HINT',
  NEAR_TURN: 'NEAR_TURN',
  YOUR_TURN: 'YOUR_TURN',
  STEP_DONE_NEXT: 'STEP_DONE_NEXT',
  RESET_DONE: 'RESET_DONE',
  CLINIC_OPENED: 'CLINIC_OPENED',
  CLINIC_CLOSED: 'CLINIC_CLOSED',
  QUEUE_UPDATE: 'QUEUE_UPDATE',
  PIN_GENERATED: 'PIN_GENERATED',
};

// Notification priority levels
const PRIORITY_LEVELS = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  CRITICAL: 4,
};

class RealtimeNotificationEngine {
  constructor() {
    // تخزين الإشعارات
    this.notifications = new Map(); // patientId -> notification[]
    this.adminNotifications = [];
    this.notificationDeduplication = new Map(); // Track sent notifications to prevent duplicates

    // المشتركون - للإشعارات الفورية
    this.subscribers = new Map(); // patientId -> Set<callback>
    this.adminSubscribers = new Set();

    // Configuration
    this.MAX_PATIENT_NOTIFICATIONS = 100;
    this.MAX_ADMIN_NOTIFICATIONS = 200;
    this.NOTIFICATION_TTL = 24 * 60 * 60 * 1000; // 24 hours
    this.DEDUP_WINDOW = 5 * 60 * 1000; // 5 minutes

    // ✅ إصلاح: تحميل الإشعارات المحفوظة فوراً عند التهيئة
    this.loadAllNotifications();

    // ربط مع event bus للإشعارات العامة
    this.setupEventBusListeners();

    // ✅ إصلاح: إعداد تحديث دوري للإشعارات
    this.startNotificationSync();

    // ✅ إصلاح (Fix 20): إعداد تنظيف الذاكرة ومنع infinite loop
    this.startMemoryCleanup();
  }

  // ✅ إصلاح: تحميل جميع الإشعارات المحفوظة
  loadAllNotifications() {
    try {
      // تحميل إشعارات المرضى
      const storedNotifications = localStorage.getItem('patient_notifications');
      if (storedNotifications) {
        const parsed = JSON.parse(storedNotifications);
        Object.keys(parsed).forEach(patientId => {
          this.notifications.set(patientId, parsed[patientId]);
        });
      }

      // تحميل إشعارات الإدارة
      const storedAdminNotifications = localStorage.getItem('admin_notifications');
      if (storedAdminNotifications) {
        this.adminNotifications = JSON.parse(storedAdminNotifications);
      }

      console.log('[NotificationEngine] Loaded saved notifications');
    } catch (e) {
      console.warn('[NotificationEngine] Failed to load saved notifications:', e);
    }
  }

  // ✅ إصلاح: مزامنة الإشعارات بشكل دوري
  startNotificationSync() {
    // مزامنة كل 30 ثانية
    this.syncInterval = setInterval(() => {
      this.syncNotifications();
    }, 30000);
  }

  // ✅ إصلاح: مزامنة الإشعارات مع الخادم
  async syncNotifications() {
    try {
      // يمكن إضافة منطق مزامنة مع الخادم هنا
      // حالياً نكتفي بالحفظ المحلي
      this.saveAllNotifications();
    } catch (e) {
      console.warn('[NotificationEngine] Sync failed:', e);
    }
  }

  // ✅ إصلاح: تنظيف الذاكرة والإشعارات القديمة
  startMemoryCleanup() {
    // Ensure no previous interval exists to prevent duplication
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldNotifications();
    }, 60000); // كل دقيقة
  }

  cleanupOldNotifications() {
    const now = Date.now();

    // تنظيف إشعارات المرضى
    this.notifications.forEach((notifications, patientId) => {
      const filtered = notifications.filter(n => {
        const notifTime = new Date(n.timestamp).getTime();
        return (now - notifTime) < this.NOTIFICATION_TTL;
      });

      if (filtered.length === 0) {
        this.notifications.delete(patientId);
      } else {
        this.notifications.set(patientId, filtered);
      }
    });

    // تنظيف إشعارات الإدارة
    this.adminNotifications = this.adminNotifications.filter(n => {
      const notifTime = new Date(n.timestamp).getTime();
      return (now - notifTime) < this.NOTIFICATION_TTL;
    });

    // تنظيف خريطة الإزالة المكررة
    const dedupKeys = Array.from(this.notificationDeduplication.keys());
    dedupKeys.forEach(key => {
      const timestamp = this.notificationDeduplication.get(key);
      if ((now - timestamp) > this.DEDUP_WINDOW) {
        this.notificationDeduplication.delete(key);
      }
    });

    this.saveAllNotifications();
  }

  // ✅ إصلاح: حفظ جميع الإشعارات
  saveAllNotifications() {
    try {
      // حفظ إشعارات المرضى
      const notificationsObj = {};
      this.notifications.forEach((value, key) => {
        notificationsObj[key] = value;
      });
      localStorage.setItem('patient_notifications', JSON.stringify(notificationsObj));

      // حفظ إشعارات الإدارة
      localStorage.setItem('admin_notifications', JSON.stringify(this.adminNotifications));
    } catch (e) {
      console.warn('[NotificationEngine] Failed to save notifications:', e);
    }
  }

  // === الاشتراك والإلغاء ===

  /**
   * اشتراك المراجع في الإشعارات الفورية
   * @param {string} patientId - معرف المراجع
   * @param {function} callback - دالة يتم استدعاؤها فوراً عند وصول إشعار
   * @returns {function} - دالة لإلغاء الاشتراك
   */
  subscribe(patientId, callback) {
    // إنشاء Set للمشتركين إذا لم يكن موجوداً
    if (!this.subscribers.has(patientId)) {
      this.subscribers.set(patientId, new Set());
    }

    // إضافة callback
    this.subscribers.get(patientId).add(callback);

    // تحميل الإشعارات السابقة من localStorage
    this.loadFromStorage(patientId);

    // إرجاع دالة إلغاء الاشتراك
    return () => {
      const subs = this.subscribers.get(patientId);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscribers.delete(patientId);
        }
      }
    };
  }

  /**
   * اشتراك الإدارة في الإشعارات
   */
  subscribeAdmin(callback) {
    this.adminSubscribers.add(callback);

    // تحميل الإشعارات السابقة
    this.loadAdminNotifications();

    return () => {
      this.adminSubscribers.delete(callback);
    };
  }

  // === إرسال الإشعارات الفورية ===

  /**
   * Check if notification is duplicate
   */
  isDuplicate(patientId, notification) {
    // Fix 19: deduplication logic
    const key = `${patientId}_${notification.type}_${notification.clinicId || ''}_${notification.message || ''}`;
    const lastTime = this.notificationDeduplication.get(key);
    
    if (lastTime && (Date.now() - lastTime) < this.DEDUP_WINDOW) {
      return true;
    }
    
    this.notificationDeduplication.set(key, Date.now());
    return false;
  }

  /**
   * إرسال إشعار فوري للمراجع
   * يتم استدعاء جميع callbacks المشتركة فوراً
   */
  notifyPatient(patientId, notification) {
    // ✅ إصلاح (Fix 19): منع الإشعارات المكررة (deduplication)
    if (this.isDuplicate(patientId, notification)) {
      console.debug('[NotificationEngine] Duplicate notification skipped');
      return;
    }

    // ✅ إصلاح: تحديد الأولوية الافتراضية
    const priority = notification.priority || PRIORITY_LEVELS.NORMAL;

    // إضافة معلومات إضافية
    const fullNotification = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      read: false,
      priority,
      ...notification,
    };

    // حفظ الإشعار
    if (!this.notifications.has(patientId)) {
      this.notifications.set(patientId, []);
    }

    const patientNotifications = this.notifications.get(patientId);
    patientNotifications.push(fullNotification);

    // ✅ إصلاح: الاحتفاظ بآخر N إشعار فقط
    if (patientNotifications.length > this.MAX_PATIENT_NOTIFICATIONS) {
      patientNotifications.shift();
    }

    // ✅ إصلاح: ترتيب حسب الأولوية
    patientNotifications.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    // حفظ في localStorage فوراً
    this.saveToStorage(patientId);

    // إرسال فوري لجميع المشتركين
    const callbacks = this.subscribers.get(patientId);
    if (callbacks && callbacks.size > 0) {
      callbacks.forEach((callback) => {
        try {
          callback(fullNotification);
        } catch (e) {
          console.error('[NotificationEngine] Error in notification callback:', e);
        }
      });
    }

    // إصدار event عام
    eventBus.emit('notification', { patientId, ...fullNotification });

    // تشغيل الصوت والاهتزاز حسب الأولوية
    this.triggerAlerts(fullNotification);
  }

  /**
   * إرسال إشعار فوري للإدارة
   */
  notifyAdmin(notification) {
    // ✅ إصلاح: تحديد الأولوية الافتراضية
    const priority = notification.priority || PRIORITY_LEVELS.NORMAL;

    const fullNotification = {
      id: `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      read: false,
      priority,
      ...notification,
    };

    // حفظ الإشعار
    this.adminNotifications.push(fullNotification);

    // ✅ إصلاح: الاحتفاظ بآخر N إشعار
    if (this.adminNotifications.length > this.MAX_ADMIN_NOTIFICATIONS) {
      this.adminNotifications.shift();
    }

    // ✅ إصلاح: ترتيب حسب الأولوية
    this.adminNotifications.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    // حفظ في localStorage
    localStorage.setItem('admin_notifications', JSON.stringify(this.adminNotifications));

    // إرسال فوري لجميع المشتركين
    this.adminSubscribers.forEach((callback) => {
      try {
        callback(fullNotification);
      } catch (e) {
        console.error('[NotificationEngine] Error in admin notification callback:', e);
      }
    });

    // إصدار event
    eventBus.emit('admin_notification', fullNotification);
  }

  // === إشعارات محددة ===
  setupEventBusListeners() {
      // Logic for event bus listeners
  }

  loadFromStorage(patientId) {
      // Logic to load patient specific notifications
  }

  saveToStorage(patientId) {
      // Logic to save patient specific notifications
  }

  loadAdminNotifications() {
      // Logic to load admin notifications
  }

  triggerAlerts(notification) {
      // Logic to trigger sound/vibration based on priority
      if (notification.priority >= PRIORITY_LEVELS.HIGH) {
        if (navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }
      }
  }

  // Cleanup on destroy
  destroy() {
    if (this.syncInterval) clearInterval(this.syncInterval);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
  }
}

export const notificationEngine = new RealtimeNotificationEngine();
export default notificationEngine;

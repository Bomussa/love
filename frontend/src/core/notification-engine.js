// === Real-time UI Toasts for Queue Events (Safe Dynamic Import) ===
import eventBus from './event-bus.js';
import { apiClient } from "./lib/api/client";

// Cache for operational notification templates from Supabase
let _opNotifCache = null;
let _opNotifCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getOperationalTemplates() {
  const now = Date.now();
  if (_opNotifCache && (now - _opNotifCacheTime) < CACHE_TTL) {
    return _opNotifCache;
  }
  try {
    const { data, error } = await supabase
      .from('operational_notifications')
      .select('*')
      .eq('is_active', true);
    if (!error && data) {
      _opNotifCache = {};
      data.forEach(n => { _opNotifCache[n.event_type] = n; });
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

class RealtimeNotificationEngine {
  constructor() {
    // تخزين الإشعارات
    this.notifications = new Map(); // patientId -> notification[]
    this.adminNotifications = [];

    // المشتركون - للإشعارات الفورية
    this.subscribers = new Map(); // patientId -> Set<callback>
    this.adminSubscribers = new Set();

    // ✅ إصلاح: تحميل الإشعارات المحفوظة فوراً عند التهيئة
    this.loadAllNotifications();

    // ربط مع event bus للإشعارات العامة
    this.setupEventBusListeners();

    // ✅ إصلاح: إعداد تحديث دوري للإشعارات
    this.startNotificationSync();
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
    setInterval(() => {
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
   * إرسال إشعار فوري للمراجع
   * يتم استدعاء جميع callbacks المشتركة فوراً
   */
  notifyPatient(patientId, notification) {
    // إضافة معلومات إضافية
    const fullNotification = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      read: false,
      ...notification,
    };

    // حفظ الإشعار
    if (!this.notifications.has(patientId)) {
      this.notifications.set(patientId, []);
    }
    this.notifications.get(patientId).push(fullNotification);

    // الاحتفاظ بآخر 100 إشعار فقط
    const patientNotifications = this.notifications.get(patientId);
    if (patientNotifications.length > 100) {
      patientNotifications.shift();
    }

    // حفظ في localStorage فوراً
    this.saveToStorage(patientId);

    // إرسال فوري لجميع المشتركين
    const callbacks = this.subscribers.get(patientId);
    if (callbacks && callbacks.size > 0) {
      callbacks.forEach((callback) => {
        try {
          callback(fullNotification);
        } catch (e) {
          // console.error('Error in notification callback:', e)
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
    const fullNotification = {
      id: `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      read: false,
      ...notification,
    };

    // حفظ الإشعار
    this.adminNotifications.push(fullNotification);

    // الاحتفاظ بآخر 200 إشعار
    if (this.adminNotifications.length > 200) {
      this.adminNotifications.shift();
    }

    // حفظ في localStorage
    localStorage.setItem('admin_notifications', JSON.stringify(this.adminNotifications));

    // إرسال فوري لجميع المشتركين
    this.adminSubscribers.forEach((callback) => {
      try {
        callback(fullNotification);
      } catch (e) {
        // console.error('Error in admin notification callback:', e)
      }
    });

    // إصدار event
    eventBus.emit('admin_notification', fullNotification);
  }

  // === الإشعارات المحددة للمراجعين ===

  /**
   * إشعار الترحيب - يُرسل فوراً عند تسجيل الدخول
   */
  async sendWelcome(patientId) {
    const templates = await getOperationalTemplates();
    const t = templates['WELCOME'] || {};
    this.notifyPatient(patientId, {
      type: NOTIFICATION_TYPES.START_HINT,
      title: t.title || '👋 مرحباً بك',
      message: t.message_template || 'تم تسجيل دخولك بنجاح في نظام اللجنة الطبية العسكرية',
      priority: t.priority || 'normal',
      sound: t.sound_enabled || false,
    });
  }

  /**
   * إشعار: اقترب دورك - يُرسل عندما يكون المراجع في المركز 3 أو أقل
   */
  async sendNearTurn(patientId, clinicName, position) {
    const templates = await getOperationalTemplates();
    const t = templates['NEAR_TURN'] || {};
    const title = t.title || '⏰ اقترب دورك';
    const msgTemplate = t.message_template || 'اقترب دورك في {clinic_name}. موقعك الحالي: {position}';
    const message = msgTemplate.replace('{clinic_name}', clinicName).replace('{position}', position);
    this.notifyPatient(patientId, {
      type: NOTIFICATION_TYPES.NEAR_TURN,
      title,
      message,
      clinicName,
      position,
      priority: t.priority || 'high',
      sound: t.sound_enabled !== false,
      vibrate: t.vibration_enabled || false,
    });
  }

  /**
   * إشعار: حان دورك - يُرسل فوراً عندما يصبح المراجع الأول في الطابور
   */
  async sendYourTurn(patientId, clinicName, number) {
    const templates = await getOperationalTemplates();
    const t = templates['YOUR_TURN'] || {};
    const title = t.title || '🔔 حان دورك الآن!';
    const msgTemplate = t.message_template || 'حان دورك في {clinic_name}. رقمك: {queue_number}. توجه للعيادة فوراً';
    const message = msgTemplate.replace('{clinic_name}', clinicName).replace('{queue_number}', number);
    this.notifyPatient(patientId, {
      type: NOTIFICATION_TYPES.YOUR_TURN,
      title,
      message,
      clinicName,
      number,
      priority: t.priority || 'urgent',
      sound: t.sound_enabled !== false,
      vibrate: t.vibration_enabled !== false,
    });
  }

  /**
   * إشعار: انتهى الفحص - يُرسل فوراً بعد إنهاء فحص في عيادة
   */
  async sendStepDone(patientId, currentClinic, nextClinic) {
    const templates = await getOperationalTemplates();
    const t = templates['STEP_DONE_NEXT'] || {};
    const title = t.title || '✅ تم إنهاء الفحص';
    const msgTemplate = t.message_template || 'تم إنهاء {current_clinic}. انتقل الآن إلى {next_clinic}';
    const message = nextClinic
      ? msgTemplate.replace('{current_clinic}', currentClinic).replace('{next_clinic}', nextClinic)
      : `تم إنهاء ${currentClinic}. انتظر التعليمات`;
    this.notifyPatient(patientId, {
      type: NOTIFICATION_TYPES.STEP_DONE_NEXT,
      title,
      message,
      currentClinic,
      nextClinic,
      priority: t.priority || 'high',
      sound: t.sound_enabled !== false,
      vibrate: t.vibration_enabled || false,
    });
  }

  /**
   * إشعار: تحديث موقعك في الطابور - يُرسل عند تغيير الموقع
   */
  async sendQueueUpdate(patientId, clinicName, position, totalWaiting) {
    const templates = await getOperationalTemplates();
    const t = templates['QUEUE_UPDATE'] || {};
    const title = t.title || '📊 تحديث الطابور';
    const msgTemplate = t.message_template || 'موقعك في {clinic_name}: {position} من {total_waiting} منتظر';
    const message = msgTemplate.replace('{clinic_name}', clinicName).replace('{position}', position).replace('{total_waiting}', totalWaiting);
    this.notifyPatient(patientId, {
      type: NOTIFICATION_TYPES.QUEUE_UPDATE,
      title,
      message,
      clinicName,
      position,
      totalWaiting,
      priority: t.priority || 'low',
      sound: t.sound_enabled || false,
      vibrate: t.vibration_enabled || false,
    });
  }

  // === الإشعارات المحددة للإدارة ===

  /**
   * إشعار: تم إعادة تعيين النظام
   */
  sendResetDone() {
    this.notifyAdmin({
      type: NOTIFICATION_TYPES.RESET_DONE,
      title: '🔄 إعادة تعيين النظام',
      message: 'تم إعادة تعيين النظام بنجاح. جميع البيانات تم مسحها',
      priority: 'normal',
    });
  }

  /**
   * إشعار: تم فتح عيادة
   */
  sendClinicOpened(clinicName, pin) {
    this.notifyAdmin({
      type: NOTIFICATION_TYPES.CLINIC_OPENED,
      title: '🟢 فتح عيادة',
      message: `تم فتح ${clinicName}${pin ? ` - PIN: ${pin}` : ''}`,
      clinicName,
      pin,
      priority: 'normal',
    });
  }

  /**
   * إشعار: تم إغلاق عيادة
   */
  sendClinicClosed(clinicName) {
    this.notifyAdmin({
      type: NOTIFICATION_TYPES.CLINIC_CLOSED,
      title: '🔴 إغلاق عيادة',
      message: `تم إغلاق ${clinicName}`,
      clinicName,
      priority: 'normal',
    });
  }

  /**
   * إشعار: تم إنشاء PIN جديد
   */
  sendPINGenerated(clinicName, pin) {
    this.notifyAdmin({
      type: NOTIFICATION_TYPES.PIN_GENERATED,
      title: '🔑 PIN جديد',
      message: `تم إنشاء PIN لـ ${clinicName}: ${pin}`,
      clinicName,
      pin,
      priority: 'high',
    });
  }

  // === التنبيهات (صوت + اهتزاز) ===

  /**
   * تشغيل التنبيهات حسب الأولوية
   */
  triggerAlerts(notification) {
    // الصوت
    if (notification.sound) {
      this.playSound(notification.priority);
    }

    // الاهتزاز
    if (notification.vibrate && 'vibrate' in navigator) {
      switch (notification.priority) {
        case 'urgent':
          navigator.vibrate([200, 100, 200, 100, 200]);
          break;
        case 'high':
          navigator.vibrate([200, 100, 200]);
          break;
        default:
          navigator.vibrate(200);
      }
    }

    // Browser Notification (إذا كان مسموحاً)
    if (notification.priority === 'urgent' || notification.priority === 'high') {
      this.showBrowserNotification(notification);
    }
  }

  /**
   * تشغيل الصوت
   */
  playSound(priority = 'normal') {
    try {
      const audio = new Audio(priority === 'urgent' ? '/sounds/urgent.mp3' : '/sounds/notify.mp3');
      audio.play().catch((e) => {
        // console.warn('Audio play failed:', e)
      });
    } catch (e) {
      // console.error('Error playing sound:', e)
    }
  }

  /**
   * إظهار إشعار المتصفح
   */
  showBrowserNotification(notification) {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/logo.png',
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          new Notification(notification.title, {
            body: notification.message,
            icon: '/logo.png',
          });
        }
      });
    }
  }

  // === إدارة التخزين ===

  saveToStorage(patientId) {
    const data = this.notifications.get(patientId) || [];
    localStorage.setItem(`notifications_${patientId}`, JSON.stringify(data));
  }

  loadFromStorage(patientId) {
    try {
      const data = localStorage.getItem(`notifications_${patientId}`);
      if (data) {
        this.notifications.set(patientId, JSON.parse(data));
      }
    } catch (e) {
      // console.error('Error loading notifications:', e)
    }
  }

  loadAdminNotifications() {
    try {
      const data = localStorage.getItem('admin_notifications');
      if (data) {
        this.adminNotifications = JSON.parse(data);
      }
    } catch (e) {
      // console.error('Error loading admin notifications:', e)
    }
  }

  // === وظائف مساعدة ===

  getNotifications(patientId) {
    return this.notifications.get(patientId) || [];
  }

  getAdminNotifications() {
    return this.adminNotifications;
  }

  markAsRead(patientId, notificationId) {
    const data = this.notifications.get(patientId);
    if (data) {
      const notification = data.find((n) => n.id === notificationId);
      if (notification) {
        notification.read = true;
        this.saveToStorage(patientId);
      }
    }
  }

  markAdminAsRead(notificationId) {
    const notification = this.adminNotifications.find((n) => n.id === notificationId);
    if (notification) {
      notification.read = true;
      localStorage.setItem('admin_notifications', JSON.stringify(this.adminNotifications));
    }
  }

  clearNotifications(patientId) {
    this.notifications.delete(patientId);
    localStorage.removeItem(`notifications_${patientId}`);
  }

  setupEventBusListeners() {
    // الاستماع لأحداث النظام العامة وتحويلها لإشعارات
    eventBus.on('system:reset', () => this.sendResetDone());
    eventBus.on('clinic:opened', (data) => this.sendClinicOpened(data.name, data.pin));
    eventBus.on('clinic:closed', (data) => this.sendClinicClosed(data.name));
    eventBus.on('pin:generated', (data) => this.sendPINGenerated(data.clinicName, data.pin));
  }
}

// تصدير نسخة وحيدة (Singleton)
const notificationEngine = new RealtimeNotificationEngine();
export default notificationEngine;

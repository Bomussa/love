import eventBus from './event-bus.js';

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

  eventBus.on('queue:near_turn', (data) => {
    if (toast) {
      const location = data?.floor || (data?.clinicName?.includes('مختبر') ? 'طابق الميزانين' : 'الطابق الأول');
      toast.success(`اقترب دورك في ${data?.clinicName || 'العيادة'} - توجه إلى ${location}`);
    }
  });

  eventBus.on('queue:your_turn', (data) => {
    if (toast) {
      const location = data?.floor || (data?.clinicName?.includes('مختبر') ? 'طابق الميزانين' : 'الطابق الأول');
      toast.loading(`حان دورك الآن في ${data?.clinicName || 'العيادة'} (${location}) - استخدم البن كود للدخول`);
      if (navigator.vibrate) navigator.vibrate(200);
      new Audio('/sounds/notify.mp3').play().catch(() => { });
    }
  });

  eventBus.on('queue:step_done', (data) => {
    if (toast) {
      const nextLocation = data?.nextFloor || (data?.nextClinic?.includes('مختبر') ? 'طابق الميزانين' : 'الطابق الأول');
      toast.success(
        data?.nextClinic
          ? `تم إنهاء الفحص، توجه إلى ${data.nextClinic} (${nextLocation})`
          : 'تم إنهاء الفحص، انتظر التعليمات',
      );
    }
  });
})();

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
    this.notifications = new Map();
    this.adminNotifications = [];
    this.subscribers = new Map();
    this.adminSubscribers = new Set();
    this.loadAllNotifications();
    this.setupEventBusListeners();
    this.startNotificationSync();
  }

  loadAllNotifications() {
    try {
      const storedNotifications = localStorage.getItem('patient_notifications');
      if (storedNotifications) {
        const parsed = JSON.parse(storedNotifications);
        Object.keys(parsed).forEach(patientId => {
          this.notifications.set(patientId, parsed[patientId]);
        });
      }
      const storedAdminNotifications = localStorage.getItem('admin_notifications');
      if (storedAdminNotifications) {
        this.adminNotifications = JSON.parse(storedAdminNotifications);
      }
    } catch (e) {
      console.warn('[NotificationEngine] Load failed:', e);
    }
  }

  startNotificationSync() {
    setInterval(() => this.saveAllNotifications(), 30000);
  }

  saveAllNotifications() {
    try {
      const notificationsObj = {};
      this.notifications.forEach((value, key) => { notificationsObj[key] = value; });
      localStorage.setItem('patient_notifications', JSON.stringify(notificationsObj));
      localStorage.setItem('admin_notifications', JSON.stringify(this.adminNotifications));
    } catch (e) {
      console.warn('[NotificationEngine] Save failed:', e);
    }
  }

  subscribe(patientId, callback) {
    if (!this.subscribers.has(patientId)) this.subscribers.set(patientId, new Set());
    this.subscribers.get(patientId).add(callback);
    return () => {
      const subs = this.subscribers.get(patientId);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) this.subscribers.delete(patientId);
      }
    };
  }

  subscribeAdmin(callback) {
    this.adminSubscribers.add(callback);
    return () => this.adminSubscribers.delete(callback);
  }

  notifyPatient(patientId, notification) {
    const fullNotification = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      read: false,
      ...notification,
    };
    if (!this.notifications.has(patientId)) this.notifications.set(patientId, []);
    this.notifications.get(patientId).push(fullNotification);
    if (this.notifications.get(patientId).length > 100) this.notifications.get(patientId).shift();
    this.saveAllNotifications();
    const callbacks = this.subscribers.get(patientId);
    if (callbacks) callbacks.forEach(cb => cb(fullNotification));
    eventBus.emit('notification', { patientId, ...fullNotification });
  }

  sendNearTurn(patientId, clinicName, position) {
    const location = clinicName.includes('مختبر') ? 'طابق الميزانين' : 'الطابق الأول';
    this.notifyPatient(patientId, {
      type: NOTIFICATION_TYPES.NEAR_TURN,
      title: '⏰ اقترب دورك',
      message: `اقترب دورك في ${clinicName}. توجه إلى ${location}. موقعك: ${position}`,
      clinicName,
      location,
      priority: 'high',
      sound: true,
    });
  }

  sendYourTurn(patientId, clinicName, number) {
    const location = clinicName.includes('مختبر') ? 'طابق الميزانين' : 'الطابق الأول';
    this.notifyPatient(patientId, {
      type: NOTIFICATION_TYPES.YOUR_TURN,
      title: '🔔 حان دورك الآن!',
      message: `حان دورك في ${clinicName} (${location}). رقمك: ${number}. استخدم البن كود للدخول`,
      clinicName,
      location,
      number,
      priority: 'urgent',
      sound: true,
    });
  }

  sendStepDone(patientId, currentClinic, nextClinic) {
    const nextLocation = nextClinic && nextClinic.includes('مختبر') ? 'طابق الميزانين' : 'الطابق الأول';
    this.notifyPatient(patientId, {
      type: NOTIFICATION_TYPES.STEP_DONE_NEXT,
      title: '✅ تم إنهاء الفحص',
      message: nextClinic
        ? `تم إنهاء ${currentClinic}. انتقل الآن إلى ${nextClinic} (${nextLocation})`
        : `تم إنهاء ${currentClinic}. انتظر التعليمات`,
      priority: 'high',
      sound: true,
    });
  }

  setupEventBusListeners() {
    eventBus.on('queue:near_turn', (data) => {
      if (data.patientId) this.sendNearTurn(data.patientId, data.clinicName, data.position);
    });
    eventBus.on('queue:your_turn', (data) => {
      if (data.patientId) this.sendYourTurn(data.patientId, data.clinicName, data.number);
    });
    eventBus.on('queue:step_done', (data) => {
      if (data.patientId) this.sendStepDone(data.patientId, data.currentClinic, data.nextClinic);
    });
  }

  getNotifications(patientId) { return this.notifications.get(patientId) || []; }
  markAllAsRead(patientId) {
    const notifs = this.notifications.get(patientId);
    if (notifs) notifs.forEach(n => n.read = true);
    this.saveAllNotifications();
  }
}

const notificationEngine = new RealtimeNotificationEngine();
export default notificationEngine;

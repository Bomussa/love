// === Real-time UI Toasts for Queue Events (Safe Dynamic Import) ===
import eventBus from './event-bus.js';
let toast;
(async () => {
  try {
    const { toast: importedToast } = await import('react-hot-toast');
    toast = importedToast;
  } catch (err) {
    toast = {
      success: (msg) => console.log('[Toast ✅]', msg),
      error: (msg) => console.log('[Toast ❌]', msg),
      loading: (msg) => console.info('[Toast ⏳]', msg),
    };

  }

  // Real-time listeners for frontend notifications
  eventBus.on('queue:near_turn', (data) => {
    toast.success(`يقترب دورك في ${data?.clinicName || 'العيادة'}`);
  });

  eventBus.on('queue:your_turn', (data) => {
    toast.loading(`الآن دورك في ${data?.clinicName || 'العيادة'}`);
    if (navigator.vibrate) navigator.vibrate(200);
    new Audio('/sounds/notify.mp3').play().catch(() => { });
  });

  eventBus.on('queue:step_done', (data) => {
    toast.success(
      data?.nextClinic
        ? `تم إنهاء الفحص، توجه إلى ${data.nextClinic}`
        : `تم إنهاء الفحص، انتظر التعليمات`
    );
  });

  // Manual test helper
  window.testNotify = () => {
    toast.success('🔔 اختبار إشعار ناجح!');
    if (navigator.vibrate) navigator.vibrate(100);
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
  PIN_GENERATED: 'PIN_GENERATED'
}

class RealtimeNotificationEngine {
  constructor() {
    // تخزين الإشعارات
    this.notifications = new Map() // patientId -> notification[]
    this.adminNotifications = []

    // المشتركون - للإشعارات الفورية
    this.subscribers = new Map() // patientId -> Set<callback>
    this.adminSubscribers = new Set()

    // ربط مع event bus للإشعارات العامة
    this.setupEventBusListeners()
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
      this.subscribers.set(patientId, new Set())
    }

    // إضافة callback
    this.subscribers.get(patientId).add(callback)

    // تحميل الإشعارات السابقة من localStorage
    this.loadFromStorage(patientId)

    // لا نرسل إشعار ترحيب تلقائياً - فقط عند الطلب الصريح

    // إرجاع دالة إلغاء الاشتراك
    return () => {
      const subs = this.subscribers.get(patientId)
      if (subs) {
        subs.delete(callback)
        if (subs.size === 0) {
          this.subscribers.delete(patientId)
        }
      }
    }
  }

  /**
   * اشتراك الإدارة في الإشعارات
   */
  subscribeAdmin(callback) {
    this.adminSubscribers.add(callback)

    // تحميل الإشعارات السابقة
    this.loadAdminNotifications()

    return () => {
      this.adminSubscribers.delete(callback)
    }
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
      ...notification
    }

    // حفظ الإشعار
    if (!this.notifications.has(patientId)) {
      this.notifications.set(patientId, [])
    }
    this.notifications.get(patientId).push(fullNotification)

    // الاحتفاظ بآخر 100 إشعار فقط
    const patientNotifications = this.notifications.get(patientId)
    if (patientNotifications.length > 100) {
      patientNotifications.shift()
    }

    // حفظ في localStorage فوراً
    this.saveToStorage(patientId)

    // إرسال فوري لجميع المشتركين
    const callbacks = this.subscribers.get(patientId)
    if (callbacks && callbacks.size > 0) {
      callbacks.forEach(callback => {
        try {
          callback(fullNotification)
        } catch (e) {
          // console.warn('Error in notification callback:', e)
        }
      })
    }

    // إصدار event عام
    eventBus.emit('notification', { patientId, ...fullNotification })

    // تشغيل الصوت والاهتزاز حسب الأولوية
    this.triggerAlerts(fullNotification)
  }

  /**
   * إرسال إشعار فوري للإدارة
   */
  notifyAdmin(notification) {
    const fullNotification = {
      id: `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      read: false,
      ...notification
    }

    // حفظ الإشعار
    this.adminNotifications.push(fullNotification)

    // الاحتفاظ بآخر 200 إشعار
    if (this.adminNotifications.length > 200) {
      this.adminNotifications.shift()
    }

    // حفظ في localStorage
    localStorage.setItem('admin_notifications', JSON.stringify(this.adminNotifications))

    // إرسال فوري لجميع المشتركين
    this.adminSubscribers.forEach(callback => {
      try {
        callback(fullNotification)
      } catch (e) {
        // console.warn('Error in admin notification callback:', e)
      }
    })

    // إصدار event
    eventBus.emit('admin_notification', fullNotification)
  }

  // === الإشعارات المحددة للمراجعين ===

  /**
   * إشعار الترحيب - يُرسل فوراً عند تسجيل الدخول
   */
  sendWelcome(patientId) {
    this.notifyPatient(patientId, {
      type: NOTIFICATION_TYPES.START_HINT,
      title: '👋 مرحباً بك',
      message: 'تم تسجيل دخولك بنجاح في نظام اللجنة الطبية العسكرية',
      priority: 'normal',
      sound: false
    })
  }

  /**
   * إشعار: اقترب دورك - يُرسل عندما يكون المراجع في المركز 3 أو أقل
   */
  sendNearTurn(patientId, clinicName, position) {
    this.notifyPatient(patientId, {
      type: NOTIFICATION_TYPES.NEAR_TURN,
      title: '⏰ اقترب دورك',
      message: `اقترب دورك في ${clinicName}. موقعك الحالي: ${position}`,
      clinicName,
      position,
      priority: 'high',
      sound: true,
      vibrate: false
    })
  }

  /**
   * إشعار: حان دورك - يُرسل فوراً عندما يصبح المراجع الأول في الطابور
   */
  sendYourTurn(patientId, clinicName, number) {
    this.notifyPatient(patientId, {
      type: NOTIFICATION_TYPES.YOUR_TURN,
      title: '🔔 حان دورك الآن!',
      message: `حان دورك في ${clinicName}. رقمك: ${number}. توجه للعيادة فوراً`,
      clinicName,
      number,
      priority: 'urgent',
      sound: true,
      vibrate: true
    })
  }

  /**
   * إشعار: انتهى الفحص - يُرسل فوراً بعد إنهاء فحص في عيادة
   */
  sendStepDone(patientId, currentClinic, nextClinic) {
    this.notifyPatient(patientId, {
      type: NOTIFICATION_TYPES.STEP_DONE_NEXT,
      title: '✅ تم إنهاء الفحص',
      message: nextClinic
        ? `تم إنهاء ${currentClinic}. انتقل الآن إلى ${nextClinic}`
        : `تم إنهاء ${currentClinic}. انتظر التعليمات`,
      currentClinic,
      nextClinic,
      priority: 'high',
      sound: true,
      vibrate: false
    })
  }

  /**
   * إشعار: تحديث موقعك في الطابور - يُرسل عند تغيير الموقع
   */
  sendQueueUpdate(patientId, clinicName, position, totalWaiting) {
    // لا نرسل إشعار صوتي لكل تحديث، فقط معلومة
    this.notifyPatient(patientId, {
      type: NOTIFICATION_TYPES.QUEUE_UPDATE,
      title: '📊 تحديث الطابور',
      message: `موقعك في ${clinicName}: ${position} من ${totalWaiting} منتظر`,
      clinicName,
      position,
      totalWaiting,
      priority: 'low',
      sound: false,
      vibrate: false
    })
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
      priority: 'normal'
    })
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
      priority: 'normal'
    })
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
      priority: 'normal'
    })
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
      priority: 'high'
    })
  }

  // === التنبيهات (صوت + اهتزاز) ===

  /**
   * تشغيل التنبيهات حسب الأولوية
   */
  triggerAlerts(notification) {
    // الصوت
    if (notification.sound) {
      this.playSound(notification.priority)
    }

    // الاهتزاز
    if (notification.vibrate && 'vibrate' in navigator) {
      switch (notification.priority) {
        case 'urgent':
          navigator.vibrate([200, 100, 200, 100, 200])
          break
        case 'high':
          navigator.vibrate([200, 100, 200])
          break
        default:
          navigator.vibrate(200)
      }
    }

    // Browser Notification (إذا كان مسموحاً)
    if (notification.priority === 'urgent' || notification.priority === 'high') {
      this.showBrowserNotification(notification)
    }
  }

  /**
   * تشغيل الصوت
   */
  playSound(priority = 'normal') {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      // تحديد التردد والصوت حسب الأولوية
      switch (priority) {
        case 'urgent':
          oscillator.frequency.value = 880 // A5
          gainNode.gain.value = 0.3
          oscillator.start()
          setTimeout(() => {
            oscillator.frequency.value = 1046 // C6
          }, 100)
          setTimeout(() => oscillator.stop(), 300)
          break

        case 'high':
          oscillator.frequency.value = 659 // E5
          gainNode.gain.value = 0.2
          oscillator.start()
          setTimeout(() => oscillator.stop(), 200)
          break

        default:
          oscillator.frequency.value = 523 // C5
          gainNode.gain.value = 0.15
          oscillator.start()
          setTimeout(() => oscillator.stop(), 150)
      }
    } catch (e) {

    }
  }

  /**
   * عرض إشعار المتصفح
   */
  async showBrowserNotification(notification) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/logo.png',
        badge: '/logo.png',
        tag: notification.id,
        requireInteraction: notification.priority === 'urgent'
      })
    } else if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
  }

  // === إدارة الإشعارات ===

  /**
   * وضع علامة مقروء
   */
  markAsRead(patientId, notificationId) {
    const notifications = this.notifications.get(patientId)
    if (notifications) {
      const notification = notifications.find(n => n.id === notificationId)
      if (notification) {
        notification.read = true
        this.saveToStorage(patientId)
      }
    }
  }

  /**
   * وضع علامة مقروء على الكل
   */
  markAllAsRead(patientId) {
    const notifications = this.notifications.get(patientId)
    if (notifications) {
      notifications.forEach(n => n.read = true)
      this.saveToStorage(patientId)
    }
  }

  /**
   * الحصول على جميع الإشعارات
   */
  getNotifications(patientId) {
    return this.notifications.get(patientId) || []
  }

  /**
   * الحصول على الإشعارات غير المقروءة
   */
  getUnreadNotifications(patientId) {
    const notifications = this.notifications.get(patientId) || []
    return notifications.filter(n => !n.read)
  }

  /**
   * مسح جميع الإشعارات
   */
  clearAll(patientId) {
    this.notifications.delete(patientId)
    localStorage.removeItem(`notifications_${patientId}`)
  }

  // === التخزين ===

  saveToStorage(patientId) {
    const notifications = this.notifications.get(patientId)
    if (notifications) {
      localStorage.setItem(`notifications_${patientId}`, JSON.stringify(notifications))
    }
  }

  loadFromStorage(patientId) {
    const stored = localStorage.getItem(`notifications_${patientId}`)
    if (stored) {
      try {
        const notifications = JSON.parse(stored)
        this.notifications.set(patientId, notifications)
      } catch (e) {
        // console.warn('Error loading notifications:', e)
      }
    }
  }

  loadAdminNotifications() {
    const stored = localStorage.getItem('admin_notifications')
    if (stored) {
      try {
        this.adminNotifications = JSON.parse(stored)
      } catch (e) {
        // console.warn('Error loading admin notifications:', e)
      }
    }
  }

  // === Event Bus Integration ===

  setupEventBusListeners() {
    // الاستماع للأحداث من أجزاء أخرى من التطبيق
    eventBus.on('queue:near_turn', ({ patientId, clinicName, position }) => {
      this.sendNearTurn(patientId, clinicName, position)
    })

    eventBus.on('queue:your_turn', ({ patientId, clinicName, number }) => {
      this.sendYourTurn(patientId, clinicName, number)
    })

    eventBus.on('queue:step_done', ({ patientId, currentClinic, nextClinic }) => {
      this.sendStepDone(patientId, currentClinic, nextClinic)
    })

    eventBus.on('queue:update', ({ patientId, clinicName, position, totalWaiting }) => {
      this.sendQueueUpdate(patientId, clinicName, position, totalWaiting)
    })

    eventBus.on('clinic:opened', ({ clinicName, pin }) => {
      this.sendClinicOpened(clinicName, pin)
    })

    eventBus.on('clinic:closed', ({ clinicName }) => {
      this.sendClinicClosed(clinicName)
    })

    eventBus.on('pin:generated', ({ clinicName, pin }) => {
      this.sendPINGenerated(clinicName, pin)
    })

    eventBus.on('system:reset', () => {
      this.sendResetDone()
    })
  }
}

// Singleton instance
const notificationEngine = new RealtimeNotificationEngine()

export default notificationEngine
export { RealtimeNotificationEngine, NOTIFICATION_TYPES }


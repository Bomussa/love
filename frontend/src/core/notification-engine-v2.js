// محرك الإشعارات - النسخة المحدثة بدون تداخل
import eventBus from './event-bus.js'

// أنواع الإشعارات
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

class NotificationEngineV2 {
  constructor() {
    // تخزين الإشعارات
    this.notifications = new Map() // patientId -> notification[]
    this.adminNotifications = []

    // المشتركون - للإشعارات الفورية
    this.subscribers = new Map() // patientId -> Set<callback>
    this.adminSubscribers = new Set()

    // تتبع الإشعارات المرسلة لمنع التكرار
    this.sentNotifications = new Set()

    // ربط مع event bus
    this.setupEventBusListeners()

    console.log('[NotificationEngineV2] Initialized without duplication')
  }

  // === منع التكرار ===

  /**
   * إنشاء مفتاح فريد للإشعار
   */
  getNotificationKey(patientId, type, clinicName = '') {
    return `${patientId}:${type}:${clinicName}`
  }

  /**
   * التحقق من إرسال الإشعار مسبقاً
   */
  wasRecentlySent(key, timeWindow = 60000) {
    const now = Date.now()
    const lastSent = this.sentNotifications.get(key)
    
    if (lastSent && (now - lastSent) < timeWindow) {
      return true // تم إرساله مؤخراً
    }
    
    return false
  }

  /**
   * تسجيل إرسال الإشعار
   */
  markAsSent(key) {
    this.sentNotifications.set(key, Date.now())
    
    // تنظيف الإشعارات القديمة (أكثر من ساعة)
    const oneHourAgo = Date.now() - 3600000
    for (const [k, timestamp] of this.sentNotifications.entries()) {
      if (timestamp < oneHourAgo) {
        this.sentNotifications.delete(k)
      }
    }
  }

  // === الاشتراك والإلغاء ===

  /**
   * اشتراك المراجع في الإشعارات الفورية
   */
  subscribe(patientId, callback) {
    if (!this.subscribers.has(patientId)) {
      this.subscribers.set(patientId, new Set())
    }

    this.subscribers.get(patientId).add(callback)
    this.loadFromStorage(patientId)

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
    this.loadAdminNotifications()

    return () => {
      this.adminSubscribers.delete(callback)
    }
  }

  // === إرسال الإشعارات الفورية ===

  /**
   * إرسال إشعار فوري للمراجع (مع منع التكرار)
   */
  notifyPatient(patientId, notification) {
    // التحقق من التكرار
    const key = this.getNotificationKey(
      patientId,
      notification.type,
      notification.clinicName || ''
    )

    if (this.wasRecentlySent(key)) {
      console.log(`[NotificationEngineV2] Skipping duplicate notification: ${key}`)
      return
    }

    // تسجيل الإرسال
    this.markAsSent(key)

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

    // الاحتفاظ بآخر 50 إشعار فقط
    const patientNotifications = this.notifications.get(patientId)
    if (patientNotifications.length > 50) {
      patientNotifications.shift()
    }

    // حفظ في localStorage
    this.saveToStorage(patientId)

    // إرسال فوري لجميع المشتركين
    const callbacks = this.subscribers.get(patientId)
    if (callbacks && callbacks.size > 0) {
      callbacks.forEach(callback => {
        try {
          callback(fullNotification)
        } catch (e) {
          console.error('[NotificationEngineV2] Error in callback:', e)
        }
      })
    }

    // إصدار event عام
    eventBus.emit('notification', { patientId, ...fullNotification })

    // تشغيل التنبيهات
    this.triggerAlerts(fullNotification)

    console.log(`[NotificationEngineV2] Sent notification to ${patientId}:`, notification.type)
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

    // الاحتفاظ بآخر 100 إشعار
    if (this.adminNotifications.length > 100) {
      this.adminNotifications.shift()
    }

    // حفظ في localStorage
    localStorage.setItem('admin_notifications', JSON.stringify(this.adminNotifications))

    // إرسال فوري لجميع المشتركين
    this.adminSubscribers.forEach(callback => {
      try {
        callback(fullNotification)
      } catch (e) {
        console.error('[NotificationEngineV2] Error in admin callback:', e)
      }
    })

    // إصدار event
    eventBus.emit('admin_notification', fullNotification)

    console.log('[NotificationEngineV2] Sent admin notification:', notification.type)
  }

  // === الإشعارات المحددة للمراجعين ===

  sendWelcome(patientId) {
    this.notifyPatient(patientId, {
      type: NOTIFICATION_TYPES.START_HINT,
      title: '👋 مرحباً بك',
      message: 'تم تسجيل دخولك بنجاح في نظام اللجنة الطبية العسكرية',
      priority: 'normal',
      sound: false
    })
  }

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

  sendQueueUpdate(patientId, clinicName, position, totalWaiting) {
    // لا نرسل إشعار صوتي لكل تحديث
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

  sendResetDone() {
    this.notifyAdmin({
      type: NOTIFICATION_TYPES.RESET_DONE,
      title: '🔄 إعادة تعيين النظام',
      message: 'تم إعادة تعيين النظام بنجاح',
      priority: 'normal'
    })
  }

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

  sendClinicClosed(clinicName) {
    this.notifyAdmin({
      type: NOTIFICATION_TYPES.CLINIC_CLOSED,
      title: '🔴 إغلاق عيادة',
      message: `تم إغلاق ${clinicName}`,
      clinicName,
      priority: 'normal'
    })
  }

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

    // Browser Notification
    if (notification.priority === 'urgent' || notification.priority === 'high') {
      this.showBrowserNotification(notification)
    }
  }

  playSound(priority = 'normal') {
    try {
      const soundFile = priority === 'urgent' ? '/sounds/urgent.mp3' : '/sounds/notify.mp3'
      const audio = new Audio(soundFile)
      audio.volume = 0.7
      audio.play().catch(() => {})
    } catch (e) {
      // Ignore sound errors
    }
  }

  showBrowserNotification(notification) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/logo.png',
        badge: '/badge.png',
        tag: notification.type,
        renotify: false
      })
    }
  }

  // === التخزين المحلي ===

  saveToStorage(patientId) {
    try {
      const notifications = this.notifications.get(patientId) || []
      localStorage.setItem(`notifications_${patientId}`, JSON.stringify(notifications))
    } catch (e) {
      console.error('[NotificationEngineV2] Error saving to storage:', e)
    }
  }

  loadFromStorage(patientId) {
    try {
      const stored = localStorage.getItem(`notifications_${patientId}`)
      if (stored) {
        const notifications = JSON.parse(stored)
        this.notifications.set(patientId, notifications)
      }
    } catch (e) {
      console.error('[NotificationEngineV2] Error loading from storage:', e)
    }
  }

  loadAdminNotifications() {
    try {
      const stored = localStorage.getItem('admin_notifications')
      if (stored) {
        this.adminNotifications = JSON.parse(stored)
      }
    } catch (e) {
      console.error('[NotificationEngineV2] Error loading admin notifications:', e)
    }
  }

  // === Event Bus Listeners ===

  setupEventBusListeners() {
    // Queue events
    eventBus.on('queue:near_turn', (data) => {
      this.sendNearTurn(data.patientId, data.clinicName, data.position)
    })

    eventBus.on('queue:your_turn', (data) => {
      this.sendYourTurn(data.patientId, data.clinicName, data.number)
    })

    eventBus.on('queue:update', (data) => {
      if (data.position && data.totalWaiting) {
        this.sendQueueUpdate(data.patientId, data.clinicName || 'العيادة', data.position, data.totalWaiting)
      }
    })

    eventBus.on('queue:step_done', (data) => {
      this.sendStepDone(data.patientId, data.currentClinic, data.nextClinic)
    })

    console.log('[NotificationEngineV2] Event bus listeners setup complete')
  }

  // === إدارة الإشعارات ===

  getNotifications(patientId) {
    return this.notifications.get(patientId) || []
  }

  getUnreadCount(patientId) {
    const notifications = this.getNotifications(patientId)
    return notifications.filter(n => !n.read).length
  }

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

  markAllAsRead(patientId) {
    const notifications = this.notifications.get(patientId)
    if (notifications) {
      notifications.forEach(n => n.read = true)
      this.saveToStorage(patientId)
    }
  }

  clearNotifications(patientId) {
    this.notifications.delete(patientId)
    localStorage.removeItem(`notifications_${patientId}`)
  }

  clearOldNotifications(patientId, olderThan = 86400000) {
    const notifications = this.notifications.get(patientId)
    if (notifications) {
      const now = Date.now()
      const filtered = notifications.filter(n => {
        const age = now - new Date(n.timestamp).getTime()
        return age < olderThan
      })
      this.notifications.set(patientId, filtered)
      this.saveToStorage(patientId)
    }
  }
}

// Singleton instance
const notificationEngineV2 = new NotificationEngineV2()

export default notificationEngineV2
export { NotificationEngineV2, NOTIFICATION_TYPES }

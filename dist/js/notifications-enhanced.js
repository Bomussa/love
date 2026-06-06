/**
 * نظام الإشعارات المحسّن - دليل المراجع
 * يعمل بشكل لحظي مع نغمة بسيطة وواضحة
 * يوفر دليل كامل للمراجع لإنهاء الفحص
 */

class EnhancedNotificationSystem {
  constructor() {
    this.notifications = []
    this.audioContext = null
    this.eventSource = null
    this.isConnected = false
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 10
    this.notificationContainer = null
    this.guidePanel = null
    
    this.init()
  }

  /**
   * تهيئة النظام
   */
  init() {
    this.createNotificationContainer()
    this.createGuidePanel()
    this.setupAudioContext()
    this.connectToEventStream()
    this.requestNotificationPermission()
    
    // تحميل الإشعارات المحفوظة
    this.loadStoredNotifications()
    
    console.log('✅ نظام الإشعارات المحسّن جاهز')
  }

  /**
   * إنشاء حاوية الإشعارات
   */
  createNotificationContainer() {
    this.notificationContainer = document.createElement('div')
    this.notificationContainer.id = 'notification-container'
    this.notificationContainer.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 999999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: 500px;
      width: 90%;
      pointer-events: none;
    `
    document.body.appendChild(this.notificationContainer)
  }

  /**
   * إنشاء لوحة الدليل
   */
  createGuidePanel() {
    this.guidePanel = document.createElement('div')
    this.guidePanel.id = 'guide-panel'
    this.guidePanel.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      max-width: 350px;
      z-index: 999998;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      display: none;
    `
    
    this.guidePanel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h3 style="margin: 0; font-size: 18px; font-weight: 600;">📋 دليل المراجع</h3>
        <button onclick="notificationSystem.toggleGuide()" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 5px 10px; border-radius: 8px; cursor: pointer; font-size: 14px;">إخفاء</button>
      </div>
      <div id="guide-content" style="font-size: 14px; line-height: 1.8;">
        <p style="margin: 10px 0;">مرحباً بك في نظام اللجنة الطبية العسكرية</p>
      </div>
    `
    
    document.body.appendChild(this.guidePanel)
  }

  /**
   * تبديل عرض الدليل
   */
  toggleGuide() {
    if (this.guidePanel.style.display === 'none') {
      this.guidePanel.style.display = 'block'
    } else {
      this.guidePanel.style.display = 'none'
    }
  }

  /**
   * تحديث محتوى الدليل
   */
  updateGuide(content) {
    const guideContent = document.getElementById('guide-content')
    if (guideContent) {
      guideContent.innerHTML = content
      this.guidePanel.style.display = 'block'
    }
  }

  /**
   * إعداد سياق الصوت
   */
  setupAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
    } catch (e) {
      console.warn('⚠️ Audio Context غير متاح:', e)
    }
  }

  /**
   * تشغيل نغمة بسيطة وواضحة
   */
  playSimpleNotificationSound(type = 'normal') {
    if (!this.audioContext) return

    try {
      // إنشاء oscillator للنغمة
      const oscillator = this.audioContext.createOscillator()
      const gainNode = this.audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(this.audioContext.destination)

      // تحديد النغمة حسب النوع
      switch (type) {
        case 'urgent': // حان دورك
          oscillator.frequency.value = 880 // A5 - نغمة عالية
          gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5)
          oscillator.start()
          oscillator.stop(this.audioContext.currentTime + 0.5)
          
          // نغمة ثانية للتأكيد
          setTimeout(() => {
            const osc2 = this.audioContext.createOscillator()
            const gain2 = this.audioContext.createGain()
            osc2.connect(gain2)
            gain2.connect(this.audioContext.destination)
            osc2.frequency.value = 1046 // C6
            gain2.gain.setValueAtTime(0.3, this.audioContext.currentTime)
            gain2.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5)
            osc2.start()
            osc2.stop(this.audioContext.currentTime + 0.5)
          }, 200)
          break

        case 'high': // اقترب دورك
          oscillator.frequency.value = 659 // E5 - نغمة متوسطة
          gainNode.gain.setValueAtTime(0.25, this.audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.4)
          oscillator.start()
          oscillator.stop(this.audioContext.currentTime + 0.4)
          break

        case 'success': // تم إنهاء الفحص
          oscillator.frequency.value = 523 // C5
          gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3)
          oscillator.start()
          oscillator.stop(this.audioContext.currentTime + 0.3)
          break

        default: // إشعار عادي
          oscillator.frequency.value = 440 // A4
          gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2)
          oscillator.start()
          oscillator.stop(this.audioContext.currentTime + 0.2)
      }
    } catch (e) {
      console.warn('⚠️ خطأ في تشغيل الصوت:', e)
    }
  }

  /**
   * الاتصال بتدفق الأحداث
   */
  connectToEventStream() {
    try {
      this.eventSource = new EventSource('/api/events')
      
      this.eventSource.onopen = () => {
        this.isConnected = true
        this.reconnectAttempts = 0
        console.log('✅ متصل بتدفق الأحداث')
      }

      this.eventSource.addEventListener('notification', (event) => {
        try {
          const notification = JSON.parse(event.data)
          this.handleNotification(notification)
        } catch (e) {
          console.error('❌ خطأ في معالجة الإشعار:', e)
        }
      })

      this.eventSource.onerror = () => {
        this.isConnected = false
        console.warn('⚠️ انقطع الاتصال بتدفق الأحداث')
        
        // إعادة الاتصال
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++
          setTimeout(() => {
            console.log(`🔄 محاولة إعادة الاتصال (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
            this.connectToEventStream()
          }, 3000 * this.reconnectAttempts)
        }
      }
    } catch (e) {
      console.error('❌ خطأ في الاتصال بتدفق الأحداث:', e)
    }
  }

  /**
   * معالجة الإشعار الوارد
   */
  handleNotification(notification) {
    // حفظ الإشعار
    this.notifications.unshift(notification)
    this.saveNotifications()

    // عرض الإشعار
    this.showNotification(notification)

    // تشغيل الصوت والاهتزاز
    this.triggerAlerts(notification)

    // تحديث الدليل
    this.updateGuideBasedOnNotification(notification)

    // إشعار المتصفح
    if (notification.priority === 'urgent' || notification.priority === 'high') {
      this.showBrowserNotification(notification)
    }
  }

  /**
   * عرض الإشعار على الشاشة
   */
  showNotification(notification) {
    const notifElement = document.createElement('div')
    notifElement.className = 'notification-toast'
    
    // تحديد اللون حسب النوع
    let bgColor = '#2c3e50'
    let icon = '🔔'
    
    switch (notification.type) {
      case 'YOUR_TURN':
        bgColor = '#e74c3c'
        icon = '🔴'
        break
      case 'NEAR_TURN':
        bgColor = '#f39c12'
        icon = '⏰'
        break
      case 'STEP_DONE_NEXT':
        bgColor = '#27ae60'
        icon = '✅'
        break
      case 'QUEUE_UPDATE':
        bgColor = '#3498db'
        icon = '📊'
        break
      case 'START_HINT':
        bgColor = '#9b59b6'
        icon = '👋'
        break
      default:
        bgColor = '#34495e'
        icon = '📢'
    }

    notifElement.style.cssText = `
      background: ${bgColor};
      color: white;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      gap: 12px;
      pointer-events: auto;
      cursor: pointer;
      transition: all 0.3s ease;
      animation: slideInDown 0.5s ease;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `

    notifElement.innerHTML = `
      <div style="font-size: 24px;">${icon}</div>
      <div style="flex: 1;">
        <div style="font-weight: 600; font-size: 16px; margin-bottom: 4px;">${notification.title || ''}</div>
        <div style="font-size: 14px; opacity: 0.95;">${notification.message || ''}</div>
      </div>
      <button onclick="this.parentElement.remove()" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">إغلاق</button>
    `

    // إضافة الأنيميشن
    const style = document.createElement('style')
    style.textContent = `
      @keyframes slideInDown {
        from {
          transform: translateY(-100px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
    `
    if (!document.querySelector('style[data-notification-styles]')) {
      style.setAttribute('data-notification-styles', 'true')
      document.head.appendChild(style)
    }

    this.notificationContainer.appendChild(notifElement)

    // إزالة تلقائية بعد مدة
    const ttl = notification.ttl || (notification.priority === 'urgent' ? 15000 : 8000)
    setTimeout(() => {
      notifElement.style.opacity = '0'
      notifElement.style.transform = 'translateX(100%)'
      setTimeout(() => notifElement.remove(), 300)
    }, ttl)
  }

  /**
   * تحديث الدليل بناءً على الإشعار
   */
  updateGuideBasedOnNotification(notification) {
    let guideContent = ''

    switch (notification.type) {
      case 'START_HINT':
        guideContent = `
          <p style="margin: 10px 0;"><strong>مرحباً بك!</strong></p>
          <p style="margin: 10px 0;">تم تسجيل دخولك بنجاح في نظام اللجنة الطبية العسكرية</p>
          <div style="background: rgba(255,255,255,0.1); padding: 12px; border-radius: 8px; margin-top: 12px;">
            <p style="margin: 5px 0; font-size: 13px;"><strong>الخطوات التالية:</strong></p>
            <ol style="margin: 8px 0; padding-inline-start: 20px; font-size: 13px;">
              <li>انتظر فتح العيادة الأولى</li>
              <li>ستصلك إشعارات بموقعك في الطابور</li>
              <li>عند اقتراب دورك ستتلقى تنبيه</li>
              <li>عند حلول دورك توجه للعيادة فوراً</li>
            </ol>
          </div>
        `
        break

      case 'NEAR_TURN':
        guideContent = `
          <p style="margin: 10px 0;"><strong>⏰ اقترب دورك!</strong></p>
          <p style="margin: 10px 0;">موقعك الحالي: <strong>${notification.position || 'غير محدد'}</strong></p>
          <p style="margin: 10px 0;">العيادة: <strong>${notification.clinicName || 'غير محدد'}</strong></p>
          <div style="background: rgba(255,255,255,0.1); padding: 12px; border-radius: 8px; margin-top: 12px;">
            <p style="margin: 5px 0; font-size: 13px;"><strong>تعليمات:</strong></p>
            <ul style="margin: 8px 0; padding-inline-start: 20px; font-size: 13px;">
              <li>تأكد من تواجدك بالقرب من العيادة</li>
              <li>جهز أوراقك ومستنداتك</li>
              <li>انتظر الإشعار التالي</li>
            </ul>
          </div>
        `
        break

      case 'YOUR_TURN':
        guideContent = `
          <p style="margin: 10px 0; font-size: 18px;"><strong>🔴 حان دورك الآن!</strong></p>
          <p style="margin: 10px 0;">رقمك: <strong style="font-size: 24px;">${notification.number || 'غير محدد'}</strong></p>
          <p style="margin: 10px 0;">العيادة: <strong>${notification.clinicName || 'غير محدد'}</strong></p>
          <div style="background: rgba(255,255,255,0.2); padding: 12px; border-radius: 8px; margin-top: 12px; border: 2px solid rgba(255,255,255,0.4);">
            <p style="margin: 5px 0; font-size: 14px;"><strong>⚠️ توجه للعيادة فوراً</strong></p>
            <p style="margin: 5px 0; font-size: 13px;">احمل معك جميع المستندات المطلوبة</p>
          </div>
        `
        break

      case 'STEP_DONE_NEXT':
        guideContent = `
          <p style="margin: 10px 0;"><strong>✅ تم إنهاء الفحص</strong></p>
          <p style="margin: 10px 0;">العيادة المنتهية: <strong>${notification.currentClinic || 'غير محدد'}</strong></p>
          ${notification.nextClinic ? `
            <p style="margin: 10px 0;">العيادة التالية: <strong>${notification.nextClinic}</strong></p>
            <div style="background: rgba(255,255,255,0.1); padding: 12px; border-radius: 8px; margin-top: 12px;">
              <p style="margin: 5px 0; font-size: 13px;"><strong>الخطوة التالية:</strong></p>
              <ul style="margin: 8px 0; padding-inline-start: 20px; font-size: 13px;">
                <li>توجه إلى ${notification.nextClinic}</li>
                <li>ستتلقى إشعار بموقعك في الطابور</li>
                <li>انتظر دورك</li>
              </ul>
            </div>
          ` : `
            <p style="margin: 10px 0; color: #ffd700;">انتظر التعليمات من الإدارة</p>
          `}
        `
        break

      case 'QUEUE_UPDATE':
        guideContent = `
          <p style="margin: 10px 0;"><strong>📊 تحديث الطابور</strong></p>
          <p style="margin: 10px 0;">العيادة: <strong>${notification.clinicName || 'غير محدد'}</strong></p>
          <p style="margin: 10px 0;">موقعك: <strong>${notification.position || 'غير محدد'}</strong> من <strong>${notification.totalWaiting || 'غير محدد'}</strong></p>
          <div style="background: rgba(255,255,255,0.1); padding: 12px; border-radius: 8px; margin-top: 12px;">
            <p style="margin: 5px 0; font-size: 13px;">ستتلقى إشعار عندما يقترب دورك</p>
          </div>
        `
        break

      default:
        guideContent = `
          <p style="margin: 10px 0;">${notification.message || ''}</p>
        `
    }

    this.updateGuide(guideContent)
  }

  /**
   * تشغيل التنبيهات (صوت + اهتزاز)
   */
  triggerAlerts(notification) {
    // تحديد نوع الصوت
    let soundType = 'normal'
    
    if (notification.type === 'YOUR_TURN') {
      soundType = 'urgent'
    } else if (notification.type === 'NEAR_TURN') {
      soundType = 'high'
    } else if (notification.type === 'STEP_DONE_NEXT') {
      soundType = 'success'
    }

    // تشغيل الصوت
    if (notification.sound !== false) {
      this.playSimpleNotificationSound(soundType)
    }

    // الاهتزاز
    if (notification.vibrate && 'vibrate' in navigator) {
      switch (soundType) {
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
  }

  /**
   * طلب إذن الإشعارات
   */
  async requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
  }

  /**
   * عرض إشعار المتصفح
   */
  showBrowserNotification(notification) {
    if ('Notification' in window && Notification.permission === 'granted') {
      const browserNotif = new Notification(notification.title || 'إشعار', {
        body: notification.message || '',
        icon: '/logo.png',
        badge: '/logo.png',
        tag: notification.id || 'notification',
        requireInteraction: notification.priority === 'urgent',
        vibrate: notification.vibrate ? [200, 100, 200] : undefined
      })

      browserNotif.onclick = () => {
        window.focus()
        browserNotif.close()
      }
    }
  }

  /**
   * حفظ الإشعارات في localStorage
   */
  saveNotifications() {
    try {
      // الاحتفاظ بآخر 50 إشعار فقط
      const toSave = this.notifications.slice(0, 50)
      localStorage.setItem('notifications', JSON.stringify(toSave))
    } catch (e) {
      console.warn('⚠️ خطأ في حفظ الإشعارات:', e)
    }
  }

  /**
   * تحميل الإشعارات المحفوظة
   */
  loadStoredNotifications() {
    try {
      const stored = localStorage.getItem('notifications')
      if (stored) {
        this.notifications = JSON.parse(stored)
      }
    } catch (e) {
      console.warn('⚠️ خطأ في تحميل الإشعارات:', e)
    }
  }

  /**
   * الحصول على جميع الإشعارات
   */
  getNotifications() {
    return this.notifications
  }

  /**
   * مسح جميع الإشعارات
   */
  clearNotifications() {
    this.notifications = []
    localStorage.removeItem('notifications')
  }
}

// إنشاء instance عام
const notificationSystem = new EnhancedNotificationSystem()

// تصدير للاستخدام العام
window.notificationSystem = notificationSystem

// اختبار يدوي
window.testNotification = (type = 'normal') => {
  const testNotifications = {
    normal: {
      type: 'START_HINT',
      title: '👋 مرحباً بك',
      message: 'هذا إشعار اختباري عادي',
      priority: 'normal',
      sound: true
    },
    near: {
      type: 'NEAR_TURN',
      title: '⏰ اقترب دورك',
      message: 'موقعك الحالي: 2',
      clinicName: 'عيادة الباطنية',
      position: 2,
      priority: 'high',
      sound: true,
      vibrate: false
    },
    your_turn: {
      type: 'YOUR_TURN',
      title: '🔴 حان دورك الآن!',
      message: 'توجه للعيادة فوراً',
      clinicName: 'عيادة الباطنية',
      number: 15,
      priority: 'urgent',
      sound: true,
      vibrate: true
    },
    done: {
      type: 'STEP_DONE_NEXT',
      title: '✅ تم إنهاء الفحص',
      message: 'انتقل إلى العيادة التالية',
      currentClinic: 'عيادة الباطنية',
      nextClinic: 'عيادة العيون',
      priority: 'high',
      sound: true
    }
  }

  const notification = testNotifications[type] || testNotifications.normal
  notificationSystem.handleNotification(notification)
}

console.log('✅ نظام الإشعارات المحسّن تم تحميله بنجاح')
console.log('💡 للاختبار: testNotification("normal") أو testNotification("near") أو testNotification("your_turn") أو testNotification("done")')


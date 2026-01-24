import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * نظام الإشعارات التعريفية الشامل
 * - إشعارات تعريفية بالطريقة والمكان والوقت والدور والاتجاه
 * - نظام Queue لإدارة الإشعارات المتعددة بدون تداخل
 * - تصميم مناسب للهاتف مع الحفاظ على الهوية البصرية
 * - اللغة تتغير فقط عند تغيير إعدادات اللغة
 */
export default function NotificationSystem({ 
  patientId, 
  currentClinic, 
  yourNumber, 
  currentServing,
  allStationsCompleted,
  language = 'ar'
}) {
  const [notification, setNotification] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);
  
  // Queue للإشعارات لمنع التداخل
  const notificationQueueRef = useRef([]);
  const isShowingNotificationRef = useRef(false);
  const notificationTimeoutRef = useRef(null);
  
  const lastPositionRef = useRef(null);
  const lastClinicRef = useRef(null);
  const lastFloorRef = useRef(null);
  const hasShownInitialFloorGuide = useRef(false);
  const hasShownCompletionNotice = useRef(false);
  const hasShownWelcome = useRef(false);
  const hasShownQueueExplanation = useRef(false);

  // دالة الترجمة - تستخدم اللغة المحددة من الإعدادات فقط
  const t = useCallback((ar, en) => {
    return language === 'ar' ? ar : en;
  }, [language]);

  // دالة لعرض الإشعار التالي من Queue
  const showNextNotification = useCallback(() => {
    if (notificationQueueRef.current.length === 0) {
      isShowingNotificationRef.current = false;
      setNotification(null);
      return;
    }

    isShowingNotificationRef.current = true;
    const nextNotif = notificationQueueRef.current.shift();
    setNotification(nextNotif.notification);

    // تشغيل الصوت
    if (nextNotif.sound) {
      playNotificationSound(nextNotif.sound);
    }

    // اهتزاز إذا مطلوب
    if (nextNotif.vibrate && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }

    // إشعار النظام إذا مطلوب
    if (nextNotif.systemNotif && hasPermission) {
      new Notification(nextNotif.notification.title, {
        body: nextNotif.notification.message.split('\n')[0],
        icon: '/medical_logo.jpg',
        requireInteraction: nextNotif.notification.priority === 'urgent'
      });
    }

    // إزالة الإشعار بعد المدة المحددة
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    
    const duration = nextNotif.duration || 8000;
    notificationTimeoutRef.current = setTimeout(() => {
      showNextNotification();
    }, duration);
  }, [hasPermission]);

  // دالة لإضافة إشعار للـ Queue
  const queueNotification = useCallback((notifData) => {
    // تحديد الأولوية - الإشعارات العاجلة تضاف في البداية
    if (notifData.notification.priority === 'urgent') {
      notificationQueueRef.current.unshift(notifData);
    } else {
      notificationQueueRef.current.push(notifData);
    }

    // إذا لم يكن هناك إشعار معروض حالياً، اعرض التالي
    if (!isShowingNotificationRef.current) {
      showNextNotification();
    }
  }, [showNextNotification]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        setHasPermission(permission === 'granted');
      });
    } else if ('Notification' in window && Notification.permission === 'granted') {
      setHasPermission(true);
    }
  }, []);

  const playNotificationSound = useCallback((type) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      if (type === 'urgent') {
        oscillator.frequency.value = 880;
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
        
        setTimeout(() => {
          const osc2 = audioContext.createOscillator();
          const gain2 = audioContext.createGain();
          osc2.connect(gain2);
          gain2.connect(audioContext.destination);
          osc2.frequency.value = 1046;
          gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
          osc2.start(audioContext.currentTime);
          osc2.stop(audioContext.currentTime + 0.3);
        }, 300);
      } else {
        oscillator.frequency.value = 523;
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.4);
      }
    } catch (err) {
      // Silent fail
    }
  }, []);

  // حساب وقت الانتظار المتوقع
  const getEstimatedWaitTime = useCallback((position, examDuration = 5) => {
    if (position <= 0) return t('الآن', 'Now');
    const minutes = position * examDuration;
    if (minutes < 60) {
      return t(`${minutes} دقيقة تقريباً`, `~${minutes} minutes`);
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return t(`${hours} ساعة و ${mins} دقيقة`, `${hours}h ${mins}m`);
  }, [t]);

  // الحصول على معلومات الطابق والاتجاه
  const getFloorAndDirectionInfo = useCallback((clinic) => {
    if (!clinic) return null;

    const floor = clinic.floor || '';
    const clinicNameAr = clinic.nameAr || clinic.name || 'العيادة';
    const clinicNameEn = clinic.nameEn || clinic.name || 'Clinic';
    const clinicName = t(clinicNameAr, clinicNameEn);
    const roomNumber = clinic.roomNumber || '';

    let floorNameAr = '';
    let floorNameEn = '';
    let directionAr = '';
    let directionEn = '';
    let floorIcon = '🏢';
    let elevatorButton = '';

    if (floor === 'الميزانين' || clinic.floorCode === 'M') {
      floorNameAr = 'الميزانين';
      floorNameEn = 'Mezzanine';
      elevatorButton = 'M';
      directionAr = '🚶 اتجه للمصعد المقابل للباب الخلفي\n🔼 اضغط على حرف M';
      directionEn = '🚶 Go to elevator opposite back door\n🔼 Press M button';
      floorIcon = '🅼';
    } else if (floor === 'الطابق الثاني' || clinic.floorCode === '2') {
      floorNameAr = 'الطابق الثاني';
      floorNameEn = '2nd Floor';
      elevatorButton = '2';
      directionAr = '🚶 اتجه للمصعد المقابل للباب الخلفي\n🔼 اضغط على رقم 2';
      directionEn = '🚶 Go to elevator opposite back door\n🔼 Press 2 button';
      floorIcon = '2️⃣';
    } else if (floor === 'الطابق الثالث' || clinic.floorCode === '3') {
      floorNameAr = 'الطابق الثالث';
      floorNameEn = '3rd Floor';
      elevatorButton = '3';
      directionAr = '🚶 اتجه للمصعد المقابل للباب الخلفي\n🔼 اضغط على رقم 3';
      directionEn = '🚶 Go to elevator opposite back door\n🔼 Press 3 button';
      floorIcon = '3️⃣';
    } else if (floor === 'الطابق الأرضي' || clinic.floorCode === 'G') {
      floorNameAr = 'الطابق الأرضي';
      floorNameEn = 'Ground Floor';
      elevatorButton = 'G';
      directionAr = '🚶 اتجه للمصعد المقابل للباب الخلفي\n🔼 اضغط على حرف G';
      directionEn = '🚶 Go to elevator opposite back door\n🔼 Press G button';
      floorIcon = '🅶';
    } else {
      return null;
    }

    return {
      clinicName,
      floorName: t(floorNameAr, floorNameEn),
      direction: t(directionAr, directionEn),
      roomNumber,
      floorIcon,
      elevatorButton,
      floor
    };
  }, [t]);

  // إشعار ترحيبي تعريفي شامل
  useEffect(() => {
    if (!hasShownWelcome.current && patientId) {
      hasShownWelcome.current = true;
      
      queueNotification({
        notification: {
          icon: '👋',
          title: t('مرحباً بك في اللجنة الطبية', 'Welcome to Medical Committee'),
          message: t(
            '📋 طريقة الاستخدام:\n' +
            '1️⃣ اتبع الإشعارات للوصول لكل عيادة\n' +
            '2️⃣ راقب رقم دورك على الشاشة\n' +
            '3️⃣ عند اقتراب دورك ستصلك تنبيهات\n' +
            '4️⃣ اذهب للعيادة عند حلول دورك',
            '📋 How to use:\n' +
            '1️⃣ Follow notifications to each clinic\n' +
            '2️⃣ Watch your queue number on screen\n' +
            '3️⃣ You will be alerted when your turn is near\n' +
            '4️⃣ Go to clinic when it is your turn'
          ),
          bgColor: 'bg-purple-600',
          priority: 'info',
          isWelcome: true
        },
        sound: 'normal',
        duration: 12000
      });
    }
  }, [patientId, queueNotification, t]);

  // إشعار تعريفي للدور مع شرح الأرقام
  useEffect(() => {
    if (!hasShownQueueExplanation.current && currentClinic && yourNumber !== null) {
      hasShownQueueExplanation.current = true;
      
      const aheadCount = Math.max(0, (yourNumber || 0) - (currentServing || 0));
      const waitTime = getEstimatedWaitTime(aheadCount);
      
      queueNotification({
        notification: {
          icon: '📋',
          title: t('شرح نظام الدور', 'Queue System Explained'),
          message: t(
            `📊 معلومات دورك:\n` +
            `━━━━━━━━━━━━━━━━\n` +
            `🎫 رقمك: ${yourNumber}\n` +
            `▶️ الحالي: ${currentServing || '-'}\n` +
            `👥 أمامك: ${aheadCount} شخص\n` +
            `⏱️ الوقت المتوقع: ${waitTime}\n` +
            `━━━━━━━━━━━━━━━━\n` +
            `💡 رقمك = ترتيبك في الطابور\n` +
            `💡 الحالي = من يُفحص الآن`,
            `📊 Your Queue Info:\n` +
            `━━━━━━━━━━━━━━━━\n` +
            `🎫 Your #: ${yourNumber}\n` +
            `▶️ Current: ${currentServing || '-'}\n` +
            `👥 Ahead: ${aheadCount} people\n` +
            `⏱️ Est. Wait: ${waitTime}\n` +
            `━━━━━━━━━━━━━━━━\n` +
            `💡 Your # = Your position\n` +
            `💡 Current = Being served now`
          ),
          bgColor: 'bg-indigo-600',
          priority: 'info',
          isQueueExplanation: true
        },
        sound: 'normal',
        duration: 15000
      });
    }
  }, [currentClinic, yourNumber, currentServing, queueNotification, t, getEstimatedWaitTime]);

  // إشعار إتمام جميع الفحوصات
  useEffect(() => {
    if (allStationsCompleted && !hasShownCompletionNotice.current) {
      hasShownCompletionNotice.current = true;
      
      queueNotification({
        notification: {
          icon: '✅',
          title: t('تم إكمال جميع الفحوصات!', 'All Examinations Completed!'),
          message: t(
            '🎉 مبروك! أنهيت جميع الفحوصات\n\n' +
            '📍 الخطوة التالية:\n' +
            '━━━━━━━━━━━━━━━━\n' +
            '🏢 اذهب إلى: استقبال اللجنة الطبية\n' +
            '📋 لاستلام: النتائج النهائية\n' +
            '🚶 الاتجاه: الطابق الأرضي - المدخل الرئيسي',
            '🎉 Congratulations! All exams completed\n\n' +
            '📍 Next Step:\n' +
            '━━━━━━━━━━━━━━━━\n' +
            '🏢 Go to: Medical Committee Reception\n' +
            '📋 To receive: Final Results\n' +
            '🚶 Direction: Ground Floor - Main Entrance'
          ),
          bgColor: 'bg-green-600',
          priority: 'success',
          isCompletionNotice: true
        },
        sound: 'normal',
        systemNotif: true,
        duration: 20000
      });
    }
  }, [allStationsCompleted, queueNotification, t]);

  // إشعار الطابق والاتجاه عند تغيير العيادة
  useEffect(() => {
    if (!currentClinic) return;

    const floorInfo = getFloorAndDirectionInfo(currentClinic);
    if (!floorInfo) return;

    // إشعار أولي للطابق
    if (!hasShownInitialFloorGuide.current) {
      hasShownInitialFloorGuide.current = true;
      lastFloorRef.current = floorInfo.floor;
      
      const roomInfo = floorInfo.roomNumber ? t(`\n🚪 الغرفة: ${floorInfo.roomNumber}`, `\n🚪 Room: ${floorInfo.roomNumber}`) : '';
      
      queueNotification({
        notification: {
          icon: floorInfo.floorIcon,
          title: t('📍 مكان العيادة الأولى', '📍 First Clinic Location'),
          message: t(
            `🏥 العيادة: ${floorInfo.clinicName}\n` +
            `🏢 الطابق: ${floorInfo.floorName}${roomInfo}\n\n` +
            `🧭 الاتجاه:\n${floorInfo.direction}`,
            `🏥 Clinic: ${floorInfo.clinicName}\n` +
            `🏢 Floor: ${floorInfo.floorName}${roomInfo}\n\n` +
            `🧭 Direction:\n${floorInfo.direction}`
          ),
          bgColor: 'bg-blue-600',
          priority: 'info',
          isFloorGuide: true
        },
        sound: 'normal',
        duration: 15000
      });
      return;
    }

    // إشعار عند تغيير العيادة
    if (lastClinicRef.current !== currentClinic.id) {
      lastClinicRef.current = currentClinic.id;

      // إشعار عند تغيير الطابق
      if (lastFloorRef.current !== floorInfo.floor) {
        lastFloorRef.current = floorInfo.floor;
        
        const roomInfo = floorInfo.roomNumber ? t(`\n🚪 الغرفة: ${floorInfo.roomNumber}`, `\n🚪 Room: ${floorInfo.roomNumber}`) : '';
        
        queueNotification({
          notification: {
            icon: floorInfo.floorIcon,
            title: t('🔄 انتقل لطابق جديد', '🔄 Move to New Floor'),
            message: t(
              `🏥 العيادة التالية: ${floorInfo.clinicName}\n` +
              `🏢 الطابق: ${floorInfo.floorName}${roomInfo}\n\n` +
              `🧭 الاتجاه:\n${floorInfo.direction}`,
              `🏥 Next Clinic: ${floorInfo.clinicName}\n` +
              `🏢 Floor: ${floorInfo.floorName}${roomInfo}\n\n` +
              `🧭 Direction:\n${floorInfo.direction}`
            ),
            bgColor: 'bg-blue-600',
            priority: 'info',
            isFloorGuide: true
          },
          sound: 'normal',
          duration: 15000
        });
      }
    }
  }, [currentClinic, getFloorAndDirectionInfo, queueNotification, t]);

  // إشعارات الدور مع معلومات تفصيلية
  const position = (yourNumber !== null && yourNumber !== undefined && 
                    currentServing !== null && currentServing !== undefined) 
                    ? yourNumber - currentServing 
                    : null;

  useEffect(() => {
    if (!currentClinic || position === null || position < 0) return;

    if (lastPositionRef.current === position) return;
    lastPositionRef.current = position;

    const clinicNameAr = currentClinic?.nameAr || currentClinic?.name || 'العيادة';
    const clinicNameEn = currentClinic?.nameEn || currentClinic?.name || 'Clinic';
    const clinicName = t(clinicNameAr, clinicNameEn);
    const roomNumber = currentClinic?.roomNumber || '';
    const roomInfo = roomNumber ? t(` - غرفة ${roomNumber}`, ` - Room ${roomNumber}`) : '';
    const waitTime = getEstimatedWaitTime(position);

    // معلومات الدور المشتركة
    const queueDetailsAr = `\n━━━━━━━━━━━━━━━━\n🎫 رقمك: ${yourNumber}  |  ▶️ الحالي: ${currentServing}  |  👥 أمامك: ${position}`;
    const queueDetailsEn = `\n━━━━━━━━━━━━━━━━\n🎫 Your #: ${yourNumber}  |  ▶️ Current: ${currentServing}  |  👥 Ahead: ${position}`;

    let notif = null;
    let soundType = 'normal';
    let vibrate = false;
    let systemNotif = false;
    let duration = 10000;

    if (position === 0) {
      notif = {
        icon: '🔴',
        title: t('⚡ حان دورك الآن!', "⚡ It's Your Turn NOW!"),
        message: t(
          `🏃 اذهب فوراً إلى:\n` +
          `🏥 ${clinicName}${roomInfo}\n` +
          `⏱️ لا تتأخر!\n` +
          queueDetailsAr,
          `🏃 Go immediately to:\n` +
          `🏥 ${clinicName}${roomInfo}\n` +
          `⏱️ Don't be late!\n` +
          queueDetailsEn
        ),
        bgColor: 'bg-red-600',
        priority: 'urgent'
      };
      soundType = 'urgent';
      vibrate = true;
      systemNotif = true;
      duration = 25000;
    } else if (position === 1) {
      notif = {
        icon: '🟠',
        title: t('🔔 أنت التالي!', '🔔 You Are Next!'),
        message: t(
          `⏳ استعد - باقي شخص واحد فقط!\n` +
          `🏥 ${clinicName}${roomInfo}\n` +
          `⏱️ الوقت المتوقع: ${waitTime}\n` +
          queueDetailsAr,
          `⏳ Get ready - Only 1 person ahead!\n` +
          `🏥 ${clinicName}${roomInfo}\n` +
          `⏱️ Est. wait: ${waitTime}\n` +
          queueDetailsEn
        ),
        bgColor: 'bg-orange-600',
        priority: 'high'
      };
      soundType = 'normal';
      vibrate = true;
      systemNotif = true;
      duration = 15000;
    } else if (position === 2) {
      notif = {
        icon: '🟡',
        title: t('⏳ اقترب دورك', '⏳ Your Turn is Near'),
        message: t(
          `👥 باقي شخصين قبلك\n` +
          `🏥 ${clinicName}\n` +
          `⏱️ الوقت المتوقع: ${waitTime}\n` +
          queueDetailsAr,
          `👥 2 people ahead of you\n` +
          `🏥 ${clinicName}\n` +
          `⏱️ Est. wait: ${waitTime}\n` +
          queueDetailsEn
        ),
        bgColor: 'bg-yellow-600',
        priority: 'medium'
      };
      duration = 12000;
    } else if (position === 3) {
      notif = {
        icon: '🔵',
        title: t('📢 تنبيه', '📢 Notice'),
        message: t(
          `👥 باقي 3 أشخاص قبلك\n` +
          `🏥 ${clinicName}\n` +
          `⏱️ الوقت المتوقع: ${waitTime}\n` +
          queueDetailsAr,
          `👥 3 people ahead of you\n` +
          `🏥 ${clinicName}\n` +
          `⏱️ Est. wait: ${waitTime}\n` +
          queueDetailsEn
        ),
        bgColor: 'bg-blue-600',
        priority: 'low'
      };
      duration = 10000;
    } else if (position === 5) {
      notif = {
        icon: 'ℹ️',
        title: t('💡 معلومة', '💡 Information'),
        message: t(
          `👥 باقي 5 أشخاص قبلك\n` +
          `🏥 يمكنك الانتظار بالقرب من ${clinicName}\n` +
          `⏱️ الوقت المتوقع: ${waitTime}\n` +
          queueDetailsAr,
          `👥 5 people ahead of you\n` +
          `🏥 You may wait near ${clinicName}\n` +
          `⏱️ Est. wait: ${waitTime}\n` +
          queueDetailsEn
        ),
        bgColor: 'bg-gray-600',
        priority: 'info'
      };
      duration = 10000;
    }

    if (notif) {
      queueNotification({
        notification: notif,
        sound: soundType,
        vibrate: vibrate,
        systemNotif: systemNotif,
        duration: duration
      });
    }
  }, [position, currentClinic, yourNumber, currentServing, queueNotification, t, getEstimatedWaitTime]);

  // تنظيف عند إزالة المكون
  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, []);

  if (!notification) return null;

  return (
    <div className="notification-system">
      {/* إشعار محسّن للموبايل مع الحفاظ على الهوية البصرية */}
      <div className="fixed top-16 right-2 left-2 sm:left-auto sm:right-4 sm:max-w-md z-50">
        <div
          className={`
            ${notification.bgColor} text-white
            px-4 py-3 sm:px-6 sm:py-4 rounded-2xl shadow-2xl
            flex items-start gap-3
            backdrop-blur-sm bg-opacity-95
            animate-slide-down
            border-2 border-white border-opacity-40
          `}
          style={{
            animation: 'slideDown 0.5s ease-out',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}
        >
          {/* أيقونة */}
          <div className="text-2xl sm:text-3xl flex-shrink-0">
            {notification.icon || '🔔'}
          </div>
          
          {/* النص */}
          <div className="flex-1 min-w-0">
            <div className="font-black text-lg sm:text-xl mb-1" style={{ letterSpacing: '0.3px', lineHeight: '1.3' }}>
              {notification.title}
            </div>
            <div className="text-sm sm:text-base font-bold opacity-100 whitespace-pre-line" style={{ letterSpacing: '0.2px', lineHeight: '1.5' }}>
              {notification.message}
            </div>
          </div>
          
          {/* زر إغلاق */}
          <button
            onClick={() => {
              if (notificationTimeoutRef.current) {
                clearTimeout(notificationTimeoutRef.current);
              }
              showNextNotification();
            }}
            className="text-white opacity-90 hover:opacity-100 text-2xl leading-none px-2 font-bold flex-shrink-0"
            aria-label={t('إغلاق', 'Close')}
          >
            ×
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideDown {
          from {
            transform: translateY(-80px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * نظام الإشعارات الشامل - محسّن للموبايل
 * - إشعارات توضيحية شاملة بدون تداخل باللغتين
 * - نظام Queue لإدارة الإشعارات المتعددة
 * - تصميم مناسب للهاتف
 * - قابل للتحكم من الإدارة
 * - عرض المعلومات بشكل واضح مع مسافات
 * - اللغة تتغير فقط عند تغيير إعدادات اللغة
 */
export default function NotificationSystem({ 
  patientId, 
  currentClinic, 
  yourNumber, 
  currentServing,
  allStationsCompleted,
  language = 'ar' // اللغة من الإعدادات
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
      // console.error('Sound error:', err);
    }
  }, []);

  // إشعار تعريفي للدور - مرة واحدة
  useEffect(() => {
    if (!hasShownQueueExplanation.current && currentClinic && yourNumber !== null) {
      hasShownQueueExplanation.current = true;
      
      const aheadCount = Math.max(0, (yourNumber || 0) - (currentServing || 0));
      
      queueNotification({
        notification: {
          icon: '📋',
          title: t('نظام الدور', 'Queue System'),
          message: t(
            `رقمك: ${yourNumber}  ·  الحالي: ${currentServing || '-'}  ·  أمامك: ${aheadCount}\n\n` +
            `📌 رقمك = دورك في الطابور\n` +
            `📌 الحالي = الرقم الذي يُفحص الآن\n` +
            `📌 أمامك = عدد الأشخاص قبلك`,
            `Your Number: ${yourNumber}  ·  Current: ${currentServing || '-'}  ·  Ahead: ${aheadCount}\n\n` +
            `📌 Your Number = Your position in queue\n` +
            `📌 Current = Number being served now\n` +
            `📌 Ahead = People before you`
          ),
          bgColor: 'bg-indigo-600',
          priority: 'info',
          isQueueExplanation: true
        },
        sound: 'normal',
        duration: 12000
      });
    }
  }, [currentClinic, yourNumber, currentServing, queueNotification, t]);

  // إشعار الترحيب
  useEffect(() => {
    if (!hasShownWelcome.current && patientId) {
      hasShownWelcome.current = true;
      
      queueNotification({
        notification: {
          icon: '👋',
          title: t('مرحباً بك', 'Welcome'),
          message: t(
            'مرحباً بك في نظام اللجنة الطبية\n\n' +
            '✅ اتبع الإشعارات للوصول لكل عيادة\n' +
            '✅ ستصلك إشعارات عند اقتراب دورك\n' +
            '✅ راقب الأرقام على الشاشة',
            'Welcome to the Medical Committee System\n\n' +
            '✅ Follow notifications to reach each clinic\n' +
            '✅ You will be notified when your turn approaches\n' +
            '✅ Watch the numbers on screen'
          ),
          bgColor: 'bg-purple-600',
          priority: 'info',
          isWelcome: true
        },
        sound: 'normal',
        duration: 10000
      });
    }
  }, [patientId, queueNotification, t]);

  const getFloorNotification = useCallback((clinic) => {
    if (!clinic) return null;

    const floor = clinic.floor || '';
    const clinicNameAr = clinic.nameAr || clinic.name || 'العيادة';
    const clinicNameEn = clinic.nameEn || clinic.name || 'Clinic';
    const clinicName = t(clinicNameAr, clinicNameEn);
    const roomNumber = clinic.roomNumber || '';

    let floorInstructionAr = '';
    let floorInstructionEn = '';
    let floorIcon = '🏢';

    if (floor === 'الميزانين' || clinic.floorCode === 'M') {
      floorInstructionAr = '📍 اتجه للمصعد المقابل للباب الخلفي\n🔼 اضغط على حرف M في المصعد';
      floorInstructionEn = '📍 Go to the elevator opposite the back door\n🔼 Press M in the elevator';
      floorIcon = '🅼';
    } else if (floor === 'الطابق الثاني' || clinic.floorCode === '2') {
      floorInstructionAr = '📍 اتجه للمصعد المقابل للباب الخلفي\n🔼 اضغط على رقم 2 في المصعد';
      floorInstructionEn = '📍 Go to the elevator opposite the back door\n🔼 Press 2 in the elevator';
      floorIcon = '2️⃣';
    } else if (floor === 'الطابق الثالث' || clinic.floorCode === '3') {
      floorInstructionAr = '📍 اتجه للمصعد المقابل للباب الخلفي\n🔼 اضغط على رقم 3 في المصعد';
      floorInstructionEn = '📍 Go to the elevator opposite the back door\n🔼 Press 3 in the elevator';
      floorIcon = '3️⃣';
    } else if (floor === 'الطابق الأرضي' || clinic.floorCode === 'G') {
      floorInstructionAr = '📍 اتجه للمصعد المقابل للباب الخلفي\n🔼 اضغط على حرف G في المصعد';
      floorInstructionEn = '📍 Go to the elevator opposite the back door\n🔼 Press G in the elevator';
      floorIcon = '🅶';
    } else {
      return null;
    }

    const roomInfo = roomNumber ? t(`\n🚪 غرفة: ${roomNumber}`, `\n🚪 Room: ${roomNumber}`) : '';

    return {
      icon: floorIcon,
      title: clinicName,
      message: t(floorInstructionAr, floorInstructionEn) + roomInfo,
      bgColor: 'bg-blue-600',
      floor: floor,
      priority: 'info'
    };
  }, [t]);

  useEffect(() => {
    if (allStationsCompleted && !hasShownCompletionNotice.current) {
      hasShownCompletionNotice.current = true;
      
      queueNotification({
        notification: {
          icon: '✅',
          title: t('انتهيت من الفحوصات', 'Examinations Completed'),
          message: t(
            '🎉 مبروك! أكملت جميع الفحوصات\n\n' +
            '📍 اذهب الآن إلى استقبال اللجنة الطبية\n' +
            '📋 لاستلام نتائجك النهائية',
            '🎉 Congratulations! All examinations completed\n\n' +
            '📍 Please proceed to Medical Committee Reception\n' +
            '📋 To receive your final results'
          ),
          bgColor: 'bg-green-600',
          priority: 'success',
          isCompletionNotice: true
        },
        sound: 'normal',
        systemNotif: true,
        duration: 15000
      });
    }
  }, [allStationsCompleted, queueNotification, t]);

  useEffect(() => {
    if (!currentClinic || hasShownInitialFloorGuide.current) return;

    hasShownInitialFloorGuide.current = true;
    const floorNotif = getFloorNotification(currentClinic);
    
    if (floorNotif) {
      lastFloorRef.current = floorNotif.floor;
      queueNotification({
        notification: {
          ...floorNotif,
          isFloorGuide: true
        },
        sound: 'normal',
        duration: 12000
      });
    }
  }, [currentClinic, getFloorNotification, queueNotification]);

  useEffect(() => {
    if (!currentClinic) return;

    if (lastClinicRef.current !== currentClinic.id) {
      lastClinicRef.current = currentClinic.id;

      const floorNotif = getFloorNotification(currentClinic);
      if (floorNotif && lastFloorRef.current !== floorNotif.floor) {
        lastFloorRef.current = floorNotif.floor;
        
        queueNotification({
          notification: {
            ...floorNotif,
            isFloorGuide: true
          },
          sound: 'normal',
          duration: 15000
        });
      }
    }
  }, [currentClinic, getFloorNotification, queueNotification]);

  const position = (yourNumber !== null && yourNumber !== undefined && 
                    currentServing !== null && currentServing !== undefined) 
                    ? yourNumber - currentServing 
                    : null;

  useEffect(() => {
    if (!currentClinic || position === null || position < 0) return;

    if (lastPositionRef.current === position) return;
    lastPositionRef.current = position;

    let notif = null;
    let soundType = 'normal';
    let vibrate = false;
    let systemNotif = false;
    let duration = 10000;

    const clinicNameAr = currentClinic?.nameAr || currentClinic?.name || 'العيادة';
    const clinicNameEn = currentClinic?.nameEn || currentClinic?.name || 'Clinic';
    const clinicName = t(clinicNameAr, clinicNameEn);
    const roomNumber = currentClinic?.roomNumber || '';
    const roomInfo = roomNumber ? t(` - غرفة ${roomNumber}`, ` - Room ${roomNumber}`) : '';

    // عرض المعلومات بشكل واضح مع مسافات
    const queueInfoAr = `\n\n📊 رقمك: ${yourNumber}  ·  الحالي: ${currentServing}  ·  أمامك: ${position}`;
    const queueInfoEn = `\n\n📊 Your #: ${yourNumber}  ·  Current: ${currentServing}  ·  Ahead: ${position}`;
    const queueInfo = t(queueInfoAr, queueInfoEn);

    if (position === 0) {
      notif = {
        icon: '🔴',
        title: t('حان دورك الآن!', "It's Your Turn!"),
        message: t(
          `⚡ اذهب فوراً إلى:\n${clinicName}${roomInfo}${queueInfoAr}`,
          `⚡ Go immediately to:\n${clinicName}${roomInfo}${queueInfoEn}`
        ),
        bgColor: 'bg-red-600',
        priority: 'urgent'
      };
      soundType = 'urgent';
      vibrate = true;
      systemNotif = true;
      duration = 20000;
    } else if (position === 1) {
      notif = {
        icon: '🟠',
        title: t('أنت التالي!', 'You Are Next!'),
        message: t(
          `🔔 استعد - باقي شخص واحد قبلك\n📍 ${clinicName}${roomInfo}${queueInfoAr}`,
          `🔔 Get ready - 1 person ahead\n📍 ${clinicName}${roomInfo}${queueInfoEn}`
        ),
        bgColor: 'bg-orange-600',
        priority: 'high'
      };
      soundType = 'normal';
      vibrate = true;
      systemNotif = true;
      duration = 12000;
    } else if (position === 2) {
      notif = {
        icon: '🟡',
        title: t('اقترب دورك', 'Your Turn is Near'),
        message: t(
          `⏳ باقي شخصين قبلك\n📍 ${clinicName}${queueInfoAr}`,
          `⏳ 2 people ahead of you\n📍 ${clinicName}${queueInfoEn}`
        ),
        bgColor: 'bg-yellow-600',
        priority: 'medium'
      };
      soundType = 'normal';
      duration = 10000;
    } else if (position === 3) {
      notif = {
        icon: '🔵',
        title: t('انتبه', 'Attention'),
        message: t(
          `📢 باقي 3 أشخاص قبلك\n📍 ${clinicName}${queueInfoAr}`,
          `📢 3 people ahead of you\n📍 ${clinicName}${queueInfoEn}`
        ),
        bgColor: 'bg-blue-600',
        priority: 'low'
      };
      soundType = 'normal';
      duration = 8000;
    } else if (position === 5) {
      notif = {
        icon: 'ℹ️',
        title: t('معلومة', 'Information'),
        message: t(
          `📋 باقي 5 أشخاص قبلك\n💡 يمكنك الانتظار بالقرب من ${clinicName}${queueInfoAr}`,
          `📋 5 people ahead of you\n💡 You may wait near ${clinicName}${queueInfoEn}`
        ),
        bgColor: 'bg-gray-600',
        priority: 'info'
      };
      soundType = 'normal';
      duration = 8000;
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
  }, [position, currentClinic, yourNumber, currentServing, queueNotification, t]);

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
      {/* إشعار محسّن للموبايل */}
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
          {/* أيقونة مناسبة للموبايل */}
          <div className="text-2xl sm:text-3xl flex-shrink-0">
            {notification.icon || '🔔'}
          </div>
          
          {/* النص - واضح ومقروء */}
          <div className="flex-1 min-w-0">
            <div className="font-black text-lg sm:text-xl mb-1" style={{ letterSpacing: '0.3px', lineHeight: '1.3' }}>
              {notification.title}
            </div>
            <div className="text-sm sm:text-base font-bold opacity-100 whitespace-pre-line" style={{ letterSpacing: '0.2px', lineHeight: '1.5' }}>
              {notification.message}
            </div>
          </div>
          
          {/* زر إغلاق صغير */}
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

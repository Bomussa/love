import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * نظام الإشعارات الشامل - محسّن للموبايل
 * - إشعارات توضيحية شاملة بدون تداخل
 * - نظام Queue لإدارة الإشعارات المتعددة
 * - تصميم مناسب للهاتف
 * - قابل للتحكم من الإدارة
 * - عرض المعلومات بشكل واضح مع مسافات
 */
export default function NotificationSystem({ 
  patientId, 
  currentClinic, 
  yourNumber, 
  currentServing,
  allStationsCompleted 
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
      
      queueNotification({
        notification: {
          icon: '📋',
          title: 'نظام الدور',
          message: `رقمك: ${yourNumber}  |  الحالي: ${currentServing || '-'}  |  أمامك: ${Math.max(0, (yourNumber || 0) - (currentServing || 0))}\n\nرقمك = دورك في الطابور\nالحالي = من يُفحص الآن\nأمامك = عدد الأشخاص قبلك`,
          bgColor: 'bg-indigo-600',
          priority: 'info',
          isQueueExplanation: true
        },
        sound: 'normal',
        duration: 12000
      });
    }
  }, [currentClinic, yourNumber, currentServing, queueNotification]);

  // إشعار الترحيب
  useEffect(() => {
    if (!hasShownWelcome.current && patientId) {
      hasShownWelcome.current = true;
      
      queueNotification({
        notification: {
          icon: '👋',
          title: 'مرحباً بك',
          message: 'اتبع الإشعارات للوصول لكل عيادة\nستصلك إشعارات عند اقتراب دورك',
          bgColor: 'bg-purple-600',
          priority: 'info',
          isWelcome: true
        },
        sound: 'normal',
        duration: 10000
      });
    }
  }, [patientId, queueNotification]);

  const getFloorNotification = useCallback((clinic) => {
    if (!clinic) return null;

    const floor = clinic.floor || '';
    const clinicName = clinic.nameAr || clinic.name || 'العيادة';
    const roomNumber = clinic.roomNumber || '';

    let floorInstruction = '';
    let floorIcon = '🏢';

    if (floor === 'الميزانين' || clinic.floorCode === 'M') {
      floorInstruction = '📍 اتجه للمصعد المقابل للباب الخلفي\n🔼 اضغط على حرف M في المصعد';
      floorIcon = '🅼';
    } else if (floor === 'الطابق الثاني' || clinic.floorCode === '2') {
      floorInstruction = '📍 اتجه للمصعد المقابل للباب الخلفي\n🔼 اضغط على رقم 2 في المصعد';
      floorIcon = '2️⃣';
    } else if (floor === 'الطابق الثالث' || clinic.floorCode === '3') {
      floorInstruction = '📍 اتجه للمصعد المقابل للباب الخلفي\n🔼 اضغط على رقم 3 في المصعد';
      floorIcon = '3️⃣';
    } else if (floor === 'الطابق الأرضي' || clinic.floorCode === 'G') {
      floorInstruction = '📍 اتجه للمصعد المقابل للباب الخلفي\n🔼 اضغط على حرف G في المصعد';
      floorIcon = '🅶';
    } else {
      return null;
    }

    return {
      icon: floorIcon,
      title: `${clinicName}`,
      message: `${floorInstruction}${roomNumber ? `\nغرفة: ${roomNumber}` : ''}`,
      bgColor: 'bg-blue-600',
      floor: floor,
      priority: 'info'
    };
  }, []);

  useEffect(() => {
    if (allStationsCompleted && !hasShownCompletionNotice.current) {
      hasShownCompletionNotice.current = true;
      
      queueNotification({
        notification: {
          icon: '✅',
          title: 'انتهيت من الفحوصات',
          message: 'اذهب لاستقبال اللجنة الطبية\nمبروك! أكملت جميع الفحوصات',
          bgColor: 'bg-green-600',
          priority: 'success',
          isCompletionNotice: true
        },
        sound: 'normal',
        systemNotif: true,
        duration: 15000
      });
    }
  }, [allStationsCompleted, queueNotification]);

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

    const clinicName = currentClinic?.nameAr || currentClinic?.name || 'العيادة';
    const roomNumber = currentClinic?.roomNumber || '';

    // عرض المعلومات بشكل واضح مع مسافات
    const queueInfo = `\n\n📊 رقمك: ${yourNumber}  |  الحالي: ${currentServing}  |  أمامك: ${position}`;

    if (position === 0) {
      notif = {
        icon: '🔴',
        title: 'حان دورك الآن!',
        message: `اذهب فوراً → ${clinicName}${roomNumber ? `\nغرفة ${roomNumber}` : ''}${queueInfo}`,
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
        title: 'أنت التالي',
        message: `استعد - باقي 1 قبلك\n${clinicName}${queueInfo}`,
        bgColor: 'bg-orange-600',
        priority: 'high'
      };
      soundType = 'normal';
      vibrate = true;
      systemNotif = true;
      duration: 12000;
    } else if (position === 2) {
      notif = {
        icon: '🟡',
        title: 'اقترب دورك',
        message: `باقي 2 قبلك\n${clinicName}${queueInfo}`,
        bgColor: 'bg-yellow-600',
        priority: 'medium'
      };
      soundType = 'normal';
      duration = 10000;
    } else if (position === 3) {
      notif = {
        icon: '🔵',
        title: 'انتبه',
        message: `باقي 3 قبلك\n${clinicName}${queueInfo}`,
        bgColor: 'bg-blue-600',
        priority: 'low'
      };
      soundType = 'normal';
      duration = 8000;
    } else if (position === 5) {
      notif = {
        icon: 'ℹ️',
        title: 'معلومة',
        message: `باقي 5 قبلك\nيمكنك الانتظار بالقرب من ${clinicName}${queueInfo}`,
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
  }, [position, currentClinic, yourNumber, currentServing, queueNotification]);

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
            aria-label="إغلاق"
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

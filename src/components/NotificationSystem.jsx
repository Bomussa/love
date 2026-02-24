import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * نظام الإشعارات المبسط
 * - إشعار واحد فقط عند الدخول (معلومات الدور)
 * - خط كبير للوضوح
 * - بدون تداخل
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
  const hasShownQueueInfo = useRef(false);
  const hasShownCompletion = useRef(false);

  // دالة الترجمة
  const t = useCallback((ar, en) => {
    return language === 'ar' ? ar : en;
  }, [language]);

  // حساب عدد من أمامك بشكل صحيح
  const getAheadCount = useCallback(() => {
    if (!yourNumber || yourNumber <= 0) return 0;
    if (!currentServing || currentServing <= 0) return yourNumber - 1;
    // أمامك = رقمك - الحالي - 1 (لأن الحالي يُخدم وليس أمامك)
    return Math.max(0, yourNumber - currentServing - 1);
  }, [yourNumber, currentServing]);

  // إشعار معلومات الدور - مرة واحدة فقط عند الدخول
  useEffect(() => {
    if (!hasShownQueueInfo.current && currentClinic && yourNumber > 0) {
      hasShownQueueInfo.current = true;
      
      const aheadCount = getAheadCount();
      const isYourTurn = aheadCount === 0;
      const waitTime = isYourTurn ? t('الآن', 'Now') : `~${Math.max(1, aheadCount * 2)} ${t('د', 'm')}`;
      
      setNotification({
        icon: isYourTurn ? '🔔' : '📋',
        title: isYourTurn ? t('دورك الآن!', 'Your Turn!') : t('معلومات دورك', 'Queue Info'),
        message: t(
          `🎫 رقمك: ${yourNumber}\n` +
          `▶️ الحالي: ${currentServing || 0}\n` +
          `👥 أمامك: ${aheadCount}\n` +
          `⏱️ الانتظار: ${waitTime}`,
          `🎫 Your #: ${yourNumber}\n` +
          `▶️ Current: ${currentServing || 0}\n` +
          `👥 Ahead: ${aheadCount}\n` +
          `⏱️ Wait: ${waitTime}`
        ),
        bgColor: isYourTurn ? 'bg-green-600' : 'bg-indigo-600'
      });

      // إخفاء بعد 8 ثواني
      setTimeout(() => setNotification(null), 8000);
    }
  }, [currentClinic, yourNumber, currentServing, t, getAheadCount]);

  // إشعار إتمام جميع الفحوصات
  useEffect(() => {
    if (allStationsCompleted && !hasShownCompletion.current) {
      hasShownCompletion.current = true;
      
      setNotification({
        icon: '✅',
        title: t('تم إكمال الفحوصات!', 'All Done!'),
        message: t(
          '🎉 مبروك!\n📍 اذهب للاستقبال لاستلام النتائج',
          '🎉 Congratulations!\n📍 Go to reception for results'
        ),
        bgColor: 'bg-green-600'
      });

      setTimeout(() => setNotification(null), 15000);
    }
  }, [allStationsCompleted, t]);

  // إغلاق الإشعار
  const closeNotification = () => setNotification(null);

  if (!notification) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm animate-slide-in">
      <div className={`${notification.bgColor} rounded-2xl shadow-2xl p-5 text-white border-2 border-white/20`}>
        {/* زر الإغلاق */}
        <button 
          onClick={closeNotification}
          className="absolute top-2 right-2 text-white/80 hover:text-white text-2xl font-bold w-8 h-8 flex items-center justify-center"
        >
          ×
        </button>
        
        {/* العنوان مع الأيقونة */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-4xl">{notification.icon}</span>
          <h3 className="text-xl font-bold">{notification.title}</h3>
        </div>
        
        {/* المحتوى بخط كبير */}
        <div className="text-lg font-medium whitespace-pre-line leading-relaxed">
          {notification.message}
        </div>
      </div>
      
      <style>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

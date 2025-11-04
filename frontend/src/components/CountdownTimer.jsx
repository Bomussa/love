import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, Timer } from 'lucide-react';

/**
 * مكون عداد تنازلي متقدم
 * 
 * الأنواع:
 * - patient: عداد 5 دقائق للمراجع (ظاهر)
 * - clinic: عداد 2 دقيقة للعيادة (مخفي - للإدارة فقط)
 */
export const CountdownTimer = ({ 
  enteredAt, 
  maxSeconds = 300, // 5 دقائق افتراضياً
  show = true, 
  language = 'ar', 
  onTimeout,
  type = 'patient', // 'patient' أو 'clinic'
  warningThreshold = 60 // متى يبدأ التحذير (60 ثانية)
}) => {
  const [timeLeft, setTimeLeft] = useState(maxSeconds);
  const [isWarning, setIsWarning] = useState(false);
  const [isDanger, setIsDanger] = useState(false);

  useEffect(() => {
    if (!enteredAt || !show) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const entered = new Date(enteredAt).getTime();
      const elapsed = Math.floor((now - entered) / 1000);
      const remaining = Math.max(0, maxSeconds - elapsed);

      setTimeLeft(remaining);
      
      // تحديد حالات التحذير
      setIsDanger(remaining <= 60 && remaining > 0); // آخر دقيقة
      setIsWarning(remaining <= warningThreshold && remaining > 60); // قبل آخر دقيقة

      if (remaining === 0 && onTimeout) {
        onTimeout();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [enteredAt, maxSeconds, show, onTimeout, warningThreshold]);

  if (!show) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const percentage = (timeLeft / maxSeconds) * 100;

  // ألوان حسب الوقت المتبقي
  const getColorClass = () => {
    if (isDanger) return 'bg-red-500/20 border-red-500 text-red-400';
    if (isWarning) return 'bg-yellow-500/20 border-yellow-500 text-yellow-400';
    return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
  };

  const getIcon = () => {
    if (isDanger) return <AlertTriangle className="w-4 h-4 animate-pulse" />;
    if (isWarning) return <Timer className="w-4 h-4" />;
    return <Clock className="w-4 h-4" />;
  };

  const getMessage = () => {
    if (type === 'patient') {
      if (isDanger) {
        return language === 'ar' 
          ? '⚠️ دقيقة واحدة متبقية!' 
          : '⚠️ 1 minute remaining!';
      }
      if (isWarning) {
        return language === 'ar' 
          ? 'يرجى التوجه للعيادة' 
          : 'Please go to clinic';
      }
      return language === 'ar' ? 'وقت متبقي' : 'Time remaining';
    } else {
      // clinic timer - للإدارة فقط
      return language === 'ar' ? 'نداء تلقائي' : 'Auto-call';
    }
  };

  return (
    <div className={`relative flex items-center gap-3 p-3 rounded-lg border ${getColorClass()} transition-all`}>
      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800 rounded-b-lg overflow-hidden">
        <div 
          className={`h-full transition-all duration-1000 ${
            isDanger ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-blue-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      {/* Icon */}
      <div className="flex-shrink-0">
        {getIcon()}
      </div>
      
      {/* Time Display */}
      <div className="flex-1">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-mono font-bold">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>
        </div>
        <p className="text-xs opacity-75 mt-0.5">
          {getMessage()}
        </p>
      </div>
      
      {/* Warning Badge */}
      {(isWarning || isDanger) && (
        <div className={`px-2 py-1 rounded text-xs font-bold ${
          isDanger ? 'bg-red-500' : 'bg-yellow-500'
        } text-white animate-pulse`}>
          {language === 'ar' ? 'عاجل' : 'URGENT'}
        </div>
      )}
    </div>
  );
};

/**
 * مكون مبسط للعد التنازلي (inline)
 */
export function InlineCountdown({ 
  enteredAt, 
  maxSeconds = 240, 
  show = true 
}) {
  const [timeRemaining, setTimeRemaining] = useState(maxSeconds)
  
  useEffect(() => {
    if (!enteredAt || !show) return
    
    const calculateRemaining = () => {
      const now = new Date()
      const entered = new Date(enteredAt)
      const elapsed = Math.floor((now - entered) / 1000)
      const remaining = Math.max(0, maxSeconds - elapsed)
      setTimeRemaining(remaining)
    }
    
    calculateRemaining()
    const interval = setInterval(calculateRemaining, 1000)
    
    return () => clearInterval(interval)
  }, [enteredAt, maxSeconds, show])
  
  if (!show) return null
  
  const minutes = Math.floor(timeRemaining / 60)
  const seconds = timeRemaining % 60
  const percentage = (timeRemaining / maxSeconds) * 100
  
  const getColor = () => {
    if (percentage > 50) return 'text-green-600'
    if (percentage > 25) return 'text-yellow-600'
    return 'text-red-600'
  }
  
  return (
    <span className={`font-mono font-bold ${getColor()}`}>
      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </span>
  )
}


import React, { useState, useEffect } from 'react'
import { Clock, AlertTriangle } from 'lucide-react'

/**
 * مكون العد التنازلي للمراجع
 * يعرض الوقت المتبقي من الـ4 دقائق
 * يتغير اللون حسب الوقت المتبقي
 */
export function CountdownTimer({ 
  enteredAt, 
  maxSeconds = 240, 
  onTimeout,
  show = true,
  language = 'ar' 
}) {
  const [timeRemaining, setTimeRemaining] = useState(maxSeconds)
  const [percentage, setPercentage] = useState(100)
  
  useEffect(() => {
    if (!enteredAt || !show) return
    
    const calculateRemaining = () => {
      const now = new Date()
      const entered = new Date(enteredAt)
      const elapsed = Math.floor((now - entered) / 1000)
      const remaining = Math.max(0, maxSeconds - elapsed)
      
      setTimeRemaining(remaining)
      setPercentage((remaining / maxSeconds) * 100)
      
      // إذا انتهى الوقت، استدعاء callback
      if (remaining === 0 && onTimeout) {
        onTimeout()
      }
    }
    
    // حساب فوري
    calculateRemaining()
    
    // تحديث كل ثانية
    const interval = setInterval(calculateRemaining, 1000)
    
    return () => clearInterval(interval)
  }, [enteredAt, maxSeconds, show, onTimeout])
  
  if (!show) return null
  
  // تحويل الثواني إلى دقائق وثواني
  const minutes = Math.floor(timeRemaining / 60)
  const seconds = timeRemaining % 60
  
  // تحديد اللون حسب الوقت المتبقي
  const getColorClass = () => {
    if (percentage > 50) return 'text-green-600 bg-green-50 border-green-300'
    if (percentage > 25) return 'text-yellow-600 bg-yellow-50 border-yellow-300'
    return 'text-red-600 bg-red-50 border-red-300'
  }
  
  const getProgressColor = () => {
    if (percentage > 50) return 'bg-green-500'
    if (percentage > 25) return 'bg-yellow-500'
    return 'bg-red-500'
  }
  
  const getText = () => {
    if (language === 'ar') {
      return {
        title: 'الوقت المتبقي للدخول',
        expired: 'انتهى الوقت!'
      }
    }
    return {
      title: 'Time Remaining',
      expired: 'Time Expired!'
    }
  }
  
  const text = getText()
  
  return (
    <div className={`rounded-lg border-2 p-4 ${getColorClass()} transition-all duration-300`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {percentage <= 25 ? (
            <AlertTriangle className="w-5 h-5 animate-pulse" />
          ) : (
            <Clock className="w-5 h-5" />
          )}
          <span className="font-semibold text-sm">
            {text.title}
          </span>
        </div>
        
        {timeRemaining > 0 ? (
          <div className="text-2xl font-bold font-mono">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>
        ) : (
          <div className="text-lg font-bold animate-pulse">
            {text.expired}
          </div>
        )}
      </div>
      
      {/* شريط التقدم */}
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className={`h-full ${getProgressColor()} transition-all duration-1000 ease-linear`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      {/* رسالة تحذيرية */}
      {percentage <= 25 && percentage > 0 && (
        <div className="mt-2 text-xs text-center font-medium animate-pulse">
          {language === 'ar' 
            ? '⚠️ يرجى التوجه للعيادة فوراً' 
            : '⚠️ Please proceed to clinic immediately'}
        </div>
      )}
      
      {timeRemaining === 0 && (
        <div className="mt-2 text-xs text-center font-medium">
          {language === 'ar' 
            ? 'سيتم نقلك لنهاية الدور' 
            : 'You will be moved to end of queue'}
        </div>
      )}
    </div>
  )
}

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


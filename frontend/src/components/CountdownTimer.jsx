/**
 * Countdown Timer Component - مؤقت العد التنازلي
 * @module CountdownTimer
 */

import React, { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'

/**
 * مؤقت العد التنازلي للمراجعة
 * @param {Object} props
 * @param {Function} props.onComplete - دالة عند اكتمال المؤقت
 * @param {number} props.initialSeconds - الثواني الابتدائية
 */
export function CountdownTimer({ onComplete, initialSeconds = 300 }) {
  const [seconds, setSeconds] = useState(initialSeconds)
  const [isRunning, setIsRunning] = useState(true)

  useEffect(() => {
    if (!isRunning || seconds <= 0) {
      if (seconds <= 0 && onComplete) {
        onComplete()
      }
      return
    }

    const timer = setInterval(() => {
      setSeconds(prev => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [isRunning, seconds, onComplete])

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const progress = ((initialSeconds - seconds) / initialSeconds) * 100

  return (
    <div className="flex flex-col items-center p-4 bg-gray-800/50 rounded-xl">
      <Clock className="w-6 h-6 text-[#C9A54C] mb-2" />
      <div className="text-3xl font-mono text-white mb-2">
        {formatTime(seconds)}
      </div>
      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#C9A54C] transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="text-sm text-gray-400 mt-2">الوقت المتبقي</div>
    </div>
  )
}

export default CountdownTimer
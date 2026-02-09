import React, { useState, useEffect } from 'react'
import { Lock } from 'lucide-react'

/**
 * مكون عداد متجاوب يعرض الأرقام بشكل موسع ومتباعد
 * يناسب جميع أحجام الشاشات (iPhone, Android, Desktop)
 */
export function ResponsiveCounter({ 
  title = 'الطابق: الميزانيين',
  status = 'جاهز',
  statusColor = 'text-green-400',
  isLocked = false,
  counters = [
    { value: 0, label: 'الحالي' },
    { value: 1, label: 'رقمك' },
    { value: 0, label: 'أمامك' }
  ],
  onCounterChange = null
}) {
  const [displayCounters, setDisplayCounters] = useState(counters)

  useEffect(() => {
    setDisplayCounters(counters)
  }, [counters])

  const handleCounterChange = (index, delta) => {
    if (isLocked) return
    
    const newCounters = [...displayCounters]
    newCounters[index].value = Math.max(0, newCounters[index].value + delta)
    setDisplayCounters(newCounters)
    
    if (onCounterChange) {
      onCounterChange(newCounters)
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${statusColor} bg-opacity-20 border border-current`}>
            {status}
          </div>
          <h3 className="text-sm sm:text-base font-semibold text-gray-300">
            {title}
          </h3>
        </div>
        {isLocked && (
          <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
        )}
      </div>

      {/* Counter Container */}
      <div className="bg-gray-800/40 border border-gray-700 rounded-2xl p-6 sm:p-8">
        {/* Numbers Row */}
        <div className="flex items-center justify-between mb-8 sm:mb-10">
          {displayCounters.map((counter, index) => (
            <div key={index} className="flex flex-col items-center gap-2 sm:gap-3 flex-1">
              {/* Number Display */}
              <div className="relative">
                <div className="text-5xl sm:text-6xl md:text-7xl font-bold text-white text-center w-20 sm:w-24 md:w-32">
                  {String(counter.value).padStart(2, '0')}
                </div>
              </div>
              
              {/* Label */}
              <p className="text-xs sm:text-sm md:text-base text-gray-400 text-center font-medium">
                {counter.label}
              </p>

              {/* Controls */}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => handleCounterChange(index, -1)}
                  disabled={isLocked || counter.value === 0}
                  className="px-2 sm:px-3 py-1 sm:py-1.5 bg-red-600/20 hover:bg-red-600/40 disabled:opacity-50 text-red-400 rounded-md text-xs sm:text-sm font-semibold transition-colors"
                >
                  −
                </button>
                <button
                  onClick={() => handleCounterChange(index, 1)}
                  disabled={isLocked}
                  className="px-2 sm:px-3 py-1 sm:py-1.5 bg-green-600/20 hover:bg-green-600/40 disabled:opacity-50 text-green-400 rounded-md text-xs sm:text-sm font-semibold transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent mb-8 sm:mb-10" />

        {/* Info Row */}
        <div className="grid grid-cols-2 gap-4 sm:gap-6">
          <div className="text-center">
            <p className="text-xs sm:text-sm text-gray-400 mb-1 sm:mb-2">الوقت المتوقع:</p>
            <p className="text-lg sm:text-2xl md:text-3xl font-bold text-blue-400">
              3:57
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs sm:text-sm text-gray-400 mb-1 sm:mb-2">دورك الآن!</p>
            <p className="text-lg sm:text-2xl md:text-3xl font-bold text-blue-400">
              ✓
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="mt-6 sm:mt-8 px-4 sm:px-6">
        <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-400 mb-1">الحالة:</p>
              <p className="text-sm sm:text-base font-semibold text-white">جاهز للفحص الطبي</p>
            </div>
            <div className="text-right">
              <p className="text-xs sm:text-sm text-gray-400 mb-1">الرقم:</p>
              <p className="text-lg sm:text-xl font-bold text-yellow-400">12345</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ResponsiveCounter

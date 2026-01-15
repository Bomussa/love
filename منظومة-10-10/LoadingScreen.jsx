/**
 * مكون شاشة التحميل
 * يحل مشكلة ظهور المقاسات الخاطئة قبل اكتمال تحميل CSS
 * تاريخ: 15 يناير 2026
 */

import React from 'react'

export function LoadingScreen({ language = 'ar' }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="text-center space-y-6 p-8">
        {/* الشعار */}
        <div className="flex justify-center">
          <img 
            src="/logo.jpeg" 
            alt="قيادة الخدمات الطبية" 
            className="w-24 h-24 object-contain rounded-full shadow-2xl animate-pulse"
          />
        </div>

        {/* النص */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">
            {language === 'ar' ? 'قيادة الخدمات الطبية' : 'Medical Services Command'}
          </h2>
          <p className="text-gray-400">
            {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
          </p>
        </div>

        {/* مؤشر التحميل */}
        <div className="flex justify-center">
          <div className="relative w-16 h-16">
            {/* الدائرة الخارجية */}
            <div className="absolute inset-0 border-4 border-gray-700 rounded-full"></div>
            {/* الدائرة الدوارة */}
            <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 border-r-blue-500 rounded-full animate-spin"></div>
          </div>
        </div>

        {/* نقاط التحميل */}
        <div className="flex justify-center space-x-2 rtl:space-x-reverse">
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  )
}

export default LoadingScreen

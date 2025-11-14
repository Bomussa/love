/**
 * QrScanPage - صفحة مسح QR Code مع كشف الجهاز والتوجيه الذكي
 * يكتشف نوع الجهاز (iPhone/Android/Desktop) ويفتح المتصفح المناسب
 */

import React, { useState, useEffect } from 'react'
import { Camera, Smartphone, Monitor, CheckCircle, XCircle, Loader } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
import axios from 'axios'
import { getApiBase } from '../lib/api-base'

/**
 * كشف نوع الجهاز بدون مكتبات خارجية
 */
function detectDevice() {
  const ua = navigator.userAgent || navigator.vendor || window.opera
  
  // كشف Android
  if (/android/i.test(ua)) {
    return 'Android'
  }
  
  // كشف iOS (iPhone, iPad, iPod)
  if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) {
    return 'iOS'
  }
  
  // أي شيء آخر = Desktop
  return 'Desktop'
}

/**
 * الحصول على أيقونة الجهاز
 */
function getDeviceIcon(device) {
  if (device === 'Desktop') {
    return <Monitor className="w-6 h-6" />
  }
  return <Smartphone className="w-6 h-6" />
}

/**
 * الحصول على اسم الجهاز بالعربية
 */
function getDeviceName(device, language) {
  if (language === 'ar') {
    return device === 'iOS' ? 'آيفون' : device === 'Android' ? 'أندرويد' : 'كمبيوتر'
  }
  return device
}

export function QrScanPage({ language, toggleLanguage }) {
  const [token, setToken] = useState('')
  const [status, setStatus] = useState<'idle' | 'validating' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [device, setDevice] = useState<'iOS' | 'Android' | 'Desktop'>('Desktop')
  const [redirecting, setRedirecting] = useState(false)

  // كشف الجهاز عند التحميل
  useEffect(() => {
    const detectedDevice = detectDevice()
    setDevice(detectedDevice)

  }, [])

  // قراءة token من URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tokenParam = params.get('token')
    
    if (tokenParam) {
      setToken(tokenParam)
      // بدء التحقق تلقائياً
      handleValidateToken(tokenParam)
    }
  }, [])

  /**
   * التحقق من صلاحية Token
   */
  const handleValidateToken = async (tokenValue) => {
    const tokenToValidate = tokenValue || token
    
    if (!tokenToValidate) {
      setErrorMessage(language === 'ar' ? 'الرجاء إدخال رمز الجلسة' : 'Please enter session token')
      return
    }

    setStatus('validating')
    setErrorMessage('')

    try {
      const API_BASE = getApiBase()
      // التحقق من Token
      const response = await axios.post(`${API_BASE}/session/validate`, { 
        token: tokenToValidate 
      })

      if (response.data.ok) {
        // حفظ معلومات الجهاز
        const detectedDevice = detectDevice()
        await axios.post(`${API_BASE}/session/device`, {
          token: tokenToValidate,
          device: detectedDevice
        }).catch(() => {
          // تجاهل الأخطاء - غير حرج

        })

        // نجح التحقق
        setStatus('success')
        
        // التوجيه الذكي بعد ثانية
        setTimeout(() => {
          handleSmartRedirect(detectedDevice)
        }, 1000)
      }
    } catch (error) {
      // console.error('❌ خطأ في التحقق:', error)
      setStatus('error')
      
      const errorCode = error.response?.data?.error || 'UNKNOWN_ERROR'
      
      // رسائل خطأ مفصلة
      const errorMessages = {
        SESSION_NOT_FOUND: {
          ar: 'الجلسة غير موجودة',
          en: 'Session not found'
        },
        SESSION_EXPIRED: {
          ar: 'انتهت صلاحية الجلسة',
          en: 'Session expired'
        },
        SESSION_ALREADY_USED: {
          ar: 'تم استخدام الجلسة من قبل',
          en: 'Session already used'
        },
        UNKNOWN_ERROR: {
          ar: 'حدث خطأ غير متوقع',
          en: 'Unexpected error occurred'
        }
      }
      
      const message = errorMessages[errorCode] || errorMessages.UNKNOWN_ERROR
      setErrorMessage(language === 'ar' ? message.ar : message.en)
    }
  }

  /**
   * التوجيه الذكي حسب نوع الجهاز
   */
  const handleSmartRedirect = (deviceType) => {
    setRedirecting(true)
    
    let appURL
    const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'https://www.mmc-mms.com'
    
    if (deviceType === 'iOS') {
      // iPhone/iPad → يفتح في Safari تلقائياً
      appURL = origin
    } else if (deviceType === 'Android') {
      // Android → يفتح في Chrome مباشرة
      const host = (typeof window !== 'undefined' && window.location && window.location.host) ? window.location.host : 'www.mmc-mms.com'
      appURL = `intent://${host}#Intent;scheme=https;package=com.android.chrome;end`
    } else {
      // Desktop → فتح عادي
      appURL = origin
    }

    setTimeout(() => {
      window.location.href = appURL
    }, 500)
  }

  const t = (key) => {
    const translations = {
      title: { ar: 'مسح رمز QR', en: 'Scan QR Code' },
      subtitle: { ar: 'ادخل رمز الجلسة للمتابعة', en: 'Enter session token to continue' },
      tokenLabel: { ar: 'رمز الجلسة', en: 'Session Token' },
      tokenPlaceholder: { ar: 'الصق رمز الجلسة هنا', en: 'Paste session token here' },
      validateButton: { ar: 'تحقق', en: 'Validate' },
      validating: { ar: 'جاري التحقق...', en: 'Validating...' },
      success: { ar: 'تم التحقق بنجاح!', en: 'Validated successfully!' },
      redirecting: { ar: 'جاري التوجيه...', en: 'Redirecting...' },
      deviceDetected: { ar: 'الجهاز المكتشف', en: 'Detected Device' },
      error: { ar: 'خطأ', en: 'Error' }
    }
    
    return translations[key]?.[language] || key
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="flex items-center gap-2">
              <Camera className="w-6 h-6" />
              {t('title')}
            </CardTitle>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLanguage}
              className="absolute top-4 left-4"
            >
              {language === 'ar' ? '🇺🇸 EN' : '🇶🇦 AR'}
            </Button>
          </div>
          
          <p className="text-sm text-gray-400">
            {t('subtitle')}
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* كشف الجهاز */}
          <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
            <span className="text-sm text-gray-400">{t('deviceDetected')}:</span>
            <div className="flex items-center gap-2">
              {getDeviceIcon(device)}
              <span className="font-medium">{getDeviceName(device, language)}</span>
            </div>
          </div>

          {/* إدخال Token */}
          {!token && (
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('tokenLabel')}</label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={t('tokenPlaceholder')}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                disabled={status === 'validating'}
              />
            </div>
          )}

          {/* زر التحقق */}
          {status === 'idle' && (
            <Button
              onClick={() => handleValidateToken()}
              className="w-full"
              disabled={!token}
            >
              {t('validateButton')}
            </Button>
          )}

          {/* حالة التحقق */}
          {status === 'validating' && (
            <div className="flex items-center justify-center gap-2 py-4">
              <Loader className="w-5 h-5 animate-spin" />
              <span>{t('validating')}</span>
            </div>
          )}

          {/* نجح التحقق */}
          {status === 'success' && (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 py-4 text-green-500">
                <CheckCircle className="w-8 h-8" />
                <span className="font-medium">{t('success')}</span>
              </div>
              
              {redirecting && (
                <div className="flex items-center justify-center gap-2 py-2">
                  <Loader className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-gray-400">{t('redirecting')}</span>
                </div>
              )}
            </div>
          )}

          {/* خطأ */}
          {status === 'error' && errorMessage && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500">
                <XCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{errorMessage}</span>
              </div>
              
              <Button
                onClick={() => {
                  setStatus('idle')
                  setErrorMessage('')
                  setToken('')
                }}
                variant="outline"
                className="w-full"
              >
                {language === 'ar' ? 'حاول مرة أخرى' : 'Try Again'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

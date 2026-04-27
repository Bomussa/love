import React, { useState, useEffect, useRef } from 'react'
import { ZFDTicketDisplay } from './ZFDTicketDisplay'
import { t } from '../lib/i18n'
import api from '../lib/api-unified'
import { supabase } from '../lib/supabase-client'

/**
 * Enhanced DisplayPage with Real-time Sync
 * 
 * ✅ Realtime Subscriptions بدلاً من Polling
 * ✅ تحديث فوري عند أي تغيير
 * ✅ استهلاك موارد منخفض
 * ✅ أداء ممتاز
 */
export function DisplayPage({ clinicId, language }) {
  const resolvedClinicId = clinicId || (() => {
    if (typeof window === 'undefined') return null
    const match = window.location.pathname.match(/^\/clinic\/([^/]+)\/display$/)
    return match ? decodeURIComponent(match[1]) : null
  })()

  const [currentStep, setCurrentStep] = useState(null)
  const [isConnected, setIsConnected] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const subscriptionRef = useRef(null)
  const connectionCheckRef = useRef(null)

  useEffect(() => {
    if (!resolvedClinicId) return

    // تهيئة الاشتراك الفوري
    initializeRealtimeSubscription()

    // فحص الاتصال كل 30 ثانية
    connectionCheckRef.current = setInterval(checkConnection, 30000)

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current)
      }
      if (connectionCheckRef.current) {
        clearInterval(connectionCheckRef.current)
      }
    }
  }, [resolvedClinicId])

  /**
   * تهيئة الاشتراك الفوري للتحديثات
   */
  const initializeRealtimeSubscription = () => {
    try {
      // الاشتراك في تغييرات جدول unified_queue
      subscriptionRef.current = supabase
        .channel(`queue-${resolvedClinicId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'unified_queue',
            filter: `clinic_id=eq.${resolvedClinicId}`,
          },
          (payload) => {
            handleQueueUpdate(payload)
          }
        )
        .subscribe((status) => {
          console.log('Subscription status:', status)
          setIsConnected(status === 'SUBSCRIBED')
        })
    } catch (error) {
      console.error('Error initializing realtime subscription:', error)
      setIsConnected(false)
    }
  }

  /**
   * معالجة تحديثات الطابور
   */
  const handleQueueUpdate = async (payload) => {
    try {
      const { new: newData, old: oldData, eventType } = payload

      // جلب أحدث بيانات الطابور
      await fetchCurrentStatus()
      
      setLastUpdate(new Date().toLocaleTimeString('ar-SA'))
      
      console.log('Queue updated:', {
        event: eventType,
        data: newData,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('Error handling queue update:', error)
    }
  }

  /**
   * جلب حالة الطابور الحالية
   */
  const fetchCurrentStatus = async () => {
    try {
      // جلب أول مراجع في حالة "called" أو "serving"
      const { data, error } = await supabase
        .from('unified_queue')
        .select('*')
        .eq('clinic_id', resolvedClinicId)
        .in('status', ['called', 'serving'])
        .order('called_at', { ascending: true })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      if (data) {
        setCurrentStep({
          status: 'OK',
          assigned: { ticket: data.display_number },
          clinicId: resolvedClinicId,
          patientId: data.patient_id,
          patientName: data.patient_name,
          examType: data.exam_type,
          calledAt: data.called_at,
          queueId: data.id,
        })
      } else {
        setCurrentStep(null)
      }
    } catch (error) {
      console.error('Error fetching queue status:', error)
    }
  }

  /**
   * فحص الاتصال بالخادم
   */
  const checkConnection = async () => {
    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('id')
        .limit(1)

      setIsConnected(!error)
    } catch (error) {
      setIsConnected(false)
    }
  }

  /**
   * إعادة الاتصال في حالة الانقطاع
   */
  const reconnect = () => {
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current)
    }
    initializeRealtimeSubscription()
    fetchCurrentStatus()
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8 relative">
      {/* مؤشر الاتصال */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
        <span className="text-sm">{isConnected ? 'متصل' : 'غير متصل'}</span>
      </div>

      {/* الشعار */}
      <img 
        src="/mms-logo.png" 
        alt="اللجنة الطبية العسكرية" 
        className="w-24 h-24 object-contain mb-4"
        loading="lazy"
      />

      {/* العنوان */}
      <h1 className="text-4xl font-bold mb-12">{t('Current Patient')}</h1>

      {/* عرض الرقم الحالي */}
      <div className="scale-150 transform">
        <ZFDTicketDisplay 
          step={currentStep} 
          className="bg-gray-800 rounded-3xl p-12 min-w-[400px]"
        />
      </div>

      {/* معلومات العيادة */}
      <div className="mt-12 text-2xl text-gray-500">
        {t('Clinic')}: {resolvedClinicId}
      </div>

      {/* آخر تحديث */}
      {lastUpdate && (
        <div className="mt-4 text-sm text-gray-400">
          آخر تحديث: {lastUpdate}
        </div>
      )}

      {/* زر إعادة الاتصال في حالة الانقطاع */}
      {!isConnected && (
        <button
          onClick={reconnect}
          className="mt-8 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition-colors"
        >
          إعادة الاتصال
        </button>
      )}
    </div>
  )
}

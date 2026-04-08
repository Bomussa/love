import React, { useState, useEffect, useRef } from 'react'
import { ZFDTicketDisplay } from './ZFDTicketDisplay'
import { t } from '../lib/i18n'
import { supabase } from '../lib/supabase-client'
import { formatQatarTime } from '../lib/date-utils'

/**
 * Enhanced DisplayPage with Real-time Sync (Fixed for public.queues)
 * 
 * ✅ Realtime Subscriptions on public.queues
 * ✅ Fallback logic for queue numbers
 * ✅ Automatic clinicId from URL
 */
export function DisplayPage({ clinicId: propClinicId, language }) {
  // Get clinicId from URL if not provided via props
  const [clinicId, setClinicId] = useState(propClinicId || null)
  const [currentStep, setCurrentStep] = useState(null)
  const [isConnected, setIsConnected] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const subscriptionRef = useRef(null)

  useEffect(() => {
    // Extract clinicId from URL if not provided
    if (!clinicId) {
      const pathParts = window.location.pathname.split('/')
      const idFromPath = pathParts[pathParts.indexOf('clinic') + 1]
      if (idFromPath && idFromPath !== 'display') {
        setClinicId(idFromPath)
      } else {
        // Try query params
        const urlParams = new URLSearchParams(window.location.search)
        const idFromQuery = urlParams.get('clinicId')
        if (idFromQuery) setClinicId(idFromQuery)
      }
    }
  }, [clinicId])

  useEffect(() => {
    if (!clinicId) return

    // Initial fetch
    fetchCurrentStatus()

    // Initialize Realtime Subscription
    initializeRealtimeSubscription()

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current)
      }
    }
  }, [clinicId])

  /**
   * Initialize Realtime Subscription for public.queues
   */
  const initializeRealtimeSubscription = () => {
    try {
      // Subscribe to changes in public.queues table
      subscriptionRef.current = supabase
        .channel(`queue-live-${clinicId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'queues',
            filter: `clinic_id=eq.${clinicId}`,
          },
          (payload) => {
            console.log('Realtime update received:', payload)
            fetchCurrentStatus()
            setLastUpdate(formatQatarTime(new Date()))
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
   * Fetch current queue status from public.queues
   */
  const fetchCurrentStatus = async () => {
    try {
      // 1. Try to find "called" or "serving"
      let { data, error } = await supabase
        .from('queues')
        .select('*')
        .eq('clinic_id', clinicId)
        .in('status', ['called', 'serving'])
        .order('created_at', { ascending: false }) // Get the most recent called
        .limit(1)
        .single()

      // 2. Fallback: If no called/serving, show first "waiting"
      if (error || !data) {
        const { data: waitingData, error: waitingError } = await supabase
          .from('queues')
          .select('*')
          .eq('clinic_id', clinicId)
          .eq('status', 'waiting')
          .order('created_at', { ascending: true })
          .limit(1)
          .single()
        
        if (!waitingError && waitingData) {
          data = waitingData
        }
      }

      if (data) {
        // Logic for display number: display_number > queue_number_int > queue_number
        const ticketNumber = data.display_number || data.queue_number_int || data.queue_number

        setCurrentStep({
          status: 'OK',
          assigned: { ticket: ticketNumber },
          clinicId: clinicId,
          patientId: data.patient_id,
          patientName: data.patient_name,
          examType: data.exam_type,
          queueId: data.id,
        })
      } else {
        setCurrentStep(null)
      }
    } catch (error) {
      console.error('Error fetching queue status:', error)
    }
  }

  const reconnect = () => {
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current)
    }
    initializeRealtimeSubscription()
    fetchCurrentStatus()
  }

  if (!clinicId) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center p-8 bg-red-900/20 rounded-2xl border border-red-500/50">
          <h2 className="text-2xl font-bold mb-4">خطأ في التوجيه</h2>
          <p>لم يتم تحديد معرف العيادة (clinicId). يرجى التأكد من الرابط.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Connection Indicator */}
      <div className="absolute top-6 right-6 flex items-center gap-3 bg-gray-900/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`}></div>
        <span className="text-sm font-medium">{isConnected ? 'متصل مباشر' : 'انقطع الاتصال'}</span>
      </div>

      {/* Logo */}
      <div className="mb-8 relative">
        <img 
          src="/mms-logo.png" 
          alt="MMS Logo" 
          className="w-32 h-32 object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]"
        />
      </div>

      {/* Title */}
      <h1 className="text-5xl font-black mb-16 tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500">
        {t('Current Patient')}
      </h1>

      {/* Ticket Display */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-[40px] blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
        <div className="relative scale-125 transform">
          <ZFDTicketDisplay 
            step={currentStep} 
            className="bg-gray-900/80 backdrop-blur-xl rounded-[32px] p-16 min-w-[450px] border border-white/10 shadow-2xl"
          />
        </div>
      </div>

      {/* Clinic Info */}
      <div className="mt-24 flex flex-col items-center gap-4">
        <div className="px-6 py-2 bg-white/5 rounded-full border border-white/5 text-xl text-gray-400">
          {t('Clinic')}: <span className="text-white font-bold">{clinicId}</span>
        </div>
        
        {lastUpdate && (
          <div className="text-sm text-gray-500 font-mono">
            آخر تحديث: {lastUpdate}
          </div>
        )}
      </div>

      {!isConnected && (
        <button
          onClick={reconnect}
          className="mt-12 px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl text-white font-bold transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-blue-600/20"
        >
          إعادة الاتصال الفوري
        </button>
      )}
    </div>
  )
}

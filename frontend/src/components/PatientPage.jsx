import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
import { Input } from './Input'
import { Lock, Unlock, Clock, Globe, LogIn, LogOut, ArrowRight, CheckCircle, Loader2, AlertCircle } from 'lucide-react'
import { calculateWaitTime, examTypes, formatTime } from '../lib/utils'
import { computeEtaMinutes } from '../lib/eta'
import { getDynamicMedicalPathway } from '../lib/dynamic-pathways'
import { t } from '../lib/i18n'
import api from '../lib/api-unified'
import { ZFDTicketDisplay, ZFDBanner } from './ZFDTicketDisplay'
import NotificationSystem, { useNotifications } from './NotificationSystem'
import { CountdownTimer } from './CountdownTimer'
import eventBus from '../core/event-bus'
import { supabase } from '../lib/supabase-client'

export function PatientPage({ patientData, onLogout, language, toggleLanguage }) {
  const [stations, setStations] = useState([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [activeTicket, setActiveTicket] = useState(null)
  const [routeWithZFD, setRouteWithZFD] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState('connected')
  const { notifications: notifList, push: pushNotif, dismiss: dismissNotif } = useNotifications()
  const isInitialLoadRef = useRef(false)

  // Initialize queue on component mount
  useEffect(() => {
    const initializeQueue = async () => {
      if (!patientData?.id || !patientData?.examType) {
        setInitialLoading(false)
        return
      }

      try {
        setConnectionStatus('loading')
        const result = await api.enterQueue(patientData.id, patientData.examType)
        
        if (result.success) {
          setConnectionStatus('connected')
          setActiveTicket({
            queueId: result.data.queueId,
            number: result.data.number,
            status: result.data.status,
            path: result.data.path
          })
          
          // Initialize stations based on path
          if (result.data.path) {
            const stationsList = result.data.path.map((clinicId, idx) => ({
              id: clinicId,
              order: idx + 1,
              isEntered: idx === 0,
              status: idx === 0 ? 'current' : 'pending'
            }))
            setStations(stationsList)
          }
          
          pushNotif({
            type: 'success',
            title: language === 'ar' ? 'تم إنشاء الطابور' : 'Queue Created',
            message: language === 'ar' ? `رقمك: ${result.data.number}` : `Your number: ${result.data.number}`
          })
        } else {
          setConnectionStatus('error')
          pushNotif({
            type: 'error',
            message: result.error || (language === 'ar' ? 'فشل إنشاء الطابور' : 'Failed to create queue')
          })
        }
      } catch (err) {
        setConnectionStatus('error')
        console.error('[PatientPage] Queue initialization failed:', err)
        pushNotif({
          type: 'error',
          message: language === 'ar' ? 'خطأ في الاتصال' : 'Connection error'
        })
      } finally {
        setInitialLoading(false)
      }
    }

    if (!isInitialLoadRef.current) {
      isInitialLoadRef.current = true
      initializeQueue()
    }
  }, [patientData?.id, patientData?.examType, language])

  // Real-time updates
  useEffect(() => {
    if (!activeTicket?.queueId) return

    const channel = supabase.channel(`patient_${activeTicket.queueId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'queues',
        filter: `id=eq.${activeTicket.queueId}`
      }, (payload) => {
        if (payload.new) {
          setActiveTicket(prev => ({
            ...prev,
            status: payload.new.status,
            current_step: payload.new.current_step
          }))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeTicket?.queueId])

  const handleEnterClinic = async (clinicId) => {
    if (!activeTicket?.queueId) return
    
    try {
      setLoading(true)
      const result = await api.startExam(activeTicket.queueId)
      
      if (result.success) {
        setActiveTicket(prev => ({
          ...prev,
          status: 'IN_PROGRESS'
        }))
        
        pushNotif({
          type: 'success',
          title: language === 'ar' ? 'تم الدخول' : 'Entered',
          message: language === 'ar' ? 'يرجى التوجه للعيادة' : 'Please go to the clinic'
        })
      }
    } catch (err) {
      console.error('[PatientPage] Enter clinic failed:', err)
      pushNotif({
        type: 'error',
        message: language === 'ar' ? 'فشل الدخول' : 'Failed to enter'
      })
    } finally {
      setLoading(false)
    }
  }

  // Periodic status check
  useEffect(() => {
    if (!patientData?.id) return

    const checkStatus = async () => {
      try {
        const result = await api.getQueueStatus(patientData.id)
        if (result.success && result.data) {
          setConnectionStatus('connected')
          setActiveTicket(prev => ({
            ...prev,
            ...result.data
          }))
        }
      } catch (err) {
        setConnectionStatus('error')
        console.error('[PatientPage] Status check failed:', err)
      }
    }

    const interval = setInterval(checkStatus, 5000)
    return () => clearInterval(interval)
  }, [patientData?.id])

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-white text-xl">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
        </div>
      </div>
    )
  }

  const t_local = (ar, en) => language === 'ar' ? ar : en

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">{t_local('الطابور', 'Queue')}</h1>
            <p className="text-gray-300">{t_local('نوع الفحص', 'Exam Type')}: {patientData?.examType}</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={toggleLanguage}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
            >
              <Globe size={20} />
              {language === 'ar' ? 'EN' : 'AR'}
            </button>
            <button
              onClick={onLogout}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2"
            >
              <LogOut size={20} />
              {t_local('خروج', 'Exit')}
            </button>
          </div>
        </div>

        {/* Connection Status */}
        <div className="mb-6">
          <div className={`p-4 rounded-lg flex items-center gap-2 ${
            connectionStatus === 'connected' ? 'bg-green-900/30 border border-green-500' :
            connectionStatus === 'loading' ? 'bg-yellow-900/30 border border-yellow-500' :
            'bg-red-900/30 border border-red-500'
          }`}>
            <div className={`w-3 h-3 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500' :
              connectionStatus === 'loading' ? 'bg-yellow-500 animate-pulse' :
              'bg-red-500'
            }`} />
            <span className="text-white">
              {connectionStatus === 'connected' ? t_local('متصل', 'Connected') :
               connectionStatus === 'loading' ? t_local('جاري الاتصال...', 'Connecting...') :
               t_local('خطأ في الاتصال', 'Connection Error')}
            </span>
          </div>
        </div>

        {/* Active Ticket */}
        {activeTicket && (
          <Card className="bg-gradient-to-br from-yellow-900 to-yellow-800 border-2 border-yellow-500 mb-8">
            <CardHeader>
              <CardTitle className="text-white text-center text-5xl">{activeTicket.number}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-gray-300 text-sm">{t_local('الحالة', 'Status')}</p>
                  <p className="text-xl font-bold text-white">{activeTicket.status}</p>
                </div>
                <div>
                  <p className="text-gray-300 text-sm">{t_local('الخطوة', 'Step')}</p>
                  <p className="text-xl font-bold text-white">{(activeTicket.current_step || 0) + 1}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stations */}
        <div className="space-y-4">
          {stations.map((station, idx) => (
            <Card 
              key={station.id}
              className={`border-2 ${
                station.isEntered ? 'border-green-500 bg-green-900/20' : 'border-gray-600 bg-gray-900/20'
              }`}
            >
              <CardHeader>
                <CardTitle className="text-white">{t_local('العيادة', 'Clinic')} {idx + 1}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">{station.id}</span>
                  {!station.isEntered && activeTicket?.status === 'WAITING' && idx === 0 && (
                    <button
                      onClick={() => handleEnterClinic(station.id)}
                      disabled={loading}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg flex items-center gap-2"
                    >
                      <ArrowRight size={18} />
                      {t_local('دخول', 'Enter')}
                    </button>
                  )}
                  {station.isEntered && (
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle size={20} />
                      {t_local('مكتمل', 'Completed')}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Notifications */}
        <NotificationSystem notifications={notifList} onDismiss={dismissNotif} />
      </div>
    </div>
  )
}

export default PatientPage

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
import { Globe, LogOut, Users, Clock, CheckCircle, Activity, UserCheck, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase-client'
import api from '../lib/api-unified'
import NotificationSystem, { useNotifications } from './NotificationSystem'

export function DoctorDashboard({ doctorData, onLogout, language, toggleLanguage }) {
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({
    totalToday: 0,
    completedToday: 0,
    waitingNow: 0,
    avgExamTime: 0
  })
  const [currentPatient, setCurrentPatient] = useState(null)
  const [examStartTime, setExamStartTime] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState('connected')
  const { notifications: notifList, push: pushNotif, dismiss: dismissNotif } = useNotifications()

  const clinicId = doctorData?.clinicId || doctorData?.clinic_id
  const clinicName = doctorData?.clinicName || doctorData?.clinic_name || (language === 'ar' ? 'العيادة' : 'Clinic')

  // Fetch patients and stats using Unified API
  const fetchData = async () => {
    if (!clinicId) return
    try {
      setConnectionStatus('loading')
      const response = await api.getClinicWaitingCount(clinicId)
      
      if (response.success || response.data) {
        setConnectionStatus('connected')
        const waitingCount = response.data?.waitingCount || response.data || 0
        
        setStats(prev => ({
          ...prev,
          waitingNow: waitingCount
        }))
      } else {
        setConnectionStatus('error')
        console.error('API Error:', response.error)
      }
    } catch (err) {
      setConnectionStatus('error')
      console.error('Error fetching data:', err)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 3000)
    return () => clearInterval(interval)
  }, [clinicId])

  // Real-time updates via Supabase
  useEffect(() => {
    if (!clinicId) return
    const channel = supabase.channel(`doctor_updates_${clinicId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queues', filter: `clinic_id=eq.${clinicId}` }, () => {
        fetchData()
      }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [clinicId])

  const handleCallNext = async () => {
    if (!clinicId) return
    setLoading(true)
    try {
      const result = await api.callNextPatient(clinicId)
      if (result.success && result.data) {
        pushNotif({
          type: 'success',
          title: language === 'ar' ? 'تم الاستدعاء' : 'Patient Called',
          message: language === 'ar' ? `تم استدعاء المراجع رقم ${result.data.display_number}` : `Called patient ${result.data.display_number}`
        })
        fetchData()
      } else {
        pushNotif({ type: 'info', message: language === 'ar' ? 'لا يوجد مراجعين في الانتظار' : 'No patients waiting' })
      }
    } catch (err) {
      pushNotif({ type: 'error', message: language === 'ar' ? 'فشل الاستدعاء' : 'Call failed' })
    } finally {
      setLoading(false)
    }
  }

  const handleStartExam = async (queueId) => {
    if (!queueId) return
    setLoading(true)
    try {
      const result = await api.startExam(queueId)
      if (result.success) {
        setCurrentPatient(result.data)
        setExamStartTime(new Date())
        pushNotif({
          type: 'success',
          title: language === 'ar' ? 'بدء الفحص' : 'Exam Started',
          message: language === 'ar' ? 'تم بدء فحص المراجع' : 'Patient exam started'
        })
        fetchData()
      }
    } catch (err) {
      pushNotif({ type: 'error', message: language === 'ar' ? 'فشل بدء الفحص' : 'Failed to start exam' })
    } finally {
      setLoading(false)
    }
  }

  const handleAdvanceQueue = async (queueId) => {
    if (!queueId || !clinicId) return
    setLoading(true)
    try {
      const result = await api.advanceQueue(queueId, clinicId)
      if (result.success) {
        setCurrentPatient(null)
        setExamStartTime(null)
        pushNotif({
          type: 'success',
          title: language === 'ar' ? 'تم الانتقال' : 'Advanced',
          message: language === 'ar' ? 'تم نقل المراجع للعيادة التالية' : 'Patient moved to next clinic'
        })
        fetchData()
      }
    } catch (err) {
      pushNotif({ type: 'error', message: language === 'ar' ? 'فشل الانتقال' : 'Failed to advance' })
    } finally {
      setLoading(false)
    }
  }

  const t = (ar, en) => language === 'ar' ? ar : en

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">{t('لوحة الطبيب', 'Doctor Dashboard')}</h1>
            <p className="text-gray-300">{clinicName}</p>
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
              {t('تسجيل الخروج', 'Logout')}
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
              {connectionStatus === 'connected' ? t('متصل', 'Connected') :
               connectionStatus === 'loading' ? t('جاري الاتصال...', 'Connecting...') :
               t('خطأ في الاتصال', 'Connection Error')}
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-blue-900 to-blue-800 border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-gray-300 text-sm">{t('الانتظار الآن', 'Waiting Now')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-white">{stats.waitingNow}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-900 to-green-800 border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-gray-300 text-sm">{t('المكتمل اليوم', 'Completed Today')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-white">{stats.completedToday}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-900 to-purple-800 border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-gray-300 text-sm">{t('الإجمالي اليوم', 'Total Today')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-white">{stats.totalToday}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-900 to-orange-800 border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-gray-300 text-sm">{t('متوسط الوقت', 'Avg Time')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-white">{stats.avgExamTime}m</div>
            </CardContent>
          </Card>
        </div>

        {/* Current Patient */}
        {currentPatient && (
          <Card className="bg-gradient-to-br from-yellow-900 to-yellow-800 border-2 border-yellow-500 mb-8">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Activity size={24} className="text-yellow-300" />
                {t('المراجع الحالي', 'Current Patient')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-gray-300 text-sm">{t('الرقم', 'Number')}</p>
                  <p className="text-2xl font-bold text-white">{currentPatient.display_number}</p>
                </div>
                <div>
                  <p className="text-gray-300 text-sm">{t('الحالة', 'Status')}</p>
                  <p className="text-2xl font-bold text-white">{currentPatient.status}</p>
                </div>
              </div>
              <button
                onClick={() => handleAdvanceQueue(currentPatient.id)}
                disabled={loading}
                className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg font-bold flex items-center justify-center gap-2"
              >
                <CheckCircle size={20} />
                {t('انتقال للعيادة التالية', 'Move to Next Clinic')}
              </button>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <button
            onClick={handleCallNext}
            disabled={loading}
            className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-600 disabled:to-gray-700 text-white rounded-lg font-bold text-lg flex items-center justify-center gap-2"
          >
            <Users size={24} />
            {t('استدعاء التالي', 'Call Next Patient')}
          </button>

          <button
            onClick={() => currentPatient && handleStartExam(currentPatient.id)}
            disabled={loading || !currentPatient}
            className="px-6 py-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-600 disabled:to-gray-700 text-white rounded-lg font-bold text-lg flex items-center justify-center gap-2"
          >
            <CheckCircle size={24} />
            {t('بدء الفحص', 'Start Exam')}
          </button>
        </div>

        {/* Notifications */}
        <NotificationSystem notifications={notifList} onDismiss={dismissNotif} />
      </div>
    </div>
  )
}

export default DoctorDashboard

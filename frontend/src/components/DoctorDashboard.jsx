
import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
import { Globe, LogOut, Users, Clock, CheckCircle, Activity, UserCheck } from 'lucide-react'
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
  const { notifications: notifList, push: pushNotif, dismiss: dismissNotif } = useNotifications()

  const clinicId = doctorData?.clinicId || doctorData?.clinic_id
  const clinicName = doctorData?.clinicName || doctorData?.clinic_name || (language === 'ar' ? 'العيادة' : 'Clinic')

  // Fetch patients and stats using Unified API
  const fetchData = async () => {
    if (!clinicId) return
    try {
      const response = await api.getQueueStatus(clinicId)
      if (response.success) {
        // Backend v5.0 returns data in a specific format
        const allData = response.data || []
        const waiting = allData.filter(p => p.status === 'WAITING')
        const inProgress = allData.find(p => p.status === 'IN_PROGRESS')
        const completed = allData.filter(p => p.status === 'DONE')

        setPatients(waiting)
        
        if (inProgress) {
          setCurrentPatient(inProgress)
          setExamStartTime(inProgress.activated_at ? new Date(inProgress.activated_at) : new Date())
        } else {
          setCurrentPatient(null)
          setExamStartTime(null)
        }

        // Stats calculation
        setStats({
          totalToday: allData.length,
          completedToday: completed.length,
          waitingNow: waiting.length,
          avgExamTime: 0 // Can be calculated if needed
        })
      }
    } catch (err) {
      console.error('Error fetching data:', err)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
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
      if (result.success && result.data?.queueId) {
        pushNotif({
          type: 'success',
          title: language === 'ar' ? 'تم الاستدعاء' : 'Patient Called',
          message: language === 'ar' ? `تم استدعاء المراجع رقم ${result.data.number}` : `Called patient ${result.data.number}`
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

  const handleStartExam = async (patientId) => {
    setLoading(true)
    try {
      const result = await api.startExam(patientId)
      if (result.success) {
        pushNotif({ type: 'success', message: language === 'ar' ? 'بدء الفحص' : 'Exam started' })
        fetchData()
      }
    } catch (err) {
      pushNotif({ type: 'error', message: language === 'ar' ? 'فشل بدء الفحص' : 'Start failed' })
    } finally {
      setLoading(false)
    }
  }

  const handleCompleteExam = async () => {
    if (!currentPatient) return
    setLoading(true)
    try {
      const result = await api.advanceQueue(currentPatient.id, clinicId, currentPatient.version)
      if (result.success) {
        pushNotif({ type: 'success', message: language === 'ar' ? 'تم إكمال الفحص' : 'Exam completed' })
        fetchData()
      }
    } catch (err) {
      pushNotif({ type: 'error', message: language === 'ar' ? 'فشل إكمال الفحص' : 'Complete failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <NotificationSystem notifications={notifList} onDismiss={dismissNotif} />
      
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <img src="/mms-logo.png" alt="Logo" className="w-12 h-12" />
            <div>
              <h1 className="text-xl font-bold">{clinicName}</h1>
              <p className="text-sm text-gray-400">{language === 'ar' ? 'لوحة تحكم الطبيب' : 'Doctor Dashboard'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={toggleLanguage}><Globe className="w-4 h-4 mr-2" />{language === 'ar' ? 'EN' : 'AR'}</Button>
            <Button variant="ghost" size="sm" className="text-red-400" onClick={onLogout}><LogOut className="w-4 h-4 mr-2" />{language === 'ar' ? 'خروج' : 'Exit'}</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-500" />
              <div><p className="text-xs text-gray-400">{language === 'ar' ? 'إجمالي اليوم' : 'Total Today'}</p><p className="text-xl font-bold">{stats.totalToday}</p></div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="w-8 h-8 text-yellow-500" />
              <div><p className="text-xs text-gray-400">{language === 'ar' ? 'في الانتظار' : 'Waiting'}</p><p className="text-xl font-bold">{stats.waitingNow}</p></div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <div><p className="text-xs text-gray-400">{language === 'ar' ? 'تم فحصهم' : 'Completed'}</p><p className="text-xl font-bold">{stats.completedToday}</p></div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4 flex items-center gap-3">
              <Activity className="w-8 h-8 text-purple-500" />
              <div><p className="text-xs text-gray-400">{language === 'ar' ? 'الحالة' : 'Status'}</p><p className="text-sm font-bold text-green-400">{language === 'ar' ? 'متصل' : 'Online'}</p></div>
            </CardContent>
          </Card>
        </div>

        {currentPatient ? (
          <Card className="bg-blue-900/20 border-blue-500/50">
            <CardHeader><CardTitle className="text-blue-400">{language === 'ar' ? 'المراجع الحالي' : 'Current Patient'}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-3xl font-bold">#{currentPatient.display_number}</p>
                  <p className="text-sm text-gray-400">{currentPatient.patient_id}</p>
                </div>
                <Button onClick={handleCompleteExam} disabled={loading} className="bg-green-600 hover:bg-green-700">
                  <UserCheck className="w-4 h-4 mr-2" /> {language === 'ar' ? 'إكمال الفحص' : 'Complete Exam'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="text-center py-12 bg-gray-800/50 rounded-xl border border-dashed border-gray-700">
            <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-6">{language === 'ar' ? 'لا يوجد مراجع قيد الفحص حالياً' : 'No patient currently in exam'}</p>
            <Button onClick={handleCallNext} disabled={loading || stats.waitingNow === 0} size="lg" className="bg-blue-600 hover:bg-blue-700">
              {language === 'ar' ? 'نداء المراجع التالي' : 'Call Next Patient'}
            </Button>
          </div>
        )}

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader><CardTitle>{language === 'ar' ? 'قائمة الانتظار' : 'Waiting List'}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {patients.length > 0 ? patients.map(p => (
                <div key={p.id} className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                  <div className="flex items-center gap-4">
                    <span className="text-xl font-bold">#{p.display_number}</span>
                    <span className="text-sm text-gray-400">{p.patient_id}</span>
                  </div>
                  <Button size="sm" onClick={() => handleStartExam(p.id)} disabled={loading || !!currentPatient}>
                    {language === 'ar' ? 'بدء' : 'Start'}
                  </Button>
                </div>
              )) : (
                <p className="text-center text-gray-500 py-4">{language === 'ar' ? 'القائمة فارغة' : 'List is empty'}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

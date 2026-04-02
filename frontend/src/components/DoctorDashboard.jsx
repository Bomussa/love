import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
import { Input } from './Input'
import { Globe, LogOut, Users, Clock, CheckCircle, SkipForward, UserCheck, Calendar, TrendingUp, Activity } from 'lucide-react'
import { supabase } from '../lib/supabase-client'
import { formatTime, formatDuration } from '../lib/utils'
import NotificationSystem, { useNotifications } from './NotificationSystem'
import eventBus from '../core/event-bus'

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

  const clinicId = doctorData?.clinic_id
  const clinicName = doctorData?.clinic_name || (language === 'ar' ? 'العيادة' : 'Clinic')

  // Fetch patients for this clinic
  const fetchPatients = async () => {
    if (!clinicId) return
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('unified_queue')
        .select('*')
        .eq('clinic_id', clinicId)
        .gte('created_at', today)
        .order('display_number', { ascending: true })

      if (error) throw error

      const waiting = data?.filter(p => p.status === 'waiting' || p.status === 'called') || []
      const completed = data?.filter(p => p.status === 'completed') || []
      const inProgress = data?.find(p => p.status === 'in_progress')

      setPatients(waiting)

      // Calculate stats
      const totalExamTime = completed.reduce((sum, p) => {
        if (p.exam_start_time && p.exam_end_time) {
          return sum + (new Date(p.exam_end_time) - new Date(p.exam_start_time))
        }
        return sum
      }, 0)

      const avgTime = completed.length > 0 ? totalExamTime / completed.length : 0

      setStats({
        totalToday: data?.length || 0,
        completedToday: completed.length,
        waitingNow: waiting.length,
        avgExamTime: avgTime
      })

      if (inProgress) {
        setCurrentPatient(inProgress)
        setExamStartTime(inProgress.exam_start_time ? new Date(inProgress.exam_start_time) : new Date())
      } else {
        setCurrentPatient(null)
        setExamStartTime(null)
      }
    } catch (err) {
      console.error('Error fetching patients:', err)
    }
  }

  useEffect(() => {
    fetchPatients()
    const interval = setInterval(fetchPatients, 5000)
    return () => clearInterval(interval)
  }, [clinicId])

  // Real-time subscription
  useEffect(() => {
    if (!clinicId) return

    const channel = supabase
      .channel(`clinic_queue_${clinicId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'unified_queue',
        filter: `clinic_id=eq.${clinicId}`
      }, () => {
        fetchPatients()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [clinicId])

  // Call next patient
  const handleCallNext = async () => {
    if (!clinicId || patients.length === 0) return

    setLoading(true)
    try {
      const nextPatient = patients[0]

      const { error } = await supabase
        .from('unified_queue')
        .update({
          status: 'called',
          called_at: new Date().toISOString()
        })
        .eq('id', nextPatient.id)

      if (error) throw error

      pushNotif({
        type: 'success',
        title: language === 'ar' ? 'تم الاستدعاء' : 'Patient Called',
        message: language === 'ar' 
          ? `تم استدعاء المراجع رقم ${nextPatient.display_number}`
          : `Called patient number ${nextPatient.display_number}`
      })

      fetchPatients()
    } catch (err) {
      pushNotif({
        type: 'error',
        message: language === 'ar' ? 'فشل الاستدعاء' : 'Failed to call patient'
      })
    } finally {
      setLoading(false)
    }
  }

  // Start examination
  const handleStartExam = async (patient) => {
    if (!clinicId) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('unified_queue')
        .update({
          status: 'in_progress',
          exam_start_time: new Date().toISOString()
        })
        .eq('id', patient.id)

      if (error) throw error

      setCurrentPatient(patient)
      setExamStartTime(new Date())

      pushNotif({
        type: 'success',
        title: language === 'ar' ? 'بدء الفحص' : 'Exam Started',
        message: language === 'ar' 
          ? `بدء فحص المراجع رقم ${patient.display_number}`
          : `Started exam for patient ${patient.display_number}`
      })

      fetchPatients()
    } catch (err) {
      pushNotif({
        type: 'error',
        message: language === 'ar' ? 'فشل بدء الفحص' : 'Failed to start exam'
      })
    } finally {
      setLoading(false)
    }
  }

  // Complete examination
  const handleCompleteExam = async () => {
    if (!currentPatient) return

    setLoading(true)
    try {
      const examEndTime = new Date().toISOString()
      const examDuration = examStartTime ? new Date() - new Date(examStartTime) : 0

      const { error } = await supabase
        .from('unified_queue')
        .update({
          status: 'completed',
          exam_end_time: examEndTime,
          exam_duration_seconds: Math.floor(examDuration / 1000)
        })
        .eq('id', currentPatient.id)

      if (error) throw error

      pushNotif({
        type: 'success',
        title: language === 'ar' ? 'تم إكمال الفحص' : 'Exam Completed',
        message: language === 'ar' 
          ? `تم إكمال فحص المراجع رقم ${currentPatient.display_number}`
          : `Completed exam for patient ${currentPatient.display_number}`
      })

      setCurrentPatient(null)
      setExamStartTime(null)
      fetchPatients()
    } catch (err) {
      pushNotif({
        type: 'error',
        message: language === 'ar' ? 'فشل إكمال الفحص' : 'Failed to complete exam'
      })
    } finally {
      setLoading(false)
    }
  }

  // Skip patient
  const handleSkipPatient = async (patient) => {
    if (!clinicId) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('unified_queue')
        .update({
          status: 'skipped',
          skipped_at: new Date().toISOString()
        })
        .eq('id', patient.id)

      if (error) throw error

      pushNotif({
        type: 'warning',
        title: language === 'ar' ? 'تم التخطي' : 'Patient Skipped',
        message: language === 'ar' 
          ? `تم تخطي المراجع رقم ${patient.display_number}`
          : `Skipped patient number ${patient.display_number}`
      })

      fetchPatients()
    } catch (err) {
      pushNotif({
        type: 'error',
        message: language === 'ar' ? 'فشل التخطي' : 'Failed to skip patient'
      })
    } finally {
      setLoading(false)
    }
  }

  // Cancel patient
  const handleCancelPatient = async (patient) => {
    if (!clinicId) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('unified_queue')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString()
        })
        .eq('id', patient.id)

      if (error) throw error

      pushNotif({
        type: 'info',
        title: language === 'ar' ? 'تم الإلغاء' : 'Patient Cancelled',
        message: language === 'ar' 
          ? `تم إلغاء المراجع رقم ${patient.display_number}`
          : `Cancelled patient number ${patient.display_number}`
      })

      fetchPatients()
    } catch (err) {
      pushNotif({
        type: 'error',
        message: language === 'ar' ? 'فشل الإلغاء' : 'Failed to cancel patient'
      })
    } finally {
      setLoading(false)
    }
  }

  const getExamDuration = () => {
    if (!examStartTime) return '00:00'
    const duration = new Date() - new Date(examStartTime)
    const minutes = Math.floor(duration / 60000)
    const seconds = Math.floor((duration % 60000) / 1000)
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="h-screen max-h-screen px-2 sm:px-4 py-4 sm:py-6 overflow-x-hidden overflow-y-auto" style={{overflowY: "auto", overflowX: "hidden"}}>
      <NotificationSystem notifications={notifList} onDismiss={dismissNotif} />

      <div className="w-full max-w-4xl mx-auto space-y-4 sm:space-y-5">
        {/* Header */}
        <div className="absolute top-4 left-4">
          <Button variant="ghost" size="sm" className="text-gray-300 hover:text-white hover:bg-gray-800/50" onClick={toggleLanguage}>
            <Globe className="icon icon-md me-2" />
            {language === 'ar' ? 'English 🇺🇸' : 'العربية 🇶🇦'}
          </Button>
        </div>

        <div className="absolute top-4 right-4">
          <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-900/30" onClick={onLogout}>
            <LogOut className="icon icon-md me-2" />
            {language === 'ar' ? 'خروج' : 'Logout'}
          </Button>
        </div>

        <div className="text-center space-y-2 pt-4">
          <img src="/mms-logo.png" alt="اللجنة الطبية العسكرية" className="mx-auto w-20 h-20 object-contain" />
          <div className="space-y-0.5">
            <h1 className="text-xl font-bold text-white">{language === 'ar' ? 'اللجنة الطبية العسكرية' : 'Military Medical Committee'}</h1>
            <p className="text-sm text-[#C9A54C] font-semibold">{clinicName}</p>
            <p className="text-gray-400 text-xs">{language === 'ar' ? `د. ${doctorData?.name || ''}` : `Dr. ${doctorData?.name || ''}`}</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-4 text-center">
              <Users className="w-6 h-6 mx-auto text-blue-400 mb-2" />
              <div className="text-2xl font-bold text-white">{stats.totalToday}</div>
              <div className="text-xs text-gray-400">{language === 'ar' ? 'إجمالي اليوم' : 'Total Today'}</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-4 text-center">
              <CheckCircle className="w-6 h-6 mx-auto text-green-400 mb-2" />
              <div className="text-2xl font-bold text-white">{stats.completedToday}</div>
              <div className="text-xs text-gray-400">{language === 'ar' ? 'مكتمل' : 'Completed'}</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-4 text-center">
              <Activity className="w-6 h-6 mx-auto text-yellow-400 mb-2" />
              <div className="text-2xl font-bold text-white">{stats.waitingNow}</div>
              <div className="text-xs text-gray-400">{language === 'ar' ? 'في الانتظار' : 'Waiting'}</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-4 text-center">
              <Clock className="w-6 h-6 mx-auto text-purple-400 mb-2" />
              <div className="text-2xl font-bold text-white">{formatDuration(stats.avgExamTime)}</div>
              <div className="text-xs text-gray-400">{language === 'ar' ? 'متوسط الفحص' : 'Avg Exam'}</div>
            </CardContent>
          </Card>
        </div>

        {/* Current Patient Card */}
        {currentPatient && (
          <Card className="bg-gradient-to-br from-green-900/30 to-blue-900/30 border-green-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg font-bold flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-green-400" />
                {language === 'ar' ? 'المراجع الحالي' : 'Current Patient'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-4xl font-black text-yellow-400">{currentPatient.display_number}</div>
                  <div className="text-sm text-gray-400">{language === 'ar' ? 'رقم الدور' : 'Queue Number'}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white">{getExamDuration()}</div>
                  <div className="text-sm text-gray-400">{language === 'ar' ? 'مدة الفحص' : 'Exam Duration'}</div>
                </div>
              </div>
              <Button
                variant="gradientPrimary"
                onClick={handleCompleteExam}
                disabled={loading}
                className="w-full py-3 text-lg font-bold"
              >
                <CheckCircle className="icon icon-md me-2" />
                {language === 'ar' ? '✓ إكمال الفحص' : '✓ Complete Exam'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Waiting List */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-lg font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              {language === 'ar' ? 'قائمة الانتظار' : 'Waiting List'}
              <span className="ml-auto text-sm font-normal text-gray-400">({patients.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!currentPatient && patients.length > 0 && (
              <Button
                variant="gradientSecondary"
                onClick={handleCallNext}
                disabled={loading}
                className="w-full py-3 text-lg font-bold mb-4"
              >
                <TrendingUp className="icon icon-md me-2" />
                {language === 'ar' ? '▶ استدعاء التالي' : '▶ Call Next'}
              </Button>
            )}

            {patients.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                {language === 'ar' ? 'لا يوجد مراجعين في الانتظار' : 'No patients waiting'}
              </div>
            ) : (
              patients.map((patient, index) => (
                <Card key={patient.id} className={`border ${patient.status === 'called' ? 'bg-yellow-900/20 border-yellow-500/30' : 'bg-gray-700/40 border-gray-600/60'}`}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          patient.status === 'called' ? 'bg-yellow-500/20' : 'bg-blue-500/20'
                        }`}>
                          <span className="text-lg font-bold text-white">{patient.display_number}</span>
                        </div>
                        <div>
                          <div className="text-white font-semibold">
                            {language === 'ar' ? `مراجع رقم ${patient.display_number}` : `Patient ${patient.display_number}`}
                          </div>
                          <div className="text-xs text-gray-400">
                            {patient.status === 'called' 
                              ? (language === 'ar' ? 'تم الاستدعاء' : 'Called')
                              : (language === 'ar' ? 'في الانتظار' : 'Waiting')
                            }
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {patient.status === 'called' ? (
                          <Button
                            variant="gradientPrimary"
                            size="sm"
                            onClick={() => handleStartExam(patient)}
                            disabled={loading || currentPatient !== null}
                          >
                            <UserCheck className="icon icon-sm me-1" />
                            {language === 'ar' ? 'بدء' : 'Start'}
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSkipPatient(patient)}
                              disabled={loading}
                              className="border-yellow-600 text-yellow-400 hover:bg-yellow-900/30"
                            >
                              <SkipForward className="icon icon-sm me-1" />
                              {language === 'ar' ? 'تخطي' : 'Skip'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCancelPatient(patient)}
                              disabled={loading}
                              className="border-red-600 text-red-400 hover:bg-red-900/30"
                            >
                              {language === 'ar' ? 'إلغاء' : 'Cancel'}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

import React, { useState, useEffect } from 'react'
import { Card, CardContent } from './Card'
import { Button } from './Button'
import { t } from '../lib/i18n'
import api from '../lib/api-unified'
import { supabase } from '../lib/supabase-client'
import NotificationSystem, { useNotifications } from './NotificationSystem'

export function PatientPage({ patientData, onLogout, language, toggleLanguage }) {
  const [stations, setStations] = useState([])
  const [loading, setLoading] = useState(false)
  const { notifications: notifList, push: pushNotif, dismiss: dismissNotif } = useNotifications()

  const todayISO = () => new Date().toISOString().split('T')[0];

  // جلب المسار والبيانات الحقيقية للطابور
  const fetchPatientStatus = async () => {
    if (!patientData?.id) return;
    
    try {
      // 1. جلب المسار المحفوظ للمراجع
      const routeResponse = await api.getRoute(patientData.id)
      let examStations = []
      
      if (routeResponse?.success && routeResponse?.route?.stations) {
        examStations = routeResponse.route.stations
      } else {
        // إذا لم يوجد مسار، نستخدم المسار الافتراضي بناءً على نوع الفحص والجنس
        const { getDynamicMedicalPathway } = await import('../lib/dynamic-pathways')
        examStations = await getDynamicMedicalPathway(patientData.examType || patientData.queueType, patientData.gender)
      }

      // 2. جلب حالة الطابور الحقيقية من unified_queue لليوم
      const { data: queueData, error: queueError } = await supabase
        .from('unified_queue')
        .select('*')
        .eq('patient_id', patientData.id)
        .eq('queue_date', todayISO())

      if (queueError) throw queueError

      // 3. دمج بيانات المسار مع بيانات الطابور الحقيقية
      const updatedStations = await Promise.all(examStations.map(async (station, index) => {
        const queueEntry = queueData?.find(q => q.clinic_id === station.id)
        
        // جلب رقم الدور الحالي في العيادة
        const { data: currentData } = await supabase
          .from('unified_queue')
          .select('display_number')
          .eq('clinic_id', station.id)
          .eq('queue_date', todayISO())
          .in('status', ['called', 'serving', 'in_progress'])
          .order('called_at', { ascending: false })
          .limit(1)
          .single()

        // حساب عدد المنتظرين أمام المراجع
        let ahead = 0
        if (queueEntry && (queueEntry.status === 'waiting' || queueEntry.status === 'called')) {
          const { count } = await supabase
            .from('unified_queue')
            .select('*', { count: 'exact', head: true })
            .eq('clinic_id', station.id)
            .eq('queue_date', todayISO())
            .eq('status', 'waiting')
            .lt('display_number', queueEntry.display_number)
          ahead = count || 0
        }

        // تحديد الحالة البصرية بناءً على البيانات الحقيقية
        let visualStatus = 'locked'
        if (queueEntry) {
          if (['done', 'completed'].includes(queueEntry.status)) {
            visualStatus = 'completed'
          } else {
            visualStatus = 'ready'
          }
        } else {
          // إذا لم يدخل الطابور بعد، نتحقق إذا كانت العيادة السابقة مكتملة
          const prevStation = index > 0 ? examStations[index - 1] : null
          if (!prevStation) {
            visualStatus = 'ready' // أول عيادة دائماً جاهزة
          } else {
            const prevQueueEntry = queueData?.find(q => q.clinic_id === prevStation.id)
            if (prevQueueEntry && ['done', 'completed'].includes(prevQueueEntry.status)) {
              visualStatus = 'ready'
            }
          }
        }

        return {
          ...station,
          yourNumber: queueEntry?.display_number || '-',
          current: currentData?.display_number || '-',
          ahead: (queueEntry && (queueEntry.status === 'waiting' || queueEntry.status === 'called')) ? ahead : (queueEntry && ['serving', 'in_progress'].includes(queueEntry.status) ? 0 : '-'),
          status: visualStatus,
          isEntered: !!queueEntry && !['done', 'completed'].includes(queueEntry.status),
          dbStatus: queueEntry?.status
        }
      }))

      setStations(updatedStations)
    } catch (err) {
      console.error('Error fetching patient status:', err)
    }
  }

  useEffect(() => {
    fetchPatientStatus()

    // الاشتراك في التحديثات اللحظية لجدول unified_queue
    const channel = supabase
      .channel(`patient_status_${patientData?.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'unified_queue'
      }, () => {
        fetchPatientStatus()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [patientData?.id])

  const handleEnterClinic = async (station) => {
    try {
      setLoading(true)
      const result = await api.enterQueue(station.id, patientData.id, true, patientData.name, patientData.queueType)
      
      if (result?.success) {
        pushNotif({
          type: 'success',
          title: language === 'ar' ? 'تم الدخول بنجاح' : 'Entered Successfully',
          message: language === 'ar' ? `رقمك هو: ${result.display_number}` : `Your number is: ${result.display_number}`
        })
        fetchPatientStatus()
      } else {
        pushNotif({ type: 'error', message: result?.error || 'فشل الدخول' })
      }
    } catch (e) {
      pushNotif({ type: 'error', message: 'حدث خطأ أثناء الدخول' })
    } finally {
      setLoading(false)
    }
  }

  const handleClinicExit = async (station) => {
    try {
      setLoading(true)
      const result = await api.queueDone(station.id, patientData.id)
      if (result?.success) {
        pushNotif({ type: 'success', message: language === 'ar' ? 'تم الخروج بنجاح' : 'Exited successfully' })
        fetchPatientStatus()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const allStationsCompleted = stations.length > 0 && stations.every(s => s.status === 'completed')

  if (allStationsCompleted) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6 flex flex-col items-center justify-center text-center">
        <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="w-16 h-16 text-green-500" />
        </div>
        <h1 className="text-3xl font-bold mb-4">{t('All Examinations Completed')}</h1>
        <p className="text-gray-400 text-lg mb-8 max-w-md">
          {language === 'ar' 
            ? 'تهانينا! لقد أكملت جميع الفحوصات الطبية المطلوبة بنجاح. يرجى التوجه للاستقبال.' 
            : 'Congratulations! You have completed all required medical exams. Please proceed to reception.'}
        </p>
        <Button onClick={onLogout} variant="gradient" className="px-8 h-12 text-lg">
          <LogOut className="w-5 h-5 mr-2" />
          {t('Logout')}
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-20">
      {/* Header */}
      <header className="bg-gray-800/50 backdrop-blur-md border-b border-white/10 sticky top-0 z-30 p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/mms-logo.png" alt="Logo" className="w-10 h-10 object-contain" />
            <div>
              <h1 className="font-bold text-lg leading-tight">{t('Medical Committee')}</h1>
              <p className="text-xs text-gray-400">{patientData?.name}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={toggleLanguage} className="border-white/10 hover:bg-white/5">
              {language === 'ar' ? 'EN' : 'عربي'}
            </Button>
            <Button variant="outline" size="sm" onClick={onLogout} className="border-red-500/30 text-red-400 hover:bg-red-500/10">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Progress Card */}
        <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-2xl p-6 border border-white/10">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            {language === 'ar' ? 'مسارك الطبي' : 'Your Medical Pathway'}
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {stations.map((s, i) => (
              <div key={s.id} className="flex items-center flex-shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  s.status === 'completed' ? 'bg-green-500 text-white' : 
                  s.status === 'ready' ? 'bg-blue-500 text-white animate-pulse' : 'bg-gray-700 text-gray-400'
                }`}>
                  {s.status === 'completed' ? <CheckCircle className="w-5 h-5" /> : i + 1}
                </div>
                {i < stations.length - 1 && <div className="w-4 h-px bg-gray-700 mx-1" />}
              </div>
            ))}
          </div>
        </div>

        {/* Stations List */}
        <div className="space-y-4">
          {stations.map((station) => (
            <Card key={station.id} className={`bg-gray-800/40 border-white/5 overflow-hidden transition-all ${station.status === 'locked' ? 'opacity-50 grayscale' : 'hover:border-white/20'}`}>
              <CardContent className="p-0">
                <div className="p-5 flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold">{language === 'ar' ? station.nameAr : station.name}</h3>
                      {station.status === 'completed' && <CheckCircle className="w-5 h-5 text-green-500" />}
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-400 text-sm">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{station.floor}</span>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                    station.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                    station.status === 'ready' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700/50 text-gray-500'
                  }`}>
                    {station.status === 'completed' ? t('Completed') : station.status === 'ready' ? t('Ready') : t('Locked')}
                  </div>
                </div>

                {station.status !== 'locked' && station.status !== 'completed' && (
                  <div className="px-5 pb-5 grid grid-cols-2 gap-3">
                    <div className="bg-gray-900/50 rounded-xl p-4 border border-white/5 text-center">
                      <p className="text-xs text-gray-500 mb-1">{t('Your Number')}</p>
                      <p className="text-3xl font-black text-blue-400">{station.yourNumber}</p>
                    </div>
                    <div className="bg-gray-900/50 rounded-xl p-4 border border-white/5 text-center">
                      <p className="text-xs text-gray-500 mb-1">{t('Current')}</p>
                      <p className="text-3xl font-black text-yellow-500">{station.current}</p>
                    </div>
                    <div className="col-span-2 bg-blue-500/5 rounded-xl p-3 border border-blue-500/10 flex items-center justify-center gap-2 text-sm">
                      <Users className="w-4 h-4 text-blue-400" />
                      <span className="text-gray-300">{t('Ahead')}:</span>
                      <span className="font-bold text-blue-400">{station.ahead} {language === 'ar' ? 'شخص' : 'persons'}</span>
                    </div>
                  </div>
                )}

                <div className="p-4 bg-white/5 border-t border-white/5">
                  {station.status === 'completed' ? (
                    <div className="flex items-center justify-center gap-2 text-green-400 font-medium py-2">
                      <CheckCircle className="w-5 h-5" />
                      {t('Examination Done')}
                    </div>
                  ) : station.status === 'locked' ? (
                    <div className="flex items-center justify-center gap-2 text-gray-500 py-2">
                      <Lock className="w-4 h-4" />
                      {t('Locked until previous done')}
                    </div>
                  ) : !station.isEntered ? (
                    <Button 
                      className="w-full h-12 text-lg font-bold" 
                      variant="gradient"
                      onClick={() => handleEnterClinic(station)}
                      disabled={loading}
                    >
                      {loading ? '...' : t('Enter Queue')}
                    </Button>
                  ) : (
                    <Button 
                      className="w-full h-12 text-lg font-bold border-red-500/30 text-red-400 hover:bg-red-500/10" 
                      variant="outline"
                      onClick={() => handleClinicExit(station)}
                      disabled={loading}
                    >
                      {loading ? '...' : t('Exit Clinic')}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <NotificationSystem notifications={notifList} onDismiss={dismissNotif} />
    </div>
  )
}

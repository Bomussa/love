import React, { useState, useEffect, useCallback, useRef } from 'react'
import { GENERAL_REFRESH_INTERVAL, NEAR_TURN_REFRESH_INTERVAL } from '../core/config/refresh.constants'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
import { Input } from './Input'
import { Lock, Unlock, Clock, Globe, LogIn, LogOut, ArrowRight, CheckCircle, Loader2 } from 'lucide-react'
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
  const [directAlerts, setDirectAlerts] = useState([])
  const { notifications: notifList, push: pushNotif, dismiss: dismissNotif } = useNotifications()
  const isInitialLoadRef = useRef(false)

  const handleGetTicketForFirstClinic = useCallback(async (station) => {
    try {
      setLoading(true)
      console.log('[PatientPage] Getting ticket for first clinic:', station.id)
      const enterResult = await api.enterQueue(station.id, patientData.id, false, patientData.name, patientData.queueType)
      const positionData = await api.getQueuePosition(station.id, patientData.id)

      if (positionData && positionData.success) {
        setStations(prev => prev.map((s, idx) => idx === 0 ? {
          ...s,
          yourNumber: positionData.display_number,
          current: positionData.current_number,
          ahead: positionData.ahead,
          totalWaiting: positionData.total_waiting,
          status: positionData.status === 'waiting' ? 'ready' : positionData.status,
          isEntered: false,
        } : s))
      }
    } catch (e) {
      console.error('[PatientPage] Get ticket for first clinic failed:', e)
    } finally {
      setLoading(false)
    }
  }, [patientData.id, patientData.name, patientData.queueType])

  const handleEnterClinic = async (station) => {
    try {
      setLoading(true)
      const entryTime = new Date().toISOString();
      const enterResult = await api.enterQueue(station.id, patientData.id, true, patientData.name, patientData.queueType)

      if (enterResult && !enterResult.success && enterResult.error && !enterResult.alreadyExists) {
        pushNotif({ type: 'error', message: enterResult.error })
        setLoading(false)
        return
      }

      const positionData = await api.getQueuePosition(station.id, patientData.id)
      if (positionData && positionData.success) {
        setActiveTicket({ clinicId: station.id, ticket: positionData.display_number })
        setStations(prev => prev.map(s => s.id === station.id ? {
          ...s,
          yourNumber: positionData.display_number,
          current: positionData.current_number,
          ahead: positionData.ahead,
          totalWaiting: positionData.total_waiting,
          status: positionData.status === 'waiting' ? 'ready' : positionData.status,
          isEntered: true,
          entered_at: positionData.entered_at || entryTime
        } : s))
        pushNotif({
          type: 'success',
          title: language === 'ar' ? 'تم الدخول بنجاح' : 'Entered Successfully',
          message: language === 'ar' ? `رقمك في الطابور: ${positionData.display_number}` : `Your queue number: ${positionData.display_number}`,
          clinic: language === 'ar' ? station.nameAr : (station.name || station.nameAr),
          floor: station.floor
        })
      }
    } catch (e) {
      console.error('[PatientPage] Enter clinic failed:', e)
      pushNotif({
        type: 'error',
        message: language === 'ar' ? 'فشل الدخول للعيادة. الرجاء المحاولة مرة أخرى.' : 'Failed to enter clinic. Please try again.'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isInitialLoadRef.current) return;
    isInitialLoadRef.current = true;

    const loadPathway = async () => {
      setInitialLoading(true)
      try {
        let examStations = null
        if (patientData.pathway && patientData.pathway.length > 0) {
          examStations = patientData.pathway
        } else {
          try {
            const savedRoute = await api.getRoute(patientData.id)
            if (savedRoute?.success && savedRoute.route?.stations) {
              examStations = savedRoute.route.stations
            }
          } catch (err) {}

          if (!examStations) {
            examStations = await getDynamicMedicalPathway(patientData.examType || patientData.queueType, patientData.gender)
          }
        }

        if (!examStations || examStations.length === 0) {
          setInitialLoading(false)
          return
        }

        const initialStations = examStations.map((station, index) => ({
          ...station,
          status: index === 0 ? 'ready' : 'locked',
          current: 0,
          yourNumber: null,
          ahead: 0,
          isEntered: false
        }))

        setStations(initialStations)

        if (examStations.length > 0) {
          const firstClinic = examStations[0]
          await handleGetTicketForFirstClinic(firstClinic)
          if (firstClinic.floor) {
            pushNotif({
              type: 'floor_guide',
              title: language === 'ar' ? 'توجه إلى العيادة' : 'Go to Clinic',
              message: language === 'ar' ? `يرجى التوجه إلى ${firstClinic.floor}` : `Please go to ${firstClinic.floor}`,
              clinic: language === 'ar' ? firstClinic.nameAr : (firstClinic.name || firstClinic.nameAr),
              floor: firstClinic.floor
            })
          }
        }
      } catch (err) {
        console.error('[PatientPage] Failed to load pathway:', err)
      } finally {
        setInitialLoading(false)
      }
    }

    loadPathway()
  }, [patientData.examType, patientData.queueType, patientData.gender, patientData.pathway, handleGetTicketForFirstClinic, language, patientData.id, pushNotif])

  useEffect(() => {
    if (patientData?.id) {
      api.getRoute(patientData.id)
        .then(data => { if (data?.route) setRouteWithZFD(data) })
        .catch(err => console.warn('Route fetch failed:', err))
    }
  }, [patientData?.id])

  useEffect(() => {
    if (!patientData?.id || stations.length === 0) return;
    
    let pollingInterval = null;
    const updateQueueStatus = async () => {
      if (document.hidden) return;
      try {
        const currentStation = stations.find(s => s.status === 'ready' && s.yourNumber !== null);
        if (currentStation) {
          const positionData = await api.getQueuePosition(currentStation.id, patientData.id);
          if (positionData?.success) {
            setStations(prev => prev.map(s => {
              if (s.id === currentStation.id) {
                if (positionData.display_number <= 2 && s.yourNumber !== positionData.display_number) {
                  const types = { 0: 'your_turn', 1: 'near_turn', 2: 'near_turn' };
                  const msgs = {
                    0: language === 'ar' ? 'دورك الآن! توجه للعيادة فوراً' : 'Your turn now! Go to the clinic immediately',
                    1: language === 'ar' ? 'أنت التالي - كن جاهزاً' : 'You are next - be ready',
                    2: language === 'ar' ? 'أنت الثاني في الانتظار' : 'You are second in line'
                  };
                  pushNotif({ type: types[positionData.display_number], message: msgs[positionData.display_number], clinic: s.nameAr });
                }
                return { ...s, yourNumber: positionData.display_number, current: positionData.current_number, ahead: positionData.ahead };
              }
              return s;
            }));
          }
        }
      } catch (err) {}
    };

    updateQueueStatus();
    pollingInterval = setInterval(updateQueueStatus, GENERAL_REFRESH_INTERVAL);

    const statusChannel = supabase.channel(`queue_status_${patientData.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unified_queue', filter: `patient_id=eq.${patientData.id}` }, payload => {
        const data = payload.new;
        updateQueueStatus();
        if (data && ['called', 'completed', 'cancelled'].includes(data.status)) {
          setTimeout(() => {
            setStations(prev => {
              const idx = prev.findIndex(s => s.id === data.clinic_id);
              if (idx === -1) return prev;
              return prev.map((s, i) => {
                if (i === idx) return { ...s, status: data.status, isEntered: false };
                if (data.status === 'completed' && i === idx + 1 && s.status === 'locked') return { ...s, status: 'ready' };
                return s;
              });
            });
          }, 300);
        }
      }).subscribe();

    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
      supabase.removeChannel(statusChannel);
    };
  }, [patientData?.id, language, stations.length, pushNotif]);

  useEffect(() => {
    if (!patientData?.military_number) return;
    const patientId = String(patientData.military_number);
    const fetchActiveAlerts = async () => {
      try {
        const { data } = await supabase.from('direct_alerts').select('*').eq('patient_id', patientId).eq('is_active', true).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false });
        if (data) setDirectAlerts(data);
      } catch (e) {}
    };
    fetchActiveAlerts();
    const channel = supabase.channel(`direct_alerts_${patientId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_alerts', filter: `patient_id=eq.${patientId}` }, payload => {
        const alert = payload.new;
        if (alert.is_active && new Date(alert.expires_at) > new Date()) {
          setDirectAlerts(prev => [alert, ...prev]);
          if (alert.sound_enabled) { try { new Audio('/notification.mp3').play().catch(() => {}); } catch(e) {} }
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [patientData?.military_number]);

  const getExamName = () => {
    const exam = examTypes.find(e => e.id === patientData.queueType)
    return exam ? (language === 'ar' ? exam.nameAr : exam.name) : (language === 'ar' ? 'فحص طبي' : 'Medical Exam')
  }

  const allStationsCompleted = stations.length > 0 && stations.every(s => s.status === 'completed')

  if (allStationsCompleted) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center" data-test="completion-screen">
        <div className="max-w-2xl mx-auto space-y-6 text-center">
          <img src="/mms-logo.png" alt="اللجنة الطبية العسكرية" className="mx-auto w-24 h-24 object-contain" />
          <h1 className="text-lg font-bold text-white">{'اللجنة الطبية العسكرية'}</h1>
          <div className="text-green-400">
            <svg className="w-24 h-24 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <Card className="bg-gradient-to-br from-green-900/30 to-blue-900/30 border-green-500/30">
            <CardContent className="p-8 space-y-6">
              <h1 className="text-5xl font-bold text-white mb-4">{language === 'ar' ? '✅ تم إنهاء الفحص الطبي' : '✅ Medical Examination Completed'}</h1>
              <div className="space-y-6 text-xl">
                <p className="text-gray-300 font-medium">{language === 'ar' ? 'تهانينا! لقد أكملت جميع الفحوصات الطبية المطلوبة بنجاح' : 'Congratulations! You have successfully completed all required medical examinations'}</p>
                <div className="bg-yellow-500/10 border-2 border-yellow-500/30 rounded-xl p-8 mt-6">
                  <h2 className="text-3xl font-bold text-yellow-400 mb-6">{language === 'ar' ? '📋 الخطوة التالية' : '📋 Next Step'}</h2>
                  <p className="text-xl text-white font-bold">{language === 'ar' ? 'يرجى التوجه إلى استقبال اللجنة الطبية' : 'Please proceed to the Medical Committee Reception'}</p>
                  <p className="text-gray-300 text-sm mt-2 font-medium">{language === 'ar' ? 'الموقع: الطابق الأول - مكتب الاستقبال' : 'Location: First Floor - Reception Office'}</p>
                </div>
              </div>
              <div className="flex gap-4 justify-center mt-8">
                <Button variant="default" size="lg" onClick={onLogout} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold px-6 py-2 text-base">
                  {language === 'ar' ? '🏠 العودة للصفحة الرئيسية' : '🏠 Return to Home'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (initialLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#C9A54C] mx-auto mb-4"></div>
          <p className="text-white text-lg">{language === 'ar' ? 'جارٍ تحميل المسار الطبي...' : 'Loading medical pathway...'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen max-h-screen px-2 sm:px-4 py-4 sm:py-6 overflow-x-hidden overflow-y-auto" data-test="patient-page" style={{ overflowY: 'auto', overflowX: 'hidden' }}>
      {directAlerts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
          {directAlerts.slice(0, 3).map(alert => (
            <div key={alert.id} className={`flex items-start gap-3 p-4 rounded-2xl shadow-2xl border backdrop-blur-sm animate-pulse-once ${alert.alert_type === 'urgent' ? 'bg-red-900/90 border-red-500/50' : alert.alert_type === 'warning' ? 'bg-yellow-900/90 border-yellow-500/50' : 'bg-[#1a0a12]/90 border-[#C9A54C]/50'}`}>
              <div className="flex-1">
                <p className="text-sm font-medium text-white leading-relaxed">{language === 'ar' ? alert.message : (alert.message_en || alert.message)}</p>
              </div>
              <button onClick={() => supabase.from('direct_alerts').update({ read_at: new Date().toISOString() }).eq('id', alert.id).then(() => setDirectAlerts(prev => prev.filter(a => a.id !== alert.id)))} className="text-white/60 hover:text-white flex-shrink-0 mt-0.5">
                <Lock className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      <NotificationSystem notifications={notifList} onDismiss={dismissNotif} />
      <div className="w-full max-w-xl mx-auto space-y-4 sm:space-y-5">
        <div className="absolute top-4 left-4">
          <Button variant="ghost" size="sm" className="text-gray-300 hover:text-white hover:bg-gray-800/50" onClick={toggleLanguage}>
            <Globe className="icon icon-md me-2" />
            {language === 'ar' ? 'English 🇺🇸' : 'العربية 🇶🇦'}
          </Button>
        </div>
        <div className="text-center space-y-2 pt-4">
          <img src="/mms-logo.png" alt="اللجنة الطبية العسكرية" className="mx-auto w-24 h-24 object-contain" />
          <div className="space-y-0.5">
            <h1 className="text-xl font-bold text-white">{language === 'ar' ? 'اللجنة الطبية العسكرية' : 'Military Medical Committee'}</h1>
            <p className="text-sm text-[#C9A54C] font-semibold">{language === 'ar' ? 'قيادة الخدمات الطبية العسكرية' : 'Military Medical Services Command'}</p>
          </div>
        </div>
        <Card className="bg-gray-800/50 border-gray-700 shadow-xl">
          <CardHeader className="text-center pb-3 pt-4">
            <CardTitle className="text-white text-xl font-bold tracking-tight">{t('yourMedicalRoute', language)}</CardTitle>
            <p className="text-gray-400 text-sm mt-1.5">{t('exam', language)}: <span className="font-bold text-[#C9A54C]">{getExamName()}</span></p>
          </CardHeader>
          <CardContent className="space-y-3 px-3 pb-4">
            {stations.map((station, index) => (
              <Card key={station.id} className={`border transition-all duration-200 ${station.status === 'ready' ? 'bg-gray-700/60 border-green-500/30 shadow-md' : station.status === 'completed' ? 'bg-gray-700/30 border-gray-600/50 opacity-65' : 'bg-gray-700/40 border-gray-600/60'}`}>
                <CardContent className="p-3.5 sm:p-5">
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${station.status === 'ready' ? 'bg-green-500/20' : station.status === 'completed' ? 'bg-green-500/15' : 'bg-gray-600/50'}`}>
                        {station.status === 'ready' ? <Unlock className="icon icon-md icon-success" /> : station.status === 'completed' ? <CheckCircle className="icon icon-md text-green-400" /> : <Lock className="icon icon-md icon-muted" />}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-white text-base font-bold leading-tight">{language === 'ar' ? station.nameAr : station.name}</h3>
                        <p className="text-gray-400 text-sm mt-0.5">{t('floor', language)}: <span className="text-gray-200 font-semibold">{language === 'ar' ? station.floor : station.floorCode}</span></p>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${station.status === 'ready' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : station.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'}`}>
                        {station.status === 'ready' ? t('ready', language) : station.status === 'completed' ? (language === 'ar' ? 'مكتمل ✓' : 'Completed ✓') : t('locked', language)}
                      </span>
                    </div>
                  </div>
                  {station.status !== 'completed' && (
                    <div className="grid grid-cols-2 gap-2.5 text-center">
                      <div className="py-4 px-2 bg-yellow-500/15 rounded-xl border-2 border-yellow-500/40">
                        <div className="text-4xl font-black text-yellow-400 mb-1.5 leading-none">{typeof station.yourNumber === 'number' ? station.yourNumber : '—'}</div>
                        <div className="text-yellow-300/80 text-sm font-bold tracking-wide mt-0.5">{t('yourNumber', language)}</div>
                      </div>
                      <div className="py-4 px-2 bg-gray-700/50 rounded-xl border border-gray-500/50">
                        <div className="text-4xl font-black text-white mb-1.5 leading-none">{station.ahead || 0}</div>
                        <div className="text-gray-400 text-sm font-bold tracking-wide mt-0.5">{t('ahead', language)}</div>
                      </div>
                    </div>
                  )}
                  {station.status === 'ready' && !station.isEntered && (
                    <div className="mt-4 pt-4 border-t border-gray-600/40">
                      {station.yourNumber > 0 && (station.ahead === 0 || station.yourNumber <= station.current) ? (
                        <Button variant="gradientPrimary" onClick={() => handleEnterClinic(station)} disabled={loading} className="w-full py-3 text-lg font-bold">
                          <LogIn className="icon icon-md me-2" />
                          {t('enterClinic', language)}
                        </Button>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                            <div className="flex items-center gap-2">
                              <Clock className="w-5 h-5 text-yellow-400" />
                              <span className="text-yellow-400 font-semibold text-sm">{language === 'ar' ? 'انتظر دورك' : 'Wait for your turn'}</span>
                            </div>
                            <span className="text-yellow-200 text-xs font-medium">{language === 'ar' ? `أمامك ${station.ahead} شخص` : `${station.ahead} ahead`}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {station.status === 'ready' && station.isEntered && (
                    <div className="mt-3 pt-3 border-t border-gray-600 text-center text-sm text-green-400 p-3 bg-green-900/20 rounded border border-green-500/30">
                      {language === 'ar' ? '✓ تم الدخول - انتظر مناداتك من الطبيب' : '✓ Entered - Wait for doctor to call you'}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
        <div className="text-center">
          <Button variant="outline" onClick={onLogout} className="border-gray-600 text-gray-300">
            {t('exitSystem', language)}
          </Button>
        </div>
      </div>
    </div>
  )
}

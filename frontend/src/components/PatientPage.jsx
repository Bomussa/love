import React, { useState, useEffect } from 'react'
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
  const [selectedStation, setSelectedStation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true) // حالة التحميل الأولي
  const [activeTicket, setActiveTicket] = useState(null)
  const [currentNotice, setCurrentNotice] = useState(null)
  const [routeWithZFD, setRouteWithZFD] = useState(null)
  const [queuePositions, setQueuePositions] = useState({})
  const [directAlerts, setDirectAlerts] = useState([])
  const { notifications: notifList, push: pushNotif, dismiss: dismissNotif } = useNotifications()

  // ✅ دالة مساعدة لجلب رقم الطابور للعيادة
  const fetchQueueNumberForStation = async (station) => {
    try {
      const positionData = await api.getQueuePosition(station.id, patientData.id)
      if (positionData && positionData.success) {
        return {
          yourNumber: positionData.display_number,
          current: positionData.current_number,
          ahead: positionData.ahead,
          totalWaiting: positionData.total_waiting,
          status: 'waiting'
        }
      }
    } catch (e) {
      console.warn('Failed to get queue position for station:', station.id, e)
    }
    return null
  }

  // ✅ دالة لإنشاء Queue entry وجلب الرقم
  const handleGetTicketForFirstClinic = async (station) => {
    try {
      setLoading(true)
      console.log('[PatientPage] Getting ticket for first clinic:', station.id)

      // أولاً: محاولة إنشاء Queue entry
      const enterResult = await api.enterQueue(station.id, patientData.id, false, patientData.name, patientData.queueType)

      if (enterResult && !enterResult.success && enterResult.error) {
        // إذا كان هناك خطأ (وليس because already in queue)
        if (!enterResult.alreadyExists) {
          console.warn('[PatientPage] Enter queue result:', enterResult)
        }
      }

      // ثانياً: جلب رقم الطابور الحالي
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

        console.log('[PatientPage] Got queue number:', positionData.display_number, 'ahead:', positionData.ahead)
      }
    } catch (e) {
      console.error('[PatientPage] Get ticket for first clinic failed:', e)
    } finally {
      setLoading(false)
    }
  }

  // دخول يدوي لأي عيادة
  const handleEnterClinic = async (station) => {
    try {
      setLoading(true)
      const entryTime = new Date().toISOString();

      // إنشاء Queue entry مع isAutoEnter = true
      const enterResult = await api.enterQueue(station.id, patientData.id, true, patientData.name, patientData.queueType)

      if (enterResult && !enterResult.success && enterResult.error && !enterResult.alreadyExists) {
        pushNotif({ type: 'error', message: enterResult.error })
        setLoading(false)
        return
      }

      // جلب بيانات الطابور
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
      setLoading(false)
    } catch (e) {
      console.error('[PatientPage] Enter clinic failed:', e)
      pushNotif({
        type: 'error',
        message: language === 'ar' ? 'فشل الدخول للعيادة. الرجاء المحاولة مرة أخرى.' : 'Failed to enter clinic. Please try again.'
      })
      setLoading(false)
    }
  }

  // ✅ تحميل المسار الطبي عند بدء الصفحة
  useEffect(() => {
    const loadPathway = async () => {
      setInitialLoading(true)
      try {
        let examStations = null

        // ✅ استخدام المسار من patientData إذا كان متوفراً
        if (patientData.pathway && patientData.pathway.length > 0) {
          examStations = patientData.pathway
          console.log('[PatientPage] Using pathway from patientData:', examStations.length, 'stations')
        } else {
          // جلب المسار من API أو قاعدة البيانات
          try {
            const savedRoute = await api.getRoute(patientData.id)
            if (savedRoute && savedRoute.success && savedRoute.route && savedRoute.route.stations) {
              examStations = savedRoute.route.stations
              console.log('[PatientPage] Using saved route:', examStations.length, 'stations')
            }
          } catch (err) {
            console.warn('[PatientPage] Failed to get saved route:', err)
          }

          // إذا لم يكن هناك مسار محفوظ، جلب المسار الديناميكي
          if (!examStations) {
            examStations = await getDynamicMedicalPathway(patientData.examType || patientData.queueType, patientData.gender)
            console.log('[PatientPage] Loaded dynamic pathway:', examStations?.length, 'stations')
          }
        }

        if (!examStations || examStations.length === 0) {
          console.error('[PatientPage] No stations found for pathway')
          setInitialLoading(false)
          return
        }

        // تهيئة المحطات
        const initialStations = examStations.map((station, index) => ({
          ...station,
          status: index === 0 ? 'ready' : 'locked',
          current: 0,
          yourNumber: null,
          ahead: 0,
          isEntered: false
        }))

        setStations(initialStations)

        // جلب رقم الطابور للعيادة الأولى
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
  }, [patientData.examType, patientData.queueType, patientData.gender, patientData.pathway])

  useEffect(() => {
    if (patientData?.id) {
      api.getRoute(patientData.id)
        .then(data => { if (data?.route) setRouteWithZFD(data) })
        .catch(err => console.warn('Route fetch failed:', err))
    }
  }, [patientData?.id])

  // تحديث لحظي لحالة الطابور
  useEffect(() => {
    if (!patientData?.id || stations.length === 0) return;
    let retryCount = 0;
    let lastResponseTime = Date.now();
    let dynamicInterval = GENERAL_REFRESH_INTERVAL;
    let pollingInterval = null;
    let isSSEActive = false;
    const MAX_RETRY = 3;
    const RECOVERY_DELAY = 3000;
    const lastStateRef = { current: null };

    const handleSSEConnected = () => {
      isSSEActive = true;
      if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
    };
    const handleSSEError = () => {
      isSSEActive = false;
      if (!pollingInterval) {
        pollingInterval = setInterval(() => { updateQueueStatus(); }, dynamicInterval);
      }
    };
    const unsubscribeConnected = eventBus.on('sse:connected', handleSSEConnected);
    const unsubscribeError = eventBus.on('sse:error', handleSSEError);
    if (window.eventBusSSE?.isConnected()) handleSSEConnected();
    else handleSSEError();

    const updateQueueStatus = async () => {
      if (document.hidden) return;
      const start = Date.now();
      try {
        const currentStation = stations.find(s => s.status === 'ready' && s.yourNumber !== null);
        if (currentStation) {
          const positionData = await api.getQueuePosition(currentStation.id, patientData.id);
          if (positionData && positionData.success) {
            const stateKey = `${currentStation.id}-${positionData.display_number}`;
            if (lastStateRef.current !== stateKey) {
              lastStateRef.current = stateKey;
              setStations(prev => prev.map(s => {
                if (s.id === currentStation.id) {
                  const previousNumber = s.lastNotifiedPosition || 999;
                  if (positionData.display_number !== previousNumber && positionData.display_number <= 2) {
                    const notifTypes = { 0: 'your_turn', 1: 'near_turn', 2: 'near_turn' };
                    const messages = {
                      0: language === 'ar' ? 'دورك الآن! توجه للعيادة فوراً' : 'Your turn now! Go to the clinic immediately',
                      1: language === 'ar' ? 'أنت التالي - كن جاهزاً' : 'You are next - be ready',
                      2: language === 'ar' ? 'أنت الثاني في الانتظار' : 'You are second in line'
                    };
                    const notifTitles = {
                      0: language === 'ar' ? 'دورك الآن!' : 'Your Turn!',
                      1: language === 'ar' ? 'تنبيه: أنت التالي' : 'Alert: You are next',
                      2: language === 'ar' ? 'تنبيه' : 'Alert'
                    };
                    const message = messages[positionData.display_number];
                    if (message) {
                      pushNotif({
                        type: notifTypes[positionData.display_number] || 'queue_update',
                        title: notifTitles[positionData.display_number],
                        message: message,
                        clinic: s.nameAr,
                        floor: s.floor
                      });
                      if (positionData.display_number === 0) {
                        eventBus.emit('queue:your_turn', { clinicName: s.nameAr, position: positionData.display_number });
                      }
                    }
                  }
                  return {
                    ...s,
                    yourNumber: positionData.display_number,
                    current: positionData.current_number,
                    ahead: positionData.ahead,
                    totalWaiting: positionData.total_waiting,
                    estimatedWait: positionData.estimated_wait_minutes,
                    lastNotifiedPosition: positionData.display_number
                  };
                }
                return s;
              }));
            }
          }
        }
        retryCount = 0;
        const duration = Date.now() - start;
        lastResponseTime = Date.now();
        dynamicInterval = Math.max(3000, Math.min(GENERAL_REFRESH_INTERVAL, duration * 2 + 2000));
      } catch (err) {
        retryCount++;
        dynamicInterval = Math.min(60000, dynamicInterval * 1.5);
        if (retryCount <= MAX_RETRY) setTimeout(updateQueueStatus, RECOVERY_DELAY);
        else retryCount = 0;
      }
    };
    updateQueueStatus();
    const heartbeatInterval = setInterval(() => {
      const now = Date.now();
      if (now - lastResponseTime > 120000) lastResponseTime = Date.now();
    }, 30000);

    const statusChannel = supabase
      .channel(`queue_status_${patientData.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'unified_queue',
        filter: `patient_id=eq.${patientData.id}`
      }, (payload) => {
        const updatedEntry = payload.new;
        updateQueueStatus();
        if (updatedEntry) {
          if (['called', 'completed', 'cancelled'].includes(updatedEntry.status)) {
            setTimeout(() => {
              setStations(prev => {
                const currentIdx = prev.findIndex(s => s.id === updatedEntry.clinic_id);
                if (currentIdx === -1) return prev;
                return prev.map((s, i) => {
                  if (i === currentIdx) return { ...s, status: updatedEntry.status, isEntered: false };
                  if (updatedEntry.status === 'completed' && i === currentIdx + 1 && s.status === 'locked') {
                    return { ...s, status: 'ready' };
                  }
                  return s;
                });
              });
            }, 300);
          }
        }
      })
      .subscribe();

    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
      unsubscribeConnected();
      unsubscribeError();
      clearInterval(heartbeatInterval);
      supabase.removeChannel(statusChannel);
    };
  }, [patientData?.id, language, stations.length]);

  useEffect(() => {
    if (!patientData?.id) return;
    const handleQueueUpdate = (data) => {
      try {
        const message = language === 'ar' ? data.message : data.messageEn;
        pushNotif({ type: data.type, message, position: data.position, clinic: data.clinic });
      } catch (err) {}
    };
    eventBus.on('queue:update', handleQueueUpdate);
    eventBus.on('queue:near_turn', handleQueueUpdate);
    eventBus.on('queue:your_turn', handleQueueUpdate);
    return () => {
      eventBus.off('queue:update', handleQueueUpdate);
      eventBus.off('queue:near_turn', handleQueueUpdate);
      eventBus.off('queue:your_turn', handleQueueUpdate);
    };
  }, [patientData?.id, language])

  useEffect(() => {
    if (!patientData?.military_number) return;
    const patientId = String(patientData.military_number);
    const fetchActiveAlerts = async () => {
      try {
        const { data } = await supabase
          .from('direct_alerts')
          .select('*')
          .eq('patient_id', patientId)
          .eq('is_active', true)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false });
        if (data && data.length > 0) setDirectAlerts(data);
      } catch (e) {}
    };
    fetchActiveAlerts();
    const channel = supabase
      .channel(`direct_alerts_${patientId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_alerts',
        filter: `patient_id=eq.${patientId}`
      }, (payload) => {
        const alert = payload.new;
        if (alert.is_active && new Date(alert.expires_at) > new Date()) {
          setDirectAlerts(prev => [alert, ...prev]);
          if (alert.sound_enabled) {
            try { new Audio('/notification.mp3').play().catch(() => {}); } catch(e) {}
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [patientData?.military_number]);

  const dismissDirectAlert = async (alertId) => {
    try {
      await supabase.from('direct_alerts').update({ read_at: new Date().toISOString() }).eq('id', alertId);
      setDirectAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (e) {}
  };

  const getExamName = () => {
    const exam = examTypes.find(e => e.id === patientData.queueType)
    if (!exam) return language === 'ar' ? 'فحص طبي' : 'Medical Exam'
    return language === 'ar' ? exam.nameAr : exam.name
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
              <h1 className="text-5xl font-bold text-white mb-4">
                {language === 'ar' ? '✅ تم إنهاء الفحص الطبي' : '✅ Medical Examination Completed'}
              </h1>
              <div className="space-y-6 text-xl">
                <p className="text-gray-300 font-medium">
                  {language === 'ar' ? 'تهانينا! لقد أكملت جميع الفحوصات الطبية المطلوبة بنجاح' : 'Congratulations! You have successfully completed all required medical examinations'}
                </p>
                <div className="bg-yellow-500/10 border-2 border-yellow-500/30 rounded-xl p-8 mt-6">
                  <h2 className="text-3xl font-bold text-yellow-400 mb-6">
                    {language === 'ar' ? '📋 الخطوة التالية' : '📋 Next Step'}
                  </h2>
                  <p className="text-xl text-white font-bold">
                    {language === 'ar' ? 'يرجى التوجه إلى استقبال اللجنة الطبية' : 'Please proceed to the Medical Committee Reception'}
                  </p>
                  <p className="text-gray-300 text-sm mt-2 font-medium">
                    {language === 'ar' ? 'الموقع: الطابق الأول - مكتب الاستقبال' : 'Location: First Floor - Reception Office'}
                  </p>
                </div>
                <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-6 mt-6">
                  <h3 className="text-xl font-bold text-white mb-4">{language === 'ar' ? 'ملخص الفحوصات' : 'Examination Summary'}</h3>
                  <div className="space-y-2 text-left">
                    <p className="text-gray-300"><span className="font-semibold">{language === 'ar' ? 'نوع الفحص:' : 'Exam Type:'}</span> {getExamName()}</p>
                    <p className="text-gray-300"><span className="font-semibold">{language === 'ar' ? 'عدد العيادات:' : 'Number of Clinics:'}</span> {stations.length}</p>
                    <p className="text-gray-300"><span className="font-semibold">{language === 'ar' ? 'الحالة:' : 'Status:'}</span> <span className="text-green-400 font-bold"> {language === 'ar' ? 'مكتمل ✓' : 'Completed ✓'}</span></p>
                  </div>
                </div>
                <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-6 mt-4">
                  <h3 className="text-lg font-bold text-white mb-3">{language === 'ar' ? 'العيادات المكتملة:' : 'Completed Clinics:'}</h3>
                  <div className="space-y-2">
                    {stations.map((station, index) => (
                      <div key={station.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-300">{index + 1}. {language === 'ar' ? station.nameAr : station.name}</span>
                        <span className="text-green-400">✓</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-4 justify-center mt-8">
                <Button variant="default" size="lg" onClick={onLogout} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold px-6 py-2 text-base">
                  {language === 'ar' ? '🏠 العودة للصفحة الرئيسية' : '🏠 Return to Home'}
                </Button>
              </div>
              <p className="text-gray-400 text-sm mt-6">
                {language === 'ar' ? 'شكراً لاستخدامكم نظام إدارة الطوابير الطبية' : 'Thank you for using the Medical Queue Management System'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ✅ مؤشر التحميل الأولي
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
    <div className="h-screen max-h-screen px-2 sm:px-4 py-4 sm:py-6 overflow-x-hidden overflow-y-auto" data-test="patient-page" style={{overflowY: "auto", overflowX: "hidden"}}>
      {directAlerts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
          {directAlerts.slice(0, 3).map(alert => (
            <div key={alert.id} className={`flex items-start gap-3 p-4 rounded-2xl shadow-2xl border backdrop-blur-sm animate-pulse-once ${
              alert.alert_type === 'urgent' ? 'bg-red-900/90 border-red-500/50' :
              alert.alert_type === 'warning' ? 'bg-yellow-900/90 border-yellow-500/50' :
              alert.alert_type === 'success' ? 'bg-green-900/90 border-green-500/50' :
              'bg-[#1a0a12]/90 border-[#C9A54C]/50'
            }`}>
              <div className="flex-1">
                <p className="text-sm font-medium text-white leading-relaxed">{language === 'ar' ? alert.message : (alert.message_en || alert.message)}</p>
              </div>
              <button onClick={() => dismissDirectAlert(alert.id)} className="text-white/60 hover:text-white transition-colors flex-shrink-0 mt-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
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
            <p className="text-gray-400 text-xs">{language === 'ar' ? 'المركز الطبي التخصصي العسكري - العطار' : 'Military Specialized Medical Center – Al-Attar'}</p>
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
                      <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                        station.status === 'ready' ? 'bg-green-500/20' :
                        station.status === 'completed' ? 'bg-green-500/15' :
                        'bg-gray-600/50'
                      }`}>
                        {station.status === 'ready' ? <Unlock className="icon icon-md icon-success" /> :
                         station.status === 'completed' ? <CheckCircle className="icon icon-md text-green-400" /> :
                         <Lock className="icon icon-md icon-muted" />}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-white text-base font-bold leading-tight">{language === 'ar' ? station.nameAr : station.name}</h3>
                        <p className="text-gray-400 text-sm mt-0.5">{t('floor', language)}: <span className="text-gray-200 font-semibold">{language === 'ar' ? station.floor : station.floorCode}</span></p>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                        station.status === 'ready' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                        station.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' :
                        'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                      }`}>
                        {station.status === 'ready' ? t('ready', language) : station.status === 'completed' ? (language === 'ar' ? 'مكتمل ✓' : 'Completed ✓') : t('locked', language)}
                      </span>
                    </div>
                  </div>
                  {routeWithZFD && routeWithZFD.route && routeWithZFD.route.length > index && (
                    <div className="mb-4" data-test="zfd-ticket-section">
                      <ZFDTicketDisplay step={routeWithZFD.route[index]} />
                    </div>
                  )}
                  {station.status !== 'completed' && (
                    <div className="grid grid-cols-2 gap-2.5 text-center" data-test="queue-info">
                      <div className="py-4 px-2 bg-yellow-500/15 rounded-xl border-2 border-yellow-500/40">
                        <div className="text-4xl font-black text-yellow-400 mb-1.5 leading-none" data-test="your-number">{typeof station.yourNumber === 'number' ? station.yourNumber : '—'}</div>
                        <div className="text-yellow-300/80 text-sm font-bold tracking-wide mt-0.5">{t('yourNumber', language)}</div>
                      </div>
                      <div className="py-4 px-2 bg-gray-700/50 rounded-xl border border-gray-500/50">
                        <div className="text-4xl font-black text-white mb-1.5 leading-none" data-test="ahead-count">{station.ahead || 0}</div>
                        <div className="text-gray-400 text-sm font-bold tracking-wide mt-0.5">{t('ahead', language)}</div>
                      </div>
                    </div>
                  )}
                  {station.status === 'ready' && !station.isEntered && (
                    <div className="mt-4 pt-4 border-t border-gray-600/40">
                      {(station.yourNumber > 0 && (station.ahead === 0 || station.ahead === null || station.yourNumber === station.current || (station.current > 0 && station.yourNumber < station.current))) ? (
                        <Button variant="gradientPrimary" onClick={() => handleEnterClinic(station)} disabled={loading} className="w-full py-3 text-lg font-bold" data-test="enter-clinic-btn">
                          <LogIn className="icon icon-md me-2" />{t('enterClinic', language)}
                        </Button>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">⏳</span>
                              <span className="text-yellow-400 font-semibold text-sm">{language === 'ar' ? 'انتظر دورك' : 'Wait for your turn'}</span>
                            </div>
                            <span className="text-yellow-200 text-xs font-medium">{language === 'ar' ? `أمامك ${station.ahead} شخص` : `${station.ahead} ahead`}</span>
                          </div>
                          <Button variant="outline" disabled={true} className="w-full opacity-40 cursor-not-allowed border-gray-600 text-sm">
                            <Lock className="icon icon-sm me-2" />{language === 'ar' ? 'الدخول غير متاح حالياً' : 'Entry not available yet'}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                  {station.status === 'ready' && station.isEntered && (
                    <div className="mt-3 pt-3 border-t border-gray-600 space-y-2">
                      <div className="text-center text-sm text-green-400 p-3 bg-green-900/20 rounded border border-green-500/30">
                        {language === 'ar' ? '✓ تم الدخول - انتظر مناداتك من الطبيب' : '✓ Entered - Wait for doctor to call you'}
                      </div>
                      {station.exitTime && (
                        <div className="text-sm text-gray-400 flex items-center gap-2">
                          <Clock className="icon icon-sm icon-muted" />
                          <span>{language === 'ar' ? 'وقت الخروج:' : 'Exit time:'} {formatTime(new Date(station.exitTime))}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {station.status === 'ready' && station.ahead > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-600/60">
                      <p className="text-gray-400 text-xs">{language === 'ar' ? `يمكنك الوصول عبر المصعد – اضغط ${station.floorCode}` : `You can reach via elevator – press ${station.floorCode}`}</p>
                    </div>
                  )}
                  {station.note && (
                    <div className="mt-3 pt-3 border-t border-gray-600/60">
                      <p className="text-yellow-400 text-xs">⚠️ {t('note', language)}: {t('registerAtReception', language)}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
        <div className="text-center">
          <Button variant="outline" onClick={onLogout} className="border-gray-600 text-gray-300">{t('exitSystem', language)}</Button>
        </div>
      </div>
    </div>
  )
}

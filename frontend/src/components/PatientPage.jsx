import React, { useState, useEffect } from 'react'
import { GENERAL_REFRESH_INTERVAL, NEAR_TURN_REFRESH_INTERVAL } from '../core/config/refresh.constants'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
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

const THEME_BG = 'var(--theme-gradient-background, linear-gradient(135deg, #8A1538 0%, #C9A54C 100%))'
const THEME_SURFACE = 'var(--theme-surface, rgba(15, 23, 42, 0.72))'
const THEME_TEXT = 'var(--theme-text, #ffffff)'

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
      // استخدام personal_id (الرقم الشخصي) من patientData
      const patientIdentifier = patientData.personal_id || patientData.patient_id || patientData.id;
      const positionData = await api.getQueuePosition(station.id, patientIdentifier)
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

      // استخدام personal_id (الرقم الشخصي) من patientData
      const patientIdentifier = patientData.personal_id || patientData.patient_id || patientData.id;

      // أولاً: محاولة إنشاء Queue entry
      const enterResult = await api.enterQueue(station.id, patientIdentifier, false, patientData.name, patientData.queueType)

      if (enterResult && !enterResult.success && enterResult.error) {
        // إذا كان هناك خطأ (وليس because already in queue)
        if (!enterResult.alreadyExists) {
          console.warn('[PatientPage] Enter queue result:', enterResult)
        }
      }

      // ثانياً: جلب رقم الطابور الحالي
      const positionData = await api.getQueuePosition(station.id, patientIdentifier)

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

      // استخدام personal_id (الرقم الشخصي) من patientData
      const patientIdentifier = patientData.personal_id || patientData.patient_id || patientData.id;

      // إنشاء Queue entry مع isAutoEnter = true
      const enterResult = await api.enterQueue(station.id, patientIdentifier, true, patientData.name, patientData.queueType)

      if (enterResult && !enterResult.success && enterResult.error && !enterResult.alreadyExists) {
        pushNotif({ type: 'error', message: enterResult.error })
        setLoading(false)
        return
      }

      // جلب بيانات الطابور
      const positionData = await api.getQueuePosition(station.id, patientIdentifier)
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
          // استخدام personal_id (الرقم الشخصي) من patientData
          const patientIdentifier = patientData.personal_id || patientData.patient_id || patientData.id;
          const positionData = await api.getQueuePosition(currentStation.id, patientIdentifier);
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
        filter: `patient_id=eq.${patientData.personal_id || patientData.patient_id || patientData.id}`
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
  }, [patientData?.id, language, stations.length])

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
    if (!patientData?.personal_id) return;
    const patientIdentifier = String(patientData.personal_id || patientData.patient_id);
    const fetchActiveAlerts = async () => {
      try {
        const { data } = await supabase
          .from('direct_alerts')
          .select('*')
          .eq('patient_id', patientIdentifier)
          .eq('is_active', true)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false });
        if (data && data.length > 0) setDirectAlerts(data);
      } catch (e) {}
    };
    fetchActiveAlerts();
    const channel = supabase
      .channel(`direct_alerts_${patientIdentifier}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_alerts',
        filter: `patient_id=eq.${patientIdentifier}`
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
  }, [patientData?.personal_id]);

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
  const completedCount = stations.filter((s) => s.status === 'completed').length
  const progress = stations.length > 0 ? Math.round((completedCount / stations.length) * 100) : 0
  const activeIndex = stations.findIndex((s) => s.status === 'ready' && s.yourNumber !== null)
  const activeStation = activeIndex >= 0 ? stations[activeIndex] : null

  if (allStationsCompleted) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center" data-test="completion-screen" style={{ background: THEME_BG, color: THEME_TEXT }}>
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
      <div className="h-screen flex items-center justify-center" style={{ background: THEME_BG, color: THEME_TEXT }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#C9A54C] mx-auto mb-4"></div>
          <p className="text-white text-lg">{language === 'ar' ? 'جارٍ تحميل المسار الطبي...' : 'Loading medical pathway...'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen max-h-screen px-2 sm:px-4 py-4 sm:py-6 overflow-x-hidden overflow-y-auto" data-test="patient-page" style={{ overflowY: 'auto', overflowX: 'hidden', background: THEME_BG, color: THEME_TEXT }}>
      {directAlerts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
          {directAlerts.slice(0, 3).map(alert => (
            <div key={alert.id} className={`flex items-start gap-3 p-4 rounded-2xl shadow-2xl border backdrop-blur-sm animate-pulse-once ${
              alert.alert_type === 'urgent' ? 'bg-red-900/90 border-red-500/50' :
              alert.alert_type === 'warning' ? 'bg-yellow-900/90 border-yellow-500/50' :
              alert.alert_type === 'success' ? 'bg-green-900/90 border-green-500/50' : 'bg-[#1a0a12]/90 border-[#C9A54C]/50'
            }`}>
              <p className="flex-1 text-sm font-medium text-white leading-relaxed">{language === 'ar' ? alert.message : (alert.message_en || alert.message)}</p>
              <button onClick={() => dismissDirectAlert(alert.id)} className="text-white/60 hover:text-white">✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="fixed inset-0 pointer-events-none" style={{ background: 'transparent' }} />
      <div className="w-full max-w-2xl mx-auto space-y-5 px-2 sm:px-4 relative z-10">
        <div className="absolute top-4 left-4">
          <Button variant="ghost" size="sm" className="text-gray-300 hover:text-white hover:bg-gray-800/50" onClick={toggleLanguage}>
            <Globe className="w-4 h-4 me-2" />{language === 'ar' ? 'English 🇺🇸' : 'العربية 🇶🇦'}
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

        <div className="bg-[#0f172a]/70 border border-blue-500/20 rounded-2xl p-4 shadow-lg" style={{ backgroundColor: 'var(--theme-surface, rgba(15, 23, 42, 0.72))' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xl">⚕️</div>
            <div>
              <p className="text-white font-medium text-sm">{language === 'ar' ? 'يتم التحكم في تدفق المرضى من قبل الأطباء' : 'Patient flow controlled by doctors'}</p>
              <p className="text-gray-400 text-xs">{language === 'ar' ? 'سيتم استدعاؤك تلقائياً عند حلول دورك' : 'You will be called automatically'}</p>
            </div>
          </div>
        </div>

        <Card className="bg-gray-800/50 border-gray-700 shadow-xl">
          <CardHeader className="text-center pb-3 pt-4">
            <CardTitle className="text-white text-xl font-bold tracking-tight">{t('yourMedicalRoute', language)}</CardTitle>
            <p className="text-gray-400 text-sm mt-1.5">{t('exam', language)}: <span className="font-bold text-[#C9A54C]">{getExamName()}</span></p>
            <div className="mt-3 h-2 w-full rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-[#8A1538] to-[#C9A54C]" style={{ width: `${progress}%` }} /></div>
            <p className="text-xs text-gray-400 mt-2">{language === 'ar' ? `تقدم الرحلة: ${completedCount}/${stations.length} مكتمل` : `Journey progress: ${completedCount}/${stations.length} completed`}</p>
          </CardHeader>

          <CardContent className="space-y-3 px-3 pb-4">
            {stations.map((station, index) => {
              const status = normalizeStatus(station.status);
              const canEnter = status === 'ready' && !station.isEntered;
              const isActive = activeIndex === index;

              return (
                <Card key={station.id} className={`border transition-all duration-200 ${status === 'ready' ? 'bg-gray-700/60 border-green-500/30 shadow-md' : status === 'completed' ? 'bg-gray-700/30 border-gray-600/50 opacity-70' : 'bg-gray-700/40 border-gray-600/60'}`}>
                  <CardContent className="p-3.5 sm:p-5">
                    <div className="flex items-center justify-between mb-3 gap-2">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${status === 'ready' ? 'bg-green-500/20' : status === 'completed' ? 'bg-green-500/15' : 'bg-gray-600/50'}`}>
                          {status === 'ready' ? <Unlock className="w-5 h-5 text-green-400" /> : status === 'completed' ? <CheckCircle className="w-5 h-5 text-green-400" /> : <Lock className="w-5 h-5 text-gray-400" />}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-white text-base font-bold leading-tight">{language === 'ar' ? station.nameAr : station.name}</h3>
                          <p className="text-gray-400 text-sm mt-0.5">{t('floor', language)}: <span className="text-gray-200 font-semibold">{language === 'ar' ? station.floor : station.floorCode}</span></p>
                        </div>
                      </div>
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${status === 'ready' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : status === 'completed' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'}`}>
                        {status === 'ready' ? t('ready', language) : status === 'completed' ? (language === 'ar' ? 'مكتمل ✓' : 'Completed ✓') : t('locked', language)}
                      </span>
                    </div>

                    {status !== 'completed' && (
                      <div className="grid grid-cols-2 gap-2.5 text-center" data-test="queue-info">
                        <div className="py-4 px-2 bg-yellow-500/15 rounded-xl border-2 border-yellow-500/40">
                          <div className="text-4xl font-black text-yellow-400 mb-1.5 leading-none" data-test="your-number">{typeof station.yourNumber === 'number' ? station.yourNumber : (status === 'ready' ? '...' : '—')}</div>
                          <div className="text-xs text-yellow-300 font-semibold">{t('yourNumber', language)}</div>
                        </div>
                        <div className="py-4 px-2 bg-blue-500/15 rounded-xl border-2 border-blue-500/40">
                          <div className="text-4xl font-black text-blue-400 mb-1.5 leading-none" data-test="current-number">{typeof station.current === 'number' ? station.current : '...'}</div>
                          <div className="text-xs text-blue-300 font-semibold">{t('current', language)}</div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default PatientPage
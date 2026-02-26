import React, { useState, useEffect } from 'react'
import { GENERAL_REFRESH_INTERVAL, NEAR_TURN_REFRESH_INTERVAL } from '../core/config/refresh.constants'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
import { Input } from './Input'
import { Lock, Unlock, Clock, Globe, LogIn, LogOut, ArrowRight, CheckCircle } from 'lucide-react'
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
  const [pinInput, setPinInput] = useState('')
  const [selectedStation, setSelectedStation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [clinicPins, setClinicPins] = useState({}) // أرقام البن كود اليومية
  const [activeTicket, setActiveTicket] = useState(null)
  const [currentNotice, setCurrentNotice] = useState(null)
  const [routeWithZFD, setRouteWithZFD] = useState(null)
  const [queuePositions, setQueuePositions] = useState({}) // Real-time queue positions
  const [directAlerts, setDirectAlerts] = useState([]) // التنبيهات المباشرة من الإدارة
  const { notifications: notifList, push: pushNotif, dismiss: dismissNotif } = useNotifications()

  // إعدادات النظام - التحكم في إظهار/إخفاء وتفعيل/إيقاف الميزات
  const [systemSettings, setSystemSettings] = useState({
    pin_system_enabled: true,
    pin_system_visible: true,
    queue_system_enabled: true,
    queue_system_visible: true
  })

  // جلب إعدادات النظام من قاعدة البيانات مع تفعيل المزامنة الفورية (Real-time)
  useEffect(() => {
    const fetchSystemSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('*')
          .like('key', 'feature_%');
        
        if (!error && data) {
          const settingsObj = {};
          data.forEach(s => {
            const key = s.key.replace('feature_', '');
            try {
              settingsObj[key] = JSON.parse(s.value);
            } catch {
              settingsObj[key] = { is_active: s.value === 'true', is_hidden: false };
            }
          });
          
          setSystemSettings(prev => ({
            ...prev,
            pin_system_enabled: settingsObj.pin_system?.is_active !== false,
            pin_system_visible: settingsObj.pin_system?.is_hidden !== true,
            queue_system_enabled: settingsObj.queue_system?.is_active !== false,
            queue_system_visible: settingsObj.queue_system?.is_hidden !== true,
            show_daily_pin: settingsObj.auto_pin_generate?.is_active !== false,
            theme: settingsObj.appearance?.theme || 'default'
          }));
        }
      } catch (err) {
        console.error('Failed to fetch system settings:', err)
      }
    }

    fetchSystemSettings();

    // الاشتراك في التغييرات اللحظية من قاعدة البيانات
    const subscription = supabase
      .channel('system_settings_changes')
      .on('postgres_changes', { event: '*', table: 'settings', schema: 'public' }, () => {
        fetchSystemSettings();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    }
  }, [])

  // ✅ أخذ رقم دور للعيادة الأولى (بدون دخول تلقائي)
  const handleGetTicketForFirstClinic = async (station) => {
    try {
      // فقط أخذ رقم دور (بدون دخول)
      await api.enterQueue(station.id, patientData.id, false) // false = لا تدخل تلقائياً

      // جلب الرقم فقط
      const positionData = await api.getQueuePosition(station.id, patientData.id)

      if (positionData && positionData.success) {
        // حفظ الرقم فقط بدون تفعيل isEntered
        setStations(prev => prev.map((s, idx) => idx === 0 ? {
          ...s,
          yourNumber: positionData.display_number,
          current: positionData.current_number,
          ahead: positionData.ahead,
          totalWaiting: positionData.total_waiting,
          status: 'ready',
          isEntered: false,
        } : s))
      }
    } catch (e) {
      console.error('Get ticket for first clinic failed:', e)
    }
  }

  // ✅ دخول يدوي لأي عيادة - محسّن مع تسجيل وقت الدخول
  const handleEnterClinic = async (station) => {
    try {
      setLoading(true)

      // تسجيل وقت الدخول الفعلي
      const entryTime = new Date().toISOString();

      // دخول الدور
      const enterResult = await api.enterQueue(station.id, patientData.id, true, patientData.name, patientData.queueType)

      // التحقق من نجاح الدخول
      if (enterResult && !enterResult.success && enterResult.error) {
        pushNotif({
          type: 'error',
          message: enterResult.error
        })
        setLoading(false)
        return
      }

      // جلب الموقع الفعلي من Backend
      const positionData = await api.getQueuePosition(station.id, patientData.id)

      if (positionData && positionData.success) {
        setActiveTicket({ clinicId: station.id, ticket: positionData.display_number })
        setStations(prev => prev.map(s => s.id === station.id ? {
          ...s,
          yourNumber: positionData.display_number,
          current: positionData.current_number,
          ahead: positionData.ahead,
          totalWaiting: positionData.total_waiting,
          status: 'ready',
          isEntered: true,
          entered_at: positionData.entered_at || entryTime
        } : s))

        // إشعار بنجاح الدخول
        pushNotif({
          type: 'success',
          title: language === 'ar' ? 'تم الدخول بنجاح' : 'Entered Successfully',
          message: language === 'ar'
            ? `رقمك في الطابور: ${positionData.display_number}`
            : `Your queue number: ${positionData.display_number}`,
          clinic: language === 'ar' ? station.nameAr : (station.name || station.nameAr),
          floor: station.floor
        })
      } else {
        // في حالة عدم الحصول على بيانات الموقع، نستخدم بيانات الدخول
        if (enterResult && enterResult.display_number) {
          setActiveTicket({ clinicId: station.id, ticket: enterResult.display_number })
          setStations(prev => prev.map(s => s.id === station.id ? {
            ...s,
            yourNumber: enterResult.display_number,
            status: 'ready',
            isEntered: true,
            entered_at: entryTime
          } : s))
        }
      }

      setLoading(false)
    } catch (e) {
      console.error('Enter clinic failed:', e)
      pushNotif({
        type: 'error',
        message: language === 'ar' ? 'فشل الدخول للعيادة. الرجاء المحاولة مرة أخرى.' : 'Failed to enter clinic. Please try again.'
      })
      setLoading(false)
    }
  }

  // جلب أرقام البن كود اليومية من API
  useEffect(() => {
    const fetchDailyPins = async () => {
      if (document.hidden) return;
      try {
        const data = await api.getPinStatus()
        if (data && data.success && data.clinics) {
          // تحويل البيانات إلى صيغة { clinic_id: clinic_info }
          const clinicsMap = {}
          Object.keys(data.clinics).forEach(key => {
            clinicsMap[key] = data.clinics[key]
          })
          setClinicPins(clinicsMap)
        }
      } catch (err) {
        // console.error('Failed to fetch daily PINs:', err)
      }
    }

    fetchDailyPins()
    // تحديث كل 5 دقائق
    const interval = setInterval(() => { if (!document.hidden) fetchDailyPins() }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    // Get stations for the patient's exam type and gender with dynamic weighting
    const loadPathway = async () => {
      try {
        let examStations = null
        let routeAlreadySaved = false // هل المسار محفوظ مسبقاً
        // محاولة جلب المسار المحفوظ أولاً
        try {
          const savedRoute = await api.getRoute(patientData.id)
          if (savedRoute && savedRoute.success && savedRoute.route && savedRoute.route.stations) {
            examStations = savedRoute.route.stations
            routeAlreadySaved = true // ✅ مسار محفوظ - لا يتغير
          }
        } catch (err) {
        }
        // إذا لم يوجد مسار محفوظ، احسب مسار جديد
        if (!examStations) {
          examStations = await getDynamicMedicalPathway(patientData.examType || patientData.queueType, patientData.gender)
        }
        // ✅ Sticky Path: الترتيب يحدث مرة واحدة فقط عند حساب المسار الجديد
        // إذا كان المسار محفوظاً مسبقاً فيُستخدم كما هو بدون إعادة ترتيب
        let sortedStations = [...examStations];
        if (!routeAlreadySaved) {
          try {
            const queueCounts = await Promise.all(
              examStations.map(async (station) => {
                const count = await api.getQueueCount(station.id);
                return { station, count: count || 0 };
              })
            );
            // ترتيب العيادات حسب الأقل ازدحاماً (الأقل أولاً)
            queueCounts.sort((a, b) => a.count - b.count);
            sortedStations = queueCounts.map(q => q.station);
            // حفظ المسار المرتّب في Backend
            try {
              await api.createRoute(
                patientData.id,
                patientData.examType || patientData.queueType,
                patientData.gender,
                sortedStations
              );
            } catch (saveErr) {
              console.warn('[PatientPage] فشل حفظ المسار المرتّب:', saveErr);
            }
          } catch (sortError) {
            console.warn('[PatientPage] فشل ترتيب العيادات:', sortError);
          }
        }

        // الدخول التلقائي للعيادة الأولى
        const initialStations = sortedStations.map((station, index) => ({
          ...station,
          status: index === 0 ? 'ready' : 'locked',
          current: 0,
          yourNumber: null,
          ahead: 0,
          isEntered: false
        }))

        setStations(initialStations)

        // ✅ أخذ رقم دور للعيادة الأولى (بدون دخول تلقائي)
        if (sortedStations.length > 0) {
          const firstClinic = sortedStations[0]
          await handleGetTicketForFirstClinic(firstClinic)

          // إشعار التوجيه للطابق
          if (firstClinic.floor) {
            pushNotif({
              type: 'floor_guide',
              title: language === 'ar' ? 'توجه إلى العيادة' : 'Go to Clinic',
              message: language === 'ar'
                ? `يرجى التوجه إلى ${firstClinic.floor}`
                : `Please go to ${firstClinic.floor}`,
              clinic: language === 'ar' ? firstClinic.nameAr : (firstClinic.name || firstClinic.nameAr),
              floor: firstClinic.floor
            })
          }
        }
      } catch (err) {
        console.error('Failed to load pathway:', err)
      }
    }

    loadPathway()
  }, [patientData.id, patientData.examType, patientData.queueType, patientData.gender, language])

  // Real-time queue position update
  useEffect(() => {
    const updatePositions = async () => {
      if (document.hidden) return;
      try {
        const updatedStations = await Promise.all(stations.map(async (station) => {
          if (station.status === 'ready' || station.status === 'locked') {
            const positionData = await api.getQueuePosition(station.id, patientData.id)
            if (positionData && positionData.success) {
              return {
                ...station,
                current: positionData.current_number,
                ahead: positionData.ahead,
                totalWaiting: positionData.total_waiting,
                yourNumber: positionData.display_number || station.yourNumber
              }
            }
          }
          return station
        }))
        setStations(updatedStations)
      } catch (err) {
      }
    }

    const interval = setInterval(updatePositions, 10000)
    return () => clearInterval(interval)
  }, [stations, patientData.id])

  const handleClinicExit = async (station) => {
    try {
      if (!pinInput || !pinInput.trim()) {
        pushNotif({
          type: 'warning',
          message: language === 'ar' ? 'يرجى إدخال رقم البن كود' : 'Please enter the PIN code'
        })
        return
      }

      setLoading(true)
      // Use the provided pinInput to complete the clinic session
      const exitResult = await api.queueDone(station.id, patientData.id, pinInput)

      if (exitResult && exitResult.success) {
        // Update station status to completed
        const updatedStations = stations.map(s =>
          s.id === station.id ? { ...s, status: 'completed', isEntered: false, exitTime: new Date().toISOString() } : s
        )

        // Find next station to unlock
        const currentIndex = updatedStations.findIndex(s => s.id === station.id)
        if (currentIndex < updatedStations.length - 1) {
          updatedStations[currentIndex + 1].status = 'ready'
          // Get ticket for next clinic
          await handleGetTicketForFirstClinic(updatedStations[currentIndex + 1])
        }

        setStations(updatedStations)
        setPinInput('')
        setSelectedStation(null)

        pushNotif({
          type: 'success',
          message: language === 'ar' ? 'تم إنهاء العيادة بنجاح' : 'Clinic session completed successfully'
        })
      } else {
        pushNotif({
          type: 'error',
          message: exitResult?.error || (language === 'ar' ? 'رقم البن كود غير صحيح' : 'Incorrect PIN code')
        })
      }
      setLoading(false)
    } catch (e) {
      console.error('Clinic exit failed:', e)
      pushNotif({
        type: 'error',
        message: language === 'ar' ? 'فشل إنهاء العيادة. الرجاء المحاولة مرة أخرى.' : 'Failed to exit clinic. Please try again.'
      })
      setLoading(false)
    }
  }

  const handleClinicExitWithoutPin = async (station) => {
    try {
      setLoading(true)
      // Exit without PIN (when system is disabled)
      const exitResult = await api.queueDone(station.id, patientData.id, 'SYSTEM_OVERRIDE')

      if (exitResult && exitResult.success) {
        const updatedStations = stations.map(s =>
          s.id === station.id ? { ...s, status: 'completed', isEntered: false, exitTime: new Date().toISOString() } : s
        )

        const currentIndex = updatedStations.findIndex(s => s.id === station.id)
        if (currentIndex < updatedStations.length - 1) {
          updatedStations[currentIndex + 1].status = 'ready'
          await handleGetTicketForFirstClinic(updatedStations[currentIndex + 1])
        }

        setStations(updatedStations)
        pushNotif({
          type: 'success',
          message: language === 'ar' ? 'تم إنهاء العيادة بنجاح' : 'Clinic session completed successfully'
        })
      }
      setLoading(false)
    } catch (e) {
      setLoading(false)
    }
  }

  const getExamName = () => {
    const type = patientData.examType || patientData.queueType
    return language === 'ar' ? (examTypes[type]?.ar || type) : (examTypes[type]?.en || type)
  }

  const dismissDirectAlert = (id) => {
    setDirectAlerts(prev => prev.filter(a => a.id !== id))
  }

  if (stations.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-[#C9A54C] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-[#C9A54C] font-medium animate-pulse">
            {language === 'ar' ? 'جاري تحميل مسارك الطبي...' : 'Loading your medical route...'}
          </p>
        </div>
      </div>
    )
  }

  const allCompleted = stations.every(s => s.status === 'completed')

  if (allCompleted) {
    return (
      <div className="min-h-screen px-4 py-8 bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-green-500/20 blur-2xl rounded-full"></div>
            <div className="relative w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto border-2 border-green-500/30">
              <CheckCircle className="w-12 h-12 text-green-400" />
            </div>
          </div>
          <Card className="bg-gray-800/50 border-gray-700 shadow-2xl overflow-hidden">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold text-white mb-3">
                {language === 'ar' ? 'اكتملت جميع الفحوصات' : 'All Exams Completed'}
              </h2>
              <p className="text-gray-400 mb-8 leading-relaxed">
                {language === 'ar'
                  ? 'لقد أنهيت جميع محطات الفحص الطبي المقررة لك بنجاح. يمكنك الآن التوجه لمكتب الاستقبال لاستكمال الإجراءات النهائية.'
                  : 'You have successfully completed all your scheduled medical exam stations. You can now proceed to the reception desk for final procedures.'}
              </p>
              <Button
                variant="outline"
                onClick={onLogout}
                className="w-full py-4 text-lg border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white transition-all"
              >
                <LogOut className="w-5 h-5 me-2" />
                {language === 'ar' ? 'تسجيل الخروج' : 'Logout'}
              </Button>

              <p className="text-gray-400 text-sm mt-6">
                {language === 'ar'
                  ? 'شكراً لاستخدامكم نظام إدارة الطوابير الطبية'
                  : 'Thank you for using the Medical Queue Management System'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-2 sm:px-4 py-4 sm:py-6 overflow-x-hidden overflow-y-auto" data-test="patient-page">
      {/* التنبيهات المباشرة من الإدارة */}
      {directAlerts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
          {directAlerts.slice(0, 3).map(alert => (
            <div
              key={alert.id}
              className={`flex items-start gap-3 p-4 rounded-2xl shadow-2xl border backdrop-blur-sm animate-pulse-once ${
                alert.alert_type === 'urgent' ? 'bg-red-900/90 border-red-500/50' :
                alert.alert_type === 'warning' ? 'bg-yellow-900/90 border-yellow-500/50' :
                alert.alert_type === 'success' ? 'bg-green-900/90 border-green-500/50' :
                'bg-[#1a0a12]/90 border-[#C9A54C]/50'
              }`}
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-white leading-relaxed">
                  {language === 'ar' ? alert.message : (alert.message_en || alert.message)}
                </p>
              </div>
              <button
                onClick={() => dismissDirectAlert(alert.id)}
                className="text-white/60 hover:text-white transition-colors flex-shrink-0 mt-0.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}
      <NotificationSystem
        notifications={notifList}
        onDismiss={dismissNotif}
      />

      <div className="w-full max-w-xl mx-auto space-y-4 sm:space-y-5">
        <div className="absolute top-4 left-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-300 hover:text-white hover:bg-gray-800/50"
            onClick={toggleLanguage}
          >
            <Globe className="w-5 h-5 me-2" />
            {language === 'ar' ? 'English 🇺🇸' : 'العربية 🇶🇦'}
          </Button>
        </div>

         <div className="text-center space-y-2 pt-8 sm:pt-4">
          <img src="/mms-logo.png" alt="اللجنة الطبية العسكرية" className="mx-auto w-20 h-20 sm:w-24 sm:h-24 object-contain" />
          <div className="space-y-0.5">
            <h1 className="text-lg sm:text-xl font-bold text-white">
              {language === 'ar' ? 'اللجنة الطبية العسكرية' : 'Military Medical Committee'}
            </h1>
            <p className="text-xs text-[#C9A54C] font-semibold">
              {language === 'ar' ? 'قيادة الخدمات الطبية العسكرية' : 'Military Medical Services Command'}
            </p>
            <p className="text-gray-400 text-xs">
              {language === 'ar'
                ? 'المركز الطبي التخصصي العسكري - العطار'
                : 'Military Specialized Medical Center – Al-Attar'}
            </p>
          </div>
        </div>

        <Card className="bg-gray-800/50 border-gray-700 shadow-xl">
          <CardHeader className="text-center pb-3 pt-4 sm:pt-5">
            <CardTitle className="text-white text-xl sm:text-2xl font-bold tracking-tight">{t('yourMedicalRoute', language)}</CardTitle>
            <p className="text-gray-400 text-sm sm:text-base mt-1.5">{t('exam', language)}: <span className="font-bold text-[#C9A54C]">{getExamName()}</span></p>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-4 pb-4 sm:pb-5">
            {stations.map((station, index) => (
              <Card key={station.id} className={`border transition-all duration-200 ${station.status === 'ready' ? 'bg-gray-700/60 border-green-500/30 shadow-md' : station.status === 'completed' ? 'bg-gray-700/30 border-gray-600/50 opacity-65' : 'bg-gray-700/40 border-gray-600/60'}`}>
                <CardContent className="p-3.5 sm:p-5">
                  {/* رأس البطاقة */}
                  <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                      <div className={`flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center ${
                        station.status === 'ready' ? 'bg-green-500/20' :
                        station.status === 'completed' ? 'bg-green-500/15' :
                        'bg-gray-600/50'
                      }`}>
                        {station.status === 'ready' ? (
                          <Unlock className="w-5 h-5 text-green-400" />
                        ) : station.status === 'completed' ? (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : (
                          <Lock className="w-5 h-5 text-gray-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-white text-2xl sm:text-3xl font-black leading-tight">
                          {language === 'ar' ? station.nameAr : station.name}
                        </h3>
                        <p className="text-gray-400 text-sm mt-0.5">
                          {t('floor', language)}: <span className="text-gray-200 font-semibold">{language === 'ar' ? station.floor : station.floorCode}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                        station.status === 'ready' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                        station.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' :
                        'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                      }`}>
                        {station.status === 'ready' ? t('ready', language) :
                          station.status === 'completed' ? (language === 'ar' ? 'مكتمل ✓' : 'Completed ✓') :
                          t('locked', language)}
                      </span>
                    </div>
                  </div>

                  {routeWithZFD && routeWithZFD.route && routeWithZFD.route.length > index && (
                    <div className="mb-4" data-test="zfd-ticket-section">
                      <ZFDTicketDisplay step={routeWithZFD.route[index]} />
                    </div>
                  )}

                  {station.status !== 'completed' && (
                    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 text-center" data-test="queue-info">
                      <div className="py-3 sm:py-4 px-2 sm:px-3 bg-yellow-500/15 rounded-xl sm:rounded-2xl border-2 border-yellow-500/40">
                        <div className="text-2xl sm:text-3xl font-black text-yellow-400 mb-1 leading-none" data-test="your-number">
                          {typeof station.yourNumber === 'number' ? station.yourNumber : '—'}
                        </div>
                        <div className="text-yellow-300/80 text-sm font-bold tracking-wide mt-0.5">{t('yourNumber', language)}</div>
                      </div>
                      <div className="py-3 sm:py-4 px-2 sm:px-3 bg-gray-700/50 rounded-xl sm:rounded-2xl border border-gray-500/50">
                        <div className="text-2xl sm:text-3xl font-black text-white mb-1 leading-none" data-test="ahead-count">
                          {station.ahead || 0}
                        </div>
                        <div className="text-gray-400 text-sm font-bold tracking-wide mt-0.5">{t('ahead', language)}</div>
                      </div>
                    </div>
                   )}

                  {/* زر الدخول للعيادة */}
                  {station.status === 'ready' && !station.isEntered && (
                    <div className="mt-4 pt-4 border-t border-gray-600/40">
                      {(station.yourNumber > 0 && (
                        station.ahead === 0 || 
                        station.ahead === null || 
                        station.yourNumber === station.current ||
                        (station.current > 0 && station.yourNumber < station.current)
                      )) ? (
                        <Button
                          variant="gradientPrimary"
                          onClick={() => handleEnterClinic(station)}
                          disabled={loading}
                          className="w-full py-3 text-lg font-bold"
                          data-test="enter-clinic-btn"
                        >
                          <LogIn className="w-5 h-5 me-2" />
                          {t('enterClinic', language)}
                        </Button>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">⏳</span>
                              <span className="text-yellow-400 font-semibold text-sm">
                                {language === 'ar' ? 'انتظر دورك' : 'Wait for your turn'}
                              </span>
                            </div>
                            <span className="text-yellow-200 text-xs font-medium">
                              {language === 'ar' 
                                ? `أمامك ${station.ahead} شخص`
                                : `${station.ahead} ahead`}
                            </span>
                          </div>
                          <Button
                            variant="outline"
                            disabled={true}
                            className="w-full opacity-40 cursor-not-allowed border-gray-600 text-sm"
                          >
                            <Lock className="w-4 h-4 me-2" />
                            {language === 'ar' ? 'الدخول غير متاح حالياً' : 'Entry not available yet'}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {station.status === 'ready' && station.isEntered && (
                    <div className="mt-3 pt-3 border-t border-gray-600 space-y-2">
                      {systemSettings.pin_system_enabled && systemSettings.pin_system_visible ? (
                        <div className="flex flex-col gap-3">
                          {/* عرض رمز الـ PIN اليومي للعيادة (إذا كان مفعلاً من الإدارة) */}
                          {systemSettings.show_daily_pin !== false && (
                            <div className="flex items-center justify-between px-4 py-2 bg-[#C9A54C]/10 border border-[#C9A54C]/30 rounded-xl animate-pulse">
                              <span className="text-[#C9A54C] text-sm font-bold">
                                {language === 'ar' ? 'رمز العيادة اليومي:' : 'Daily Clinic PIN:'}
                              </span>
                              <span className="text-white text-lg font-black tracking-widest">
                                {clinicPins[station.id]?.pin_code || '—'}
                              </span>
                            </div>
                          )}
                          
                          <div className="flex flex-wrap gap-2 items-center">
                            <Input
                              type="text"
                              placeholder={`${t('enterPIN', language)} (${t('ticketNumber', language)})`}
                              value={selectedStation?.id === station.id ? pinInput : ''}
                              onChange={(e) => { setSelectedStation(station); setPinInput(e.target.value) }}
                              className="bg-gray-600 border-gray-500 text-white flex-1"
                              maxLength={6}
                              data-test="pin-input"
                            />
                            <Button
                              variant="gradientSecondary"
                              onClick={() => handleClinicExit(station)}
                              disabled={loading || !pinInput || !pinInput.trim()}
                              title={t('exitClinic', language)}
                              data-test="exit-clinic-btn"
                              className="w-full py-4 text-lg font-bold rounded-2xl shadow-lg"
                            >
                              <LogOut className="w-5 h-5 me-2" />
                              {t('exitClinic', language)}
                            </Button>
                          </div>
                        </div>
                      ) : !systemSettings.pin_system_enabled ? (
                        /* إذا كان النظام موقف - يمكن الخروج بدون بن كود */
                        <div className="flex flex-wrap gap-2 items-center">
                          <Button
                            variant="gradientSecondary"
                            onClick={() => handleClinicExitWithoutPin(station)}
                            disabled={loading}
                            title={t('exitClinic', language)}
                            data-test="exit-clinic-btn"
                            className="w-full py-4 text-lg font-bold rounded-2xl shadow-lg"
                          >
                            <LogOut className="w-5 h-5 me-2" />
                            {t('exitClinic', language)} - {language === 'ar' ? 'بدون رقم سري' : 'Without PIN'}
                          </Button>
                        </div>
                      ) : null}

                      {/* إذا كان النظام مخفي فقط (لكن مفعل) - الخروج يتم تلقائياً بواسطة الطبيب */}
                      {systemSettings.pin_system_enabled && !systemSettings.pin_system_visible && (
                        <div className="text-center text-sm text-gray-400 p-3 bg-gray-700/50 rounded">
                          {language === 'ar' ? 'سيتم إنهاء الفحص بواسطة الطبيب' : 'Exam will be completed by the doctor'}
                        </div>
                      )}
                      {station.exitTime && (
                        <div className="text-sm text-gray-400 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-500" />
                          <span>{language === 'ar' ? 'وقت الخروج:' : 'Exit time:'} {formatTime(new Date(station.exitTime))}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {station.status === 'ready' && station.ahead > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-600/60">
                      <p className="text-gray-400 text-xs">
                        {language === 'ar'
                          ? `يمكنك الوصول عبر المصعد – اضغط ${station.floorCode || station.floor}`
                          : `You can reach via elevator – press ${station.floorCode || station.floor}`}
                      </p>
                    </div>
                  )}

                  {station.note && (
                    <div className="mt-3 pt-3 border-t border-gray-600/60">
                      <p className="text-yellow-400 text-xs">
                        ⚠️ {t('note', language)}: {t('registerAtReception', language)}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>

        <div className="text-center">
          <Button variant="outline" onClick={onLogout} className="border-gray-600 text-gray-300">
            <LogOut className="w-4 h-4 me-2" />
            {t('logout', language)}
          </Button>
        </div>
      </div>
    </div>
  )
}

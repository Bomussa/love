import React, { useState, useEffect } from 'react'
import { GENERAL_REFRESH_INTERVAL, NEAR_TURN_REFRESH_INTERVAL } from '../core/config/refresh.constants'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
import { Input } from './Input'
import { Lock, Unlock, Clock, Globe, LogIn, LogOut } from 'lucide-react'
import { calculateWaitTime, examTypes, formatTime } from '../lib/utils'
import { getDynamicMedicalPathway } from '../lib/dynamic-pathways'
import { t } from '../lib/i18n'
import api from '../lib/api'
import enhancedApi from '../lib/enhanced-api'
import { ZFDTicketDisplay, ZFDBanner } from './ZFDTicketDisplay'
import NotificationSystem from './NotificationSystem'
import { CountdownTimer } from './CountdownTimer'
import eventBus from '../core/event-bus'

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

  // دخول تلقائي للعيادة الأولى
  const handleAutoEnterFirstClinic = async (station) => {
    try {
      // دخول الدور
      await api.enterQueue(station.id, patientData.id, true)
      
      // جلب الموقع الفعلي من Backend
      const positionData = await api.getQueuePosition(station.id, patientData.id)
      
      if (positionData && positionData.success) {
        setActiveTicket({ clinicId: station.id, ticket: positionData.display_number })
        setStations(prev => prev.map((s, idx) => idx === 0 ? {
          ...s,
          yourNumber: positionData.display_number,
          ahead: positionData.ahead,
          totalWaiting: positionData.total_waiting,
          status: 'ready',
          isEntered: true,
          entered_at: positionData.entered_at || new Date().toISOString() // حفظ وقت الدخول
        } : s))
      }
    } catch (e) {
      // console.error('Auto-enter first clinic failed:', e)
      // في حالة الفشل، لا نعطي أي رقم افتراضي
      // console.error('Cannot enter clinic without backend connection')
    }
  }

  // دخول يدوي لأي عيادة
  const handleEnterClinic = async (station) => {
    try {
      setLoading(true)
      // دخول الدور
      await api.enterQueue(station.id, patientData.id, true)
      
      // جلب الموقع الفعلي من Backend
      const positionData = await api.getQueuePosition(station.id, patientData.id)
      
      if (positionData && positionData.success) {
        setActiveTicket({ clinicId: station.id, ticket: positionData.display_number })
        setStations(prev => prev.map(s => s.id === station.id ? {
          ...s,
          yourNumber: positionData.display_number,
          ahead: positionData.ahead,
          totalWaiting: positionData.total_waiting,
          status: 'ready',
          isEntered: true,
          entered_at: positionData.entered_at || new Date().toISOString() // حفظ وقت الدخول
        } : s))
      }
      
      setLoading(false)
    } catch (e) {
      // console.error('Enter clinic failed:', e)
      alert(language === 'ar' ? 'فشل الدخول للعيادة. الرجاء المحاولة مرة أخرى.' : 'Failed to enter clinic. Please try again.')
      setLoading(false)
    }
  }

  // جلب أرقام البن كود اليومية من API
  useEffect(() => {
    const fetchDailyPins = async () => {
      if (document.hidden) return;
      try {
        const data = await api.getPinStatus()
        if (data && data.pins) {
          // تحويل البيانات إلى صيغة { clinic_id: pin_number }
          const pinsMap = {}
          Object.keys(data.pins).forEach(key => {
            // التعامل مع كلا الحالتين (object و string)
            const pinData = data.pins[key]
            pinsMap[key] = typeof pinData === 'object' ? pinData.pin : pinData
          })
          setClinicPins(pinsMap)

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
        
        // محاولة جلب المسار المحفوظ أولاً
        try {
          const savedRoute = await api.getRoute(patientData.id)
          if (savedRoute && savedRoute.success && savedRoute.route && savedRoute.route.stations) {
            examStations = savedRoute.route.stations

          }
        } catch (err) {

        }
        
        // إذا لم يوجد مسار محفوظ، احسب مسار جديد
        if (!examStations) {
          examStations = await getDynamicMedicalPathway(patientData.examType || patientData.queueType, patientData.gender)
          
          // حفظ المسار الجديد في Backend
          try {
            await api.createRoute(
              patientData.id,
              patientData.examType || patientData.queueType,
              patientData.gender,
              examStations
            )

          } catch (err) {
            // console.error('❌ Failed to save route:', err)
          }
        }
        
        // الدخول التلقائي للعيادة الأولى
        const initialStations = examStations.map((station, index) => ({
          ...station,
          status: index === 0 ? 'ready' : 'locked',
          current: 0,
          yourNumber: 0,
          ahead: 0,
          isEntered: false
        }))
        
        setStations(initialStations)
        
        // دخول تلقائي للعيادة الأولى
        if (examStations.length > 0) {
          const firstClinic = examStations[0]
          await handleAutoEnterFirstClinic(firstClinic)
          
          // إشعار الطابق عند البداية
          if (firstClinic.floor) {
            setCurrentNotice({
              type: 'floor_guide',
              message: `📍 يرجى التوجه إلى ${firstClinic.floor}`,
              clinic: firstClinic.nameAr
            })
            setTimeout(() => setCurrentNotice(null), 5000)
          }
        }
      } catch (err) {
        // console.error('Failed to load pathway:', err)
      }
    }
    
    loadPathway()
  }, [patientData.examType, patientData.queueType, patientData.gender])

  // Fetch route with ZFD validation
  useEffect(() => {
    if (patientData?.id) {
      enhancedApi.getRoute(patientData.id)
        .then(data => {
          if (data?.route) {
            setRouteWithZFD(data)
          }
        })
        .catch(err => console.warn('Route fetch failed:', err))
    }
  }, [patientData?.id])

  // تحديث لحظي لحالة الطابور مع آلية الإصلاح التلقائي
  useEffect(() => {
    if (!patientData?.id || stations.length === 0) return;
    
    let retryCount = 0;
    let lastResponseTime = Date.now();
    let dynamicInterval = GENERAL_REFRESH_INTERVAL;
    const MAX_RETRY = 3;
    const RECOVERY_DELAY = 5000; // 5 ثواني
    const lastStateRef = { current: null };
    let pollingInterval = null;
    let isSSEActive = false;
    
    // مراقبة حالة SSE
    const handleSSEConnected = () => {
      isSSEActive = true;

      // إيقاف Polling عند اتصال SSE
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
    };
    
    const handleSSEError = () => {
      isSSEActive = false;

      // تفعيل Polling عند فشل SSE
      if (!pollingInterval) {
        pollingInterval = setInterval(() => {
          updateQueueStatus();
        }, dynamicInterval);
      }
    };
    
    // الاستماع لحالة SSE
    const unsubscribeConnected = eventBus.on('sse:connected', handleSSEConnected);
    const unsubscribeError = eventBus.on('sse:error', handleSSEError);
    
    // التحقق من حالة SSE الحالية
    if (window.eventBusSSE?.isConnected()) {
      handleSSEConnected();
    } else {
      handleSSEError();
    }
    
    const updateQueueStatus = async () => {
      if (document.hidden) return;
      
      const start = Date.now();
      try {
        // ✅ إصلاح: إرسال طلب للعيادة الحالية فقط (تقليل 429 Errors)
        const currentStation = stations.find(s => s.isEntered && s.status === 'ready');
        
        if (currentStation) {
          // استخدام endpoint position للحصول على موقع دقيق
          const station = currentStation;
          const positionData = await api.getQueuePosition(station.id, patientData.id);
          if (positionData && positionData.success) {
            // تجنب التحديثات المكررة
            const stateKey = `${station.id}-${positionData.display_number}`;
            if (lastStateRef.current !== stateKey) {
              lastStateRef.current = stateKey;
              
              // تحديث الأرقام من الباك اند
              setStations(prev => prev.map(s => {
                if (s.id === station.id) {
                  // إشعار فوري عند تغيير الموقع (لتجنب التكرار)
                  const previousNumber = s.lastNotifiedPosition || 999;
                  if (positionData.display_number !== previousNumber) {
                    const messages = {
                      0: language === 'ar' ? '🔔 دورك الآن!' : '🔔 Your turn now!',
                      1: language === 'ar' ? '⚠️ أنت التالي - كن جاهزاً' : '⚠️ You are next - be ready',
                      2: language === 'ar' ? 'ℹ️ أنت الثاني - استعد' : 'ℹ️ You are second - get ready'
                    };
                    
                    const message = messages[positionData.display_number];
                    // إظهار إشعار للمراكز 0, 1, 2 فقط
                    if (message && positionData.display_number >= 0 && positionData.display_number <= 2) {
                      setCurrentNotice({
                        type: 'queue_update',
                        message: message,
                        clinic: station.nameAr
                      });
                      
                      // تشغيل صوت عند دورك الآن (0) - استخدام notification engine
                      if (positionData.display_number === 0) {
                        eventBus.emit('queue:your_turn', {
                          clinicName: station.nameAr,
                          position: positionData.display_number
                        });
                      }
                      
                      setTimeout(() => setCurrentNotice(null), NEAR_TURN_REFRESH_INTERVAL);
                    }
                  }
                  
                  // حفظ الموقع لتجنب التكرار
                  return {
                    ...s,
                    yourNumber: positionData.display_number,
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
        
        // نجاح – إعادة العداد
        retryCount = 0;
        const duration = Date.now() - start;
        lastResponseTime = Date.now();
        // تعديل فترات التحديث ديناميكيًا حسب وقت الاستجابة
        dynamicInterval = Math.max(5000, GENERAL_REFRESH_INTERVAL + duration);
      } catch (err) {

        retryCount++;
        dynamicInterval = Math.min(60000, dynamicInterval * 1.5);
        
        if (retryCount <= MAX_RETRY) {
          // إعادة المحاولة بعد تأخير
          setTimeout(updateQueueStatus, RECOVERY_DELAY);
        } else {
          // console.error('⚠️ فشل التحديث بعد 3 محاولات - الاعتماد على SSE');
          // إعادة تعيين العداد والانتظار على SSE
          retryCount = 0;
        }
      }
    };
    
    // تحديث فوري
    updateQueueStatus();
    
    // Adaptive Polling: يعمل فقط إذا SSE غير نشط
    // سيتم تفعيله/إيقافه تلقائياً حسب حالة SSE
    
    // Heartbeat لمراقبة الصفحة (تحذير فقط، بدون إعادة تحميل)
    const heartbeatInterval = setInterval(() => {
      const now = Date.now();
      if (now - lastResponseTime > 120000) { // دقيقتان بدلاً من دقيقة

        // إعادة تعيين الوقت لتجنب التحذيرات المتكررة
        lastResponseTime = Date.now();
      }
    }, 60000);
    
    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
      unsubscribeConnected();
      unsubscribeError();
      clearInterval(heartbeatInterval);
    };
  }, [patientData?.id, stations, language]);
  
  // Listen to real-time notifications via eventBus (no duplicate EventSource)
  useEffect(() => {
    if (!patientData?.id) return;
    
    // Listen to queue events from eventBus
    const handleQueueUpdate = (data) => {
      try {
        const message = language === 'ar' ? data.message : data.messageEn;
        
        setCurrentNotice({
          type: data.type,
          message,
          position: data.position,
          clinic: data.clinic
        });
        
        setTimeout(() => setCurrentNotice(null), NEAR_TURN_REFRESH_INTERVAL);
      } catch (err) {
        // console.error('Event bus parse error:', err);
      }
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

  // الخروج من العيادة باستخدام رقم البن كود
  const handleClinicExit = async (station) => {
    try {
      setLoading(true)
      
      // التحقق من إدخال PIN
      if (!pinInput || !pinInput.trim()) {
        alert(language === 'ar' ? 'الرجاء إدخال رقم PIN' : 'Please enter PIN')
        setLoading(false)
        return
      }

      // استدعاء API للخروج
      const exitResult = await api.queueDone(station.id, patientData.id, pinInput)
      
      // التحقق من نجاح العملية
      if (!exitResult || !exitResult.success) {
        const errorMsg = exitResult?.error || (language === 'ar' ? 'رقم PIN غير صحيح' : 'Incorrect PIN')
        alert(errorMsg)
        setLoading(false)
        return
      }
      
      // Log duration for analytics
      if (exitResult && exitResult.duration_minutes) {

      }

      // تحديد العيادة التالية
      const currentIdx = stations.findIndex(s => s.id === station.id)
      const hasNextClinic = currentIdx >= 0 && currentIdx + 1 < stations.length
      
      // إذا كانت هناك عيادة تالية، نفتحها فقط (بدون دخول تلقائي)
      if (hasNextClinic) {
        // تحديث العيادات: إكمال الحالية وفتح التالية
        setStations(prev => prev.map((s, i) => {
          if (i === currentIdx) {
            // العيادة الحالية - مكتملة
            return { ...s, status: 'completed', exitTime: new Date() }
          } else if (i === currentIdx + 1) {
            // العيادة التالية - مفتوحة لكن غير مدخولة (يجب على المراجع الدخول يدوياً)
            return { ...s, status: 'ready', isEntered: false }
          }
          return s
        }))
        
        // إشعار بفتح العيادة التالية
        const nextClinicName = stations[currentIdx + 1]?.nameAr || 'العيادة التالية'
        setCurrentNotice({
          type: 'next_clinic',
          message: language === 'ar' 
            ? `✅ تم إكمال الفحص. يرجى الدخول إلى ${nextClinicName}`
            : `✅ Examination completed. Please enter ${nextClinicName}`,
          clinic: nextClinicName
        })
        setTimeout(() => setCurrentNotice(null), 5000)
      } else {
        // لا توجد عيادة تالية - فقط نكمل العيادة الحالية
        setStations(prev => prev.map((s, i) => 
          i === currentIdx ? { ...s, status: 'completed', exitTime: new Date() } : s
        ))
      }

      setPinInput('')
      setSelectedStation(null)

      const msg = language === 'ar' ? 'تم الخروج بنجاح' : 'Successfully exited'
      alert(msg)
    } catch (e) {
      // console.error('Complete clinic failed', e)
      const msg = language === 'ar' ? 'فشل الخروج من العيادة' : 'Failed to exit clinic'
      alert(msg)
    } finally {
      setLoading(false)
    }
  }

  const getExamName = () => {
    const exam = examTypes.find(e => e.id === patientData.queueType)
    if (!exam) return language === 'ar' ? 'فحص طبي' : 'Medical Exam'
    return language === 'ar' ? exam.nameAr : exam.name
  }

  // Check if all stations are completed
  const allStationsCompleted = stations.length > 0 && stations.every(s => s.status === 'completed')

  // If all completed, show completion screen
  if (allStationsCompleted) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center" data-test="completion-screen">
        <div className="max-w-2xl mx-auto space-y-6 text-center">
          <img src="/logo.jpeg" alt="قيادة الخدمات الطبية" className="mx-auto w-32 h-32 object-contain rounded-full shadow-lg" />

          <div className="text-green-400">
            <svg className="w-24 h-24 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <Card className="bg-gradient-to-br from-green-900/30 to-blue-900/30 border-green-500/30">
            <CardContent className="p-8 space-y-6">
              <h1 className="text-3xl font-bold text-white">
                {language === 'ar' ? '✅ تم إنهاء الفحص الطبي' : '✅ Medical Examination Completed'}
              </h1>
              
              <div className="space-y-4 text-lg">
                <p className="text-gray-300">
                  {language === 'ar' 
                    ? 'تهانينا! لقد أكملت جميع الفحوصات الطبية المطلوبة بنجاح'
                    : 'Congratulations! You have successfully completed all required medical examinations'}
                </p>

                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6 mt-6">
                  <h2 className="text-2xl font-bold text-yellow-400 mb-4">
                    {language === 'ar' ? '📋 الخطوة التالية' : '📋 Next Step'}
                  </h2>
                  <p className="text-xl text-white font-semibold">
                    {language === 'ar'
                      ? 'يرجى التوجه إلى استقبال اللجنة الطبية'
                      : 'Please proceed to the Medical Committee Reception'}
                  </p>
                  <p className="text-gray-300 mt-3">
                    {language === 'ar'
                      ? 'الموقع: الطابق الأول - مكتب الاستقبال'
                      : 'Location: First Floor - Reception Office'}
                  </p>
                </div>

                <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-6 mt-6">
                  <h3 className="text-xl font-bold text-white mb-4">
                    {language === 'ar' ? 'ملخص الفحوصات' : 'Examination Summary'}
                  </h3>
                  <div className="space-y-2 text-left">
                    <p className="text-gray-300">
                      <span className="font-semibold">{language === 'ar' ? 'نوع الفحص:' : 'Exam Type:'}</span> {getExamName()}
                    </p>
                    <p className="text-gray-300">
                      <span className="font-semibold">{language === 'ar' ? 'عدد العيادات:' : 'Number of Clinics:'}</span> {stations.length}
                    </p>
                    <p className="text-gray-300">
                      <span className="font-semibold">{language === 'ar' ? 'الحالة:' : 'Status:'}</span> 
                      <span className="text-green-400 font-bold"> {language === 'ar' ? 'مكتمل ✓' : 'Completed ✓'}</span>
                    </p>
                  </div>
                </div>

                <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-6 mt-4">
                  <h3 className="text-lg font-bold text-white mb-3">
                    {language === 'ar' ? 'العيادات المكتملة:' : 'Completed Clinics:'}
                  </h3>
                  <div className="space-y-2">
                    {stations.map((station, index) => (
                      <div key={station.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-300">
                          {index + 1}. {language === 'ar' ? station.nameAr : station.name}
                        </span>
                        <span className="text-green-400">✓</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 justify-center mt-8">
                <Button 
                  variant="default" 
                  size="lg"
                  onClick={onLogout}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold px-8 py-3 text-lg"
                >
                  {language === 'ar' ? '🏠 العودة للصفحة الرئيسية' : '🏠 Return to Home'}
                </Button>
              </div>

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
    <div className="min-h-screen p-4" data-test="patient-page">
      {currentNotice && (
        <ZFDBanner
          notice={currentNotice}
          onDismiss={() => setCurrentNotice(null)}
        />
      )}

      <NotificationSystem
        patientId={patientData?.id}
        currentClinic={stations.find(s => s.status === 'active' || s.status === 'ready')}
        yourNumber={stations.find(s => s.status === 'active' || s.status === 'ready')?.yourNumber}
        currentServing={stations.find(s => s.status === 'active' || s.status === 'ready')?.current}
        allStationsCompleted={allStationsCompleted}
      />

      <div className="max-w-4xl mx-auto space-y-6">
        <div className="absolute top-4 left-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-300 hover:text-white hover:bg-gray-800/50"
            onClick={toggleLanguage}
          >
            <Globe className="icon icon-md me-2" />
            {language === 'ar' ? 'English 🇺🇸' : 'العربية 🇶🇦'}
          </Button>
        </div>

        <div className="text-center space-y-4">
          <img src="/logo.jpeg" alt="قيادة الخدمات الطبية" className="mx-auto w-24 h-24 object-contain rounded-full shadow-lg" />

          <div>
            <h1 className="text-2xl font-bold text-white">
              {language === 'ar' ? 'قيادة الخدمات الطبية' : 'Medical Services Command'}
            </h1>
            <p className="text-lg text-gray-300">
              {language === 'ar' ? 'Medical Services' : 'قيادة الخدمات الطبية'}
            </p>
            <p className="text-gray-400 text-sm">
              {language === 'ar'
                ? 'المركز الطبي المتخصص العسكري - العطار'
                : 'Military Specialized Medical Center – Al-Attar'}
            </p>
          </div>
        </div>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="text-center">
            <CardTitle className="text-white text-xl">{t('yourMedicalRoute', language)}</CardTitle>
            <p className="text-gray-400">{t('exam', language)}: {getExamName()}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {stations.map((station, index) => (
              <Card key={station.id} className="bg-gray-700/50 border-gray-600">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {station.status === 'ready' ? (
                        <Unlock className="icon icon-lg icon-success" />
                      ) : station.status === 'completed' ? (
                        <Lock className="icon icon-lg icon-primary" />
                      ) : (
                        <Lock className="icon icon-lg icon-muted" />
                      )}
                      <div>
                        <h3 className="text-white font-semibold">
                          {language === 'ar' ? station.nameAr : station.name}
                        </h3>
                        <p className="text-gray-400 text-sm">
                          {t('floor', language)}: {language === 'ar' ? station.floor : station.floorCode}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        station.status === 'ready' ? 'bg-green-500/20 text-green-400' :
                        station.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {station.status === 'ready' ? t('ready', language) :
                          station.status === 'completed' ? t('completed', language) :
                          t('locked', language)}
                      </span>
                    </div>
                  </div>

                  {routeWithZFD && routeWithZFD.route && routeWithZFD.route.length > index && (
                    <div className="mb-4" data-test="zfd-ticket-section">
                      <ZFDTicketDisplay step={routeWithZFD.route[index]} />
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-4 text-center" data-test="queue-info">
                    <div>
                      <div className="text-2xl font-bold text-white" data-test="current-number">{station.current}</div>
                      <div className="text-gray-400 text-sm">{t('current', language)}</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-yellow-400" data-test="your-number">{station.yourNumber || '-'}</div>
                      <div className="text-gray-400 text-sm">{t('yourNumber', language)}</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-white" data-test="ahead-count">{station.ahead || 0}</div>
                      <div className="text-gray-400 text-sm">{t('ahead', language)}</div>
                    </div>
                  </div>
                  
                  {station.isEntered && (
                    <>
                      {/* عرض العد التنازلي */}
                      {station.entered_at && (
                        <div className="mt-3">
                          <CountdownTimer
                            enteredAt={station.entered_at}
                            maxSeconds={240}
                            show={true}
                            language={language}
                            onTimeout={() => {

                            }}
                          />
                        </div>
                      )}
                      
                      <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-300">
                            🕒 {language === 'ar' ? 'الوقت المتوقع:' : 'Est. Wait:'}
                          </span>
                          <span className="text-blue-400 font-bold">
                            {station.ahead ? `~${station.ahead * 5} ${language === 'ar' ? 'دقيقة' : 'min'}` : language === 'ar' ? 'دورك الآن!' : 'Your turn!'}
                          </span>
                        </div>
                      </div>
                    </>
                  )}

                  {station.status === 'ready' && !station.isEntered && (
                    <div className="mt-4 pt-4 border-t border-gray-600">
                      <Button
                        variant="gradientPrimary"
                        onClick={() => handleEnterClinic(station)}
                        disabled={loading}
                        className="w-full"
                        data-test="enter-clinic-btn"
                      >
                        <LogIn className="icon icon-md me-2" />
                        {language === 'ar' ? 'دخول العيادة' : 'Enter Clinic'}
                      </Button>
                    </div>
                  )}

                  {station.status === 'ready' && station.isEntered && (
                    <div className="mt-4 pt-4 border-t border-gray-600 space-y-3">
                      <div className="flex flex-wrap gap-2 items-center">
                        <Input
                          type="text"
                          placeholder={`${t('enterPIN', language)} (${t('ticketNumber', language)})`}
                          value={selectedStation?.id === station.id ? pinInput : ''}
                          onChange={(e) => { setSelectedStation(station); setPinInput(e.target.value) }}
                          className="bg-gray-600 border-gray-500 text-white"
                          maxLength={6}
                          data-test="pin-input"
                        />
                        <Button
                          variant="gradientSecondary"
                          onClick={() => handleClinicExit(station)}
                          disabled={loading || !pinInput.trim()}
                          title={t('exitClinic', language)}
                          data-test="exit-clinic-btn"
                        >
                          <LogOut className="icon icon-md me-2" />
                          {t('exitClinic', language)}
                        </Button>
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
                    <div className="mt-4 pt-4 border-t border-gray-600">
                      <p className="text-gray-400 text-sm">
                        {language === 'ar'
                          ? `يمكنك الوصول عبر المصعد – اضغط ${station.floorCode}`
                          : `You can reach via elevator – press ${station.floorCode}`}
                      </p>
                    </div>
                  )}

                  {station.note && (
                    <div className="mt-4 pt-4 border-t border-gray-600">
                      <p className="text-yellow-400 text-sm">
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
            {t('exitSystem', language)}
          </Button>
        </div>
      </div>
    </div>
  )
}


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

  // إعدادات النظام - التحكم في إظهار/إخفاء وتفعيل/إيقاف الميزات
  const [systemSettings, setSystemSettings] = useState({
    pin_system_enabled: true,
    pin_system_visible: true,
    queue_system_enabled: true,
    queue_system_visible: true
  })

  // جلب إعدادات النظام من قاعدة البيانات
  useEffect(() => {
    const fetchSystemSettings = async () => {
      try {
        const response = await api.getSettings()
        if (response && response.settings) {
          setSystemSettings({
            pin_system_enabled: response.settings.pin_system_enabled !== 'false',
            pin_system_visible: response.settings.pin_system_visible !== 'false',
            queue_system_enabled: response.settings.queue_system_enabled !== 'false',
            queue_system_visible: response.settings.queue_system_visible !== 'false'
          })
        }
      } catch (err) {
        console.error('Failed to fetch system settings:', err)
      }
    }

    fetchSystemSettings()
    // تحديث كل 30 ثانية للتأكد من التغييرات اللحظية
    const interval = setInterval(fetchSystemSettings, 30000)
    return () => clearInterval(interval)
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
        setCurrentNotice({
          type: 'error',
          message: enterResult.error
        })
        setTimeout(() => setCurrentNotice(null), 5000)
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
        setCurrentNotice({
          type: 'success',
          message: language === 'ar' 
            ? `✅ تم الدخول بنجاح - رقمك ${positionData.display_number}`
            : `✅ Entered successfully - Your # ${positionData.display_number}`
        })
        setTimeout(() => setCurrentNotice(null), 4000)
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
      setCurrentNotice({
        type: 'error',
        message: language === 'ar' ? 'فشل الدخول للعيادة. الرجاء المحاولة مرة أخرى.' : 'Failed to enter clinic. Please try again.'
      })
      setTimeout(() => setCurrentNotice(null), 5000)
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

        // محاولة جلب المسار المحفوظ أولاً
        try {
          const savedRoute = await api.getRoute(patientData.id)
          if (savedRoute && savedRoute.success && savedRoute.route && savedRoute.route.stations) {
            examStations = savedRoute.route.stations
          }
        } catch (err) {
          console.log('No saved route found');
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
            console.log('Failed to save route:', err);
          }
        }

        // ✅ إصلاح: ترتيب العيادات حسب الأقل ازدحاماً
        let sortedStations = [...examStations];
        try {
          const queueCounts = await Promise.all(
            examStations.map(async (station) => {
              const count = await api.getQueueCount(station.id);
              return { station, count: count || 0 };
            })
          );
          // ترتيب العيادات حسب الأقل ازدحاماً (الأقل في الاعلى)
          queueCounts.sort((a, b) => a.count - b.count);
          sortedStations = queueCounts.map(q => q.station);
          console.log('[PatientPage] Stations sorted by queue count:', queueCounts.map(q => `${q.station.nameAr}: ${q.count}`));
        } catch (sortError) {
          console.warn('[PatientPage] Failed to sort stations:', sortError);
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

          // إشعار الطابق
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
        console.error('Failed to load pathway:', err)
      }
    }

    loadPathway()
  }, [patientData.examType, patientData.queueType, patientData.gender])

  // Fetch route with ZFD validation
  useEffect(() => {
    if (patientData?.id) {
      api.getRoute(patientData.id)
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
    let pollingInterval = null;
    let isSSEActive = false;
    const MAX_RETRY = 3;
    const RECOVERY_DELAY = 5000;
    const lastStateRef = { current: null };

    // مراقبة حالة SSE
    const handleSSEConnected = () => {
      isSSEActive = true;
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
    };

    const handleSSEError = () => {
      isSSEActive = false;
      if (!pollingInterval) {
        pollingInterval = setInterval(() => {
          updateQueueStatus();
        }, dynamicInterval);
      }
    };

    const unsubscribeConnected = eventBus.on('sse:connected', handleSSEConnected);
    const unsubscribeError = eventBus.on('sse:error', handleSSEError);

    if (window.eventBusSSE?.isConnected()) {
      handleSSEConnected();
    } else {
      handleSSEError();
    }

    const updateQueueStatus = async () => {
      if (document.hidden) return;

      const start = Date.now();
      try {
        // ✅ إصلاح: إرسال طلب للعيادة الحالية فقط
        const currentStation = stations.find(s => s.status === 'ready' && s.yourNumber !== null);

        if (currentStation) {
          const positionData = await api.getQueuePosition(currentStation.id, patientData.id);
          if (positionData && positionData.success) {
            const stateKey = `${currentStation.id}-${positionData.display_number}`;
            if (lastStateRef.current !== stateKey) {
              lastStateRef.current = stateKey;

              setStations(prev => prev.map(s => {
                if (s.id === currentStation.id) {
                  // إشعار عند تغيير الموقع
                  const previousNumber = s.lastNotifiedPosition || 999;
                  if (positionData.display_number !== previousNumber && positionData.display_number <= 2) {
                    const messages = {
                      0: language === 'ar' ? '🔔 دورك الآن!' : '🔔 Your turn now!',
                      1: language === 'ar' ? '⚠️ أنت التالي - كن جاهزاً' : '⚠️ You are next - be ready',
                      2: language === 'ar' ? 'ℹ️ أنت الثاني - استعد' : 'ℹ️ You are second - get ready'
                    };

                    const message = messages[positionData.display_number];
                    if (message) {
                      setCurrentNotice({
                        type: 'queue_update',
                        message: message,
                        clinic: s.nameAr
                      });

                      if (positionData.display_number === 0) {
                        eventBus.emit('queue:your_turn', {
                          clinicName: s.nameAr,
                          position: positionData.display_number
                        });
                      }

                      setTimeout(() => setCurrentNotice(null), NEAR_TURN_REFRESH_INTERVAL);
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
        dynamicInterval = Math.max(5000, GENERAL_REFRESH_INTERVAL + duration);
      } catch (err) {
        retryCount++;
        dynamicInterval = Math.min(60000, dynamicInterval * 1.5);

        if (retryCount <= MAX_RETRY) {
          setTimeout(updateQueueStatus, RECOVERY_DELAY);
        } else {
          retryCount = 0;
        }
      }
    };

    updateQueueStatus();

    const heartbeatInterval = setInterval(() => {
      const now = Date.now();
      if (now - lastResponseTime > 120000) {
        lastResponseTime = Date.now();
      }
    }, 60000);

    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
      unsubscribeConnected();
      unsubscribeError();
      clearInterval(heartbeatInterval);
    };
  }, [patientData?.id, language, stations.length]);

  // Listen to real-time notifications via eventBus
  useEffect(() => {
    if (!patientData?.id) return;

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
        console.error('Event bus parse error:', err);
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

  // ✅ الخروج من العيادة باستخدام رقم البن كود - مع تحسين تمرير الدور
  const handleClinicExit = async (station) => {
    try {
      setLoading(true)

      // التحقق من إدخال PIN
      if (!pinInput || !pinInput.trim()) {
        setCurrentNotice({
          type: 'warning',
          message: language === 'ar' ? 'الرجاء إدخال رقم PIN' : 'Please enter PIN'
        })
        setTimeout(() => setCurrentNotice(null), 4000)
        setLoading(false)
        return
      }

      // استدعاء API للخروج
      const exitResult = await api.queueDone(station.id, patientData.id, pinInput)

      if (!exitResult || !exitResult.success) {
        const errorMsg = exitResult?.error || (language === 'ar' ? 'رقم PIN غير صحيح' : 'Incorrect PIN')
        setCurrentNotice({
          type: 'error',
          message: errorMsg
        })
        setTimeout(() => setCurrentNotice(null), 5000)
        setLoading(false)
        return
      }

      // تحديد العيادة التالية
      const currentIdx = stations.findIndex(s => s.id === station.id)
      const hasNextClinic = currentIdx >= 0 && currentIdx + 1 < stations.length

      // ✅ إصلاح: إذا كانت هناك عيادة تالية، نفتحها وندخل الطابور تلقائياً
      if (hasNextClinic) {
        const nextClinic = stations[currentIdx + 1];
        const nextClinicName = language === 'ar' ? nextClinic?.nameAr : nextClinic?.name;

        // تحديث العيادات: إكمال الحالية وفتح التالية
        setStations(prev => prev.map((s, i) => {
          if (i === currentIdx) {
            return { ...s, status: 'completed', exitTime: new Date(), isEntered: false }
          } else if (i === currentIdx + 1) {
            return { ...s, status: 'ready', isEntered: false, yourNumber: null, current: null, ahead: null }
          }
          return s
        }))

        // ✅ تمرير الدور للعيادة التالية تلقائياً
        try {
          const enterResult = await api.enterQueue(nextClinic.id, patientData.id, true, patientData.name, patientData.queueType);

          if (enterResult && (enterResult.success || enterResult.display_number)) {
            const positionData = await api.getQueuePosition(nextClinic.id, patientData.id);

            if (positionData && positionData.success) {
              setActiveTicket({ clinicId: nextClinic.id, ticket: positionData.display_number });
              setStations(prev => prev.map((s, i) => {
                if (i === currentIdx + 1) {
                  return {
                    ...s,
                    yourNumber: positionData.display_number,
                    current: positionData.current_number,
                    ahead: positionData.ahead,
                    totalWaiting: positionData.total_waiting,
                    status: 'ready',
                    isEntered: true,
                    entered_at: new Date().toISOString()
                  };
                }
                return s;
              }));

              // ✅ إصلاح: إشارة واضحة بتمرير الدور
              setCurrentNotice({
                type: 'next_clinic',
                message: language === 'ar' 
                  ? `✅ تم التمرير إلى ${nextClinicName} - رقمك ${positionData.display_number}`
                  : `✅ Moved to ${nextClinicName} - Your # ${positionData.display_number}`,
                clinic: nextClinicName
              });
            } else {
              setCurrentNotice({
                type: 'next_clinic',
                message: language === 'ar' 
                  ? `✅ تم التمرير إلى ${nextClinicName}`
                  : `✅ Moved to ${nextClinicName}`,
                clinic: nextClinicName
              });
            }
          } else {
            setCurrentNotice({
              type: 'next_clinic',
              message: language === 'ar' 
                ? `✅ يرجى الدخول إلى ${nextClinicName}`
                : `✅ Please enter ${nextClinicName}`,
              clinic: nextClinicName
            });
          }
        } catch (autoEnterError) {
          console.error('Auto-enter next clinic failed:', autoEnterError);
          setCurrentNotice({
            type: 'next_clinic',
            message: language === 'ar' 
              ? `✅ يرجى الدخول إلى ${nextClinicName}`
              : `✅ Please enter ${nextClinicName}`,
            clinic: nextClinicName
          });
        }

        setTimeout(() => setCurrentNotice(null), 6000);
      } else {
        // لا توجد عيادة تالية
        setStations(prev => prev.map((s, i) => 
          i === currentIdx ? { ...s, status: 'completed', exitTime: new Date(), isEntered: false } : s
        ));

        setCurrentNotice({
          type: 'success',
          message: language === 'ar' ? '✅ تم إنهاء جميع الفحوصات' : '✅ All examinations completed'
        });
        setTimeout(() => setCurrentNotice(null), 5000);
      }

      setPinInput('')
      setSelectedStation(null)
    } catch (e) {
      console.error('Complete clinic failed', e)
      setCurrentNotice({
        type: 'error',
        message: language === 'ar' ? 'فشل الخروج من العيادة' : 'Failed to exit clinic'
      })
      setTimeout(() => setCurrentNotice(null), 5000)
    } finally {
      setLoading(false)
    }
  }

  // الخروج بدون PIN
  const handleClinicExitWithoutPin = async (station) => {
    try {
      setLoading(true)
      const exitResult = await api.queueDone(station.id, patientData.id, null, true)

      if (!exitResult || !exitResult.success) {
        const errorMsg = exitResult?.error || (language === 'ar' ? 'فشل الخروج' : 'Exit failed')
        setCurrentNotice({
          type: 'error',
          message: errorMsg
        })
        setTimeout(() => setCurrentNotice(null), 5000)
        setLoading(false)
        return
      }

      const currentIdx = stations.findIndex(s => s.id === station.id)
      const hasNextClinic = currentIdx >= 0 && currentIdx + 1 < stations.length

      if (hasNextClinic) {
        setStations(prev => prev.map((s, i) => {
          if (i === currentIdx) {
            return { ...s, status: 'completed', exitTime: new Date() }
          } else if (i === currentIdx + 1) {
            return { ...s, status: 'ready', isEntered: false }
          }
          return s
        }))

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
        setStations(prev => prev.map((s, i) => 
          i === currentIdx ? { ...s, status: 'completed', exitTime: new Date() } : s
        ))
      }

      setCurrentNotice({
        type: 'success',
        message: language === 'ar' ? '✅ تم الخروج بنجاح' : '✅ Successfully exited'
      })
      setTimeout(() => setCurrentNotice(null), 4000)
    } catch (e) {
      setCurrentNotice({
        type: 'error',
        message: language === 'ar' ? 'فشل الخروج من العيادة' : 'Failed to exit clinic'
      })
      setTimeout(() => setCurrentNotice(null), 5000)
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
          <img src="/mms-logo.png" alt="اللجنة الطبية العسكرية" className="mx-auto w-24 h-24 object-contain" />

          <h1 className="text-xl font-bold text-white">
            {'اللجنة الطبية العسكرية'}
          </h1>

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
                  {language === 'ar' 
                    ? 'تهانينا! لقد أكملت جميع الفحوصات الطبية المطلوبة بنجاح'
                    : 'Congratulations! You have successfully completed all required medical examinations'}
                </p>

                <div className="bg-yellow-500/10 border-2 border-yellow-500/30 rounded-xl p-8 mt-6">
                  <h2 className="text-3xl font-bold text-yellow-400 mb-6">
                    {language === 'ar' ? '📋 الخطوة التالية' : '📋 Next Step'}
                  </h2>
                  <p className="text-2xl text-white font-bold">
                    {language === 'ar'
                      ? 'يرجى التوجه إلى استقبال اللجنة الطبية'
                      : 'Please proceed to the Medical Committee Reception'}
                  </p>
                  <p className="text-gray-300 text-lg mt-4 font-medium">
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
        language={language}
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

        <div className="text-center space-y-2">
          <img src="/mms-logo.png" alt="اللجنة الطبية العسكرية" className="mx-auto w-24 h-24 object-contain" />

          <div>
            <h1 className="text-xl font-bold text-white">
              {language === 'ar' ? 'اللجنة الطبية العسكرية' : 'Military Medical Committee'}
            </h1>
            <p className="text-sm text-[#C9A54C] font-semibold mt-1">
              {language === 'ar' ? 'قيادة الخدمات الطبية العسكرية' : 'Military Medical Services Command'}
            </p>
            <p className="text-gray-400 text-xs mt-1">
              {language === 'ar'
                ? 'المركز الطبي التخصصي العسكري - العطار'
                : 'Military Specialized Medical Center – Al-Attar'}
            </p>
          </div>
        </div>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="text-center">
            <CardTitle className="text-white text-2xl sm:text-3xl font-bold">{t('yourMedicalRoute', language)}</CardTitle>
            <p className="text-gray-300 text-lg sm:text-xl mt-2">{t('exam', language)}: <span className="font-semibold text-white">{getExamName()}</span></p>
          </CardHeader>
          <CardContent className="space-y-4">
            {stations.map((station, index) => (
              <Card key={station.id} className={`bg-gray-700/50 border-gray-600 ${station.status === 'completed' ? 'opacity-70' : ''}`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {station.status === 'ready' ? (
                        <Unlock className="icon icon-lg icon-success" />
                      ) : station.status === 'completed' ? (
                        <CheckCircle className="icon icon-lg text-green-400" />
                      ) : (
                        <Lock className="icon icon-lg icon-muted" />
                      )}
                      <div>
                        <h3 className="text-white text-lg sm:text-xl font-bold">
                          {language === 'ar' ? station.nameAr : station.name}
                        </h3>
                        <p className="text-gray-300 text-base sm:text-lg">
                          {t('floor', language)}: {language === 'ar' ? station.floor : station.floorCode}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-4 py-2 rounded-full text-base sm:text-lg font-semibold ${
                        station.status === 'ready' ? 'bg-green-500/20 text-green-400' :
                        station.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        'bg-gray-500/20 text-gray-400'
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
                    <div className="grid grid-cols-3 gap-4 sm:gap-6 text-center px-4 py-6 bg-gray-800/30 rounded-xl mx-2" data-test="queue-info">
                      <div className="p-4 bg-gray-700/50 rounded-lg">
                        <div className="text-6xl font-bold text-white mb-4" data-test="current-number">
                          {typeof station.current === 'number' ? station.current : '0'}
                        </div>
                        <div className="text-gray-300 text-xl font-semibold">{t('current', language)}</div>
                      </div>
                      <div className="p-4 bg-yellow-500/20 rounded-lg border-2 border-yellow-500/50">
                        <div className="text-6xl font-bold text-yellow-400 mb-4" data-test="your-number">
                          {typeof station.yourNumber === 'number' ? station.yourNumber : '1'}
                        </div>
                        <div className="text-yellow-200 text-xl font-semibold">{t('yourNumber', language)}</div>
                      </div>
                      <div className="p-4 bg-gray-700/50 rounded-lg">
                        <div className="text-6xl font-bold text-white mb-4" data-test="ahead-count">
                          {station.ahead || 0}
                        </div>
                        <div className="text-gray-300 text-xl font-semibold">{t('ahead', language)}</div>
                      </div>
                    </div>
                  )}

                  {/* عداد تنازلي كبير للتوقيت */}
                  {station.status === 'ready' && !station.isEntered && (
                    <div className="mt-4 p-6 bg-blue-500/10 border-2 border-blue-500/30 rounded-xl">
                      <div className="flex items-center justify-end gap-3 mb-3">
                        <span className="text-blue-300 text-xl font-medium">
                          {language === 'ar' ? 'وقت متبقي' : 'وقت متبقي'}
                        </span>
                        <span className="text-3xl">🕒</span>
                      </div>
                      <div className="text-center">
                        <div className="text-5xl font-bold text-blue-400 mb-2">
                          {station.ahead > 0 ? `${computeEtaMinutes(station.ahead, 2)}:00` : language === 'ar' ? 'دورك الآن!' : 'دورك الآن!'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* الوقت المتوقع بعد الدخول */}
                  {station.status === 'ready' && station.isEntered && station.ahead === 0 && (
                    <div className="mt-4 p-6 bg-green-500/10 border-2 border-green-500/30 rounded-xl">
                      <div className="flex items-center justify-center gap-3">
                        <span className="text-3xl">⏰</span>
                        <span className="text-green-300 text-2xl font-bold">
                          {language === 'ar' ? 'دورك الآن!' : 'دورك الآن!'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* ✅ إصلاح: زر الدخول للعيادة - يظهر فقط عند حلول الدور */}
                  {station.status === 'ready' && !station.isEntered && (
                    <div className="mt-4 pt-4 border-t border-gray-600">
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
                          className="w-full"
                          data-test="enter-clinic-btn"
                        >
                          <LogIn className="icon icon-md me-2" />
                          {t('enterClinic', language)}
                        </Button>
                      ) : (
                        <div className="text-center space-y-3">
                          <div className="p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-xl">
                            <p className="text-yellow-400 font-bold text-lg">
                              {language === 'ar' ? '⏳ انتظر دورك' : '⏳ Wait for your turn'}
                            </p>
                            <p className="text-yellow-200 text-sm mt-2">
                              {language === 'ar' 
                                ? `رقمك ${station.yourNumber} - الحالي ${station.current || 0} - أمامك ${station.ahead} شخص`
                                : `Your # ${station.yourNumber} - Current ${station.current || 0} - ${station.ahead} ahead`}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            disabled={true}
                            className="w-full opacity-50 cursor-not-allowed border-gray-600"
                          >
                            <Lock className="icon icon-md me-2" />
                            {language === 'ar' ? 'الدخول غير متاح حالياً' : 'Entry not available yet'}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {station.status === 'ready' && station.isEntered && (
                    <div className="mt-4 pt-4 border-t border-gray-600 space-y-3">
                      {/* عرض حقل البن كود فقط إذا كان النظام مفعل ومرئي */}
                      {systemSettings.pin_system_enabled && systemSettings.pin_system_visible ? (
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
                            disabled={loading || !pinInput || !pinInput.trim()}
                            title={t('exitClinic', language)}
                            data-test="exit-clinic-btn"
                          >
                            <LogOut className="icon icon-md me-2" />
                            {t('exitClinic', language)}
                          </Button>
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
                            className="w-full"
                          >
                            <LogOut className="icon icon-md me-2" />
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

/**
 * @fileoverview Patient Page Component - Doctor-Controlled Queue System
 * @description Main patient interface for the queue system.
 *              PIN-related UI removed; patient flow controlled by doctors.
 * @version 4.0.0
 * @since 2025-04-01
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import { Button } from './Button';
import { Lock, Unlock, Clock, Globe, LogIn, CheckCircle, ArrowRight } from 'lucide-react';
import { examTypes, formatTime } from '../lib/utils';
import { computeEtaMinutes } from '../lib/eta';
import { getDynamicMedicalPathway } from '../lib/dynamic-pathways';
import { t } from '../lib/i18n';
import api from '../lib/api';
import { ZFDTicketDisplay, ZFDBanner } from './ZFDTicketDisplay';
import NotificationSystem from './NotificationSystem';
import eventBus from '../core/event-bus';
import { supabase } from '../lib/supabase-client';

/**
 * PatientPage Component
 * @param {Object} props - Component props
 * @param {Object} props.patientData - Patient information
 * @param {Function} props.onLogout - Logout handler
 * @param {string} props.language - Current language
 * @param {Function} props.toggleLanguage - Language toggle handler
 */
export function PatientPage({ patientData, onLogout, language, toggleLanguage }) {
  // State management
  const [stations, setStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTicket, setActiveTicket] = useState(null);
  const [currentNotice, setCurrentNotice] = useState(null);
  const [routeWithZFD, setRouteWithZFD] = useState(null);
  const [directAlerts, setDirectAlerts] = useState([]);
  const [queuePositions, setQueuePositions] = useState({});

  // System settings (PIN system removed)
  const [systemSettings] = useState({
    queue_system_enabled: true,
    queue_system_visible: true,
    doctor_control_enabled: true
  });

  /**
   * Gets ticket for first clinic without auto-entry
   * @param {Object} station - Clinic station
   */
  const handleGetTicketForFirstClinic = useCallback(async (station) => {
    try {
      // Create queue entry
      const idempotencyKey = `${patientData.id}-${station.id}-${Date.now()}`;
      const result = await api.createQueue(
        patientData.sessionId,
        patientData.examType || patientData.queueType,
        patientData.gender,
        idempotencyKey
      );

      if (result?.success) {
        // Get queue position
        const positionData = await api.getQueuePosition(station.id, patientData.id);

        if (positionData?.success) {
          setStations(prev => prev.map((s, idx) => idx === 0 ? {
            ...s,
            queueId: result.queueId,
            yourNumber: positionData.display_number,
            current: positionData.current_number,
            ahead: positionData.ahead,
            totalWaiting: positionData.total_waiting,
            status: 'ready',
            isEntered: false,
          } : s));
        }
      }
    } catch (e) {
      console.error('Get ticket for first clinic failed:', e);
      setCurrentNotice({
        type: 'error',
        message: language === 'ar' 
          ? 'فشل في الحصول على رقم الدور. الرجاء المحاولة مرة أخرى.'
          : 'Failed to get ticket. Please try again.'
      });
      setTimeout(() => setCurrentNotice(null), 5000);
    }
  }, [patientData, language]);

  /**
   * Enters patient into clinic manually
   * @param {Object} station - Clinic station
   */
  const handleEnterClinic = useCallback(async (station) => {
    try {
      setLoading(true);
      const entryTime = new Date().toISOString();

      // Enter queue
      const enterResult = await api.enterQueue(
        station.id, 
        patientData.id, 
        true, 
        patientData.name, 
        patientData.queueType
      );

      if (enterResult && !enterResult.success && enterResult.error) {
        setCurrentNotice({
          type: 'error',
          message: enterResult.error
        });
        setTimeout(() => setCurrentNotice(null), 5000);
        setLoading(false);
        return;
      }

      // Get updated position
      const positionData = await api.getQueuePosition(station.id, patientData.id);

      if (positionData?.success) {
        setActiveTicket({ clinicId: station.id, ticket: positionData.display_number });
        setStations(prev => prev.map(s => s.id === station.id ? {
          ...s,
          yourNumber: positionData.display_number,
          current: positionData.current_number,
          ahead: positionData.ahead,
          totalWaiting: positionData.total_waiting,
          status: 'ready',
          isEntered: true,
          entered_at: positionData.entered_at || entryTime
        } : s));

        setCurrentNotice({
          type: 'success',
          message: language === 'ar' 
            ? `✅ تم الدخول بنجاح - رقمك ${positionData.display_number}`
            : `✅ Entered successfully - Your # ${positionData.display_number}`
        });
        setTimeout(() => setCurrentNotice(null), 4000);
      }

      setLoading(false);
    } catch (e) {
      console.error('Enter clinic failed:', e);
      setCurrentNotice({
        type: 'error',
        message: language === 'ar' 
          ? 'فشل الدخول للعيادة. الرجاء المحاولة مرة أخرى.'
          : 'Failed to enter clinic. Please try again.'
      });
      setTimeout(() => setCurrentNotice(null), 5000);
      setLoading(false);
    }
  }, [patientData, language]);

  /**
   * Loads patient's medical pathway
   */
  useEffect(() => {
    const loadPathway = async () => {
      try {
        let examStations = null;

        // Try to get saved route first
        try {
          const savedRoute = await api.getRoute(patientData.id);
          if (savedRoute?.success && savedRoute.route?.stations) {
            examStations = savedRoute.route.stations;
          }
        } catch (err) {
          console.log('No saved route found');
        }

        // Calculate new route if none saved
        if (!examStations) {
          examStations = await getDynamicMedicalPathway(
            patientData.examType || patientData.queueType, 
            patientData.gender
          );

          // Save new route
          try {
            await api.createRoute(
              patientData.id,
              patientData.examType || patientData.queueType,
              patientData.gender,
              examStations
            );
          } catch (err) {
            console.log('Failed to save route:', err);
          }
        }

        // Sort stations by queue count (least loaded first)
        let sortedStations = [...examStations];
        try {
          const queueCounts = await Promise.all(
            examStations.map(async (station) => {
              const count = await api.getQueueCount(station.id);
              return { station, count: count || 0 };
            })
          );
          queueCounts.sort((a, b) => a.count - b.count);
          sortedStations = queueCounts.map(q => q.station);
        } catch (sortError) {
          console.warn('Failed to sort stations:', sortError);
        }

        // Initialize stations state
        const initialStations = sortedStations.map((station, index) => ({
          ...station,
          status: index === 0 ? 'ready' : 'locked',
          current: 0,
          yourNumber: null,
          ahead: 0,
          isEntered: false
        }));

        setStations(initialStations);

        // Get ticket for first clinic
        if (sortedStations.length > 0) {
          await handleGetTicketForFirstClinic(sortedStations[0]);

          // Show floor guide
          if (sortedStations[0].floor) {
            setCurrentNotice({
              type: 'floor_guide',
              message: `📍 يرجى التوجه إلى ${sortedStations[0].floor}`,
              clinic: sortedStations[0].nameAr
            });
            setTimeout(() => setCurrentNotice(null), 5000);
          }
        }
      } catch (err) {
        console.error('Failed to load pathway:', err);
      }
    };

    loadPathway();
  }, [patientData.examType, patientData.queueType, patientData.gender, handleGetTicketForFirstClinic]);

  /**
   * Fetches route with ZFD validation
   */
  useEffect(() => {
    if (patientData?.id) {
      api.getRoute(patientData.id)
        .then(data => {
          if (data?.route) {
            setRouteWithZFD(data);
          }
        })
        .catch(err => console.warn('Route fetch failed:', err));
    }
  }, [patientData?.id]);

  /**
   * Real-time queue status updates
   */
  useEffect(() => {
    if (!patientData?.id || stations.length === 0) return;

    let retryCount = 0;
    let dynamicInterval = 5000;
    const MAX_RETRY = 3;
    const lastStateRef = { current: null };

    const updateQueueStatus = async () => {
      if (document.hidden) return;

      try {
        const currentStation = stations.find(s => s.status === 'ready' && s.yourNumber !== null);

        if (currentStation) {
          const positionData = await api.getQueuePosition(currentStation.id, patientData.id);
          
          if (positionData?.success) {
            const stateKey = `${currentStation.id}-${positionData.display_number}`;
            
            if (lastStateRef.current !== stateKey) {
              lastStateRef.current = stateKey;

              setStations(prev => prev.map(s => {
                if (s.id === currentStation.id) {
                  // Notify when approaching turn
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
                        message,
                        clinic: s.nameAr
                      });

                      if (positionData.display_number === 0) {
                        eventBus.emit('queue:your_turn', { clinicName: s.nameAr, type: 'YOUR_TURN', position: positionData.display_number });
                      } else if (positionData.display_number === 1) {
                        eventBus.emit('queue:step_done_next', { clinicName: s.nameAr, type: 'STEP_DONE_NEXT', position: positionData.display_number });
                      } else if (positionData.display_number === 2) {
                        eventBus.emit('queue:near_turn', { clinicName: s.nameAr, type: 'NEAR_TURN', position: positionData.display_number });
                      }

                      setTimeout(() => setCurrentNotice(null), 10000);
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
      } catch (err) {
        retryCount++;
        dynamicInterval = Math.min(60000, dynamicInterval * 1.5);

        if (retryCount <= MAX_RETRY) {
          setTimeout(updateQueueStatus, 5000);
        }
      }
    };

    let cancelled = false;
    let timeoutId;

    const loop = async () => {
      if (cancelled) return;
      await updateQueueStatus();
      timeoutId = setTimeout(loop, dynamicInterval);
    };

    loop();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [patientData?.id, language, stations.length]);

  /**
   * Direct alerts from admin
   */
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
        
        if (data?.length > 0) setDirectAlerts(data);
      } catch (e) {
        console.error('Error fetching direct alerts:', e);
      }
    };

    fetchActiveAlerts();

    // Realtime subscription
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
            try {
              new Audio('/notification.mp3').play().catch(() => {});
            } catch(e) {}
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [patientData?.military_number]);

  /**
   * Dismisses a direct alert
   * @param {string} alertId - Alert ID
   */
  const dismissDirectAlert = async (alertId) => {
    try {
      await supabase
        .from('direct_alerts')
        .update({ read_at: new Date().toISOString() })
        .eq('id', alertId);
      
      setDirectAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (e) {
      console.error('Error dismissing alert:', e);
    }
  };

  /**
   * Gets exam name in current language
   * @returns {string} Exam name
   */
  const getExamName = () => {
    const exam = examTypes.find(e => e.id === patientData.queueType);
    if (!exam) return language === 'ar' ? 'فحص طبي' : 'Medical Exam';
    return language === 'ar' ? exam.nameAr : exam.name;
  };

  // Check if all stations completed
  const allStationsCompleted = stations.length > 0 && stations.every(s => s.status === 'completed');

  // Completion screen
  if (allStationsCompleted) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center" data-test="completion-screen">
        <div className="max-w-2xl mx-auto space-y-6 text-center">
          <img src="/mms-logo.png" alt="اللجنة الطبية العسكرية" className="mx-auto w-24 h-24 object-contain" />

          <h1 className="text-lg font-bold text-white">
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
                  <p className="text-xl text-white font-bold">
                    {language === 'ar'
                      ? 'يرجى التوجه إلى استقبال اللجنة الطبية'
                      : 'Please proceed to the Medical Committee Reception'}
                  </p>
                  <p className="text-gray-300 text-sm mt-2 font-medium">
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
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold px-6 py-2 text-base"
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
    );
  }

  // Main patient page
  return (
    <div className="min-h-screen px-3 py-4 overflow-x-hidden overflow-y-auto" data-test="patient-page">
      {/* Notice Banner */}
      {currentNotice && (
        <ZFDBanner notice={currentNotice} onDismiss={() => setCurrentNotice(null)} />
      )}

      {/* Direct Alerts */}
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
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <NotificationSystem
        patientId={patientData?.id}
        currentClinic={stations.find(s => s.status === 'active' || s.status === 'ready')}
        yourNumber={stations.find(s => s.status === 'active' || s.status === 'ready')?.yourNumber}
        currentServing={stations.find(s => s.status === 'active' || s.status === 'ready')?.current}
        allStationsCompleted={allStationsCompleted}
        language={language}
      />

      <div className="w-full max-w-2xl mx-auto space-y-5 px-2 sm:px-4">
        {/* Language Toggle */}
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

        {/* Header */}
        <div className="text-center space-y-1">
          <img src="/mms-logo.png" alt="اللجنة الطبية العسكرية" className="mx-auto w-24 h-24 object-contain" />

          <div>
            <h1 className="text-lg font-bold text-white">
              {language === 'ar' ? 'اللجنة الطبية العسكرية' : 'Military Medical Committee'}
            </h1>
            <p className="text-xs text-[#C9A54C] font-semibold mt-1">
              {language === 'ar' ? 'قيادة الخدمات الطبية العسكرية' : 'Military Medical Services Command'}
            </p>
            <p className="text-gray-400 text-xs mt-1">
              {language === 'ar'
                ? 'المركز الطبي التخصصي العسكري - العطار'
                : 'Military Specialized Medical Center – Al-Attar'}
            </p>
          </div>
        </div>

        {/* Doctor Control Notice */}
        <Card className="bg-blue-900/20 border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-medium">
                  {language === 'ar' 
                    ? '⚕️ يتم التحكم في تدفق المرضى من قبل الأطباء'
                    : '⚕️ Patient flow is controlled by doctors'}
                </p>
                <p className="text-gray-400 text-sm">
                  {language === 'ar'
                    ? 'سيتم استدعاؤك تلقائياً عند حلول دورك'
                    : 'You will be called automatically when it is your turn'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Medical Route */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="text-center pb-3 pt-4">
            <CardTitle className="text-white text-xl sm:text-2xl font-bold">{t('yourMedicalRoute', language)}</CardTitle>
            <p className="text-gray-400 text-xs sm:text-sm mt-1">{t('exam', language)}: <span className="font-semibold text-white">{getExamName()}</span></p>
          </CardHeader>
          <CardContent className="space-y-3 px-3 sm:px-4 pb-4">
            {stations.map((station, index) => (
              <Card key={station.id} className={`bg-gray-700/50 border-gray-600 ${station.status === 'completed' ? 'opacity-70' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {station.status === 'ready' ? (
                        <Unlock className="icon icon-lg icon-success" />
                      ) : station.status === 'completed' ? (
                        <CheckCircle className="icon icon-lg text-green-400" />
                      ) : (
                        <Lock className="icon icon-lg icon-muted" />
                      )}
                      <div>
                        <h3 className="text-white text-base sm:text-lg font-bold">
                          {language === 'ar' ? station.nameAr : station.name}
                        </h3>
                        <p className="text-gray-300 text-sm sm:text-base">
                          {t('floor', language)}: {language === 'ar' ? station.floor : station.floorCode}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
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

                  {/* ZFD Ticket */}
                  {routeWithZFD?.route?.length > index && (
                    <div className="mb-4" data-test="zfd-ticket-section">
                      <ZFDTicketDisplay step={routeWithZFD.route[index]} />
                    </div>
                  )}

                  {/* Queue Info */}
                  {station.status !== 'completed' && (
                    <div className="grid grid-cols-3 gap-2 text-center px-2 py-3 bg-gray-800/30 rounded-xl" data-test="queue-info">
                      <div className="p-3 bg-gray-700/50 rounded-lg">
                        <div className="text-3xl font-bold text-white mb-1" data-test="current-number">
                          {typeof station.current === 'number' ? station.current : '0'}
                        </div>
                        <div className="text-gray-300 text-sm font-medium">{t('current', language)}</div>
                      </div>
                      <div className="p-3 bg-yellow-500/20 rounded-lg border-2 border-yellow-500/50">
                        <div className="text-3xl font-bold text-yellow-400 mb-1" data-test="your-number">
                          {typeof station.yourNumber === 'number' ? station.yourNumber : '-'}
                        </div>
                        <div className="text-yellow-200 text-sm font-medium">{t('yourNumber', language)}</div>
                      </div>
                      <div className="p-3 bg-gray-700/50 rounded-lg">
                        <div className="text-3xl font-bold text-white mb-1" data-test="ahead-count">
                          {station.ahead || 0}
                        </div>
                        <div className="text-gray-300 text-sm font-medium">{t('ahead', language)}</div>
                      </div>
                    </div>
                  )}

                  {/* ETA Countdown */}
                  {station.status === 'ready' && !station.isEntered && station.ahead > 0 && (
                    <div className="mt-3 p-4 bg-blue-500/10 border-2 border-blue-500/30 rounded-xl">
                      <div className="flex items-center justify-end gap-2 mb-2">
                        <span className="text-blue-300 text-sm font-medium">
                          {language === 'ar' ? 'وقت متبقي تقريبي' : 'Estimated wait time'}
                        </span>
                        <span className="text-3xl">🕒</span>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-400 mb-1">
                          {computeEtaMinutes(station.ahead, 2)} {language === 'ar' ? 'دقيقة' : 'minutes'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Your Turn Notice */}
                  {station.status === 'ready' && station.isEntered && station.ahead === 0 && (
                    <div className="mt-3 p-4 bg-green-500/10 border-2 border-green-500/30 rounded-xl">
                      <div className="flex items-center justify-center gap-3">
                        <span className="text-3xl">⏰</span>
                        <span className="text-green-300 text-xl font-bold">
                          {language === 'ar' ? 'دورك الآن!' : 'Your turn now!'}
                        </span>
                      </div>
                      <p className="text-center text-gray-400 text-sm mt-2">
                        {language === 'ar' 
                          ? 'يرجى الانتظار حتى يتم استدعاؤك من قبل الطبيب'
                          : 'Please wait to be called by the doctor'}
                      </p>
                    </div>
                  )}

                  {/* Enter Clinic Button */}
                  {station.status === 'ready' && !station.isEntered && (
                    <div className="mt-4 pt-4 border-t border-gray-600">
                      {(station.yourNumber > 0 && (
                        station.ahead === 0 || 
                        station.ahead === null || 
                        station.yourNumber === station.current ||
                        (station.current > 0 && station.yourNumber <= station.current)
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

                  {/* Doctor Control Notice (when entered) */}
                  {station.status === 'ready' && station.isEntered && (
                    <div className="mt-3 pt-3 border-t border-gray-600 space-y-2">
                      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-white font-medium text-sm">
                              {language === 'ar' 
                                ? '⚕️ يتم التحكم في إنهاء الفحص من قبل الطبيب'
                                : '⚕️ Examination completion is controlled by the doctor'}
                            </p>
                            <p className="text-gray-400 text-xs">
                              {language === 'ar'
                                ? 'سيتم تمريرك تلقائياً للعيادة التالية'
                                : 'You will be automatically moved to the next clinic'}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {station.exitTime && (
                        <div className="text-sm text-gray-400 flex items-center gap-2">
                          <Clock className="icon icon-sm icon-muted" />
                          <span>{language === 'ar' ? 'وقت الخروج:' : 'Exit time:'} {formatTime(new Date(station.exitTime))}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Floor Guide */}
                  {station.status === 'ready' && station.ahead > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-600">
                      <p className="text-gray-400 text-sm">
                        {language === 'ar'
                          ? `يمكنك الوصول عبر المصعد – اضغط ${station.floorCode}`
                          : `You can reach via elevator – press ${station.floorCode}`}
                      </p>
                    </div>
                  )}

                  {/* Note */}
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

        {/* Exit Button */}
        <div className="text-center">
          <Button variant="outline" onClick={onLogout} className="border-gray-600 text-gray-300">
            {t('exitSystem', language)}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default PatientPage;

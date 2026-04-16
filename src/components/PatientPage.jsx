/**
 * @fileoverview Patient Page Component - Doctor-Controlled Queue System
 * @description شاشة المسار الطبي للمراجع — تعرض الدور الحقيقي من Supabase مباشرة
 *              دون أي بيانات وهمية. كل المعلومات حية من unified_queue و patient_routes.
 *
 * الإصلاحات في هذا الإصدار:
 * ✅ استبدال api.createQueue() / api.getQueuePosition() / api.getRoute() المكسورة
 *    بـ Supabase مباشرة عبر enter_unified_queue_safe RPC
 * ✅ إزالة import computeEtaMinutes من lib/eta (ملف غير موجود) — استبدلت بحساب inline
 * ✅ Real-time subscription على unified_queue بدلاً من polling عبر backend
 * ✅ قراءة وحفظ المسار من patient_routes مباشرة
 * ✅ يظهر رقم الدور الحقيقي فوراً بعد الدخول
 *
 * @version 5.0.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import { Button } from './Button';
import { Lock, Unlock, Clock, Globe, LogIn, CheckCircle } from 'lucide-react';
import { examTypes, formatTime } from '../lib/utils';
import { getDynamicMedicalPathway } from '../lib/dynamic-pathways';
import { t } from '../lib/i18n';
import { ZFDBanner } from './ZFDTicketDisplay';
import NotificationSystem from './NotificationSystem';
import eventBus from '../core/event-bus';
import { supabase } from '../lib/supabase-client';

/**
 * حساب وقت الانتظار التقديري
 * @param {number} ahead  - عدد الأشخاص قبل المراجع
 * @param {number} avgMin - متوسط وقت الفحص بالدقائق
 * @returns {number} وقت تقديري بالدقائق
 */
const computeEtaMinutes = (ahead, avgMin = 3) => Math.max(0, (ahead ?? 0) * avgMin);

/**
 * جلب موقع مراجع في طابور عيادة معيّنة مباشرة من Supabase
 * @async
 * @param {string} clinicId  - معرف العيادة
 * @param {string} patientId - معرف المريض
 * @returns {Promise<{display_number,current_number,ahead,total_waiting,entered_at}|null>}
 */
async function fetchQueuePosition(clinicId, patientId) {
  const today = new Date().toISOString().split('T')[0];

  // 1) بيانات المراجع في هذه العيادة
  const { data: myRow } = await supabase
    .from('unified_queue')
    .select('id, display_number, status, entered_at')
    .eq('clinic_id',  clinicId)
    .eq('patient_id', patientId)
    .eq('queue_date', today)
    .neq('status', 'cancelled')
    .order('entered_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!myRow) return null;

  // 2) الرقم الحالي الذي يُخدَّم (serving/in_progress)
  const { data: servingRow } = await supabase
    .from('unified_queue')
    .select('display_number')
    .eq('clinic_id',  clinicId)
    .eq('queue_date', today)
    .in('status', ['serving', 'in_progress', 'called'])
    .order('display_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const currentNumber = servingRow?.display_number ?? 0;

  // 3) عدد من أمام المراجع (waiting بأرقام أصغر)
  const { count: ahead } = await supabase
    .from('unified_queue')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id',  clinicId)
    .eq('queue_date', today)
    .in('status', ['waiting', 'called'])
    .lt('display_number', myRow.display_number);

  // 4) إجمالي المنتظرين
  const { count: totalWaiting } = await supabase
    .from('unified_queue')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .eq('queue_date', today)
    .in('status', ['waiting', 'called']);

  return {
    id:              myRow.id,
    display_number:  myRow.display_number,
    current_number:  currentNumber,
    ahead:           ahead ?? 0,
    total_waiting:   totalWaiting ?? 0,
    entered_at:      myRow.entered_at,
    status:          myRow.status,
    success:         true,
  };
}

/**
 * PatientPage Component
 * @param {Object}   props.patientData    - بيانات المراجع
 * @param {Function} props.onLogout       - تسجيل الخروج
 * @param {string}   props.language       - ar | en
 * @param {Function} props.toggleLanguage - تبديل اللغة
 */
export function PatientPage({ patientData, onLogout, language, toggleLanguage }) {
  const [stations,      setStations]      = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [activeTicket,  setActiveTicket]  = useState(null);
  const [currentNotice, setCurrentNotice] = useState(null);
  const [directAlerts,  setDirectAlerts]  = useState([]);
  const channelRef = useRef(null);

  /** ─── دخول العيادة الأولى تلقائياً عند تحميل المسار ─────────────────── */
  const enterFirstClinic = useCallback(async (station) => {
    try {
      const result = await supabase.rpc('enter_unified_queue_safe', {
        p_clinic_id:    station.id,
        p_patient_id:   String(patientData.id || patientData.military_number || patientData.sessionId),
        p_patient_name: patientData.name || patientData.patient_name || null,
        p_exam_type:    patientData.examType || patientData.queueType || 'general',
        p_gender:       patientData.gender   || 'male',
        p_military_id:  String(patientData.military_number || patientData.militaryId || ''),
        p_personal_id:  String(patientData.id || patientData.personalId || ''),
        p_force:        false,
      });

      if (result.error) throw result.error;

      const data    = result.data;
      const success = data?.success;
      const status  = data?.status;

      // تعامل مع حالة التعارض
      if (!success && status === 'ALREADY_ACTIVE_IN_OTHER_CLINIC') {
        setCurrentNotice({
          type: 'error',
          message: language === 'ar'
            ? `أنت موجود في عيادة أخرى حالياً. يرجى إكمالها أولاً.`
            : `You are currently in another clinic. Please finish it first.`
        });
        setTimeout(() => setCurrentNotice(null), 6000);
        return;
      }

      if (success || data?.display_number) {
        const num = data.display_number ?? data.number;

        // جلب بيانات الموقع الكاملة
        const pos = await fetchQueuePosition(
          station.id,
          String(patientData.id || patientData.military_number || patientData.sessionId)
        );

        setStations(prev => prev.map((s, idx) => idx === 0 ? {
          ...s,
          queueId:      data.id,
          yourNumber:   pos?.display_number ?? num,
          current:      pos?.current_number ?? 0,
          ahead:        pos?.ahead         ?? 0,
          totalWaiting: pos?.total_waiting ?? 0,
          status:       'ready',
          isEntered:    false,
        } : s));

        setActiveTicket({ clinicId: station.id, ticket: pos?.display_number ?? num });

        // إظهار دليل الطابق
        if (station.floor) {
          setCurrentNotice({
            type:    'floor_guide',
            message: `📍 ${language === 'ar' ? 'يرجى التوجه إلى' : 'Please head to'} ${station.floor}`,
            clinic:  language === 'ar' ? station.nameAr : station.name,
          });
          setTimeout(() => setCurrentNotice(null), 6000);
        }
      }
    } catch (e) {
      console.error('[PatientPage] enterFirstClinic error:', e);
    }
  }, [patientData, language]);

  /** ─── دخول عيادة يدوياً (زر "دخول العيادة") ─────────────────────────── */
  const handleEnterClinic = useCallback(async (station) => {
    try {
      setLoading(true);
      const pid = String(patientData.id || patientData.military_number || patientData.sessionId);

      const result = await supabase.rpc('enter_unified_queue_safe', {
        p_clinic_id:    station.id,
        p_patient_id:   pid,
        p_patient_name: patientData.name || patientData.patient_name || null,
        p_exam_type:    patientData.examType || patientData.queueType || 'general',
        p_gender:       patientData.gender   || 'male',
        p_military_id:  String(patientData.military_number || patientData.militaryId || ''),
        p_personal_id:  String(patientData.id || patientData.personalId || ''),
        p_force:        false,
      });

      if (result.error) throw result.error;

      const data   = result.data;
      const status = data?.status;

      if (!data?.success && status === 'ALREADY_ACTIVE_IN_OTHER_CLINIC') {
        setCurrentNotice({
          type:    'error',
          message: language === 'ar'
            ? 'أنت موجود في عيادة أخرى. أكملها أولاً.'
            : 'You are in another clinic. Finish it first.'
        });
        setTimeout(() => setCurrentNotice(null), 5000);
        setLoading(false);
        return;
      }

      const pos = await fetchQueuePosition(station.id, pid);

      if (pos) {
        setActiveTicket({ clinicId: station.id, ticket: pos.display_number });
        setStations(prev => prev.map(s => s.id === station.id ? {
          ...s,
          yourNumber:   pos.display_number,
          current:      pos.current_number,
          ahead:        pos.ahead,
          totalWaiting: pos.total_waiting,
          status:       'ready',
          isEntered:    true,
          entered_at:   pos.entered_at,
        } : s));

        setCurrentNotice({
          type:    'success',
          message: language === 'ar'
            ? `✅ تم الدخول - رقمك ${pos.display_number}`
            : `✅ Entered - Your # ${pos.display_number}`,
        });
        setTimeout(() => setCurrentNotice(null), 4000);
      }
    } catch (e) {
      console.error('[PatientPage] handleEnterClinic error:', e);
      setCurrentNotice({
        type:    'error',
        message: language === 'ar' ? 'فشل الدخول للعيادة' : 'Failed to enter clinic',
      });
      setTimeout(() => setCurrentNotice(null), 5000);
    } finally {
      setLoading(false);
    }
  }, [patientData, language]);

  /** ─── تحميل المسار الطبي ────────────────────────────────────────────── */
  useEffect(() => {
    const loadPathway = async () => {
      const pid = String(patientData.id || patientData.military_number || patientData.sessionId);
      const examType = patientData.examType || patientData.queueType;
      const gender   = patientData.gender || 'male';

      try {
        let examStations = null;

        // 1) محاولة جلب مسار محفوظ من patient_routes
        try {
          const { data: savedRoute } = await supabase
            .from('patient_routes')
            .select('stations, current_station_index, status')
            .eq('patient_id', pid)
            .eq('exam_type',  examType)
            .eq('status',     'in_progress')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (savedRoute?.stations && Array.isArray(savedRoute.stations) && savedRoute.stations.length > 0) {
            examStations = savedRoute.stations;
          }
        } catch (err) {
          console.log('[PatientPage] No saved route, computing new one.');
        }

        // 2) حساب مسار جديد إذا لم يكن محفوظ
        if (!examStations || examStations.length === 0) {
          examStations = await getDynamicMedicalPathway(examType, gender);

          if (examStations && examStations.length > 0) {
            // حفظ المسار في patient_routes
            try {
              await supabase.from('patient_routes').upsert({
                patient_id:            pid,
                exam_type:             examType,
                gender:                gender,
                stations:              examStations,
                current_station_index: 0,
                status:                'in_progress',
                updated_at:            new Date().toISOString(),
              }, { onConflict: 'patient_id,exam_type' });
            } catch (saveErr) {
              console.log('[PatientPage] Failed to save route:', saveErr);
            }
          }
        }

        if (!examStations || examStations.length === 0) return;

        // 3) ترتيب العيادات حسب عدد المنتظرين (الأقل حمولة أولاً)
        let sortedStations = [...examStations];
        try {
          const today = new Date().toISOString().split('T')[0];
          const clinicIds = examStations.map(s => s.id);
          const { data: counts } = await supabase
            .from('unified_queue')
            .select('clinic_id')
            .in('clinic_id', clinicIds)
            .eq('queue_date', today)
            .in('status', ['waiting', 'called']);

          const countMap = {};
          (counts || []).forEach(r => {
            countMap[r.clinic_id] = (countMap[r.clinic_id] || 0) + 1;
          });

          sortedStations = [...examStations].sort(
            (a, b) => (countMap[a.id] || 0) - (countMap[b.id] || 0)
          );
        } catch { /* ترتيب افتراضي */ }

        // 4) تهيئة حالة المحطات
        const initialStations = sortedStations.map((station, index) => ({
          ...station,
          status:       index === 0 ? 'ready' : 'locked',
          current:      null,
          yourNumber:   null,
          ahead:        null,
          totalWaiting: null,
          isEntered:    false,
        }));

        setStations(initialStations);

        // 5) الدخول التلقائي للعيادة الأولى
        await enterFirstClinic(sortedStations[0]);

      } catch (err) {
        console.error('[PatientPage] loadPathway error:', err);
      }
    };

    if (patientData) loadPathway();
  }, [
    patientData?.id, patientData?.military_number, patientData?.sessionId,
    patientData?.examType, patientData?.queueType, patientData?.gender,
    enterFirstClinic
  ]);

  /** ─── Real-time: مراقبة unified_queue وتحديث الأرقام لحظياً ──────────── */
  useEffect(() => {
    if (!stations.length) return;

    const pid = String(patientData?.id || patientData?.military_number || patientData?.sessionId || '');
    if (!pid) return;

    // تنظيف القناة السابقة
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // الاشتراك على جميع تغييرات unified_queue لليوم
    const today = new Date().toISOString().split('T')[0];
    const activeStation = stations.find(s => s.status === 'ready');
    if (!activeStation) return;

    const channel = supabase
      .channel(`patient_queue_${pid}_${activeStation.id}`)
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'unified_queue',
        filter: `clinic_id=eq.${activeStation.id}`,
      }, async () => {
        // إعادة جلب موقع المراجع عند أي تغيير في العيادة النشطة
        try {
          const pos = await fetchQueuePosition(activeStation.id, pid);
          if (!pos) return;

          setStations(prev => prev.map(s => {
            if (s.id !== activeStation.id) return s;

            // التحقق من تحريك المسار (status='done' يعني الطبيب أنهى الفحص)
            if (pos.status === 'done' || pos.status === 'completed') {
              return { ...s, status: 'completed', yourNumber: pos.display_number };
            }

            const prevAhead = s.ahead;
            const newAhead  = pos.ahead;

            // إشعار عند اقتراب الدور
            if (prevAhead !== newAhead && newAhead <= 2 && newAhead !== null) {
              const msgs = {
                0: language === 'ar' ? '🔔 دورك الآن! توجه للطبيب' : '🔔 Your turn now!',
                1: language === 'ar' ? '⚠️ أنت التالي — استعد'    : '⚠️ You are next — get ready',
                2: language === 'ar' ? 'ℹ️ شخصان أمامك'           : 'ℹ️ 2 persons ahead',
              };
              if (msgs[newAhead]) {
                setCurrentNotice({ type: 'queue_update', message: msgs[newAhead] });
                setTimeout(() => setCurrentNotice(null), 10000);
                if (newAhead === 0) {
                  eventBus.emit('queue:your_turn', { clinicName: s.nameAr, position: 0 });
                  try { new Audio('/notification.mp3').play().catch(() => {}); } catch {}
                }
              }
            }

            return {
              ...s,
              yourNumber:   pos.display_number,
              current:      pos.current_number,
              ahead:        pos.ahead,
              totalWaiting: pos.total_waiting,
            };
          }));

          // إذا اكتملت المحطة النشطة، افتح المحطة التالية
          if (pos.status === 'done' || pos.status === 'completed') {
            setStations(prev => {
              const idx = prev.findIndex(s => s.id === activeStation.id);
              if (idx === -1 || idx + 1 >= prev.length) return prev;
              return prev.map((s, i) => {
                if (i === idx)     return { ...s, status: 'completed' };
                if (i === idx + 1) return { ...s, status: 'ready' };
                return s;
              });
            });
          }
        } catch (e) {
          console.error('[PatientPage] realtime update error:', e);
        }
      })
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [stations.length, patientData?.id, patientData?.military_number, language]);

  /** ─── تنبيهات مباشرة من الإدارة ─────────────────────────────────────── */
  useEffect(() => {
    const patientId = String(patientData?.military_number || patientData?.id || '');
    if (!patientId) return;

    const fetchAlerts = async () => {
      const { data } = await supabase
        .from('direct_alerts')
        .select('*')
        .eq('patient_id', patientId)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
      if (data?.length > 0) setDirectAlerts(data);
    };

    fetchAlerts();

    const ch = supabase
      .channel(`alerts_${patientId}`)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'direct_alerts',
        filter: `patient_id=eq.${patientId}`,
      }, (payload) => {
        const a = payload.new;
        if (a.is_active && new Date(a.expires_at) > new Date()) {
          setDirectAlerts(prev => [a, ...prev]);
          if (a.sound_enabled) {
            try { new Audio('/notification.mp3').play().catch(() => {}); } catch {}
          }
        }
      })
      .subscribe();

    return () => supabase.removeChannel(ch);
  }, [patientData?.military_number, patientData?.id]);

  const dismissAlert = async (id) => {
    await supabase.from('direct_alerts').update({ read_at: new Date().toISOString() }).eq('id', id);
    setDirectAlerts(prev => prev.filter(a => a.id !== id));
  };

  const getExamName = () => {
    const exam = examTypes.find(e => e.id === patientData?.queueType);
    if (!exam) return language === 'ar' ? 'فحص طبي' : 'Medical Exam';
    return language === 'ar' ? exam.nameAr : exam.name;
  };

  const allDone = stations.length > 0 && stations.every(s => s.status === 'completed');

  // ── شاشة الاكتمال ──────────────────────────────────────────────────────
  if (allDone) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <div className="max-w-2xl mx-auto space-y-6 text-center">
          <img src="/mms-logo.png" alt="اللجنة الطبية العسكرية" className="mx-auto w-24 h-24 object-contain" />
          <div className="text-green-400">
            <svg className="w-24 h-24 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <Card className="bg-gradient-to-br from-green-900/30 to-blue-900/30 border-green-500/30">
            <CardContent className="p-8 space-y-6">
              <h1 className="text-4xl font-bold text-white">
                {language === 'ar' ? '✅ تم إنهاء الفحص الطبي' : '✅ Medical Examination Completed'}
              </h1>
              <p className="text-gray-300">
                {language === 'ar'
                  ? 'تهانينا! يرجى التوجه إلى استقبال اللجنة الطبية'
                  : 'Congratulations! Please proceed to the Medical Committee Reception'}
              </p>
              <Button variant="default" size="lg" onClick={onLogout}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                {language === 'ar' ? '🏠 العودة للرئيسية' : '🏠 Return to Home'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── الصفحة الرئيسية ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen px-3 py-4 overflow-x-hidden overflow-y-auto">

      {/* إشعار أعلى الصفحة */}
      {currentNotice && (
        <ZFDBanner notice={currentNotice} onDismiss={() => setCurrentNotice(null)} />
      )}

      {/* تنبيهات الإدارة */}
      {directAlerts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
          {directAlerts.slice(0, 3).map(alert => (
            <div key={alert.id} className={`flex items-start gap-3 p-4 rounded-2xl shadow-2xl border backdrop-blur-sm ${
              alert.alert_type === 'urgent'  ? 'bg-red-900/90 border-red-500/50'    :
              alert.alert_type === 'warning' ? 'bg-yellow-900/90 border-yellow-500/50' :
              'bg-[#1a0a12]/90 border-[#C9A54C]/50'
            }`}>
              <div className="flex-1">
                <p className="text-sm font-medium text-white leading-relaxed">
                  {language === 'ar' ? alert.message : (alert.message_en || alert.message)}
                </p>
              </div>
              <button onClick={() => dismissAlert(alert.id)} className="text-white/60 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <NotificationSystem
        patientId={patientData?.id}
        currentClinic={stations.find(s => s.status === 'ready')}
        yourNumber={stations.find(s => s.status === 'ready')?.yourNumber}
        currentServing={stations.find(s => s.status === 'ready')?.current}
        allStationsCompleted={allDone}
        language={language}
      />

      <div className="w-full max-w-2xl mx-auto space-y-5 px-2 sm:px-4">

        {/* زر اللغة */}
        <div className="absolute top-4 left-4">
          <Button variant="ghost" size="sm"
            className="text-gray-300 hover:text-white hover:bg-gray-800/50"
            onClick={toggleLanguage}>
            <Globe className="w-4 h-4 me-2" />
            {language === 'ar' ? 'English 🇺🇸' : 'العربية 🇶🇦'}
          </Button>
        </div>

        {/* Header */}
        <div className="text-center space-y-1">
          <img src="/mms-logo.png" alt="اللجنة الطبية العسكرية"
            className="mx-auto w-24 h-24 object-contain" />
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

        {/* إشعار التحكم بالأطباء */}
        <Card className="bg-blue-900/20 border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
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

        {/* المسار الطبي */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="text-center pb-3 pt-4">
            <CardTitle className="text-white text-xl sm:text-2xl font-bold">
              {t('yourMedicalRoute', language)}
            </CardTitle>
            <p className="text-gray-400 text-xs sm:text-sm mt-1">
              {t('exam', language)}: <span className="font-semibold text-white">{getExamName()}</span>
            </p>
          </CardHeader>
          <CardContent className="space-y-3 px-3 sm:px-4 pb-4">
            {stations.map((station, index) => (
              <Card key={station.id}
                className={`bg-gray-700/50 border-gray-600 ${station.status === 'completed' ? 'opacity-70' : ''}`}>
                <CardContent className="p-4">

                  {/* رأس المحطة */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {station.status === 'ready' ? (
                        <Unlock className="w-5 h-5 text-green-400" />
                      ) : station.status === 'completed' ? (
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      ) : (
                        <Lock className="w-5 h-5 text-gray-400" />
                      )}
                      <div>
                        <h3 className="text-white text-base sm:text-lg font-bold">
                          {language === 'ar' ? station.nameAr : station.name}
                        </h3>
                        <p className="text-gray-300 text-sm">
                          {t('floor', language)}: {language === 'ar' ? station.floor : station.floorCode}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      station.status === 'ready'     ? 'bg-green-500/20 text-green-400' :
                      station.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {station.status === 'ready'
                        ? t('ready', language)
                        : station.status === 'completed'
                        ? (language === 'ar' ? 'مكتمل ✓' : 'Completed ✓')
                        : t('locked', language)}
                    </span>
                  </div>

                  {/* معلومات الطابور — مرئية فقط لمحطة غير مكتملة */}
                  {station.status !== 'completed' && (
                    <div className="grid grid-cols-3 gap-2 text-center px-2 py-3 bg-gray-800/30 rounded-xl">
                      <div className="p-3 bg-gray-700/50 rounded-lg">
                        <div className="text-3xl font-bold text-white mb-1">
                          {station.current ?? '—'}
                        </div>
                        <div className="text-gray-300 text-sm font-medium">{t('current', language)}</div>
                      </div>
                      <div className="p-3 bg-yellow-500/20 rounded-lg border-2 border-yellow-500/50">
                        <div className="text-3xl font-bold text-yellow-400 mb-1">
                          {station.yourNumber ?? '—'}
                        </div>
                        <div className="text-yellow-200 text-sm font-medium">{t('yourNumber', language)}</div>
                      </div>
                      <div className="p-3 bg-gray-700/50 rounded-lg">
                        <div className="text-3xl font-bold text-white mb-1">
                          {station.ahead ?? '—'}
                        </div>
                        <div className="text-gray-300 text-sm font-medium">{t('ahead', language)}</div>
                      </div>
                    </div>
                  )}

                  {/* وقت انتظار تقديري */}
                  {station.status === 'ready' && !station.isEntered && (station.ahead ?? 0) > 0 && (
                    <div className="mt-3 p-4 bg-blue-500/10 border-2 border-blue-500/30 rounded-xl">
                      <div className="flex items-center justify-end gap-2 mb-2">
                        <span className="text-blue-300 text-sm font-medium">
                          {language === 'ar' ? 'وقت متبقي تقريبي' : 'Estimated wait time'}
                        </span>
                        <span className="text-3xl">🕒</span>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-400">
                          {computeEtaMinutes(station.ahead, 3)} {language === 'ar' ? 'دقيقة' : 'min'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* "دورك الآن" */}
                  {station.status === 'ready' && station.isEntered && (station.ahead ?? 0) === 0 && (
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

                  {/* زر دخول العيادة */}
                  {station.status === 'ready' && !station.isEntered && (
                    <div className="mt-4 pt-4 border-t border-gray-600">
                      {station.yourNumber && (
                        (station.ahead === 0 || station.ahead === null ||
                         station.yourNumber <= (station.current ?? 0))
                      ) ? (
                        <Button
                          variant="gradientPrimary"
                          onClick={() => handleEnterClinic(station)}
                          disabled={loading}
                          className="w-full"
                        >
                          <LogIn className="w-4 h-4 me-2" />
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
                                ? `رقمك ${station.yourNumber ?? '—'} — أمامك ${station.ahead ?? '—'} شخص`
                                : `Your # ${station.yourNumber ?? '—'} — ${station.ahead ?? '—'} ahead`}
                            </p>
                          </div>
                          <Button variant="outline" disabled
                            className="w-full opacity-50 cursor-not-allowed border-gray-600">
                            <Lock className="w-4 h-4 me-2" />
                            {language === 'ar' ? 'الدخول غير متاح حالياً' : 'Entry not available yet'}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* إشعار داخل العيادة */}
                  {station.status === 'ready' && station.isEntered && (
                    <div className="mt-3 pt-3 border-t border-gray-600">
                      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-white font-medium text-sm">
                              {language === 'ar'
                                ? '✅ تم الدخول - انتظر مناداتك من الطبيب'
                                : '✅ Entered - Wait to be called by the doctor'}
                            </p>
                            <p className="text-gray-400 text-xs">
                              {language === 'ar'
                                ? 'سيتم تمريرك تلقائياً للعيادة التالية'
                                : 'You will be automatically moved to the next clinic'}
                            </p>
                          </div>
                        </div>
                      </div>
                      {station.entered_at && (
                        <div className="text-sm text-gray-400 flex items-center gap-2 mt-2">
                          <Clock className="w-3 h-3" />
                          <span>
                            {language === 'ar' ? 'وقت الدخول:' : 'Entry time:'}
                            {' '}{formatTime(new Date(station.entered_at))}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* دليل الطابق */}
                  {station.status === 'ready' && (station.ahead ?? 0) > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-600">
                      <p className="text-gray-400 text-sm">
                        {language === 'ar'
                          ? `يمكنك الوصول عبر المصعد – اضغط ${station.floorCode}`
                          : `You can reach via elevator – press ${station.floorCode}`}
                      </p>
                    </div>
                  )}

                </CardContent>
              </Card>
            ))}

            {stations.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <div className="w-12 h-12 border-4 border-[#C9A54C] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p>{language === 'ar' ? 'جارٍ تحميل المسار الطبي...' : 'Loading medical pathway...'}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* زر الخروج */}
        <div className="text-center pb-6">
          <Button variant="outline" onClick={onLogout} className="border-gray-600 text-gray-300">
            {t('exitSystem', language)}
          </Button>
        </div>

      </div>
    </div>
  );
}

export default PatientPage;

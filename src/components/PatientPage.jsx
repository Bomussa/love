/**
 * @file PatientPage.jsx
 * @description شاشة المسار الطبي للمراجع
 * الإصلاحات:
 * ✅ استبدال api.js (endpoints غير موجودة) بـ Supabase مباشرة
 * ✅ إزالة import lib/eta المفقود - computeEtaMinutes inline
 * ✅ إصلاح gender: يُقرأ من patientData.gender الممرر من LoginPage
 * ✅ Real-time subscription على unified_queue لتحديث الرقم فورياً
 * ✅ enter_unified_queue_safe RPC لتسجيل المراجع والحصول على رقم فوري
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

/** حساب وقت الانتظار التقديري بالدقائق */
const computeEtaMinutes = (ahead, avg = 3) => Math.max(0, (ahead ?? 0) * avg);

/**
 * جلب موقع المراجع في الطابور مباشرة من Supabase
 * @returns {{ display_number, current_number, ahead, total_waiting, status } | null}
 */
async function fetchQueuePosition(clinicId, patientId) {
  const today = new Date().toISOString().split('T')[0];

  const { data: myRow } = await supabase
    .from('unified_queue')
    .select('id, display_number, status, entered_at')
    .eq('clinic_id',  clinicId)
    .eq('patient_id', patientId)
    .eq('queue_date', today)
    .not('status', 'eq', 'cancelled')
    .order('entered_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!myRow) return null;

  const { data: serving } = await supabase
    .from('unified_queue')
    .select('display_number')
    .eq('clinic_id',  clinicId)
    .eq('queue_date', today)
    .in('status', ['serving','in_progress','called'])
    .order('display_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count: ahead } = await supabase
    .from('unified_queue')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id',  clinicId)
    .eq('queue_date', today)
    .in('status', ['waiting','called'])
    .lt('display_number', myRow.display_number);

  const { count: totalWaiting } = await supabase
    .from('unified_queue')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .eq('queue_date', today)
    .in('status', ['waiting','called']);

  return {
    id:             myRow.id,
    display_number: myRow.display_number,
    current_number: serving?.display_number ?? 0,
    ahead:          ahead ?? 0,
    total_waiting:  totalWaiting ?? 0,
    entered_at:     myRow.entered_at,
    status:         myRow.status,
    success:        true,
  };
}

export function PatientPage({ patientData, onLogout, language, toggleLanguage }) {
  const [stations,      setStations]      = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [activeTicket,  setActiveTicket]  = useState(null);
  const [currentNotice, setCurrentNotice] = useState(null);
  const [directAlerts,  setDirectAlerts]  = useState([]);
  const channelRef = useRef(null);

  // معرف المريض الموحد
  const pid = String(
    patientData?.id || patientData?.patientId ||
    patientData?.military_number || patientData?.militaryId || ''
  );

  // ── الدخول التلقائي للعيادة الأولى ────────────────────────────────────
  const enterFirstClinic = useCallback(async (station) => {
    if (!pid) return;
    try {
      const { data, error } = await supabase.rpc('enter_unified_queue_safe', {
        p_clinic_id:    station.id,
        p_patient_id:   pid,
        p_patient_name: patientData?.name || patientData?.patient_name || pid,
        p_exam_type:    patientData?.examType || patientData?.queueType || 'general',
        p_gender:       patientData?.gender || 'male',
        p_military_id:  String(patientData?.military_number || patientData?.militaryId || pid),
        p_personal_id:  pid,
        p_force:        false,
      });
      if (error) { console.error('[PP] enterFirst:', error.message); return; }

      const rpcData = data;
      if (!rpcData?.success && rpcData?.status === 'ALREADY_ACTIVE_IN_OTHER_CLINIC') {
        setCurrentNotice({ type:'info', message: language === 'ar'
          ? 'أنت في عيادة أخرى نشطة. أكملها أولاً.' : 'You are active in another clinic. Finish it first.' });
        setTimeout(() => setCurrentNotice(null), 6000);
        return;
      }

      const pos = await fetchQueuePosition(station.id, pid);
      if (pos) {
        setStations(prev => prev.map((s, idx) => idx === 0 ? {
          ...s,
          queueId:      rpcData?.id || pos.id,
          yourNumber:   pos.display_number,
          current:      pos.current_number,
          ahead:        pos.ahead,
          totalWaiting: pos.total_waiting,
          status:       'ready',
          isEntered:    false,
        } : s));
        setActiveTicket({ clinicId: station.id, ticket: pos.display_number });
        if (station.floor) {
          setCurrentNotice({ type:'floor_guide',
            message: `📍 ${language === 'ar' ? 'يرجى التوجه إلى' : 'Head to'} ${station.floor}`,
            clinic: language === 'ar' ? station.nameAr : station.name });
          setTimeout(() => setCurrentNotice(null), 7000);
        }
      }
    } catch (e) { console.error('[PP] enterFirst error:', e); }
  }, [patientData, pid, language]);

  // ── دخول عيادة يدوي (زر "دخول") ──────────────────────────────────────
  const handleEnterClinic = useCallback(async (station) => {
    if (!pid) return;
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('enter_unified_queue_safe', {
        p_clinic_id:    station.id,
        p_patient_id:   pid,
        p_patient_name: patientData?.name || pid,
        p_exam_type:    patientData?.examType || patientData?.queueType || 'general',
        p_gender:       patientData?.gender || 'male',
        p_military_id:  String(patientData?.military_number || pid),
        p_personal_id:  pid,
        p_force:        false,
      });
      if (error) throw error;
      if (!data?.success && data?.status === 'ALREADY_ACTIVE_IN_OTHER_CLINIC') {
        setCurrentNotice({ type:'error', message: language === 'ar'
          ? 'أنت موجود في عيادة أخرى. أكملها أولاً.' : 'You are in another clinic. Finish it first.' });
        setTimeout(() => setCurrentNotice(null), 5000);
        setLoading(false);
        return;
      }
      const pos = await fetchQueuePosition(station.id, pid);
      if (pos) {
        setActiveTicket({ clinicId: station.id, ticket: pos.display_number });
        setStations(prev => prev.map(s => s.id === station.id ? {
          ...s,
          yourNumber: pos.display_number,
          current:    pos.current_number,
          ahead:      pos.ahead,
          status:     'ready',
          isEntered:  true,
          entered_at: pos.entered_at,
        } : s));
        setCurrentNotice({ type:'success', message: language === 'ar'
          ? `✅ رقمك: ${pos.display_number}` : `✅ Your number: ${pos.display_number}` });
        setTimeout(() => setCurrentNotice(null), 4000);
      }
    } catch (e) {
      setCurrentNotice({ type:'error', message: language === 'ar' ? 'فشل الدخول' : 'Entry failed' });
      setTimeout(() => setCurrentNotice(null), 5000);
    } finally { setLoading(false); }
  }, [patientData, pid, language]);

  // ── تحميل المسار الطبي ────────────────────────────────────────────────
  useEffect(() => {
    if (!pid) return;
    const loadPathway = async () => {
      const examType = patientData?.examType || patientData?.queueType;
      const gender   = patientData?.gender || 'male';

      // 1. محاولة قراءة مسار محفوظ من patient_routes
      let examStations = null;
      try {
        const { data: savedRoute } = await supabase
          .from('patient_routes')
          .select('stations, current_station_index, status')
          .eq('patient_id', pid)
          .eq('status', 'in_progress')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (savedRoute?.stations?.length > 0) {
          examStations = savedRoute.stations;
        }
      } catch {}

      // 2. حساب مسار جديد
      if (!examStations?.length) {
        examStations = await getDynamicMedicalPathway(examType, gender);
        if (examStations?.length > 0) {
          try {
            await supabase.from('patient_routes').upsert({
              patient_id: pid, exam_type: examType, gender,
              stations: examStations, current_station_index: 0, status: 'in_progress',
              updated_at: new Date().toISOString()
            }, { onConflict: 'patient_id,exam_type' });
          } catch {}
        }
      }
      if (!examStations?.length) return;

      // 3. ترتيب حسب عدد المنتظرين
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data: counts } = await supabase
          .from('unified_queue')
          .select('clinic_id')
          .in('clinic_id', examStations.map(s => s.id))
          .eq('queue_date', today)
          .in('status', ['waiting','called']);
        const cmap = {};
        (counts || []).forEach(r => { cmap[r.clinic_id] = (cmap[r.clinic_id] || 0) + 1; });
        examStations = [...examStations].sort((a, b) => (cmap[a.id] || 0) - (cmap[b.id] || 0));
      } catch {}

      const init = examStations.map((s, i) => ({
        ...s, status: i === 0 ? 'ready' : 'locked',
        current: null, yourNumber: null, ahead: null, isEntered: false
      }));
      setStations(init);
      await enterFirstClinic(examStations[0]);
    };
    loadPathway();
  }, [pid, patientData?.examType, patientData?.queueType, patientData?.gender, enterFirstClinic]);

  // ── Real-time: تحديث الأرقام لحظياً ──────────────────────────────────
  useEffect(() => {
    if (!stations.length || !pid) return;
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    const active = stations.find(s => s.status === 'ready');
    if (!active) return;

    const ch = supabase.channel(`pp_${pid}_${active.id}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'unified_queue',
        filter:`clinic_id=eq.${active.id}` }, async () => {
        try {
          const pos = await fetchQueuePosition(active.id, pid);
          if (!pos) return;
          if (pos.status === 'done' || pos.status === 'completed') {
            setStations(prev => {
              const idx = prev.findIndex(s => s.id === active.id);
              return prev.map((s, i) => {
                if (i === idx)     return { ...s, status:'completed' };
                if (i === idx + 1) return { ...s, status:'ready' };
                return s;
              });
            });
            return;
          }
          setStations(prev => prev.map(s => {
            if (s.id !== active.id) return s;
            const newAhead = pos.ahead;
            if (s.ahead !== newAhead && newAhead <= 2 && newAhead !== null) {
              const msgs = {
                0: language==='ar' ? '🔔 دورك الآن! توجه للطبيب' : '🔔 Your turn!',
                1: language==='ar' ? '⚠️ أنت التالي' : '⚠️ You are next',
                2: language==='ar' ? 'ℹ️ شخصان أمامك' : 'ℹ️ 2 ahead'
              };
              if (msgs[newAhead]) {
                setCurrentNotice({ type:'queue_update', message: msgs[newAhead] });
                setTimeout(() => setCurrentNotice(null), 10000);
                if (newAhead === 0) {
                  eventBus.emit('queue:your_turn', { clinicName: s.nameAr });
                  try { new Audio('/notification.mp3').play().catch(()=>{}); } catch {}
                }
              }
            }
            return { ...s, yourNumber: pos.display_number, current: pos.current_number,
              ahead: pos.ahead, totalWaiting: pos.total_waiting };
          }));
        } catch {}
      }).subscribe();
    channelRef.current = ch;
    return () => { if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; } };
  }, [stations.length, pid, language]);

  // ── تنبيهات مباشرة ────────────────────────────────────────────────────
  useEffect(() => {
    const alertId = String(patientData?.military_number || patientData?.id || '');
    if (!alertId) return;
    supabase.from('direct_alerts').select('*')
      .eq('patient_id', alertId).eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .then(({ data }) => { if (data?.length) setDirectAlerts(data); });
    const ch = supabase.channel(`alerts_${alertId}`)
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'direct_alerts',
        filter:`patient_id=eq.${alertId}` }, (p) => {
        const a = p.new;
        if (a.is_active && new Date(a.expires_at) > new Date()) setDirectAlerts(prev => [a,...prev]);
      }).subscribe();
    return () => supabase.removeChannel(ch);
  }, [patientData?.military_number, patientData?.id]);

  const dismissAlert = async (id) => {
    await supabase.from('direct_alerts').update({ read_at: new Date().toISOString() }).eq('id', id);
    setDirectAlerts(prev => prev.filter(a => a.id !== id));
  };

  const getExamName = () => {
    const e = examTypes.find(x => x.id === patientData?.queueType);
    if (!e) return language === 'ar' ? 'فحص طبي' : 'Medical Exam';
    return language === 'ar' ? e.nameAr : e.name;
  };

  const allDone = stations.length > 0 && stations.every(s => s.status === 'completed');

  // ── شاشة الاكتمال ─────────────────────────────────────────────────────
  if (allDone) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <div className="max-w-lg mx-auto text-center space-y-6">
          <img src="/mms-logo.png" alt="MMC" className="mx-auto w-24 h-24 object-contain" />
          <div className="text-green-400">
            <svg className="w-20 h-20 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <Card className="bg-gradient-to-br from-green-900/30 to-blue-900/30 border-green-500/30">
            <CardContent className="p-8 space-y-4">
              <h1 className="text-3xl font-black text-white">
                {language === 'ar' ? '✅ تم إنهاء الفحص الطبي' : '✅ Medical Exam Completed'}
              </h1>
              <p className="text-gray-300">
                {language === 'ar' ? 'يرجى التوجه إلى استقبال اللجنة الطبية' : 'Please go to the Medical Committee Reception'}
              </p>
              <Button variant="default" size="lg" onClick={onLogout}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                {language === 'ar' ? '🏠 العودة للرئيسية' : '🏠 Return Home'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── الصفحة الرئيسية ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen px-3 py-4 overflow-x-hidden overflow-y-auto">

      {currentNotice && <ZFDBanner notice={currentNotice} onDismiss={() => setCurrentNotice(null)} />}

      {/* تنبيهات الإدارة */}
      {directAlerts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
          {directAlerts.slice(0, 3).map(alert => (
            <div key={alert.id} className={`flex items-start gap-3 p-4 rounded-2xl shadow-2xl border ${
              alert.alert_type === 'urgent'  ? 'bg-red-900/90 border-red-500/50' :
              alert.alert_type === 'warning' ? 'bg-yellow-900/90 border-yellow-500/50' :
              'bg-[#1a0a12]/90 border-[#C9A54C]/50'
            }`}>
              <p className="flex-1 text-sm font-medium text-white leading-relaxed">
                {language === 'ar' ? alert.message : (alert.message_en || alert.message)}
              </p>
              <button onClick={() => dismissAlert(alert.id)} className="text-white/60 hover:text-white">✕</button>
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
          <Button variant="ghost" size="sm" className="text-gray-300 hover:text-white hover:bg-gray-800/50" onClick={toggleLanguage}>
            <Globe className="w-4 h-4 me-2" />
            {language === 'ar' ? 'English 🇺🇸' : 'العربية 🇶🇦'}
          </Button>
        </div>

        {/* Header */}
        <div className="text-center space-y-1 pt-2">
          <img src="/mms-logo.png" alt="MMC" className="mx-auto w-24 h-24 object-contain" />
          <h1 className="text-lg font-bold text-white">
            {language === 'ar' ? 'اللجنة الطبية العسكرية' : 'Military Medical Committee'}
          </h1>
          <p className="text-xs text-[#C9A54C] font-semibold">
            {language === 'ar' ? 'قيادة الخدمات الطبية العسكرية' : 'Military Medical Services Command'}
          </p>
        </div>

        {/* بطاقة التحكم بالطبيب */}
        <Card className="bg-blue-900/20 border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xl">⚕️</div>
              <div>
                <p className="text-white font-medium text-sm">
                  {language === 'ar' ? 'يتم التحكم في تدفق المرضى من قبل الأطباء' : 'Patient flow controlled by doctors'}
                </p>
                <p className="text-gray-400 text-xs">
                  {language === 'ar' ? 'سيتم استدعاؤك تلقائياً عند حلول دورك' : 'You will be called automatically'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* المسار الطبي */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="text-center pb-3 pt-4">
            <CardTitle className="text-white text-xl font-bold">
              {t('yourMedicalRoute', language)}
            </CardTitle>
            <p className="text-gray-400 text-xs mt-1">
              {t('exam', language)}: <span className="text-white font-semibold">{getExamName()}</span>
              {patientData?.gender && (
                <span className="mr-2 ml-2 text-[#C9A54C]">
                  {language === 'ar'
                    ? (patientData.gender === 'male' ? '👨 ذكر' : '👩 أنثى')
                    : (patientData.gender === 'male' ? '👨 Male' : '👩 Female')}
                </span>
              )}
            </p>
          </CardHeader>

          <CardContent className="space-y-3 px-3 pb-4">
            {stations.map((station) => (
              <Card key={station.id} className={`bg-gray-700/50 border-gray-600 ${station.status === 'completed' ? 'opacity-70' : ''}`}>
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
                        <h3 className="text-white font-bold text-base">
                          {language === 'ar' ? station.nameAr : station.name}
                        </h3>
                        <p className="text-gray-400 text-xs">
                          {t('floor', language)}: {language === 'ar' ? station.floor : station.floorCode}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      station.status === 'ready'     ? 'bg-green-500/20 text-green-400' :
                      station.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {station.status === 'ready'     ? t('ready', language) :
                       station.status === 'completed' ? (language === 'ar' ? 'مكتمل ✓' : 'Done ✓') :
                       t('locked', language)}
                    </span>
                  </div>

                  {/* أرقام الطابور - تُعرض فقط لمحطة غير مكتملة */}
                  {station.status !== 'completed' && (
                    <div className="grid grid-cols-3 gap-2 text-center py-3 bg-gray-800/40 rounded-xl">
                      {/* الرقم الحالي */}
                      <div className="p-3 bg-gray-700/60 rounded-lg">
                        <div className="text-3xl font-black text-white mb-1">
                          {station.current !== null && station.current !== undefined ? station.current : '—'}
                        </div>
                        <div className="text-gray-400 text-xs font-medium">{t('current', language)}</div>
                      </div>
                      {/* رقمك */}
                      <div className="p-3 bg-yellow-500/20 rounded-lg border-2 border-yellow-500/50">
                        <div className="text-3xl font-black text-yellow-400 mb-1">
                          {station.yourNumber !== null && station.yourNumber !== undefined ? station.yourNumber : '—'}
                        </div>
                        <div className="text-yellow-200 text-xs font-medium">{t('yourNumber', language)}</div>
                      </div>
                      {/* أمامك */}
                      <div className="p-3 bg-gray-700/60 rounded-lg">
                        <div className="text-3xl font-black text-white mb-1">
                          {station.ahead !== null && station.ahead !== undefined ? station.ahead : '—'}
                        </div>
                        <div className="text-gray-400 text-xs font-medium">{t('ahead', language)}</div>
                      </div>
                    </div>
                  )}

                  {/* وقت انتظار تقديري */}
                  {station.status === 'ready' && !station.isEntered && (station.ahead ?? 0) > 0 && (
                    <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center justify-between">
                      <span className="text-blue-300 text-sm">
                        {language === 'ar' ? 'وقت متبقي تقريبي' : 'Est. wait'}
                      </span>
                      <span className="text-blue-400 font-bold">
                        {computeEtaMinutes(station.ahead, 3)} {language === 'ar' ? 'دقيقة' : 'min'}
                      </span>
                    </div>
                  )}

                  {/* "دورك الآن" */}
                  {station.status === 'ready' && station.isEntered && (station.ahead ?? 0) === 0 && (
                    <div className="mt-3 p-4 bg-green-500/10 border-2 border-green-500/30 rounded-xl text-center">
                      <p className="text-green-300 text-xl font-black">
                        {language === 'ar' ? '⏰ دورك الآن!' : '⏰ Your turn now!'}
                      </p>
                      <p className="text-gray-400 text-sm mt-1">
                        {language === 'ar' ? 'انتظر حتى يناديك الطبيب' : 'Wait to be called by the doctor'}
                      </p>
                    </div>
                  )}

                  {/* زر الدخول */}
                  {station.status === 'ready' && !station.isEntered && (
                    <div className="mt-4 pt-4 border-t border-gray-600">
                      {station.yourNumber && (station.ahead === 0 || station.ahead === null) ? (
                        <Button variant="gradientPrimary" onClick={() => handleEnterClinic(station)}
                          disabled={loading} className="w-full">
                          <LogIn className="w-4 h-4 me-2" />
                          {t('enterClinic', language)}
                        </Button>
                      ) : (
                        <div className="space-y-2">
                          <div className="p-3 bg-yellow-500/20 border border-yellow-500/40 rounded-xl text-center">
                            <p className="text-yellow-400 font-bold">
                              {language === 'ar' ? '⏳ انتظر دورك' : '⏳ Wait your turn'}
                            </p>
                            <p className="text-yellow-200 text-sm mt-1">
                              {language === 'ar'
                                ? `رقمك ${station.yourNumber ?? '—'} — أمامك ${station.ahead ?? '—'} شخص`
                                : `Your # ${station.yourNumber ?? '—'} — ${station.ahead ?? '—'} ahead`}
                            </p>
                          </div>
                          <Button variant="outline" disabled className="w-full opacity-50 border-gray-600">
                            <Lock className="w-4 h-4 me-2" />
                            {language === 'ar' ? 'الدخول غير متاح حالياً' : 'Entry not available yet'}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* داخل العيادة */}
                  {station.status === 'ready' && station.isEntered && (
                    <div className="mt-3 pt-3 border-t border-gray-600">
                      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                        <p className="text-white font-medium text-sm">
                          {language === 'ar' ? '✅ تم الدخول — انتظر مناداتك من الطبيب' : '✅ Entered — Wait to be called'}
                        </p>
                        {station.entered_at && (
                          <p className="text-gray-400 text-xs mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {language === 'ar' ? 'دخلت:' : 'Entered:'} {formatTime(new Date(station.entered_at))}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                </CardContent>
              </Card>
            ))}

            {/* تحميل */}
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

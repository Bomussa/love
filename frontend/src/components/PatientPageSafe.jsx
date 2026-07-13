import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import { Button } from './Button';
import {
  Lock,
  Unlock,
  Clock,
  Globe,
  LogIn,
  CheckCircle,
  RefreshCw,
  AlertTriangle,
  Bell,
} from 'lucide-react';
import { examTypes, formatTime } from '../lib/utils';
import { getDynamicMedicalPathway } from '../lib/dynamic-pathways';
import { t } from '../lib/i18n';
import api from '../lib/api-unified';
import { supabase } from '../lib/supabase-client';
import { GENERAL_REFRESH_INTERVAL } from '../core/config/refresh.constants';

const getQatarDate = () => new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

const normalizeStatus = (status) => {
  const v = String(status || '').trim().toLowerCase();
  if (v === 'completed' || v === 'done') return 'completed';
  if (v === 'called' || v === 'serving' || v === 'in_progress' || v === 'in-service' || v === 'in_service') return 'called';
  if (v === 'waiting' || v === 'ready' || v === 'locked' || v === 'cancelled' || v === 'no_show') return v;
  return 'waiting';
};

const getPatientId = (patientData) => String(
  patientData?.patient_id ||
  patientData?.personal_id ||
  patientData?.patientId ||
  patientData?.personalId ||
  patientData?.id ||
  ''
).trim();

const getSessionId = (patientData) => String(patientData?.sessionId || patientData?.session_id || patientData?.id || '').trim();

const stationTemplate = (stations) => stations.map((station, index) => ({
  ...station,
  status: index === 0 ? 'ready' : 'locked',
  isEntered: false,
  yourNumber: null,
  ahead: null,
  current: null,
  totalWaiting: null,
  entered_at: null,
}));

async function queuePosition(clinicId, patientId) {
  const today = getQatarDate();
  const { data: myRow } = await supabase
    .from('unified_queue')
    .select('id, display_number, status, entered_at')
    .eq('clinic_id', clinicId)
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
    .eq('clinic_id', clinicId)
    .eq('queue_date', today)
    .in('status', ['called', 'serving', 'in_progress'])
    .order('display_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count: ahead } = await supabase
    .from('unified_queue')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .eq('queue_date', today)
    .in('status', ['waiting', 'called', 'serving', 'in_progress'])
    .lt('display_number', myRow.display_number);

  const { count: totalWaiting } = await supabase
    .from('unified_queue')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .eq('queue_date', today)
    .in('status', ['waiting', 'called', 'serving', 'in_progress']);

  return {
    ...myRow,
    current_number: serving?.display_number ?? 0,
    ahead: ahead ?? 0,
    total_waiting: totalWaiting ?? 0,
    success: true,
  };
}

export function PatientPage({ patientData, onLogout, language, toggleLanguage }) {
  const [stations, setStations] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [pathwayError, setPathwayError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentNotice, setCurrentNotice] = useState(null);
  const [directAlerts, setDirectAlerts] = useState([]);
  const channelRef = useRef(null);
  const pollTimerRef = useRef(null);
  const noticeTimerRef = useRef(null);

  const patientId = useMemo(() => getPatientId(patientData), [patientData]);
  const sessionId = useMemo(() => getSessionId(patientData), [patientData]);
  const queueType = patientData?.queueType || patientData?.examType || 'general';
  const gender = patientData?.gender || 'male';

  const getExamName = useCallback(() => {
    const exam = examTypes.find((e) => e.id === queueType);
    return exam ? (language === 'ar' ? exam.nameAr : exam.name) : (language === 'ar' ? 'فحص طبي' : 'Medical Exam');
  }, [language, queueType]);

  const notify = useCallback((message) => {
    setCurrentNotice(message);
    window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setCurrentNotice(null), 4000);
  }, []);

  const markCompletedAndUnlockNext = useCallback((prevStations, completedIndex) => prevStations.map((station, idx) => {
    if (idx === completedIndex) return { ...station, status: 'completed', isEntered: false };
    if (idx === completedIndex + 1 && normalizeStatus(station.status) === 'locked') return { ...station, status: 'ready' };
    return station;
  }), []);

  const enterStation = useCallback(async (station, index) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('enter_unified_queue_safe', {
        p_clinic_id: station.id,
        p_patient_id: patientId,
        p_exam_type: queueType,
        p_gender: gender,
        p_military_id: patientId,
        p_personal_id: patientId,
        p_force: false,
      });

      if (error) throw error;

      if (data?.status === 'ALREADY_ACTIVE_IN_OTHER_CLINIC') {
        notify(language === 'ar' ? 'أنت مرتبط بعيادة أخرى. أكملها أولاً.' : 'You are active in another clinic. Finish it first.');
        return;
      }

      const pos = await queuePosition(station.id, patientId);
      const fallbackNumber = data?.display_number ?? data?.displayNumber ?? data?.queue_number ?? null;
      const resolved = pos || (fallbackNumber !== null ? {
        id: data?.id || station.id,
        display_number: fallbackNumber,
        current_number: 0,
        ahead: 0,
        total_waiting: 0,
        entered_at: new Date().toISOString(),
        success: true,
      } : null);

      if (!resolved) {
        throw new Error('QUEUE_POSITION_MISSING');
      }

      setStations((prev) => prev.map((s, i) => (i === index ? {
        ...s,
        queueId: data?.id || resolved.id,
        yourNumber: resolved.display_number,
        current: resolved.current_number,
        ahead: resolved.ahead,
        totalWaiting: resolved.total_waiting,
        status: 'ready',
        isEntered: true,
        entered_at: resolved.entered_at,
      } : s)));

      notify(language === 'ar' ? `✅ رقمك: ${resolved.display_number}` : `✅ Your number: ${resolved.display_number}`);
    } catch (err) {
      console.error('[PatientPageSafe] enterStation:', err);
      notify(language === 'ar' ? 'تعذر تأكيد الدخول للعيادة، لكن المسار بقي ظاهرًا.' : 'Could not confirm clinic entry, but the pathway remains visible.');
      setStations((prev) => prev.map((s, i) => (i === index ? { ...s, isEntered: true, status: 'ready' } : s)));
    } finally {
      setLoading(false);
    }
  }, [gender, language, notify, patientId, queueType]);

  const loadPathway = useCallback(async () => {
    if (!patientId) {
      setInitialLoading(false);
      setPathwayError(language === 'ar' ? 'بيانات المراجع غير مكتملة.' : 'Patient data is incomplete.');
      return;
    }

    setInitialLoading(true);
    setPathwayError(null);

    try {
      let pathway = Array.isArray(patientData?.pathway) && patientData.pathway.length > 0 ? patientData.pathway : null;
      if (!pathway && Array.isArray(patientData?.route?.stations) && patientData.route.stations.length > 0) {
        pathway = patientData.route.stations;
      }
      if (!pathway) {
        const saved = await api.getRoute(sessionId || patientId);
        if (saved?.success && Array.isArray(saved?.route?.stations) && saved.route.stations.length > 0) {
          pathway = saved.route.stations;
        }
      }
      if (!pathway) pathway = await getDynamicMedicalPathway(queueType, gender);
      if (!Array.isArray(pathway) || pathway.length === 0) throw new Error('EMPTY_PATHWAY');

      const prepared = stationTemplate(pathway);
      setStations(prepared);

      try {
        void api.createRoute(patientId, queueType, gender, pathway);
      } catch {
        // non-fatal
      }

      void enterStation(prepared[0], 0);
    } catch (err) {
      console.error('[PatientPageSafe] loadPathway:', err);
      setPathwayError(language === 'ar' ? 'تعذر تحميل المسار الطبي. حاول مرة أخرى.' : 'Unable to load the medical pathway. Please try again.');
    } finally {
      setInitialLoading(false);
    }
  }, [enterStation, gender, language, patientData, patientId, queueType, sessionId]);

  const activeIndex = useMemo(() => stations.findIndex((s) => normalizeStatus(s.status) === 'ready' && s.yourNumber !== null), [stations]);
  const activeStation = activeIndex >= 0 ? stations[activeIndex] : null;
  const completedCount = useMemo(() => stations.filter((s) => normalizeStatus(s.status) === 'completed').length, [stations]);
  const allCompleted = stations.length > 0 && stations.every((s) => normalizeStatus(s.status) === 'completed');
  const progress = stations.length > 0 ? Math.round((completedCount / stations.length) * 100) : 0;

  useEffect(() => { void loadPathway(); }, [loadPathway]);

  useEffect(() => {
    if (!patientId || !activeStation) return undefined;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`patient_queue_${patientId}_${activeStation.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unified_queue', filter: `clinic_id=eq.${activeStation.id}` }, async () => {
        const pos = await queuePosition(activeStation.id, patientId);
        if (!pos) return;
        const status = normalizeStatus(pos.status);

        setStations((prev) => {
          const idx = prev.findIndex((s) => s.id === activeStation.id);
          if (idx === -1) return prev;
          if (status === 'completed') {
            return markCompletedAndUnlockNext(prev, idx).map((station, i) => (i === idx ? {
              ...station,
              current: pos.current_number,
              ahead: pos.ahead,
              totalWaiting: pos.total_waiting,
            } : station));
          }
          return prev.map((station, i) => (i === idx ? {
            ...station,
            yourNumber: pos.display_number,
            current: pos.current_number,
            ahead: pos.ahead,
            totalWaiting: pos.total_waiting,
            isEntered: true,
          } : station));
        });
      })
      .subscribe();

    channelRef.current = channel;
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [activeStation, markCompletedAndUnlockNext, patientId]);

  useEffect(() => {
    if (!patientId || !activeStation) return undefined;

    pollTimerRef.current = window.setInterval(async () => {
      const pos = await queuePosition(activeStation.id, patientId);
      if (!pos) return;
      const status = normalizeStatus(pos.status);

      setStations((prev) => {
        const idx = prev.findIndex((s) => s.id === activeStation.id);
        if (idx === -1) return prev;
        if (status === 'completed') return markCompletedAndUnlockNext(prev, idx);
        return prev.map((station, i) => (i === idx ? {
          ...station,
          yourNumber: pos.display_number,
          current: pos.current_number,
          ahead: pos.ahead,
          totalWaiting: pos.total_waiting,
          isEntered: true,
        } : station));
      });
    }, GENERAL_REFRESH_INTERVAL || 10000);

    return () => {
      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    };
  }, [activeStation, markCompletedAndUnlockNext, patientId]);

  useEffect(() => {
    if (!patientId) return undefined;
    const alertId = String(patientData?.military_number || patientData?.militaryId || patientId);
    let alive = true;

    const loadAlerts = async () => {
      const { data } = await supabase
        .from('direct_alerts')
        .select('*')
        .eq('patient_id', alertId)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (alive && Array.isArray(data) && data.length) setDirectAlerts(data);
    };

    void loadAlerts();

    const channel = supabase
      .channel(`direct_alerts_${alertId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_alerts', filter: `patient_id=eq.${alertId}` }, (payload) => {
        const alert = payload.new;
        if (alert?.is_active && new Date(alert.expires_at) > new Date()) {
          setDirectAlerts((prev) => [alert, ...prev]);
        }
      })
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [patientData?.id, patientData?.militaryId, patientData?.military_number, patientId]);

  const dismissDirectAlert = async (alertId) => {
    try {
      await supabase.from('direct_alerts').update({ read_at: new Date().toISOString() }).eq('id', alertId);
      setDirectAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch {
      // ignore
    }
  };

  if (allCompleted) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center bg-gradient-to-b from-[#08111f] to-[#04070d]" data-test="completion-screen">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <img src="/mms-logo.png" alt="اللجنة الطبية العسكرية" className="mx-auto w-24 h-24 object-contain" />
          <CheckCircle className="w-24 h-24 mx-auto text-[#C9A54C]" />
          <Card className="bg-gradient-to-br from-green-900/30 to-blue-900/30 border-[#C9A54C]/30 shadow-2xl">
            <CardContent className="p-8 space-y-6">
              <h1 className="text-4xl sm:text-5xl font-black text-white">
                {language === 'ar' ? 'اكتمل المسار الطبي' : 'Medical pathway completed'}
              </h1>
              <p className="text-gray-300 text-lg leading-relaxed">
                {language === 'ar' ? 'تم إنهاء جميع المحطات بنجاح.' : 'All stations have been completed successfully.'}
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Button onClick={() => window.location.reload()} className="bg-[#C9A54C] text-black font-bold">
                  <RefreshCw className="w-4 h-4 me-2" />{language === 'ar' ? 'تحديث' : 'Refresh'}
                </Button>
                <Button onClick={onLogout} variant="outline" className="border-gray-600 text-gray-200">
                  {t('exitSystem', language)}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-full border-4 border-[#C9A54C] border-t-transparent animate-spin" />
          <p className="text-white text-lg">{language === 'ar' ? 'جارٍ تحميل المسار الطبي...' : 'Loading medical pathway...'}</p>
        </div>
      </div>
    );
  }

  if (pathwayError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-950" data-test="pathway-error-screen">
        <Card className="w-full max-w-lg bg-gray-800/80 border-red-500/40">
          <CardContent className="p-6 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center text-red-400"><AlertTriangle className="w-8 h-8" /></div>
            <h2 className="text-xl font-bold text-white">{language === 'ar' ? 'تعذر تحميل المسار' : 'Unable to load pathway'}</h2>
            <p className="text-gray-300 leading-relaxed">{pathwayError}</p>
            <div className="flex gap-3 justify-center pt-2">
              <Button onClick={() => window.location.reload()} variant="default" className="bg-[#C9A54C] text-black font-bold">
                <RefreshCw className="w-4 h-4 me-2" />{language === 'ar' ? 'إعادة المحاولة' : 'Retry'}
              </Button>
              <Button onClick={onLogout} variant="outline" className="border-gray-600 text-gray-200">
                {language === 'ar' ? 'العودة' : 'Back'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent px-3 py-4 overflow-x-hidden overflow-y-auto" data-test="patient-page">
      {currentNotice && (
        <div className="fixed top-4 right-4 z-50 max-w-sm rounded-2xl border border-white/10 bg-[#111827]/95 p-4 shadow-2xl backdrop-blur">
          <div className="flex items-start gap-3">
            <div className="text-yellow-400 mt-0.5"><Bell className="w-4 h-4" /></div>
            <div className="flex-1 text-sm text-white leading-relaxed">{currentNotice}</div>
            <button onClick={() => setCurrentNotice(null)} className="text-white/60 hover:text-white">✕</button>
          </div>
        </div>
      )}

      {directAlerts.length > 0 && (
        <div className="fixed top-4 left-4 z-50 space-y-2 max-w-sm">
          {directAlerts.slice(0, 3).map((alert) => (
            <div key={alert.id} className={`flex items-start gap-3 p-4 rounded-2xl shadow-2xl border backdrop-blur-sm ${alert.alert_type === 'urgent' ? 'bg-red-900/90 border-red-500/50' : alert.alert_type === 'warning' ? 'bg-yellow-900/90 border-yellow-500/50' : alert.alert_type === 'success' ? 'bg-green-900/90 border-green-500/50' : 'bg-[#1a0a12]/90 border-[#C9A54C]/50'}`}>
              <p className="flex-1 text-sm font-medium text-white leading-relaxed">{language === 'ar' ? alert.message : (alert.message_en || alert.message)}</p>
              <button onClick={() => dismissDirectAlert(alert.id)} className="text-white/60 hover:text-white">✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="w-full max-w-2xl mx-auto space-y-5 px-2 sm:px-4">
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

        <div className="bg-[#1a0820]/80 border border-[#C9A54C]/20 rounded-2xl p-4 shadow-lg backdrop-blur-sm">
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
                <Card key={station.id} className={`border transition-all duration-200 ${status === 'ready' ? 'bg-[#8A1538]/20 border-[#C9A54C]/50 shadow-md' : status === 'completed' ? 'bg-[#8A1538]/10 border-[#C9A54C]/20 opacity-70' : 'bg-[#1a0820]/40 border-white/10'}`}>
                  <CardContent className="p-3.5 sm:p-5">
                    <div className="flex items-center justify-between mb-3 gap-2">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${status === 'ready' ? 'bg-[#C9A54C]/20' : status === 'completed' ? 'bg-[#C9A54C]/10' : 'bg-white/5'}`}>
                          {status === 'ready' ? <Unlock className="w-5 h-5 text-[#C9A54C]" /> : status === 'completed' ? <CheckCircle className="w-5 h-5 text-[#C9A54C]" /> : <Lock className="w-5 h-5 text-gray-400" />}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-white text-base font-bold leading-tight">{language === 'ar' ? station.nameAr : station.name}</h3>
                          <p className="text-gray-400 text-sm mt-0.5">{t('floor', language)}: <span className="text-gray-200 font-semibold">{language === 'ar' ? station.floor : station.floorCode}</span></p>
                        </div>
                      </div>
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${status === 'ready' ? 'bg-green-500/20 text-[#C9A54C] border border-[#C9A54C]/30' : status === 'completed' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'}`}>
                        {status === 'ready' ? t('ready', language) : status === 'completed' ? (language === 'ar' ? 'مكتمل ✓' : 'Completed ✓') : t('locked', language)}
                      </span>
                    </div>

                    {status !== 'completed' && (
                      <div className="grid grid-cols-2 gap-2.5 text-center" data-test="queue-info">
                        <div className="py-4 px-2 bg-yellow-500/15 rounded-xl border-2 border-yellow-500/40">
                          <div className="text-4xl font-black text-yellow-400 mb-1.5 leading-none" data-test="your-number">{typeof station.yourNumber === 'number' ? station.yourNumber : (status === 'ready' ? '...' : '—')}</div>
                          <div className="text-yellow-300/80 text-sm font-bold tracking-wide mt-0.5">{t('yourNumber', language)}</div>
                        </div>
                        <div className="py-4 px-2 bg-gray-700/50 rounded-xl border border-gray-500/50">
                          <div className="text-4xl font-black text-white mb-1.5 leading-none" data-test="ahead-count">{typeof station.ahead === 'number' ? station.ahead : (status === 'ready' ? '...' : '—')}</div>
                          <div className="text-gray-400 text-sm font-bold tracking-wide mt-0.5">{t('ahead', language)}</div>
                        </div>
                      </div>
                    )}

                    {canEnter && (
                      <div className="mt-4 pt-4 border-t border-gray-600/40">
                        {(station.yourNumber > 0 && (station.ahead === 0 || station.ahead === null || station.ahead === undefined)) ? (
                          <Button variant="gradientPrimary" onClick={() => enterStation(station, index)} disabled={loading} className="w-full py-3 text-lg font-bold" data-test="enter-clinic-btn">
                            <LogIn className="w-4 h-4 me-2" />{t('enterClinic', language)}
                          </Button>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                              <div className="flex items-center gap-2"><span className="text-lg">⏳</span><span className="text-yellow-400 font-semibold text-sm">{language === 'ar' ? 'انتظر دورك' : 'Wait for your turn'}</span></div>
                              <span className="text-yellow-200 text-xs font-medium">{language === 'ar' ? `أمامك ${station.ahead ?? '—'} شخص` : `${station.ahead ?? '—'} ahead`}</span>
                            </div>
                            <Button variant="outline" disabled className="w-full opacity-40 cursor-not-allowed border-gray-600 text-sm">
                              <Lock className="w-4 h-4 me-2" />{language === 'ar' ? 'الدخول غير متاح حالياً' : 'Entry not available yet'}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {status === 'ready' && station.isEntered && (
                      <div className="mt-3 pt-3 border-t border-gray-600 space-y-2">
                        <div className="text-center text-sm text-[#C9A54C] p-3 bg-[#8A1538]/20 rounded border border-[#C9A54C]/30">{language === 'ar' ? '✓ تم الدخول - انتظر مناداتك من الطبيب' : '✓ Entered - Wait for doctor to call you'}</div>
                        {station.entered_at && <div className="text-sm text-gray-400 flex items-center gap-2"><Clock className="w-4 h-4" /><span>{language === 'ar' ? 'وقت الدخول:' : 'Entry time:'} {formatTime(new Date(station.entered_at))}</span></div>}
                      </div>
                    )}

                    {isActive && status !== 'completed' && <div className="mt-3 pt-3 border-t border-[#C9A54C]/20 text-center text-[#C9A54C] text-sm font-bold">{language === 'ar' ? 'المحطة الحالية ✓' : 'Current station ✓'}</div>}
                    {status === 'completed' && <div className="mt-3 pt-3 border-t border-green-500/20 text-center text-[#C9A54C] text-sm font-bold">{language === 'ar' ? 'تم إنهاء هذه المحطة ✓' : 'Station completed ✓'}</div>}
                  </CardContent>
                </Card>
              );
            })}
          </CardContent>
        </Card>

        <div className="text-center pb-6 flex flex-wrap justify-center gap-3">
          <Button variant="outline" onClick={() => window.location.reload()} className="border-gray-600 text-gray-300"><RefreshCw className="w-4 h-4 me-2" />{language === 'ar' ? 'تحديث' : 'Refresh'}</Button>
          <Button variant="outline" onClick={onLogout} className="border-gray-600 text-gray-300">{t('exitSystem', language)}</Button>
        </div>
      </div>
    </div>
  );
}

export default PatientPage;
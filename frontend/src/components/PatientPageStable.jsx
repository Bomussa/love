import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import { Button } from './Button';
import { Lock, Unlock, Clock, Globe, LogIn, CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { examTypes, formatTime } from '../lib/utils';
import { getDynamicMedicalPathway } from '../lib/dynamic-pathways';
import { t } from '../lib/i18n';
import api from '../lib/api-unified';
import { supabase } from '../lib/supabase-client';
import { GENERAL_REFRESH_INTERVAL } from '../core/config/refresh.constants';

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
  const today = new Date().toISOString().slice(0, 10);
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

export function PatientPageStable({ patientData, onLogout, language, toggleLanguage }) {
  const [stations, setStations] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [pathwayError, setPathwayError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentNotice, setCurrentNotice] = useState(null);
  const [directAlerts, setDirectAlerts] = useState([]);
  const channelRef = useRef(null);
  const pollTimerRef = useRef(null);

  const patientId = useMemo(() => getPatientId(patientData), [patientData]);
  const sessionId = useMemo(() => getSessionId(patientData), [patientData]);
  const queueType = patientData?.queueType || patientData?.examType || 'general';
  const gender = patientData?.gender || 'male';
  const patientName = patientData?.name || patientData?.patient_name || patientId || sessionId || '';

  const shellStyle = { backgroundColor: 'hsl(var(--background))' };
  const panelStyle = { backgroundColor: 'hsl(var(--card) / 0.82)' };
  const mutedPanelStyle = { backgroundColor: 'hsl(var(--muted) / 0.46)' };
  const overlayStyle = { backgroundColor: 'hsl(var(--theme-surface) / 0.95)' };
  const accentBorderStyle = { borderColor: 'hsl(var(--theme-secondary) / 0.28)' };
  const highlightBorderStyle = { borderColor: 'hsl(var(--theme-secondary) / 0.45)' };
  const primaryTextStyle = { color: 'hsl(var(--theme-text))' };
  const secondaryTextStyle = { color: 'hsl(var(--theme-text-secondary))' };
  const accentTextStyle = { color: 'hsl(var(--theme-secondary))' };

  const getExamName = useCallback(() => {
    const exam = examTypes.find((e) => e.id === queueType);
    return exam ? (language === 'ar' ? exam.nameAr : exam.name) : (language === 'ar' ? 'فحص طبي' : 'Medical Exam');
  }, [language, queueType]);

  const notify = useCallback((message) => {
    setCurrentNotice(message);
    window.clearTimeout(window.__patientStableNotice);
    window.__patientStableNotice = window.setTimeout(() => setCurrentNotice(null), 4000);
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
        p_patient_name: patientName,
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
      if (!pos) throw new Error('QUEUE_POSITION_MISSING');

      setStations((prev) => prev.map((s, i) => (i === index ? {
        ...s,
        queueId: data?.id || pos.id,
        yourNumber: pos.display_number,
        current: pos.current_number,
        ahead: pos.ahead,
        totalWaiting: pos.total_waiting,
        status: 'ready',
        isEntered: true,
        entered_at: pos.entered_at,
      } : s)));

      notify(language === 'ar' ? `✅ رقمك: ${pos.display_number}` : `✅ Your number: ${pos.display_number}`);
    } catch (err) {
      console.error('[PatientPageStable] enterStation:', err);
      notify(language === 'ar' ? 'فشل الدخول للعيادة' : 'Failed to enter clinic');
    } finally {
      setLoading(false);
    }
  }, [gender, language, notify, patientId, patientName, queueType]);

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
      try { void api.createRoute(patientId, queueType, gender, pathway); } catch {}
      await enterStation(prepared[0], 0);
    } catch (err) {
      console.error('[PatientPageStable] loadPathway:', err);
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
      <div className="min-h-screen p-4 flex items-center justify-center bg-[hsl(var(--background))]" data-test="completion-screen">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <img src="/mms-logo.png" alt="اللجنة الطبية العسكرية" className="mx-auto w-24 h-24 object-contain" />
          <CheckCircle className="w-24 h-24 mx-auto" style={accentTextStyle} />
          <Card className="shadow-2xl" style={{ backgroundColor: 'hsl(var(--card) / 0.78)', borderColor: 'hsl(var(--theme-secondary) / 0.3)' }}>
            <CardContent className="p-8 space-y-6">
              <h1 className="text-4xl sm:text-5xl font-black" style={primaryTextStyle}>
                {language === 'ar' ? 'اكتمل المسار الطبي' : 'Medical pathway completed'}
              </h1>
              <p className="text-lg leading-relaxed" style={secondaryTextStyle}>
                {language === 'ar' ? 'تم إنهاء جميع المحطات بنجاح.' : 'All stations have been completed successfully.'}
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Button onClick={() => window.location.reload()} className="font-bold" style={{ backgroundColor: 'hsl(var(--theme-secondary))', color: 'hsl(var(--background))' }}>
                  <RefreshCw className="w-4 h-4 me-2" />{language === 'ar' ? 'تحديث' : 'Refresh'}
                </Button>
                <Button onClick={onLogout} variant="outline" style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}>
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
      <div className="min-h-screen flex items-center justify-center" style={shellStyle}>
        <div className="text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-full border-4 animate-spin" style={{ borderColor: 'hsl(var(--theme-secondary))', borderTopColor: 'transparent' }} />
          <p style={primaryTextStyle} className="text-lg">{language === 'ar' ? 'جارٍ تحميل المسار الطبي...' : 'Loading medical pathway...'}</p>
        </div>
      </div>
    );
  }

  if (pathwayError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={shellStyle} data-test="pathway-error-screen">
        <Card className="w-full max-w-lg shadow-2xl" style={{ backgroundColor: 'hsl(var(--card) / 0.8)', borderColor: 'hsl(var(--destructive) / 0.4)' }}>
          <CardContent className="p-6 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'hsl(var(--destructive) / 0.12)', color: 'hsl(var(--destructive))' }}><AlertTriangle className="w-8 h-8" /></div>
            <h2 className="text-xl font-bold" style={primaryTextStyle}>{language === 'ar' ? 'تعذر تحميل المسار' : 'Unable to load pathway'}</h2>
            <p className="leading-relaxed" style={secondaryTextStyle}>{pathwayError}</p>
            <div className="flex gap-3 justify-center pt-2">
              <Button onClick={() => window.location.reload()} variant="default" className="font-bold" style={{ backgroundColor: 'hsl(var(--theme-secondary))', color: 'hsl(var(--background))' }}>
                <RefreshCw className="w-4 h-4 me-2" />{language === 'ar' ? 'إعادة المحاولة' : 'Retry'}
              </Button>
              <Button onClick={onLogout} variant="outline" style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}>
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
        <div className="fixed top-4 right-4 z-50 max-w-sm rounded-2xl border p-4 shadow-2xl backdrop-blur" style={overlayStyle}>
          <div className="flex items-start gap-3">
            <div className="mt-0.5" style={accentTextStyle}><Bell className="w-4 h-4" /></div>
            <div className="flex-1 text-sm leading-relaxed" style={primaryTextStyle}>{currentNotice}</div>
            <button onClick={() => setCurrentNotice(null)} style={secondaryTextStyle}>✕</button>
          </div>
        </div>
      )}

      {directAlerts.length > 0 && (
        <div className="fixed top-4 left-4 z-50 space-y-2 max-w-sm">
          {directAlerts.slice(0, 3).map((alert) => (
            <div key={alert.id} className="flex items-start gap-3 p-4 rounded-2xl shadow-2xl border backdrop-blur-sm" style={alert.alert_type === 'urgent' ? { backgroundColor: 'hsl(var(--destructive) / 0.9)', borderColor: 'hsl(var(--destructive) / 0.5)' } : alert.alert_type === 'warning' ? { backgroundColor: 'hsl(var(--theme-secondary) / 0.22)', borderColor: 'hsl(var(--theme-secondary) / 0.45)' } : alert.alert_type === 'success' ? { backgroundColor: 'hsl(var(--theme-surface) / 0.92)', borderColor: 'hsl(var(--theme-secondary) / 0.3)' } : { backgroundColor: 'hsl(var(--theme-surface) / 0.92)', borderColor: 'hsl(var(--theme-secondary) / 0.35)' }}>
              <p className="flex-1 text-sm font-medium leading-relaxed" style={primaryTextStyle}>{language === 'ar' ? alert.message : (alert.message_en || alert.message)}</p>
              <button onClick={() => dismissDirectAlert(alert.id)} style={secondaryTextStyle}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="w-full max-w-2xl mx-auto space-y-5 px-2 sm:px-4">
        <div className="absolute top-4 left-4">
          <Button variant="ghost" size="sm" className="hover:bg-transparent" onClick={toggleLanguage} style={{ color: 'hsl(var(--foreground))' }}>
            <Globe className="w-4 h-4 me-2" />{language === 'ar' ? 'English 🇺🇸' : 'العربية 🇶🇦'}
          </Button>
        </div>

        <div className="text-center space-y-2 pt-4">
          <img src="/mms-logo.png" alt="اللجنة الطبية العسكرية" className="mx-auto w-24 h-24 object-contain" />
          <div className="space-y-0.5">
            <h1 className="text-xl font-bold" style={primaryTextStyle}>{language === 'ar' ? 'اللجنة الطبية العسكرية' : 'Military Medical Committee'}</h1>
            <p className="text-sm font-semibold" style={accentTextStyle}>{language === 'ar' ? 'قيادة الخدمات الطبية العسكرية' : 'Military Medical Services Command'}</p>
            <p className="text-xs" style={secondaryTextStyle}>{language === 'ar' ? 'المركز الطبي التخصصي العسكري - العطار' : 'Military Specialized Medical Center – Al-Attar'}</p>
          </div>
        </div>

        <div className="rounded-2xl border p-4 shadow-lg backdrop-blur-sm" style={{ backgroundColor: 'hsl(var(--theme-surface) / 0.78)', borderColor: 'hsl(var(--theme-secondary) / 0.22)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl" style={mutedPanelStyle}>⚕️</div>
            <div>
              <p className="font-medium text-sm" style={primaryTextStyle}>{language === 'ar' ? 'يتم التحكم في تدفق المرضى من قبل الأطباء' : 'Patient flow controlled by doctors'}</p>
              <p className="text-xs" style={secondaryTextStyle}>{language === 'ar' ? 'سيتم استدعاؤك تلقائياً عند حلول دورك' : 'You will be called automatically'}</p>
            </div>
          </div>
        </div>

        <Card className="shadow-xl" style={panelStyle}>
          <CardHeader className="text-center pb-3 pt-4">
            <CardTitle className="text-xl font-bold tracking-tight" style={primaryTextStyle}>{t('yourMedicalRoute', language)}</CardTitle>
            <p className="text-sm mt-1.5" style={secondaryTextStyle}>{t('exam', language)}: <span className="font-bold" style={accentTextStyle}>{getExamName()}</span></p>
            <div className="mt-3 h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'hsl(var(--muted))' }}><div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: 'hsl(var(--theme-secondary))' }} /></div>
            <p className="text-xs mt-2" style={secondaryTextStyle}>{language === 'ar' ? `تقدم الرحلة: ${completedCount}/${stations.length} مكتمل` : `Journey progress: ${completedCount}/${stations.length} completed`}</p>
          </CardHeader>

          <CardContent className="space-y-3 px-3 pb-4">
            {stations.map((station, index) => {
              const status = normalizeStatus(station.status);
              const canEnter = status === 'ready' && !station.isEntered;
              const isActive = activeIndex === index;

              return (
                <Card key={station.id} className="border transition-all duration-200" style={status === 'ready' ? { backgroundColor: 'hsl(var(--theme-surface) / 0.8)', borderColor: 'hsl(var(--theme-secondary) / 0.45)', boxShadow: '0 10px 30px rgba(0,0,0,0.18)' } : status === 'completed' ? { backgroundColor: 'hsl(var(--theme-surface) / 0.65)', borderColor: 'hsl(var(--theme-secondary) / 0.22)', opacity: 0.78 } : { backgroundColor: 'hsl(var(--theme-surface) / 0.56)', borderColor: 'hsl(var(--border) / 0.5)' }}>
                  <CardContent className="p-3.5 sm:p-5">
                    <div className="flex items-center justify-between mb-3 gap-2">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={status === 'ready' ? { backgroundColor: 'hsl(var(--theme-secondary) / 0.18)' } : status === 'completed' ? { backgroundColor: 'hsl(var(--theme-secondary) / 0.1)' } : { backgroundColor: 'hsl(var(--muted))' }}>
                          {status === 'ready' ? <Unlock className="w-5 h-5" style={accentTextStyle} /> : status === 'completed' ? <CheckCircle className="w-5 h-5" style={accentTextStyle} /> : <Lock className="w-5 h-5" style={secondaryTextStyle} />}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base font-bold leading-tight" style={primaryTextStyle}>{language === 'ar' ? station.nameAr : station.name}</h3>
                          <p className="text-sm mt-0.5" style={secondaryTextStyle}>{t('floor', language)}: <span className="font-semibold" style={primaryTextStyle}>{language === 'ar' ? station.floor : station.floorCode}</span></p>
                        </div>
                      </div>
                      <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap border" style={status === 'ready' ? { backgroundColor: 'hsl(var(--theme-secondary) / 0.12)', color: 'hsl(var(--theme-secondary))', borderColor: 'hsl(var(--theme-secondary) / 0.3)' } : status === 'completed' ? { backgroundColor: 'hsl(var(--theme-secondary) / 0.08)', color: 'hsl(var(--theme-secondary))', borderColor: 'hsl(var(--theme-secondary) / 0.25)' } : { backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--theme-text-secondary))', borderColor: 'hsl(var(--border))' }}>
                        {status === 'ready' ? t('ready', language) : status === 'completed' ? (language === 'ar' ? 'مكتمل ✓' : 'Completed ✓') : t('locked', language)}
                      </span>
                    </div>

                    {status !== 'completed' && (
                      <div className="grid grid-cols-2 gap-2.5 text-center" data-test="queue-info">
                        <div className="py-4 px-2 rounded-xl border-2" style={{ backgroundColor: 'hsl(var(--theme-secondary) / 0.12)', borderColor: 'hsl(var(--theme-secondary) / 0.4)' }}>
                          <div className="text-4xl font-black mb-1.5 leading-none" style={accentTextStyle} data-test="your-number">{typeof station.yourNumber === 'number' ? station.yourNumber : (status === 'ready' ? '...' : '—')}</div>
                          <div className="text-sm font-bold tracking-wide mt-0.5" style={secondaryTextStyle}>{t('yourNumber', language)}</div>
                        </div>
                        <div className="py-4 px-2 rounded-xl border" style={{ backgroundColor: 'hsl(var(--muted) / 0.7)', borderColor: 'hsl(var(--border))' }}>
                          <div className="text-4xl font-black mb-1.5 leading-none" style={primaryTextStyle} data-test="ahead-count">{typeof station.ahead === 'number' ? station.ahead : (status === 'ready' ? '...' : '—')}</div>
                          <div className="text-sm font-bold tracking-wide mt-0.5" style={secondaryTextStyle}>{t('ahead', language)}</div>
                        </div>
                      </div>
                    )}

                    {canEnter && (
                      <div className="mt-4 pt-4 border-t" style={{ borderColor: 'hsl(var(--border) / 0.65)' }}>
                        {(station.yourNumber > 0 && (station.ahead === 0 || station.ahead === null || station.ahead === undefined)) ? (
                          <Button variant="gradientPrimary" onClick={() => enterStation(station, index)} disabled={loading} className="w-full py-3 text-lg font-bold" data-test="enter-clinic-btn">
                            <LogIn className="w-4 h-4 me-2" />{t('enterClinic', language)}
                          </Button>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between px-4 py-3 rounded-xl border" style={{ backgroundColor: 'hsl(var(--theme-secondary) / 0.08)', borderColor: 'hsl(var(--theme-secondary) / 0.3)' }}>
                              <div className="flex items-center gap-2"><span className="text-lg">⏳</span><span className="font-semibold text-sm" style={accentTextStyle}>{language === 'ar' ? 'انتظر دورك' : 'Wait for your turn'}</span></div>
                              <span className="text-xs font-medium" style={accentTextStyle}>{language === 'ar' ? `أمامك ${station.ahead ?? '—'} شخص` : `${station.ahead ?? '—'} ahead`}</span>
                            </div>
                            <Button variant="outline" disabled className="w-full opacity-40 cursor-not-allowed border-gray-600 text-sm">
                              <Lock className="w-4 h-4 me-2" />{language === 'ar' ? 'الدخول غير متاح حالياً' : 'Entry not available yet'}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {status === 'ready' && station.isEntered && (
                      <div className="mt-3 pt-3 border-t space-y-2" style={{ borderColor: 'hsl(var(--border) / 0.65)' }}>
                        <div className="text-center text-sm p-3 rounded border" style={{ color: 'hsl(var(--theme-secondary))', backgroundColor: 'hsl(var(--theme-secondary) / 0.1)', borderColor: 'hsl(var(--theme-secondary) / 0.3)' }}>{language === 'ar' ? '✓ تم الدخول - انتظر مناداتك من الطبيب' : '✓ Entered - Wait for doctor to call you'}</div>
                        {station.entered_at && <div className="text-sm flex items-center gap-2" style={secondaryTextStyle}><Clock className="w-4 h-4" /><span>{language === 'ar' ? 'وقت الدخول:' : 'Entry time:'} {formatTime(new Date(station.entered_at))}</span></div>}
                      </div>
                    )}

                    {isActive && status !== 'completed' && <div className="mt-3 pt-3 border-t text-center text-sm font-bold" style={{ borderColor: 'hsl(var(--theme-secondary) / 0.22)', color: 'hsl(var(--theme-secondary))' }}>{language === 'ar' ? 'المحطة الحالية ✓' : 'Current station ✓'}</div>}
                    {status === 'completed' && <div className="mt-3 pt-3 border-t text-center text-sm font-bold" style={{ borderColor: 'hsl(var(--theme-secondary) / 0.22)', color: 'hsl(var(--theme-secondary))' }}>{language === 'ar' ? 'تم إنهاء هذه المحطة ✓' : 'Station completed ✓'}</div>}
                  </CardContent>
                </Card>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default PatientPageStable;

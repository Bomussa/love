import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import { Button } from './Button';
import { Bell, CheckCircle, Clock, Globe, Lock, LogIn, RefreshCw, Unlock, AlertTriangle } from 'lucide-react';
import { examTypes, formatTime } from '../lib/utils';
import { getDynamicMedicalPathway } from '../lib/dynamic-pathways';
import { t } from '../lib/i18n';
import api from '../lib/api-unified';
import { supabase } from '../lib/supabase-client';
import { GENERAL_REFRESH_INTERVAL } from '../core/config/refresh.constants';

const normalize = (status) => {
  const v = String(status || '').trim().toLowerCase();
  if (v === 'completed' || v === 'done') return 'completed';
  if (['called', 'serving', 'in_progress', 'in-service', 'in_service', 'active', 'current', 'ongoing'].includes(v)) return 'called';
  if (['waiting', 'ready', 'locked', 'cancelled', 'no_show'].includes(v)) return v;
  return 'waiting';
};
const getPatientId = (p) => String(p?.patient_id || p?.personal_id || p?.patientId || p?.personalId || p?.id || '').trim();
const template = (stations) => stations.map((s, i) => ({ ...s, status: i === 0 ? 'ready' : 'locked', isEntered: false, yourNumber: null, ahead: null, current: null, totalWaiting: null, entered_at: null }));

function extractCanonicalRoute(response) {
  return response?.route || response?.data?.route || response?.data || response || null;
}

function canonicalRouteStations(route) {
  if (Array.isArray(route?.stations)) return route.stations;
  if (Array.isArray(route?.pathway)) return route.pathway;
  if (Array.isArray(route?.path)) return route.path;
  return [];
}

function prepareCanonicalStations(route) {
  const source = canonicalRouteStations(route);
  const rawStep = Number(route?.current_station_index ?? route?.current_step ?? 0);
  const currentStep = Math.max(0, Math.min(Number.isFinite(rawStep) ? rawStep : 0, source.length));
  const complete = Boolean(route?.completed)
    || ['completed', 'done'].includes(String(route?.status || '').toLowerCase())
    || currentStep >= source.length;
  const queueId = route?.queue_id || route?.id || null;

  return source.map((station, index) => ({
    ...station,
    nameAr: station.nameAr || station.name_ar || station.name || station.id,
    name: station.nameEn || station.name_en || station.name || station.nameAr || station.id,
    queueId,
    status: complete || index < currentStep ? 'completed' : index === currentStep ? 'ready' : 'locked',
    isEntered: false,
    yourNumber: null,
    ahead: null,
    current: null,
    totalWaiting: null,
    entered_at: null,
  }));
}

async function queuePosition(clinicId, patientId) {
  const response = await api.getQueuePosition(clinicId, patientId);
  if (!response?.success) return null;
  const row = response.data || response;
  return {
    ...row,
    current_number: row.current_number ?? row.currentNumber ?? 0,
    ahead: row.ahead ?? 0,
    total_waiting: row.total_waiting ?? row.totalWaiting ?? 0,
    success: true,
  };
}

export function PatientPageThemeAware({ patientData, onLogout, language, toggleLanguage }) {
  const patientId = useMemo(() => getPatientId(patientData), [patientData]);
  const queueType = patientData?.queueType || patientData?.examType || 'general';
  const gender = patientData?.gender || 'male';

  const [stations, setStations] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [pathwayError, setPathwayError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentNotice, setCurrentNotice] = useState(null);
  const [directAlerts, setDirectAlerts] = useState([]);
  const [routeVersion, setRouteVersion] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [realtimeStatus, setRealtimeStatus] = useState('IDLE');
  const [realtimeEventCount, setRealtimeEventCount] = useState(0);
  const [realtimeLastEventAt, setRealtimeLastEventAt] = useState(0);
  const [routeVersionUpdatedAt, setRouteVersionUpdatedAt] = useState(0);
  const routeVersionRef = useRef(0);
  const channelRef = useRef(null);
  const pollTimerRef = useRef(null);
  const noticeTimerRef = useRef(null);

  const shellStyle = { backgroundColor: 'hsl(var(--background))' };
  const panelStyle = { backgroundColor: 'hsl(var(--card) / 0.82)' };
  const sheetStyle = { backgroundColor: 'hsl(var(--theme-surface) / 0.95)' };
  const textStyle = { color: 'hsl(var(--theme-text))' };
  const subTextStyle = { color: 'hsl(var(--theme-text-secondary))' };
  const accentStyle = { color: 'hsl(var(--theme-secondary))' };

  const examName = useMemo(() => {
    const ex = examTypes.find((e) => e.id === queueType);
    return ex ? (language === 'ar' ? ex.nameAr : ex.name) : (language === 'ar' ? 'فحص طبي' : 'Medical Exam');
  }, [language, queueType]);

  const notify = useCallback((message) => {
    setCurrentNotice(message);
    window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setCurrentNotice(null), 4000);
  }, []);

  const applyRouteVersion = useCallback((value, updatedAt = Date.now()) => {
    const nextVersion = Number(value || 0);
    if (!Number.isFinite(nextVersion) || nextVersion <= routeVersionRef.current) return false;
    routeVersionRef.current = nextVersion;
    setRouteVersion(nextVersion);
    setRouteVersionUpdatedAt(updatedAt);
    return true;
  }, []);

  const markCompletedAndUnlockNext = useCallback((prev, completedIndex) => prev.map((station, idx) => {
    if (idx === completedIndex) return { ...station, status: 'completed', isEntered: false };
    if (idx === completedIndex + 1 && normalize(station.status) === 'locked') return { ...station, status: 'ready' };
    return station;
  }), []);

  const enterStation = useCallback(async (station, index) => {
    try {
      setLoading(true);
      const result = await api.enterQueue(
        station.id,
        patientId,
        false,
        null,
        queueType,
        gender,
        patientId,
        patientId,
      );
      if (!result?.success) {
        if (result?.status === 'ALREADY_ACTIVE_IN_OTHER_CLINIC' || result?.code === 'ALREADY_ACTIVE_IN_OTHER_CLINIC') {
          notify(language === 'ar' ? 'أنت مرتبط بعيادة أخرى. أكملها أولاً.' : 'You are active in another clinic. Finish it first.');
          return;
        }
        throw new Error(result?.error || 'QUEUE_ENTRY_FAILED');
      }

      const pos = await queuePosition(station.id, patientId);
      if (!pos) throw new Error('QUEUE_POSITION_MISSING');
      setStations((prev) => prev.map((s, i) => (i === index ? {
        ...s,
        queueId: result?.id || result?.data?.id || pos.id,
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
      console.error('[PatientPageThemeAware] enterStation:', err);
      notify(language === 'ar' ? 'فشل الدخول للعيادة' : 'Failed to enter clinic');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [gender, language, notify, patientId, queueType]);

  const refreshJourney = useCallback(async ({ enterIfMissing = false } = {}) => {
    let response = await api.getRoute(patientId);
    let route = response?.success === false ? null : extractCanonicalRoute(response);
    let routeStations = canonicalRouteStations(route);

    if (!route || routeStations.length === 0) {
      let fallback = Array.isArray(patientData?.route?.stations) && patientData.route.stations.length > 0
        ? patientData.route.stations
        : Array.isArray(patientData?.pathway) && patientData.pathway.length > 0
          ? patientData.pathway
          : await getDynamicMedicalPathway(queueType, gender);
      if (!Array.isArray(fallback) || fallback.length === 0) throw new Error('EMPTY_PATHWAY');

      response = await api.createRoute(patientId, queueType, gender, fallback);
      if (response?.success === false) throw new Error(response?.error || 'ROUTE_PERSISTENCE_FAILED');
      route = extractCanonicalRoute(response);
      routeStations = canonicalRouteStations(route);
    }

    const prepared = prepareCanonicalStations(route);
    if (!prepared.length) throw new Error('CANONICAL_ROUTE_EMPTY');

    const rawStep = Number(route?.current_station_index ?? route?.current_step ?? 0);
    const currentStep = Math.max(0, Math.min(Number.isFinite(rawStep) ? rawStep : 0, prepared.length));
    const complete = Boolean(route?.completed)
      || ['completed', 'done'].includes(String(route?.status || '').toLowerCase())
      || currentStep >= prepared.length;

    const incomingVersion = Number(route?.version || 0);
    const routeSnapshotIsStale = () => (
      routeVersionRef.current > 0
      && (!Number.isFinite(incomingVersion) || incomingVersion <= 0 || incomingVersion < routeVersionRef.current)
    );

    if (routeSnapshotIsStale()) return route;
    applyRouteVersion(incomingVersion);
    setLastSyncAt(Date.now());

    if (complete) {
      if (routeSnapshotIsStale()) return route;
      setStations(prepared.map((station) => ({ ...station, status: 'completed', isEntered: false })));
      return route;
    }

    const currentStation = prepared[currentStep];
    const position = await queuePosition(currentStation.id, patientId);
    if (routeSnapshotIsStale()) return route;
    if (position) {
      prepared[currentStep] = {
        ...currentStation,
        queueId: position.id || currentStation.queueId,
        yourNumber: position.display_number,
        current: position.current_number,
        ahead: position.ahead,
        totalWaiting: position.total_waiting,
        status: 'ready',
        isEntered: true,
        entered_at: position.entered_at,
      };
    }

    setStations(prepared);
    if (!position && enterIfMissing) await enterStation(currentStation, currentStep);
    return route;
  }, [applyRouteVersion, enterStation, gender, patientData, patientId, queueType]);

  const loadPathway = useCallback(async () => {
    if (!patientId) {
      setInitialLoading(false);
      setPathwayError(language === 'ar' ? 'بيانات المراجع غير مكتملة.' : 'Patient data is incomplete.');
      return;
    }

    setInitialLoading(true);
    setPathwayError(null);
    try {
      await refreshJourney({ enterIfMissing: true });
    } catch (err) {
      console.error('[PatientPageThemeAware] loadPathway:', err);
      setPathwayError(language === 'ar' ? 'تعذر تحميل المسار الطبي. حاول مرة أخرى.' : 'Unable to load the medical pathway. Please try again.');
    } finally {
      setInitialLoading(false);
    }
  }, [language, patientId, refreshJourney]);

  const activeIndex = useMemo(() => stations.findIndex((s) => normalize(s.status) === 'ready' && s.yourNumber !== null), [stations]);
  const activeStation = activeIndex >= 0 ? stations[activeIndex] : null;
  const activeQueueId = activeStation?.queueId || stations.find((station) => station.queueId)?.queueId || patientData?.queueId || null;
  const completedCount = useMemo(() => stations.filter((s) => normalize(s.status) === 'completed').length, [stations]);
  const allCompleted = stations.length > 0 && stations.every((s) => normalize(s.status) === 'completed');
  const progress = stations.length > 0 ? Math.round((completedCount / stations.length) * 100) : 0;

  useEffect(() => { void loadPathway(); }, [loadPathway]);

  useEffect(() => {
    if (!patientId || !activeQueueId) return undefined;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`queue:${activeQueueId}`, { config: { private: false } })
      .on('broadcast', { event: 'queue_changed' }, (message) => {
        const receivedAt = Date.now();
        const payload = message?.payload || message || {};
        setRealtimeLastEventAt(receivedAt);
        setRealtimeEventCount((count) => count + 1);
        applyRouteVersion(payload.version, receivedAt);

        const nextStep = Number(payload.current_step);
        const nextStatus = String(payload.status || '').trim().toLowerCase();
        if (Number.isFinite(nextStep)) {
          setStations((previous) => previous.map((station, index) => {
            if (['done', 'completed'].includes(nextStatus) || index < nextStep) {
              return { ...station, status: 'completed', isEntered: false };
            }
            if (index === nextStep) return { ...station, status: 'ready' };
            return { ...station, status: 'locked', isEntered: false };
          }));
        }

        void refreshJourney({ enterIfMissing: false });
      })
      .subscribe((status) => setRealtimeStatus(status));

    channelRef.current = channel;
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setRealtimeStatus('CLOSED');
    };
  }, [activeQueueId, applyRouteVersion, patientId, refreshJourney]);

  useEffect(() => {
    if (!patientId) return undefined;
    let inFlight = false;
    pollTimerRef.current = window.setInterval(() => {
      if (inFlight || document.visibilityState === 'hidden') return;
      inFlight = true;
      void refreshJourney({ enterIfMissing: false })
        .finally(() => { inFlight = false; });
    }, Math.max(GENERAL_REFRESH_INTERVAL || 5000, 5000));
    return () => {
      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    };
  }, [patientId, refreshJourney]);

  useEffect(() => {
    if (!patientId) return undefined;
    const alertId = String(patientData?.military_number || patientData?.militaryId || patientId);
    let alive = true;
    const loadAlerts = async () => {
      const { data } = await supabase.from('direct_alerts').select('*').eq('patient_id', alertId).eq('is_active', true).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false });
      if (alive && Array.isArray(data) && data.length) setDirectAlerts(data);
    };
    void loadAlerts();
    const channel = supabase.channel(`direct_alerts_${alertId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_alerts', filter: `patient_id=eq.${alertId}` }, (payload) => {
      const alert = payload.new;
      if (alert?.is_active && new Date(alert.expires_at) > new Date()) setDirectAlerts((prev) => [alert, ...prev]);
    }).subscribe();
    return () => { alive = false; supabase.removeChannel(channel); };
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
      <div className="min-h-screen p-4 flex items-center justify-center" style={shellStyle} data-test="completion-screen" data-route-version={routeVersion} data-last-sync-at={lastSyncAt || ''} data-realtime-status={realtimeStatus} data-realtime-events={realtimeEventCount} data-realtime-last-event-at={realtimeLastEventAt} data-route-version-updated-at={routeVersionUpdatedAt}>
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <img src="/mms-logo.png" alt="اللجنة الطبية العسكرية" className="mx-auto w-24 h-24 object-contain" />
          <CheckCircle className="w-24 h-24 mx-auto" style={accentStyle} />
          <Card className="shadow-2xl" style={{ backgroundColor: 'hsl(var(--card) / 0.78)', borderColor: 'hsl(var(--theme-secondary) / 0.3)' }}>
            <CardContent className="p-8 space-y-6">
              <h1 className="text-4xl sm:text-5xl font-black" style={textStyle}>{language === 'ar' ? 'اكتمل المسار الطبي' : 'Medical pathway completed'}</h1>
              <p className="text-lg leading-relaxed" style={subTextStyle}>{language === 'ar' ? 'تم إنهاء جميع المحطات بنجاح.' : 'All stations have been completed successfully.'}</p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Button onClick={() => window.location.reload()} className="font-bold" style={{ backgroundColor: 'hsl(var(--theme-secondary))', color: 'hsl(var(--background))' }}>
                  <RefreshCw className="w-4 h-4 me-2" />{language === 'ar' ? 'تحديث' : 'Refresh'}
                </Button>
                <Button onClick={onLogout} variant="outline" style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}>{t('exitSystem', language)}</Button>
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
          <p className="text-lg" style={textStyle}>{language === 'ar' ? 'جارٍ تحميل المسار الطبي...' : 'Loading medical pathway...'}</p>
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
            <h2 className="text-xl font-bold" style={textStyle}>{language === 'ar' ? 'تعذر تحميل المسار' : 'Unable to load pathway'}</h2>
            <p className="leading-relaxed" style={subTextStyle}>{pathwayError}</p>
            <div className="flex gap-3 justify-center pt-2">
              <Button onClick={() => window.location.reload()} className="font-bold" style={{ backgroundColor: 'hsl(var(--theme-secondary))', color: 'hsl(var(--background))' }}>
                <RefreshCw className="w-4 h-4 me-2" />{language === 'ar' ? 'إعادة المحاولة' : 'Retry'}
              </Button>
              <Button onClick={onLogout} variant="outline" style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}>{language === 'ar' ? 'العودة' : 'Back'}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent px-3 py-4 overflow-x-hidden overflow-y-auto" data-test="patient-page" data-current-clinic={activeStation?.id || ''} data-route-version={routeVersion} data-last-sync-at={lastSyncAt || ''} data-realtime-status={realtimeStatus} data-realtime-events={realtimeEventCount} data-realtime-last-event-at={realtimeLastEventAt} data-route-version-updated-at={routeVersionUpdatedAt}>
      {currentNotice && (
        <div className="fixed top-4 right-4 z-50 max-w-sm rounded-2xl border p-4 shadow-2xl backdrop-blur" style={sheetStyle}>
          <div className="flex items-start gap-3">
            <div className="mt-0.5" style={accentStyle}><Bell className="w-4 h-4" /></div>
            <div className="flex-1 text-sm leading-relaxed" style={textStyle}>{currentNotice}</div>
            <button onClick={() => setCurrentNotice(null)} style={subTextStyle}>✕</button>
          </div>
        </div>
      )}

      {directAlerts.length > 0 && (
        <div className="fixed top-4 left-4 z-50 space-y-2 max-w-sm">
          {directAlerts.slice(0, 3).map((alert) => (
            <div key={alert.id} className="flex items-start gap-3 p-4 rounded-2xl shadow-2xl border backdrop-blur-sm" style={alert.alert_type === 'urgent' ? { backgroundColor: 'hsl(var(--destructive) / 0.9)', borderColor: 'hsl(var(--destructive) / 0.5)' } : alert.alert_type === 'warning' ? { backgroundColor: 'hsl(var(--theme-secondary) / 0.22)', borderColor: 'hsl(var(--theme-secondary) / 0.45)' } : alert.alert_type === 'success' ? { backgroundColor: 'hsl(var(--theme-surface) / 0.92)', borderColor: 'hsl(var(--theme-secondary) / 0.3)' } : { backgroundColor: 'hsl(var(--theme-surface) / 0.92)', borderColor: 'hsl(var(--theme-secondary) / 0.35)' }}>
              <p className="flex-1 text-sm font-medium leading-relaxed" style={textStyle}>{language === 'ar' ? alert.message : (alert.message_en || alert.message)}</p>
              <button onClick={() => dismissDirectAlert(alert.id)} style={subTextStyle}>✕</button>
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
            <h1 className="text-xl font-bold" style={textStyle}>{language === 'ar' ? 'اللجنة الطبية العسكرية' : 'Military Medical Committee'}</h1>
            <p className="text-sm font-semibold" style={accentStyle}>{language === 'ar' ? 'قيادة الخدمات الطبية العسكرية' : 'Military Medical Services Command'}</p>
            <p className="text-xs" style={subTextStyle}>{language === 'ar' ? 'المركز الطبي التخصصي العسكري - العطار' : 'Military Specialized Medical Center – Al-Attar'}</p>
          </div>
        </div>

        <div className="rounded-2xl border p-4 shadow-lg backdrop-blur-sm" style={{ backgroundColor: 'hsl(var(--theme-surface) / 0.78)', borderColor: 'hsl(var(--theme-secondary) / 0.22)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl" style={{ backgroundColor: 'hsl(var(--muted) / 0.7)' }}>⚕️</div>
            <div>
              <p className="font-medium text-sm" style={textStyle}>{language === 'ar' ? 'يتم التحكم في تدفق المرضى من قبل الأطباء' : 'Patient flow controlled by doctors'}</p>
              <p className="text-xs" style={subTextStyle}>{language === 'ar' ? 'سيتم استدعاؤك تلقائياً عند حلول دورك' : 'You will be called automatically'}</p>
            </div>
          </div>
        </div>

        <Card className="shadow-xl" style={panelStyle}>
          <CardHeader className="text-center pb-3 pt-4">
            <CardTitle className="text-xl font-bold tracking-tight" style={textStyle}>{t('yourMedicalRoute', language)}</CardTitle>
            <p className="text-sm mt-1.5" style={subTextStyle}>{t('exam', language)}: <span className="font-bold" style={accentStyle}>{examName}</span></p>
            <div className="mt-3 h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'hsl(var(--muted))' }}><div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: 'hsl(var(--theme-secondary))' }} /></div>
            <p className="text-xs mt-2" style={subTextStyle}>{language === 'ar' ? `تقدم الرحلة: ${completedCount}/${stations.length} مكتمل` : `Journey progress: ${completedCount}/${stations.length} completed`}</p>
          </CardHeader>

          <CardContent className="space-y-3 px-3 pb-4">
            {stations.map((station, index) => {
              const status = normalize(station.status);
              const canEnter = status === 'ready' && !station.isEntered;
              const active = activeIndex === index;
              return (
                <Card key={station.id} data-test="route-station" data-clinic-id={station.id} data-status={status} data-order={index + 1} className="border transition-all duration-200" style={status === 'ready' ? { backgroundColor: 'hsl(var(--theme-surface) / 0.8)', borderColor: 'hsl(var(--theme-secondary) / 0.45)' } : status === 'completed' ? { backgroundColor: 'hsl(var(--theme-surface) / 0.65)', borderColor: 'hsl(var(--theme-secondary) / 0.22)', opacity: 0.78 } : { backgroundColor: 'hsl(var(--theme-surface) / 0.56)', borderColor: 'hsl(var(--border) / 0.5)' }}>
                  <CardContent className="p-3.5 sm:p-5">
                    <div className="flex items-center justify-between mb-3 gap-2">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={status === 'ready' ? { backgroundColor: 'hsl(var(--theme-secondary) / 0.18)' } : status === 'completed' ? { backgroundColor: 'hsl(var(--theme-secondary) / 0.1)' } : { backgroundColor: 'hsl(var(--muted))' }}>
                          {status === 'ready' ? <Unlock className="w-5 h-5" style={accentStyle} /> : status === 'completed' ? <CheckCircle className="w-5 h-5" style={accentStyle} /> : <Lock className="w-5 h-5" style={subTextStyle} />}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base font-bold leading-tight" style={textStyle}>{language === 'ar' ? station.nameAr : station.name}</h3>
                          <p className="text-sm mt-0.5" style={subTextStyle}>{t('floor', language)}: <span className="font-semibold" style={textStyle}>{language === 'ar' ? station.floor : station.floorCode}</span></p>
                        </div>
                      </div>
                      <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap border" style={status === 'ready' ? { backgroundColor: 'hsl(var(--theme-secondary) / 0.12)', color: 'hsl(var(--theme-secondary))', borderColor: 'hsl(var(--theme-secondary) / 0.3)' } : status === 'completed' ? { backgroundColor: 'hsl(var(--theme-secondary) / 0.08)', color: 'hsl(var(--theme-secondary))', borderColor: 'hsl(var(--theme-secondary) / 0.25)' } : { backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--theme-text-secondary))', borderColor: 'hsl(var(--border))' }}>{status === 'ready' ? t('ready', language) : status === 'completed' ? (language === 'ar' ? 'مكتمل ✓' : 'Completed ✓') : t('locked', language)}</span>
                    </div>

                    {status !== 'completed' && (
                      <div className="grid grid-cols-2 gap-2.5 text-center" data-test="queue-info">
                        <div className="py-4 px-2 rounded-xl border-2" style={{ backgroundColor: 'hsl(var(--theme-secondary) / 0.12)', borderColor: 'hsl(var(--theme-secondary) / 0.4)' }}>
                          <div className="text-4xl font-black mb-1.5 leading-none" style={accentStyle} data-test="your-number">{typeof station.yourNumber === 'number' ? station.yourNumber : (status === 'ready' ? '...' : '—')}</div>
                          <div className="text-sm font-bold tracking-wide mt-0.5" style={subTextStyle}>{t('yourNumber', language)}</div>
                        </div>
                        <div className="py-4 px-2 rounded-xl border" style={{ backgroundColor: 'hsl(var(--muted) / 0.7)', borderColor: 'hsl(var(--border))' }}>
                          <div className="text-4xl font-black mb-1.5 leading-none" style={textStyle} data-test="ahead-count">{typeof station.ahead === 'number' ? station.ahead : (status === 'ready' ? '...' : '—')}</div>
                          <div className="text-sm font-bold tracking-wide mt-0.5" style={subTextStyle}>{t('ahead', language)}</div>
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
                              <div className="flex items-center gap-2"><span className="text-lg">⏳</span><span className="font-semibold text-sm" style={accentStyle}>{language === 'ar' ? 'انتظر دورك' : 'Wait for your turn'}</span></div>
                              <span className="text-xs font-medium" style={accentStyle}>{language === 'ar' ? `أمامك ${station.ahead ?? '—'} شخص` : `${station.ahead ?? '—'} ahead`}</span>
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
                        {station.entered_at && <div className="text-sm flex items-center gap-2" style={subTextStyle}><Clock className="w-4 h-4" /><span>{language === 'ar' ? 'وقت الدخول:' : 'Entry time:'} {formatTime(new Date(station.entered_at))}</span></div>}
                      </div>
                    )}

                    {active && status !== 'completed' && <div className="mt-3 pt-3 border-t text-center text-sm font-bold" style={{ borderColor: 'hsl(var(--theme-secondary) / 0.22)', color: 'hsl(var(--theme-secondary))' }}>{language === 'ar' ? 'المحطة الحالية ✓' : 'Current station ✓'}</div>}
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

export default PatientPageThemeAware;

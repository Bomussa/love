/**
 * LiveStatisticsPanel
 *
 * لوحة إحصائيات حية تعتمد على بيانات unified_queue و clinics مباشرة.
 * الهدف: منع ظهور أصفار افتراضية قبل التحميل، وإظهار قيمة حقيقية أو حالة تحميل/خطأ واضحة.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { 
  BarChart3,
  RefreshCw,
  AlertCircle,
  Users,
  Clock,
  CheckCircle2,
  Building2,
  Timer,
  UserCheck,
  UserX,
  Activity,
  TrendingUp,
} from 'lucide-react';
import { supabase } from '../lib/supabase-client';

const qatarToday = () => new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split('T')[0];
const isDoneStatus = (status) => ['completed', 'done'].includes(String(status || '').toLowerCase());
const isWaitingStatus = (status) => ['waiting'].includes(String(status || '').toLowerCase());
const isInClinicStatus = (status) => ['called', 'serving', 'in_progress'].includes(String(status || '').toLowerCase());
const isSkippedStatus = (status) => ['absent', 'no_show'].includes(String(status || '').toLowerCase());

function humanizeClinicName(clinicId, clinicsById) {
  if (!clinicId) return '—';
  const clinic = clinicsById.get(clinicId);
  return clinic?.name_ar || clinic?.name_en || clinic?.name || String(clinicId);
}

function safeDateHour(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.getHours() : null;
}

function formatMaybeNumber(value) {
  if (value === null || value === undefined) return '—';
  if (Number.isNaN(value)) return '—';
  return value;
}

export const LiveStatisticsPanel = ({ isOpen, onClose, language = 'ar' }) => {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [source, setSource] = useState('');

  const ar = language === 'ar';

  const refreshStats = useCallback(async () => {
    setIsLoading(true);
    setError('');

    const today = qatarToday();

    try {
      const [queueRes, clinicsRes] = await Promise.all([
        supabase
          .from('unified_queue')
          .select('id, patient_id, personal_id, clinic_id, status, exam_type, gender, entered_at, called_at, completed_at, exam_start_time, queue_date')
          .eq('queue_date', today),
        supabase
          .from('clinics')
          .select('id, name, name_ar, name_en, is_active')
      ]);

      if (queueRes.error) throw queueRes.error;
      if (clinicsRes.error) throw clinicsRes.error;

      const rows = Array.isArray(queueRes.data) ? queueRes.data : [];
      const clinics = Array.isArray(clinicsRes.data) ? clinicsRes.data : [];
      const clinicsById = new Map(clinics.map((clinic) => [clinic.id, clinic]));

      const uniquePatients = new Set(
        rows
          .map((row) => row.patient_id || row.personal_id)
          .filter(Boolean)
      );

      const byClinic = {};
      const byExamType = {};
      const byGender = { male: 0, female: 0 };
      const hourlyStats = {};
      let waitingNow = 0;
      let completedToday = 0;
      let activeInClinic = 0;
      let skippedPatients = 0;
      let totalWaitMinutes = 0;
      let waitSamples = 0;

      for (const row of rows) {
        const clinicKey = humanizeClinicName(row.clinic_id, clinicsById);
        byClinic[clinicKey] = (byClinic[clinicKey] || 0) + 1;

        const examKey = row.exam_type || 'general';
        byExamType[examKey] = (byExamType[examKey] || 0) + 1;

        const genderKey = String(row.gender || '').toLowerCase();
        if (genderKey === 'male') byGender.male += 1;
        else if (genderKey === 'female') byGender.female += 1;

        const enteredHour = safeDateHour(row.entered_at);
        if (enteredHour !== null) {
          hourlyStats[enteredHour] = (hourlyStats[enteredHour] || 0) + 1;
        }

        const status = String(row.status || '').toLowerCase();
        if (isWaitingStatus(status)) waitingNow += 1;
        if (isDoneStatus(status)) completedToday += 1;
        if (isInClinicStatus(status)) activeInClinic += 1;
        if (isSkippedStatus(status)) skippedPatients += 1;

        const startPoint = row.called_at || row.exam_start_time || row.completed_at;
        if (row.entered_at && startPoint) {
          const entered = new Date(row.entered_at).getTime();
          const start = new Date(startPoint).getTime();
          if (Number.isFinite(entered) && Number.isFinite(start) && start >= entered) {
            totalWaitMinutes += Math.round((start - entered) / 60000);
            waitSamples += 1;
          }
        }
      }

      const activeClinicsFromQueue = new Set(rows.map((row) => row.clinic_id).filter(Boolean)).size;
      const activeClinicsFromTable = clinics.filter((clinic) => clinic?.is_active !== false).length;
      const activeClinics = activeClinicsFromQueue > 0 ? activeClinicsFromQueue : activeClinicsFromTable;

      const sortedHours = Object.entries(hourlyStats).map(([hour, count]) => [Number(hour), count]);
      const peakHourEntry = sortedHours.length
        ? sortedHours.reduce((best, current) => (current[1] > best[1] ? current : best), sortedHours[0])
        : [0, 0];

      setStats({
        totalToday: rows.length,
        waitingNow,
        completedToday,
        activeClinics,
        activeInClinic,
        skippedPatients,
        uniquePatients: uniquePatients.size,
        avgWaitMinutes: waitSamples > 0 ? Math.round(totalWaitMinutes / waitSamples) : 0,
        hourlyStats,
        byClinic,
        byExamType,
        byGender,
        peakHour: peakHourEntry[0] || 0,
        peakCount: peakHourEntry[1] || 0,
      });
      setSource('direct');
      setLastUpdate(new Date());
    } catch (directError) {
      try {
        const { data, error: rpcError } = await supabase.rpc('get_admin_dashboard_overview');
        if (rpcError) throw rpcError;

        const payload = data || {};
        setStats({
          totalToday: payload.total_today ?? payload.total ?? null,
          waitingNow: payload.waiting_now ?? payload.waiting ?? null,
          completedToday: payload.completed_today ?? payload.done ?? null,
          activeClinics: payload.active_clinics ?? payload.clinics ?? null,
          activeInClinic: payload.active_in_clinic ?? payload.currently_in_clinic ?? null,
          skippedPatients: payload.skipped_patients ?? payload.absent ?? null,
          uniquePatients: payload.unique_patients ?? null,
          avgWaitMinutes: payload.avg_wait_minutes ?? null,
          hourlyStats: payload.hourly_stats ?? {},
          byClinic: payload.by_clinic ?? {},
          byExamType: payload.by_exam_type ?? {},
          byGender: payload.by_gender ?? { male: null, female: null },
          peakHour: payload.peak_hour ?? 0,
          peakCount: payload.peak_count ?? 0,
        });
        setSource('rpc');
        setLastUpdate(new Date());
      } catch (rpcFallbackError) {
        setStats(null);
        setError(ar ? 'تعذر تحميل الإحصائيات الحية' : 'Failed to load live statistics');
        console.warn('[LiveStatisticsPanel] direct fetch failed:', directError, 'fallback failed:', rpcFallbackError);
      }
    } finally {
      setIsLoading(false);
    }
  }, [ar]);

  useEffect(() => {
    if (!isOpen) return;

    let alive = true;
    const runRefresh = async () => {
      if (!alive) return;
      await refreshStats();
    };

    void runRefresh();

    const interval = setInterval(runRefresh, 15000);

    const channel = supabase
      .channel('live_statistics_panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unified_queue' }, runRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clinics' }, runRefresh)
      .subscribe();

    return () => {
      alive = false;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [isOpen, refreshStats]);

  const fmt = useMemo(() => ({
    totalToday: isLoading ? '…' : formatMaybeNumber(stats?.totalToday),
    waitingNow: isLoading ? '…' : formatMaybeNumber(stats?.waitingNow),
    completedToday: isLoading ? '…' : formatMaybeNumber(stats?.completedToday),
    activeClinics: isLoading ? '…' : formatMaybeNumber(stats?.activeClinics),
  }), [isLoading, stats]);

  if (!isOpen) return null;

  const Card = ({ icon: Icon, title, value, subtitle, tone }) => (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-gray-400 text-xs">{title}</div>
          <div className="text-3xl font-bold text-white mt-1">{value}</div>
          {subtitle ? <div className="text-gray-500 text-xs mt-1">{subtitle}</div> : null}
        </div>
        <div className="shrink-0 rounded-lg bg-white/10 p-2">
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );

  const statusLine = error
    ? <div className="flex items-center gap-2 text-red-300 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>
    : <div className="text-gray-400 text-xs">{source === 'direct' ? (ar ? 'مباشر من قاعدة البيانات' : 'Direct from database') : (ar ? 'من RPC احتياطي' : 'RPC fallback')} · {lastUpdate ? lastUpdate.toLocaleTimeString(ar ? 'ar-SA' : undefined) : '—'}</div>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-gray-700 bg-gray-900/95 shadow-2xl">
        <div className="border-b border-gray-700 bg-gradient-to-r from-blue-900/40 to-purple-900/40 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/20 p-2">
                <BarChart3 className="w-6 h-6 text-blue-300" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{ar ? 'الإحصائيات الحية' : 'Live Statistics'}</h2>
                <p className="text-gray-400 text-sm">{ar ? 'بيانات حقيقية محدثة من قاعدة البيانات' : 'Real data updated from the database'}</p>
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg px-3 py-2 text-2xl text-gray-300 hover:bg-white/10">×</button>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            {statusLine}
            <button
              onClick={refreshStats}
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm text-gray-200 hover:bg-white/15"
              title={ar ? 'تحديث' : 'Refresh'}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              {ar ? 'تحديث' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="max-h-[calc(90vh-160px)] overflow-y-auto p-4">
          {isLoading && !stats ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <RefreshCw className="w-8 h-8 animate-spin" />
            </div>
          ) : stats ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card icon={Users} title={ar ? 'إجمالي اليوم' : 'Today Total'} value={fmt.totalToday} tone="bg-blue-950/30 border-blue-500/20" />
                <Card icon={Clock} title={ar ? 'في الانتظار' : 'Waiting Now'} value={fmt.waitingNow} tone="bg-yellow-950/30 border-yellow-500/20" />
                <Card icon={CheckCircle2} title={ar ? 'مكتمل اليوم' : 'Completed Today'} value={fmt.completedToday} tone="bg-green-950/30 border-green-500/20" />
                <Card icon={Building2} title={ar ? 'عيادات نشطة' : 'Active Clinics'} value={fmt.activeClinics} tone="bg-purple-950/30 border-purple-500/20" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card icon={UserCheck} title={ar ? 'داخل العيادات' : 'In Clinic'} value={formatMaybeNumber(stats.activeInClinic)} tone="bg-indigo-950/30 border-indigo-500/20" />
                <Card icon={UserX} title={ar ? 'متغيبون' : 'Skipped'} value={formatMaybeNumber(stats.skippedPatients)} tone="bg-red-950/30 border-red-500/20" />
                <Card icon={Timer} title={ar ? 'متوسط الانتظار' : 'Avg Wait'} value={`${formatMaybeNumber(stats.avgWaitMinutes)} ${ar ? 'د' : 'm'}`} tone="bg-orange-950/30 border-orange-500/20" />
                <Card icon={TrendingUp} title={ar ? 'ساعة الذروة' : 'Peak Hour'} value={`${formatMaybeNumber(stats.peakHour)}:00`} subtitle={`${formatMaybeNumber(stats.peakCount)} ${ar ? 'عملية' : 'ops'}`} tone="bg-cyan-950/30 border-cyan-500/20" />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-4">
                  <h3 className="mb-4 flex items-center gap-2 font-semibold text-white"><Activity className="w-4 h-4 text-blue-300" />{ar ? 'حسب العيادة' : 'By Clinic'}</h3>
                  <div className="space-y-3">
                    {Object.entries(stats.byClinic || {})
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 5)
                      .map(([name, count], index) => (
                        <div key={name} className="flex items-center gap-3">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${index === 0 ? 'bg-yellow-500 text-black' : index === 1 ? 'bg-gray-400 text-black' : index === 2 ? 'bg-amber-700 text-white' : 'bg-gray-700 text-gray-300'}`}>{index + 1}</span>
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <span className="truncate text-white">{name}</span>
                              <span className="text-gray-400">{count}</span>
                            </div>
                            <div className="mt-1 h-1.5 rounded-full bg-gray-700 overflow-hidden">
                              <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.max(4, (count / Math.max(...Object.values(stats.byClinic || { x: 1 }), 1)) * 100)}%` }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    {!Object.keys(stats.byClinic || {}).length ? <div className="py-4 text-center text-gray-500">{ar ? 'لا توجد بيانات' : 'No data'}</div> : null}
                  </div>
                </div>

                <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-4">
                  <h3 className="mb-4 flex items-center gap-2 font-semibold text-white"><Activity className="w-4 h-4 text-purple-300" />{ar ? 'حسب نوع الفحص' : 'By Exam Type'}</h3>
                  <div className="space-y-3">
                    {Object.entries(stats.byExamType || {})
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 5)
                      .map(([name, count], index) => (
                        <div key={name} className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2">
                          <span className="truncate text-sm text-white">{name}</span>
                          <span className="text-gray-400 text-sm">{count}</span>
                        </div>
                      ))}
                    {!Object.keys(stats.byExamType || {}).length ? <div className="py-4 text-center text-gray-500">{ar ? 'لا توجد بيانات' : 'No data'}</div> : null}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-4">
                <h3 className="mb-4 flex items-center gap-2 font-semibold text-white"><Activity className="w-4 h-4 text-cyan-300" />{ar ? 'حسب الجنس' : 'By Gender'}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-blue-500/10 p-3 text-center">
                    <div className="text-2xl font-bold text-blue-300">{formatMaybeNumber(stats.byGender?.male)}</div>
                    <div className="text-xs text-gray-400 mt-1">{ar ? 'ذكور' : 'Male'}</div>
                  </div>
                  <div className="rounded-lg bg-pink-500/10 p-3 text-center">
                    <div className="text-2xl font-bold text-pink-300">{formatMaybeNumber(stats.byGender?.female)}</div>
                    <div className="text-xs text-gray-400 mt-1">{ar ? 'إناث' : 'Female'}</div>
                  </div>
                </div>
              </div>

              <div className="text-center text-xs text-gray-500 border-t border-gray-700 pt-2">
                {ar ? 'آخر تحديث' : 'Last updated'}: {lastUpdate ? lastUpdate.toLocaleTimeString(ar ? 'ar-SA' : undefined) : '—'}
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-gray-400">
              {ar ? 'تعذر عرض البيانات الحية' : 'Unable to display live data'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveStatisticsPanel;

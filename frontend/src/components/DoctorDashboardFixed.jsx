import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertCircle, ArrowRight, CheckCircle2, Clock3, LogOut, RefreshCcw, Stethoscope, Users2 } from 'lucide-react';
import { Card, CardContent } from './Card';
import api from '../lib/api-unified';

const normalize = (value) => String(value ?? '').trim().toLowerCase();

const pickArray = (snapshot) => {
  if (Array.isArray(snapshot)) return snapshot;
  if (!snapshot || typeof snapshot !== 'object') return [];

  const candidates = [
    snapshot.queue,
    snapshot.items,
    snapshot.rows,
    snapshot.patients,
    snapshot.list,
    snapshot.entries,
    snapshot.data,
  ];

  return candidates.find(Array.isArray) || [];
};

const pickValue = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');

const getPatientLabel = (item, index) => {
  const value = pickValue(
    item?.patient_name,
    item?.patientName,
    item?.name,
    item?.full_name,
    item?.fullName,
    item?.display_name,
    item?.username,
    item?.militaryId,
    item?.military_id,
    item?.patient_id,
    item?.patientId,
    item?.id,
  );

  return value ? String(value) : `#${index + 1}`;
};

const getQueueStatusBadge = (status) => {
  const normalized = normalize(status);
  if (['called', 'in_service', 'inservice', 'active', 'current', 'ongoing', 'examining', 'working'].includes(normalized)) {
    return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  }
  if (['completed', 'done', 'finished', 'closed'].includes(normalized)) {
    return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
  }
  if (['cancelled', 'canceled', 'no_show', 'noshow'].includes(normalized)) {
    return 'bg-red-500/15 text-red-300 border-red-500/30';
  }
  return 'bg-white/8 text-white/70 border-white/10';
};

const humanizeStatus = (status, language) => {
  const normalized = normalize(status);
  const map = {
    waiting: language === 'ar' ? 'في الانتظار' : 'Waiting',
    called: language === 'ar' ? 'تم النداء' : 'Called',
    in_service: language === 'ar' ? 'داخل الكشف' : 'In service',
    inservice: language === 'ar' ? 'داخل الكشف' : 'In service',
    active: language === 'ar' ? 'نشط' : 'Active',
    current: language === 'ar' ? 'الحالي' : 'Current',
    ongoing: language === 'ar' ? 'جارٍ' : 'Ongoing',
    examining: language === 'ar' ? 'قيد الفحص' : 'Examining',
    completed: language === 'ar' ? 'مكتمل' : 'Completed',
    done: language === 'ar' ? 'مكتمل' : 'Done',
    finished: language === 'ar' ? 'منتهي' : 'Finished',
    cancelled: language === 'ar' ? 'ملغي' : 'Cancelled',
    canceled: language === 'ar' ? 'ملغي' : 'Cancelled',
    no_show: language === 'ar' ? 'لم يحضر' : 'No show',
    noshow: language === 'ar' ? 'لم يحضر' : 'No show',
  };

  return map[normalized] || (status ? String(status) : (language === 'ar' ? 'غير معروف' : 'Unknown'));
};

function DoctorDashboardFixed({ doctorData, onLogout, language = 'ar', toggleLanguage }) {
  const clinicId = doctorData?.clinic_id || doctorData?.clinicId || doctorData?.clinic || null;
  const clinicName = doctorData?.clinic_name || doctorData?.clinicName || doctorData?.clinic_label || clinicId || (language === 'ar' ? 'غير محددة' : 'Unassigned');
  const doctorKey = doctorData?.id || doctorData?.username || doctorData?.name || doctorData?.doctorId || clinicId || 'doctor';

  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const queue = useMemo(() => pickArray(snapshot), [snapshot]);

  const currentPatient = useMemo(() => {
    if (snapshot && typeof snapshot === 'object') {
      const direct = pickValue(snapshot.currentPatient, snapshot.current, snapshot.activePatient, snapshot.calledPatient, snapshot.current_queue, snapshot.currentQueue);
      if (direct && typeof direct === 'object') return direct;
    }

    const active = queue.find((item) => ['called', 'in_service', 'inservice', 'active', 'current', 'ongoing', 'examining', 'working'].includes(normalize(item?.status)));
    return active || queue[0] || null;
  }, [queue, snapshot]);

  const waitingCount = useMemo(() => {
    if (typeof snapshot?.waitingCount === 'number') return snapshot.waitingCount;
    if (typeof snapshot?.waiting_count === 'number') return snapshot.waiting_count;
    if (typeof snapshot?.waiting === 'number') return snapshot.waiting;
    return queue.filter((item) => normalize(item?.status || 'waiting') === 'waiting').length;
  }, [queue, snapshot]);

  const refreshStatus = useCallback(async ({ silent = false } = {}) => {
    if (!clinicId) {
      setError(language === 'ar' ? 'الطبيب غير مرتبط بعيادة.' : 'No clinic is assigned to this doctor.');
      setSnapshot(null);
      setLoading(false);
      return;
    }

    if (!silent) setLoading(true);
    try {
      const res = await api.getQueueStatus(clinicId);
      if (res?.success === false) {
        throw new Error(res?.error || res?.message || (language === 'ar' ? 'تعذر جلب حالة الطابور' : 'Failed to load queue status'));
      }

      setSnapshot(res?.data ?? res ?? null);
      setError('');
    } catch (err) {
      setError(err?.message || (language === 'ar' ? 'حدث خطأ غير متوقع' : 'An unexpected error occurred'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [clinicId, language]);

  useEffect(() => {
    refreshStatus();
    const timer = setInterval(() => refreshStatus({ silent: true }), 5000);
    return () => clearInterval(timer);
  }, [refreshStatus]);

  const runAction = useCallback(async (key, actionFn, successMessage) => {
    setAction(key);
    setNotice('');
    setError('');

    try {
      const res = await actionFn();
      if (res?.success === false) {
        throw new Error(res?.error || res?.message || (language === 'ar' ? 'فشل التنفيذ' : 'Operation failed'));
      }
      setNotice(successMessage);
      await refreshStatus({ silent: true });
    } catch (err) {
      setError(err?.message || (language === 'ar' ? 'فشل التنفيذ' : 'Operation failed'));
    } finally {
      setAction(null);
    }
  }, [language, refreshStatus]);

  const currentQueueId = pickValue(currentPatient?.queueId, currentPatient?.queue_id, currentPatient?.id, currentPatient?.queueID);
  const currentPatientId = pickValue(currentPatient?.patient_id, currentPatient?.patientId, currentPatient?.personal_id, currentPatient?.militaryId, currentPatient?.military_id, currentPatient?.id);
  const currentStatus = currentPatient?.status || snapshot?.status || (currentPatient ? 'waiting' : 'idle');

  const hasCurrentPatient = Boolean(currentPatient);
  const isBusy = action !== null || loading;

  return (
    <div className="min-h-screen px-4 py-5 md:px-6 md:py-8 text-white" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <header className="rounded-3xl border border-white/10 bg-black/25 p-5 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
                <Stethoscope className="h-4 w-4 text-cyan-300" />
                {language === 'ar' ? 'لوحة الطبيب' : 'Doctor dashboard'}
              </div>
              <div>
                <h1 className="text-2xl font-bold leading-tight md:text-3xl">
                  {doctorData?.name || doctorData?.username || (language === 'ar' ? 'الطبيب' : 'Doctor')}
                </h1>
                <p className="mt-1 text-sm text-white/70">
                  {language === 'ar' ? 'العيادة المرتبطة' : 'Assigned clinic'}: <span className="font-semibold text-white">{clinicName}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {toggleLanguage && (
                <button
                  type="button"
                  onClick={toggleLanguage}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  {language === 'ar' ? 'English 🇺🇸' : 'العربية 🇶🇦'}
                </button>
              )}
              <button
                type="button"
                onClick={() => refreshStatus()}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading}
              >
                <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {language === 'ar' ? 'تحديث' : 'Refresh'}
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-2 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/20 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
                {language === 'ar' ? 'خروج' : 'Logout'}
              </button>
            </div>
          </div>
        </header>

        {(error || notice) && (
          <div className="grid gap-3 md:grid-cols-2">
            {error && (
              <Card className="border-red-500/20 bg-red-500/10 backdrop-blur">
                <CardContent className="flex items-start gap-3 p-4 text-red-100">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-none" />
                  <div>
                    <p className="font-semibold">{language === 'ar' ? 'خطأ' : 'Error'}</p>
                    <p className="text-sm text-red-100/90">{error}</p>
                  </div>
                </CardContent>
              </Card>
            )}
            {notice && (
              <Card className="border-emerald-500/20 bg-emerald-500/10 backdrop-blur">
                <CardContent className="flex items-start gap-3 p-4 text-emerald-100">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none" />
                  <div>
                    <p className="font-semibold">{language === 'ar' ? 'تم' : 'Done'}</p>
                    <p className="text-sm text-emerald-100/90">{notice}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[1fr_1.55fr]">
          <Card className="border-white/10 bg-black/25 shadow-2xl backdrop-blur-xl">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-white/60">{language === 'ar' ? 'ملخص العيادة' : 'Clinic summary'}</p>
                  <h2 className="mt-1 text-xl font-semibold">{clinicName}</h2>
                </div>
                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-cyan-200">
                  <Users2 className="h-6 w-6" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-white/50">{language === 'ar' ? 'المنتظرون' : 'Waiting'}</p>
                  <p className="mt-2 text-3xl font-bold">{Number.isFinite(waitingCount) ? waitingCount : 0}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-white/50">{language === 'ar' ? 'الحالة' : 'Status'}</p>
                  <p className="mt-2 text-sm font-semibold text-white/90">{humanizeStatus(currentStatus, language)}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/75">
                <p>{language === 'ar' ? 'رمز الطبيب' : 'Doctor key'}: <span className="font-semibold text-white">{doctorKey}</span></p>
                <p className="mt-1">{language === 'ar' ? 'المعرف' : 'Clinic ID'}: <span className="font-semibold text-white">{clinicId || (language === 'ar' ? 'غير متوفر' : 'Unavailable')}</span></p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-black/25 shadow-2xl backdrop-blur-xl">
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm text-white/60">{language === 'ar' ? 'المراجع الحالي' : 'Current patient'}</p>
                  <h2 className="mt-1 text-xl font-semibold">
                    {hasCurrentPatient ? getPatientLabel(currentPatient, 0) : (language === 'ar' ? 'لا يوجد مراجع حالي' : 'No current patient')}
                  </h2>
                </div>
                <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${getQueueStatusBadge(currentStatus)}`}>
                  <Clock3 className="h-4 w-4" />
                  {humanizeStatus(currentStatus, language)}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-white/50">{language === 'ar' ? 'رقم المراجع' : 'Patient ID'}</p>
                  <p className="mt-2 break-words text-sm font-semibold text-white">{currentPatientId || (language === 'ar' ? 'غير متوفر' : 'Unavailable')}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-white/50">{language === 'ar' ? 'رقم الدور' : 'Queue number'}</p>
                  <p className="mt-2 text-sm font-semibold text-white">{pickValue(currentPatient?.display_number, currentPatient?.displayNumber, currentPatient?.queue_number, currentPatient?.queueNumber, currentPatient?.number) || (language === 'ar' ? 'غير متوفر' : 'Unavailable')}</p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <button
                  type="button"
                  onClick={() => runAction(
                    'call',
                    () => api.callNextPatient(clinicId, doctorKey),
                    language === 'ar' ? 'تم استدعاء المراجع التالي' : 'Next patient called',
                  )}
                  disabled={!clinicId || isBusy}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowRight className="h-4 w-4" />
                  {language === 'ar' ? 'استدعاء التالي' : 'Call next'}
                </button>

                <button
                  type="button"
                  onClick={() => runAction(
                    'start',
                    () => {
                      if (!currentQueueId) throw new Error(language === 'ar' ? 'لا يوجد معرف صف صالح' : 'No valid queue identifier');
                      return api.startExamination(currentQueueId, doctorKey);
                    },
                    language === 'ar' ? 'بدأت مرحلة الفحص' : 'Examination started',
                  )}
                  disabled={!clinicId || !hasCurrentPatient || isBusy}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Stethoscope className="h-4 w-4" />
                  {language === 'ar' ? 'بدء الفحص' : 'Start exam'}
                </button>

                <button
                  type="button"
                  onClick={() => runAction(
                    'advance',
                    () => {
                      if (!currentQueueId) throw new Error(language === 'ar' ? 'لا يوجد معرف صف صالح' : 'No valid queue identifier');
                      return api.advancePatient(currentQueueId, clinicId, currentPatient?.version ?? null);
                    },
                    language === 'ar' ? 'تم تمرير المراجع للمحطة التالية' : 'Patient advanced',
                  )}
                  disabled={!clinicId || !hasCurrentPatient || isBusy}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowRight className="h-4 w-4" />
                  {language === 'ar' ? 'تمرير الدور' : 'Advance'}
                </button>

                <button
                  type="button"
                  onClick={() => runAction(
                    'complete',
                    () => {
                      if (!currentPatientId) throw new Error(language === 'ar' ? 'لا يوجد رقم مراجع صالح' : 'No valid patient identifier');
                      return api.queueDone(clinicId, currentPatientId);
                    },
                    language === 'ar' ? 'اكتملت محطة العيادة' : 'Clinic stage completed',
                  )}
                  disabled={!clinicId || !hasCurrentPatient || isBusy}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm font-medium text-blue-100 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {language === 'ar' ? 'إنهاء المرحلة' : 'Complete'}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-white/10 bg-black/25 shadow-2xl backdrop-blur-xl">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-white/60">{language === 'ar' ? 'قائمة الانتظار' : 'Queue list'}</p>
                <h2 className="mt-1 text-xl font-semibold">{language === 'ar' ? 'المراجعين في هذه العيادة' : 'Patients in this clinic'}</h2>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white/70">
                <Users2 className="h-5 w-5" />
              </div>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
                {language === 'ar' ? 'جارٍ تحميل الحالة...' : 'Loading status...'}
              </div>
            ) : queue.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
                {language === 'ar' ? 'لا توجد حالات في قائمة الانتظار الآن.' : 'There are no queued patients right now.'}
              </div>
            ) : (
              <div className="grid gap-3">
                {queue.slice(0, 12).map((item, index) => {
                  const itemStatus = item?.status || 'waiting';
                  const itemLabel = getPatientLabel(item, index);
                  const itemId = pickValue(item?.patient_id, item?.patientId, item?.militaryId, item?.military_id, item?.id);
                  const itemNumber = pickValue(item?.display_number, item?.displayNumber, item?.queue_number, item?.queueNumber, item?.number);

                  return (
                    <div
                      key={`${itemId || itemLabel}-${index}`}
                      className={`flex flex-col gap-3 rounded-2xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between ${normalize(itemStatus) === normalize(currentStatus) ? 'border-cyan-500/30 bg-cyan-500/10' : 'border-white/10 bg-white/5'}`}
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-white">{itemLabel}</span>
                          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${getQueueStatusBadge(itemStatus)}`}>
                            {humanizeStatus(itemStatus, language)}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-white/60">
                          <span>{language === 'ar' ? 'رقم الدور' : 'Queue'}: <span className="text-white/80">{itemNumber || '—'}</span></span>
                          <span>{language === 'ar' ? 'المعرف' : 'ID'}: <span className="text-white/80">{itemId || '—'}</span></span>
                        </div>
                      </div>
                      {normalize(itemStatus) === normalize(currentStatus) && (
                        <div className="inline-flex items-center gap-2 text-xs font-medium text-cyan-200">
                          <Activity className="h-4 w-4" />
                          {language === 'ar' ? 'الحالي الآن' : 'Current now'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default DoctorDashboardFixed;

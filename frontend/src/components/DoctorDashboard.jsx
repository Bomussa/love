import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from './Button';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import NotificationSystem, { useNotifications } from './NotificationSystem';
import { supabase } from '../lib/supabase-client';
import api from '../lib/api-unified';
import {
  Globe,
  LogOut,
  Users,
  CheckCircle,
  UserX,
  Timer,
  Activity,
  Star,
  ArrowRightLeft,
  RotateCcw,
  Building2,
  ShieldCheck,
  Clock,
  TrendingUp,
  UserCheck,
  Play,
  MoveRight,
  AlertTriangle,
  ArrowLeftRight,
} from 'lucide-react';

const todayISO = () => new Date().toISOString().split('T')[0];
const statusAliases = {
  waiting: ['waiting'],
  called: ['called'],
  inProgress: ['in_progress', 'serving'],
  done: ['done', 'completed'],
  absent: ['absent', 'no_show'],
};

const normalizeStatus = (status) => {
  const s = String(status || '').toLowerCase();
  if (statusAliases.waiting.includes(s)) return 'waiting';
  if (statusAliases.called.includes(s)) return 'called';
  if (statusAliases.inProgress.includes(s)) return 'in_progress';
  if (statusAliases.done.includes(s)) return 'done';
  if (statusAliases.absent.includes(s)) return 'absent';
  return s || 'waiting';
};

const formatElapsed = (startIso) => {
  if (!startIso) return '00:00';
  const diff = Date.now() - new Date(startIso).getTime();
  if (diff < 0) return '00:00';
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export function DoctorDashboard({ doctorData, onLogout, language, toggleLanguage }) {
  const [patients, setPatients] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ waitingNow: 0, doneToday: 0, absentToday: 0, totalToday: 0 });
  const [currentPatient, setCurrentPatient] = useState(null);
  const [timer, setTimer] = useState('00:00');
  const timerRef = useRef(null);
  const realtimeRef = useRef(null);
  const { notifications, push, dismiss } = useNotifications();

  const clinicId = doctorData?.clinic_id || doctorData?.clinicId || null;
  const clinicName = doctorData?.clinic_name || doctorData?.clinicName || (language === 'ar' ? 'العيادة' : 'Clinic');
  const clinicLabel = useMemo(() => {
    const clinic = clinics.find((c) => c.id === clinicId);
    return clinic ? (language === 'ar' ? clinic.name_ar || clinic.name : clinic.name_en || clinic.name) : clinicName;
  }, [clinics, clinicId, clinicName, language]);

  const translate = (ar, en) => (language === 'ar' ? ar : en);

  const fetchClinics = async () => {
    const { data, error } = await supabase.from('clinics').select('id, name_ar, name_en, name').eq('is_active', true).order('name_ar');
    if (!error) setClinics(data || []);
  };

  const fetchPatients = async () => {
    if (!clinicId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('unified_queue')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('queue_date', todayISO())
        .order('display_number', { ascending: true });

      if (error) throw error;

      const list = (data || []).map((row) => ({ ...row, status: normalizeStatus(row.status) }));
      const waiting = list.filter((row) => row.status === 'waiting' || row.status === 'called');
      const done = list.filter((row) => row.status === 'done');
      const absent = list.filter((row) => row.status === 'absent');
      const inProgress = list.find((row) => row.status === 'in_progress');

      setPatients(list);
      setStats({
        waitingNow: waiting.length,
        doneToday: done.length,
        absentToday: absent.length,
        totalToday: list.length,
      });
      setCurrentPatient(inProgress || null);
    } catch (error) {
      console.error('DoctorDashboard fetchPatients error:', error);
      push({ type: 'error', title: translate('خطأ', 'Error'), message: translate('تعذر تحميل بيانات الطابور', 'Failed to load queue data') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
    fetchClinics();

    const channel = supabase
      .channel(`doctor_dashboard_${clinicId || 'global'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unified_queue' }, (payload) => {
        const row = payload?.new || payload?.old;
        if (!clinicId || !row || row.clinic_id === clinicId) fetchPatients();
      })
      .subscribe();

    realtimeRef.current = channel;
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [clinicId]);

  useEffect(() => {
    if (!currentPatient?.exam_start_time) {
      if (timerRef.current) clearInterval(timerRef.current);
      setTimer('00:00');
      return undefined;
    }

    const tick = () => setTimer(formatElapsed(currentPatient.exam_start_time));
    tick();
    timerRef.current = setInterval(tick, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentPatient?.exam_start_time]);

  const updateQueue = async (id, updates) => {
    const { data, error } = await supabase.from('unified_queue').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  };

  const getNextWaiting = () => patients.filter((p) => p.status === 'waiting').sort((a, b) => (a.display_number || 0) - (b.display_number || 0))[0] || null;

  const handleCallNext = async () => {
    if (!clinicId) return;
    try {
      setLoading(true);
      if (!result?.success) throw new Error(result?.error || translate('لا يوجد دور متاح', 'No patient available'));
      push({ type: 'success', title: translate('تم النداء', 'Called'), message: translate('تم استدعاء الدور التالي', 'Next patient called') });
      await fetchPatients();
    } catch (error) {
      push({ type: 'error', title: translate('فشل', 'Failed'), message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleStartExam = async (patient) => {
    try {
      setLoading(true);
      await updateQueue(patient.id, { status: 'in_progress', exam_start_time: new Date().toISOString(), called_at: patient.called_at || new Date().toISOString() });
      push({ type: 'success', title: translate('بدء الفحص', 'Started'), message: translate('بدأ الفحص فعليًا', 'Exam has started') });
      await fetchPatients();
    } catch (error) {
      push({ type: 'error', title: translate('فشل', 'Failed'), message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleFinishExam = async (patient) => {
    try {
      setLoading(true);
      await updateQueue(patient.id, { status: 'done', completed_at: new Date().toISOString(), exam_end_time: new Date().toISOString() });
      push({ type: 'success', title: translate('انتهى الفحص', 'Finished'), message: translate('تم إنهاء الحالة بنجاح', 'Exam finished successfully') });
      await fetchPatients();
    } catch (error) {
      push({ type: 'error', title: translate('فشل', 'Failed'), message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleMoveLast = async (patient) => {
    try {
      setLoading(true);
      const { data: lastRow, error: lastError } = await supabase
        .from('unified_queue')
        .select('display_number')
        .eq('clinic_id', clinicId)
        .eq('queue_date', todayISO())
        .order('display_number', { ascending: false })
        .limit(1)
        .single();
      if (lastError && lastError.code !== 'PGRST116') throw lastError;
      await updateQueue(patient.id, { display_number: (lastRow?.display_number || 0) + 1, status: 'waiting' });
      push({ type: 'success', title: translate('تم الترحيل', 'Moved'), message: translate('تم نقل المراجع لآخر الدور', 'Patient moved to the end') });
      await fetchPatients();
    } catch (error) {
      push({ type: 'error', title: translate('فشل', 'Failed'), message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleVip = async (patient) => {
    try {
      setLoading(true);
      await updateQueue(patient.id, { is_vip: true, priority_score: 100 });
      push({ type: 'success', title: translate('VIP', 'VIP'), message: translate('تم تمييز المراجع كـ VIP', 'Patient marked as VIP') });
      await fetchPatients();
    } catch (error) {
      push({ type: 'error', title: translate('فشل', 'Failed'), message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleTransferClinic = async (patient, targetClinicId) => {
    try {
      if (!targetClinicId) return;
      setLoading(true);
      await updateQueue(patient.id, {
        clinic_id: targetClinicId,
        status: 'waiting',
        exam_start_time: null,
        exam_end_time: null,
        called_at: null,
        completed_at: null,
      });
      push({ type: 'success', title: translate('تم التحويل', 'Transferred'), message: translate('تم التحويل إلى عيادة أخرى', 'Moved to another clinic') });
      await fetchPatients();
    } catch (error) {
      push({ type: 'error', title: translate('فشل', 'Failed'), message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleMilitaryCommittee = async (patient) => {
    try {
      setLoading(true);
      await updateQueue(patient.id, {
        is_military_committee: true,
        status: 'waiting',
      });
      push({ type: 'success', title: translate('اللجنة العسكرية', 'Military'), message: translate('تم التحويل للجنة الطبية العسكرية', 'Transferred to military committee') });
      await fetchPatients();
    } catch (error) {
      push({ type: 'error', title: translate('فشل', 'Failed'), message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleAbsent = async (patient) => {
    try {
      setLoading(true);
      await updateQueue(patient.id, { status: 'absent', marked_absent_at: new Date().toISOString() });
      push({ type: 'success', title: translate('غياب', 'Absent'), message: translate('تم تسجيله كمتغيب', 'Marked as absent') });
      await fetchPatients();
    } catch (error) {
      push({ type: 'error', title: translate('فشل', 'Failed'), message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const currentWaiting = getNextWaiting();
  const transferTargets = clinics.filter((clinic) => clinic.id !== clinicId);

  return (
    <div className="min-h-screen bg-[#0f1115] text-white p-4 sm:p-6 overflow-x-hidden">
      <NotificationSystem notifications={notifications} onDismiss={dismiss} />

      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-900/40 p-6 rounded-2xl border border-white/5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-[#C9A54C] to-[#8A1538] rounded-2xl flex items-center justify-center shadow-lg shadow-red-900/20">
              <img src="/mms-logo.png" alt="Logo" className="w-12 h-12 object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{translate('اللجنة الطبية العسكرية', 'Military Medical Committee')}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="px-2 py-0.5 bg-[#C9A54C]/10 text-[#C9A54C] text-xs font-bold rounded-full border border-[#C9A54C]/20 uppercase">{clinicLabel}</span>
                <span className="text-gray-400 text-sm">{doctorData?.name ? `${translate('د.', 'Dr.') } ${doctorData.name}` : translate('غير معروف', 'Unknown')}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={toggleLanguage} className="text-gray-400 hover:text-white">
              <Globe className="w-4 h-4 me-2" />
              {language === 'ar' ? 'English' : 'العربية'}
            </Button>
            <Button variant="destructive" size="sm" onClick={onLogout} className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20">
              <LogOut className="w-4 h-4 me-2" />
              {translate('خروج', 'Logout')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: translate('المنتظرين', 'Waiting'), value: stats.waitingNow, icon: Users, color: 'text-blue-400', bg: 'bg-blue-400/10' },
            { label: translate('المنتهين', 'Done'), value: stats.doneToday, icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-400/10' },
            { label: translate('المتغيبين', 'Absent'), value: stats.absentToday, icon: UserX, color: 'text-red-400', bg: 'bg-red-400/10' },
            { label: translate('الإجمالي', 'Total'), value: stats.totalToday, icon: Activity, color: 'text-purple-400', bg: 'bg-purple-400/10' },
          ].map((stat) => (
            <Card key={stat.label} className="bg-gray-900/40 border-white/5 overflow-hidden relative group">
              <div className={`absolute top-0 right-0 w-16 h-16 ${stat.bg} rounded-bl-full -mr-8 -mt-8 transition-all group-hover:scale-110`} />
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`p-3 rounded-xl ${stat.bg}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-gradient-to-br from-gray-900 to-black border-white/10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#C9A54C] via-[#8A1538] to-[#C9A54C]" />
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-[#C9A54C]" />
                    {translate('المراجع الحالي', 'Current Patient')}
                  </span>
                  {currentPatient?.exam_start_time && (
                    <div className="flex items-center gap-2 bg-red-500/10 text-red-500 px-3 py-1 rounded-full border border-red-500/20">
                      <Timer className="w-4 h-4 animate-pulse" />
                      <span className="font-mono font-bold text-lg">{timer}</span>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {currentPatient ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between bg-white/5 p-6 rounded-2xl border border-white/5">
                      <div className="space-y-1">
                        <p className="text-sm text-gray-400 uppercase tracking-wider">{translate('رقم الدور', 'Queue Number')}</p>
                        <h2 className="text-5xl font-black text-white">{currentPatient.display_number}</h2>
                      </div>
                      <div className="text-right space-y-2">
                        <p className="text-sm text-gray-400">{translate('الحالة', 'Status')}</p>
                        <p className="text-xl font-bold text-[#C9A54C]">{currentPatient.status}</p>
                        {currentPatient.is_vip && (
                          <span className="inline-flex items-center gap-1 bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded text-xs font-bold border border-yellow-500/20">
                            <Star className="w-3 h-3 fill-current" /> VIP
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <Button variant="gradient" className="h-14 font-bold" onClick={() => handleFinishExam(currentPatient)} disabled={loading}>
                        <CheckCircle className="w-5 h-5 me-2" />
                        {translate('إنهاء الفحص', 'Finish')}
                      </Button>
                      <Button variant="outline" className="h-14 border-white/10 hover:bg-white/5" onClick={() => handleAbsent(currentPatient)} disabled={loading}>
                        <UserX className="w-5 h-5 me-2 text-red-400" />
                        {translate('غياب', 'Absent')}
                      </Button>
                      <Button variant="outline" className="h-14 border-white/10 hover:bg-white/5" onClick={() => handleMoveLast(currentPatient)} disabled={loading}>
                        <RotateCcw className="w-5 h-5 me-2 text-blue-400" />
                        {translate('آخر الدور', 'Last')}
                      </Button>
                      <Button variant="outline" className="h-14 border-white/10 hover:bg-white/5" onClick={() => handleMilitaryCommittee(currentPatient)} disabled={loading}>
                        <ShieldCheck className="w-5 h-5 me-2 text-purple-400" />
                        {translate('اللجنة العسكرية', 'Military')}
                      </Button>
                    </div>

                    <div className="pt-4 border-t border-white/5">
                      <p className="text-xs text-gray-500 mb-3 uppercase font-bold tracking-widest">{translate('تحويل لعيادة أخرى', 'Transfer to Clinic')}</p>
                      <div className="flex flex-wrap gap-2">
                        {transferTargets.slice(0, 6).map((clinic) => (
                          <Button
                            key={clinic.id}
                            variant="ghost"
                            size="sm"
                            className="bg-white/5 hover:bg-[#C9A54C]/20 text-xs border border-white/5"
                            onClick={() => handleTransferClinic(currentPatient, clinic.id)}
                          >
                            <Building2 className="w-3 h-3 me-1" />
                            {language === 'ar' ? clinic.name_ar || clinic.name : clinic.name_en || clinic.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center space-y-4">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/5">
                      <Users className="w-10 h-10 text-gray-600" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xl font-bold text-gray-400">{translate('لا يوجد مراجع حالي', 'No Active Patient')}</h3>
                      <p className="text-sm text-gray-500">{translate('استدعِ المراجع التالي من القائمة', 'Call the next patient from the waiting list')}</p>
                    </div>
                    <Button variant="gradientSecondary" size="lg" className="mt-4 px-12 h-14 text-lg font-black shadow-xl shadow-red-900/20" onClick={handleCallNext} disabled={loading || patients.filter((p) => p.status === 'waiting').length === 0}>
                      <TrendingUp className="w-6 h-6 me-3" />
                      {translate('استدعاء التالي', 'Call Next')}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-gray-900/40 border-white/5 h-full flex flex-col">
              <CardHeader className="border-b border-white/5 pb-4">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-400" />
                    {translate('قائمة الانتظار', 'Waiting List')}
                  </span>
                  <span className="bg-blue-400/10 text-blue-400 px-2 py-0.5 rounded text-xs font-bold border border-blue-400/20">
                    {patients.filter((p) => p.status === 'waiting' || p.status === 'called').length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex-grow overflow-y-auto max-h-[600px] custom-scrollbar">
                {patients.filter((p) => p.status === 'waiting' || p.status === 'called').length === 0 ? (
                  <div className="p-12 text-center text-gray-500 italic">{translate('القائمة فارغة', 'List is empty')}</div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {patients.filter((p) => p.status === 'waiting' || p.status === 'called').map((patient) => (
                      <div key={patient.id} className={`p-4 hover:bg-white/5 transition-colors group ${patient.status === 'called' ? 'bg-yellow-500/5' : ''}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl border shadow-inner ${patient.status === 'called' ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-500' : 'bg-gray-800 border-white/10 text-white'}`}>
                              {patient.display_number}
                            </div>
                            <div>
                              <div className="font-bold flex items-center gap-2">
                                {translate(`مراجع رقم ${patient.display_number}`, `Patient #${patient.display_number}`)}
                                {patient.is_vip && <Star className="w-3 h-3 text-yellow-500 fill-current" />}
                              </div>
                              <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                                <Clock className="w-3 h-3" />
                                {new Date(patient.entered_at || patient.created_at).toLocaleTimeString(language === 'ar' ? 'ar-QA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {patient.status === 'called' ? (
                              <Button size="sm" variant="gradient" className="h-8 text-xs font-bold" onClick={() => handleStartExam(patient)} disabled={loading || !!currentPatient}>
                                <UserCheck className="w-3 h-3 me-1" /> {translate('بدء', 'Start')}
                              </Button>
                            ) : (
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 bg-white/5 hover:bg-yellow-500/20 text-yellow-500" onClick={() => handleVip(patient)} title={translate('تمييز VIP', 'Mark VIP')}>
                                  <Star className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 bg-white/5 hover:bg-red-500/20 text-red-500" onClick={() => handleAbsent(patient)} title={translate('غياب', 'Absent')}>
                                  <UserX className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 bg-white/5 hover:bg-blue-500/20 text-blue-400" onClick={() => handleMoveLast(patient)} title={translate('آخر الدور', 'Move last')}>
                                  <RotateCcw className="w-4 h-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
              <div className="p-4 bg-black/20 border-t border-white/5">
                <p className="text-[10px] text-center text-gray-600 uppercase tracking-widest font-bold">{translate('نظام إدارة طوابير اللجنة الطبية', 'MMC Queue Management System')}</p>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      ` }} />
    </div>
  );
}

export default DoctorDashboard;

/**
 * DoctorControl — لوحة تحكم الطبيب في شاشة الإدارة
 * ميزات كاملة: إحصائيات يومية، VIP، تمرير الدور، وقت الدخول/الخروج، تحديث لحظي
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Users, Clock, CheckCircle, Activity, Phone,
  RotateCcw, UserCheck, Search, RefreshCw, UserX, Play,
  Star, ArrowRightLeft, Timer, Shield, LogIn, LogOut
} from 'lucide-react';
import { supabase } from '../lib/supabase-client';
import toast from 'react-hot-toast';

// توقيت قطر (UTC+3) — يطابق qatar_today() في Supabase
const getQatarDate = () =>
  new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split('T')[0];
const getQatarNow = () =>
  new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

const DoctorControl = ({ language = 'ar', t = (ar) => ar, doctorId, clinicId }) => {
  const [patients,         setPatients]         = useState([]);
  const [clinics,          setClinics]          = useState([]);
  const [selectedClinic,   setSelectedClinic]   = useState(clinicId || '');
  const [loading,          setLoading]          = useState(true);
  const [stats,            setStats]            = useState({ waiting:0, inProgress:0, completed:0, missed:0, avgWaitTime:0, avgExamTime:0 });
  const [currentPatient,   setCurrentPatient]   = useState(null);
  const [searchTerm,       setSearchTerm]       = useState('');
  const [filterStatus,     setFilterStatus]     = useState('all');
  const [examTimer,        setExamTimer]        = useState('00:00');
  const [showVipModal,     setShowVipModal]     = useState(false);
  const [vipId,            setVipId]            = useState('');
  const [vipLoading,       setVipLoading]       = useState(false);
  const timerRef = useRef(null);

  const tr = (ar, en) => language === 'ar' ? ar : en;

  // ── مؤقت الفحص ──────────────────────────────────────────────
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (currentPatient?.exam_start_time || currentPatient?.called_at) {
      const start = new Date(currentPatient.exam_start_time || currentPatient.called_at).getTime();
      timerRef.current = setInterval(() => {
        const diff = Date.now() - start;
        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setExamTimer(`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
      }, 1000);
    } else { setExamTimer('00:00'); }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [currentPatient?.id, currentPatient?.exam_start_time, currentPatient?.called_at]);

  // ── تحميل العيادات ─────────────────────────────────────────
  const loadClinics = async () => {
    try {
      const { data } = await supabase
        .from('clinics').select('id,name_ar,name_en').eq('is_active', true).order('name_ar');
      if (data) {
        setClinics(data);
        if (!selectedClinic && data.length > 0) setSelectedClinic(data[0].id);
      }
    } catch (e) { console.error('loadClinics:', e); }
  };

  // ── تحميل المرضى — أعمدة حقيقية فقط ───────────────────────
  const loadPatients = async () => {
    if (!selectedClinic) { setLoading(false); return; }
    try {
      setLoading(true);
      const today = getQatarDate();
      const { data, error } = await supabase
        .from('unified_queue')
        .select([
          'id','display_number','patient_id',
          'military_id','personal_id','gender','exam_type',
          'status','entered_at','called_at','exam_start_time',
          'exam_end_time','completed_at',
          'is_vip','is_priority','is_military_committee','notes','queue_date'
        ].join(','))
        .eq('clinic_id', selectedClinic)
        .eq('queue_date', today)
        .order('display_number', { ascending: true });

      if (error) throw error;
      const all = data || [];
      setPatients(all);
      calcStats(all);
      setCurrentPatient(all.find(p => ['serving','called','in_progress'].includes(p.status)) || null);
    } catch (e) {
      console.error('loadPatients:', e);
      toast.error(tr('خطأ في تحميل البيانات','Error loading data'));
    } finally { setLoading(false); }
  };

  // ── حساب الإحصائيات — حالات DB الصحيحة ──────────────────
  const calcStats = (data) => {
    const waiting    = data.filter(p => p.status === 'waiting').length;
    const inProgress = data.filter(p => ['serving','called','in_progress'].includes(p.status)).length;
    const completed  = data.filter(p => ['done','completed'].includes(p.status)).length;
    const missed     = data.filter(p => ['no_show','absent'].includes(p.status)).length;
    const done = data.filter(p => ['done','completed'].includes(p.status) && p.entered_at && p.called_at);
    let avgWaitTime = 0;
    if (done.length > 0) {
      avgWaitTime = Math.round(
        done.reduce((s,p) => s + Math.abs(new Date(p.called_at) - new Date(p.entered_at)), 0)
        / done.length / 60000
      );
    }
    const doneExam = data.filter(p => ['done','completed'].includes(p.status) && p.exam_start_time && p.exam_end_time);
    let avgExamTime = 0;
    if (doneExam.length > 0) {
      avgExamTime = Math.round(
        doneExam.reduce((s,p) => s + Math.abs(new Date(p.exam_end_time) - new Date(p.exam_start_time)), 0)
        / doneExam.length / 60000
      );
    }
    setStats({ waiting, inProgress, completed, missed, avgWaitTime, avgExamTime });
  };

  // ── استدعاء التالي عبر RPC المحمية ─────────────────────────
  const callNextPatient = async () => {
    try {
      const { data: cd, error } = await supabase.rpc('call_next_patient', {
        p_clinic_id: selectedClinic, p_mark_current_done: false
      });
      if (error) throw error;
      const num = cd?.data?.display_number;
      num
        ? toast.success(tr(`✅ تم استدعاء رقم ${num}`,`✅ Called #${num}`))
        : toast.info(tr('لا يوجد مرضى في الانتظار','No patients waiting'));
      loadPatients();
    } catch (e) {
      toast.error(tr('خطأ في الاستدعاء','Error calling'));
    }
  };

  // ── تمرير الدور VIP بالرقم العسكري/الشخصي ──────────────────
  const callVipPatient = async () => {
    if (!vipId.trim()) return;
    setVipLoading(true);
    try {
      const today = getQatarDate();
      // البحث عن المريض بفلاتر مساواة على أعمدة الهوية القابلة للفهرسة.
      const vipKey = vipId.trim();
      const findByIdColumn = async (column) => supabase
        .from('unified_queue')
        .select('id,display_number,status')
        .eq('clinic_id', selectedClinic)
        .eq('queue_date', today)
        .eq(column, vipKey)
        .in('status', ['waiting','called'])
        .order('display_number', { ascending: true })
        .limit(1)
        .maybeSingle();

      let found = null;
      for (const column of ['military_id', 'personal_id', 'patient_id']) {
        const { data, error } = await findByIdColumn(column);
        if (error) throw error;
        if (data) { found = data; break; }
      }

      if (found) {
        // تمرير الدور مباشرة
        const { error } = await supabase
          .from('unified_queue')
          .update({ status: 'called', called_at: getQatarNow(), is_vip: true, is_priority: true })
          .eq('id', found.id);
        if (error) throw error;
        toast.success(tr(`✅ تم تمرير الدور للمراجع رقم ${found.display_number}`, `✅ Priority given to #${found.display_number}`));
      } else {
        // إضافة مباشرة للطابور كـ VIP
        const { data: last } = await supabase
          .from('unified_queue')
          .select('display_number')
          .eq('clinic_id', selectedClinic)
          .eq('queue_date', today)
          .order('display_number', { ascending: false })
          .limit(1).maybeSingle();
        const nextNum = (last?.display_number || 0) + 1;
        const { error } = await supabase
          .from('unified_queue')
          .insert({
            clinic_id: selectedClinic,
            patient_id: vipKey,
            personal_id: vipKey,
            status: 'called',
            called_at: getQatarNow(),
            entered_at: getQatarNow(),
            display_number: nextNum,
            queue_date: today,
            is_vip: true,
            is_priority: true,
          });
        if (error) throw error;
        toast.success(tr(`✅ تم إضافة VIP رقم ${nextNum}`, `✅ VIP added as #${nextNum}`));
      }
      setVipId('');
      setShowVipModal(false);
      loadPatients();
    } catch (e) {
      console.error('callVipPatient:', e);
      toast.error(tr('خطأ في تمرير الدور','Error calling VIP'));
    } finally { setVipLoading(false); }
  };

  // ── إنهاء الفحص — يُسجَّل في exam_records + يُقدّم المسار ──
  const completePatient = async (patient) => {
    try {
      const { error: re } = await supabase.rpc('finish_exam_record', {
        p_queue_id: patient.id,
        p_status:   'completed',
        p_result:   null,
        p_notes:    null,
      });
      if (re) {
        const nowQ = getQatarNow();
        await supabase.from('unified_queue').update({
          status: 'done',
          completed_at: nowQ,
          exam_end_time: nowQ,
        }).eq('id', patient.id);
      }
      if (patient.patient_id) {
        await supabase.rpc('advance_patient_route', {
          p_patient_id: patient.patient_id,
          p_clinic_id:  selectedClinic,
        }).catch(() => null);
      }
      await logActivity('patient_completed',
        `تم إنهاء فحص المريض ${patient.patient_id || patient.personal_id || patient.display_number}`,
        { patient_id: patient.patient_id, queue_id: patient.id });
      toast.success(tr('✅ تم إنهاء الفحص بنجاح','✅ Examination completed'));
      loadPatients();
    } catch (e) {
      console.error('completePatient:', e);
      toast.error(tr('حدث خطأ أثناء إكمال الفحص','Error completing examination'));
    }
  };

  // ── تسجيل الغياب ───────────────────────────────────────────
  const markMissed = async (patient) => {
    try {
      await supabase.rpc('finish_exam_record', {
        p_queue_id: patient.id,
        p_status:   'absent',
        p_notes:    tr('غياب - ','Absent - ') + new Date().toLocaleTimeString('ar-SA'),
      }).catch(() => null);
      await supabase.from('unified_queue').update({
        status: 'no_show',
        notes:  tr('غياب - ','Absent - ') + new Date().toLocaleTimeString('ar-SA'),
      }).eq('id', patient.id);
      toast.info(tr('تم تسجيل الغياب','Absence recorded'));
      loadPatients();
    } catch (e) {
      toast.error(tr('خطأ في تسجيل الغياب','Error recording absence'));
    }
  };

  // ── نقل لآخر الدور ─────────────────────────────────────────
  const moveToEnd = async (patient) => {
    try {
      const { data: last } = await supabase
        .from('unified_queue').select('display_number')
        .eq('clinic_id', selectedClinic).order('display_number', { ascending:false })
        .limit(1).maybeSingle();
      await supabase.from('unified_queue').update({
        status: 'waiting', called_at: null,
        display_number: (last?.display_number || 0) + 1,
      }).eq('id', patient.id);
      toast.success(tr('تم نقل المريض لآخر الصف','Patient moved to end'));
      loadPatients();
    } catch (e) { toast.error(tr('خطأ في نقل المريض','Error moving patient')); }
  };

  // ── إعادة للصف ─────────────────────────────────────────────
  const returnToQueue = async (patient) => {
    try {
      await supabase.from('unified_queue').update({ status:'waiting', called_at:null }).eq('id', patient.id);
      toast.success(tr('تم إعادة المريض للصف','Patient returned to queue'));
      loadPatients();
    } catch (e) { toast.error(tr('خطأ','Error')); }
  };

  // ── إلغاء الدور ────────────────────────────────────────────
  const cancelPatient = async (patient) => {
    try {
      await supabase.from('unified_queue').update({ status:'cancelled' }).eq('id', patient.id);
      toast.success(tr('تم إلغاء الدور','Queue cancelled'));
      loadPatients();
    } catch (e) { toast.error(tr('خطأ في الإلغاء','Error cancelling')); }
  };

  // ── تسجيل النشاط ───────────────────────────────────────────
  const logActivity = async (actionType, description, metadata = {}) => {
    try {
      await supabase.from('activity_logs').insert([{
        action_type:  actionType,
        description:  description,
        user_id:      (doctorId && /^[0-9a-f-]{36}$/i.test(doctorId)) ? doctorId : null,
        metadata:     metadata,
        created_at:   getQatarNow(),
      }]);
    } catch (e) { /* اختياري */ }
  };

  // ── مدة الفحص ──────────────────────────────────────────────
  const formatDuration = (start, end = new Date()) => {
    if (!start) return '—';
    const diff = new Date(end).getTime() - new Date(start).getTime();
    if (diff < 0) return '—';
    const m = Math.floor(diff / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${m}:${String(s).padStart(2,'0')}`;
  };

  const formatTime = (ts) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', { hour:'2-digit', minute:'2-digit' });
  };

  // ── Real-time + تحميل أولي ─────────────────────────────────
  useEffect(() => { loadClinics(); }, []);

  useEffect(() => {
    loadPatients();
    if (!selectedClinic) return;
    const ch = supabase
      .channel(`dc_${selectedClinic}_${Date.now()}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'unified_queue',
        filter:`clinic_id=eq.${selectedClinic}` }, loadPatients)
      .subscribe();
    const iv = setInterval(loadPatients, 10000);
    return () => { supabase.removeChannel(ch); clearInterval(iv); };
  }, [selectedClinic]);

  // ── فلترة المرضى ───────────────────────────────────────────
  const filtered = patients.filter(p => {
    const idStr  = `${p.patient_id||''} ${p.military_id||''} ${p.personal_id||''}`.toLowerCase();
    const search = searchTerm.toLowerCase();
    const matchSearch = idStr.includes(search) || String(p.display_number||'').includes(search);
    let matchStatus = filterStatus === 'all';
    if (!matchStatus) {
      if (filterStatus === 'waiting')     matchStatus = p.status === 'waiting';
      if (filterStatus === 'in_progress') matchStatus = ['serving','called','in_progress'].includes(p.status);
      if (filterStatus === 'completed')   matchStatus = ['done','completed'].includes(p.status);
      if (filterStatus === 'missed')      matchStatus = ['no_show','absent'].includes(p.status);
    }
    return matchSearch && matchStatus;
  });

  const patientId = (p) => p.military_id || p.personal_id || p.patient_id || '—';
  const clinicName = (id) => {
    const c = clinics.find(x => x.id === id);
    return c ? (language === 'ar' ? c.name_ar : (c.name_en || c.name_ar)) : id;
  };

  // ════════════════════════════════════════════════════════════
  // واجهة المستخدم
  // ════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Shield className="text-[#C9A54C]" size={28} />
          {tr('شاشة الطبيب المعني','Doctor Control Panel')}
        </h2>
        <div className="flex items-center gap-3">
          <select
            value={selectedClinic}
            onChange={e => setSelectedClinic(e.target.value)}
            className="bg-[#1A1A1A] border border-white/10 rounded-lg px-4 py-2 text-white text-sm"
          >
            <option value="">{tr('اختر العيادة','Select Clinic')}</option>
            {clinics.map(c => (
              <option key={c.id} value={c.id}>
                {language === 'ar' ? c.name_ar : (c.name_en || c.name_ar)}
              </option>
            ))}
          </select>
          <button onClick={loadPatients}
            className="p-2 bg-[#C9A54C]/20 hover:bg-[#C9A54C]/30 text-[#C9A54C] rounded-lg transition-all">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* إحصائيات يومية */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { icon: Users,       color: 'blue',   val: stats.waiting,    label: tr('في الانتظار','Waiting') },
          { icon: Activity,    color: 'yellow', val: stats.inProgress, label: tr('قيد الفحص','In Progress') },
          { icon: CheckCircle, color: 'green',  val: stats.completed,  label: tr('أنهى الفحص','Completed') },
          { icon: UserX,       color: 'red',    val: stats.missed,     label: tr('تغيب','Absent') },
          { icon: Clock,       color: 'purple', val: `${stats.avgWaitTime}د`, label: tr('متوسط الانتظار','Avg Wait') },
          { icon: Timer,       color: 'orange', val: `${stats.avgExamTime}د`, label: tr('متوسط الفحص','Avg Exam') },
        ].map(({ icon: Icon, color, val, label }, i) => (
          <div key={i} className={`bg-${color}-500/10 border border-${color}-500/20 rounded-xl p-4 text-center`}>
            <Icon className={`text-${color}-400 mx-auto mb-2`} size={22} />
            <div className={`text-2xl font-bold text-${color}-400`}>{val}</div>
            <div className="text-xs text-gray-400 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* المريض الحالي + أزرار التحكم */}
      {currentPatient ? (
        <div className="bg-gradient-to-br from-[#8A1538]/20 to-[#C9A54C]/10 border border-[#C9A54C]/30 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[#C9A54C] flex items-center gap-2">
              <Activity size={20} />
              {tr('المريض الحالي','Current Patient')}
            </h3>
            <div className="flex items-center gap-2 bg-[#C9A54C]/20 px-3 py-1.5 rounded-lg">
              <Timer size={16} className="text-[#C9A54C]" />
              <span className="font-mono text-[#C9A54C] font-bold">{examTimer}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-xs text-gray-400 mb-1">{tr('رقم الدور','Queue #')}</div>
              <div className="text-3xl font-bold text-[#C9A54C]">#{currentPatient.display_number}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">{tr('الرقم العسكري/الشخصي','Military/Personal ID')}</div>
              <div className="font-mono text-lg font-bold">{patientId(currentPatient)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">{tr('الجنس','Gender')}</div>
              <div className="font-medium text-lg">
                {currentPatient.gender === 'female' ? tr('أنثى ♀','Female ♀') : tr('ذكر ♂','Male ♂')}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">{tr('وقت الدخول','Entry Time')}</div>
              <div className="font-mono text-sm flex items-center gap-1">
                <LogIn size={14} className="text-green-400" />
                {formatTime(currentPatient.exam_start_time || currentPatient.called_at)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {currentPatient.is_vip && (
              <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-500/30 flex items-center gap-1">
                <Star size={12} /> VIP
              </span>
            )}
            {currentPatient.is_priority && (
              <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full border border-orange-500/30">
                ⚡ {tr('أولوية','Priority')}
              </span>
            )}
            {currentPatient.is_military_committee && (
              <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/30 flex items-center gap-1">
                <Shield size={12} /> {tr('لجنة عسكرية','Military Committee')}
              </span>
            )}
          </div>

          <div className="flex gap-3 flex-wrap">
            <button onClick={() => completePatient(currentPatient)}
              className="flex-1 min-w-[140px] py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-all">
              <CheckCircle size={20} />
              {tr('إنهاء الفحص','Complete Exam')}
            </button>
            <button onClick={() => markMissed(currentPatient)}
              className="px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg font-medium flex items-center gap-2 transition-all">
              <UserX size={20} />
              {tr('تغيب','Absent')}
            </button>
            <button onClick={() => returnToQueue(currentPatient)}
              className="px-4 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg font-medium flex items-center gap-2 transition-all">
              <RotateCcw size={20} />
              {tr('إعادة للصف','Return')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-3 flex-wrap">
          <button onClick={callNextPatient} disabled={stats.waiting === 0}
            className="flex-1 py-4 bg-gradient-to-r from-[#C9A54C] to-[#8A1538] hover:from-[#D4B55D] hover:to-[#9A2548] text-white rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            <Phone size={24} />
            {tr('استدعاء المريض التالي','Call Next Patient')}
            {stats.waiting > 0 && (
              <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                {stats.waiting} {tr('في الانتظار','waiting')}
              </span>
            )}
          </button>
          <button onClick={() => setShowVipModal(true)}
            className="px-6 py-4 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/30 rounded-xl font-bold flex items-center gap-2 transition-all">
            <Star size={22} />
            {tr('تمرير VIP','VIP Call')}
          </button>
        </div>
      )}

      {/* نافذة VIP */}
      {showVipModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] border border-yellow-500/30 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-yellow-400 mb-4 flex items-center gap-2">
              <Star size={20} />
              {tr('تمرير الدور VIP','VIP Priority Call')}
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              {tr('أدخل الرقم العسكري أو الشخصي للمراجع المراد تمرير دوره','Enter military or personal ID for priority call')}
            </p>
            <input
              type="text"
              value={vipId}
              onChange={e => setVipId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && callVipPatient()}
              placeholder={tr('الرقم العسكري / الشخصي','Military / Personal ID')}
              className="w-full bg-[#0b0b0f] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 mb-4 text-center text-lg font-mono"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={callVipPatient} disabled={!vipId.trim() || vipLoading}
                className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-600 text-black rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                {vipLoading ? <RefreshCw size={18} className="animate-spin" /> : <Star size={18} />}
                {tr('تمرير الدور','Call VIP')}
              </button>
              <button onClick={() => { setShowVipModal(false); setVipId(''); }}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium">
                {tr('إلغاء','Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* بحث + فلتر */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            placeholder={tr('بحث برقم الهوية أو رقم الدور...','Search by ID or queue number...')}
            className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-500" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-[#1A1A1A] border border-white/10 rounded-lg px-4 py-3 text-white">
          <option value="all">{tr('الكل','All')}</option>
          <option value="waiting">{tr('في الانتظار','Waiting')}</option>
          <option value="in_progress">{tr('قيد الفحص','In Progress')}</option>
          <option value="completed">{tr('تم الفحص','Completed')}</option>
          <option value="missed">{tr('تغيب','Missed/Absent')}</option>
        </select>
      </div>

      {/* جدول المرضى */}
      <div className="bg-[#1A1A1A] rounded-xl overflow-hidden border border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-white/5">
              <tr>
                {[
                  tr('الرقم','No.'),
                  tr('الهوية','ID'),
                  tr('الجنس','Gender'),
                  tr('الحالة','Status'),
                  tr('وقت الدخول','Entry Time'),
                  tr('وقت الاستدعاء','Called At'),
                  tr('وقت الخروج','Exit Time'),
                  tr('مدة الفحص','Exam Duration'),
                  tr('إجراءات','Actions')
                ].map((h,i) => (
                  <th key={i} className="text-right p-3 text-gray-400 font-medium text-sm whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className={`border-t border-white/5 hover:bg-white/5 transition-all ${
                  ['serving','called','in_progress'].includes(p.status) ? 'bg-yellow-500/5' : ''
                }`}>
                  <td className="p-3 font-mono font-bold text-[#C9A54C] whitespace-nowrap">
                    #{p.display_number}
                    {p.is_vip && <Star size={12} className="inline ml-1 text-yellow-400" />}
                    {p.is_priority && <span className="text-orange-400 text-xs ml-1">⚡</span>}
                  </td>
                  <td className="p-3 font-mono text-sm whitespace-nowrap">{patientId(p)}</td>
                  <td className="p-3 text-sm whitespace-nowrap">
                    {p.gender === 'female' ? tr('أنثى ♀','Female ♀') : tr('ذكر ♂','Male ♂')}
                  </td>
                  <td className="p-3 whitespace-nowrap"><StatusBadge status={p.status} tr={tr} /></td>
                  <td className="p-3 text-gray-400 text-sm whitespace-nowrap">
                    <span className="flex items-center gap-1">
                      <LogIn size={12} className="text-green-400" />
                      {formatTime(p.entered_at)}
                    </span>
                  </td>
                  <td className="p-3 text-gray-400 text-sm whitespace-nowrap">
                    {formatTime(p.called_at)}
                  </td>
                  <td className="p-3 text-gray-400 text-sm whitespace-nowrap">
                    {['done','completed'].includes(p.status) ? (
                      <span className="flex items-center gap-1">
                        <LogOut size={12} className="text-red-400" />
                        {formatTime(p.exam_end_time || p.completed_at)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="p-3 font-mono text-sm text-[#C9A54C] whitespace-nowrap">
                    {['serving','called','in_progress'].includes(p.status)
                      ? <span className="text-yellow-400 animate-pulse">{formatDuration(p.exam_start_time || p.called_at)}</span>
                      : (['done','completed'].includes(p.status) && p.exam_start_time && p.exam_end_time)
                        ? formatDuration(p.exam_start_time, p.exam_end_time)
                        : '—'}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1.5 flex-wrap">
                      {p.status === 'waiting' && (
                        <>
                          <ActionBtn onClick={() => markMissed(p)} color="red" title={tr('غياب','Absent')}>
                            <UserX size={14} />
                          </ActionBtn>
                          <ActionBtn onClick={() => moveToEnd(p)} color="blue" title={tr('نقل لآخر الدور','Move to end')}>
                            <ArrowRightLeft size={14} />
                          </ActionBtn>
                          <ActionBtn onClick={() => cancelPatient(p)} color="gray" title={tr('إلغاء الدور','Cancel')}>
                            <UserX size={14} />
                          </ActionBtn>
                        </>
                      )}
                      {['called','serving','in_progress'].includes(p.status) && (
                        <>
                          <ActionBtn onClick={() => completePatient(p)} color="green" title={tr('إنهاء الفحص','Complete')}>
                            <CheckCircle size={14} />
                          </ActionBtn>
                          <ActionBtn onClick={() => markMissed(p)} color="red" title={tr('غياب','Absent')}>
                            <UserX size={14} />
                          </ActionBtn>
                        </>
                      )}
                      {['done','completed','no_show','absent','cancelled'].includes(p.status) && (
                        <ActionBtn onClick={() => returnToQueue(p)} color="yellow" title={tr('إعادة للصف','Return to queue')}>
                          <RotateCcw size={14} />
                        </ActionBtn>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-12 text-center text-gray-400">
            <Users size={48} className="mx-auto mb-4 opacity-30" />
            <p>{loading ? tr('جارٍ التحميل...','Loading...') : tr('لا يوجد مرضى','No patients found')}</p>
          </div>
        )}
      </div>

      {/* ملخص يومي */}
      <div className="bg-[#1A1A1A] border border-white/10 rounded-xl p-5">
        <h4 className="font-bold text-gray-300 mb-4 flex items-center gap-2">
          <Activity size={18} className="text-[#C9A54C]" />
          {tr('ملخص اليوم','Daily Summary')} — {clinicName(selectedClinic)}
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-white">{patients.length}</div>
            <div className="text-xs text-gray-400">{tr('إجمالي المراجعين','Total Patients')}</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-400">{stats.completed}</div>
            <div className="text-xs text-gray-400">{tr('أنهوا الفحص','Completed')}</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-400">{stats.missed}</div>
            <div className="text-xs text-gray-400">{tr('تغيبوا','Absent')}</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-400">{stats.waiting}</div>
            <div className="text-xs text-gray-400">{tr('في الانتظار','Waiting')}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── زر إجراء صغير ─────────────────────────────────────────────
const ActionBtn = ({ onClick, color, title, children }) => {
  const colors = {
    red:    'bg-red-500/20 hover:bg-red-500/30 text-red-400',
    blue:   'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400',
    yellow: 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400',
    green:  'bg-green-500/20 hover:bg-green-500/30 text-green-400',
    gray:   'bg-gray-500/20 hover:bg-gray-500/30 text-gray-400',
    orange: 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-400',
  };
  return (
    <button onClick={onClick} title={title}
      className={`p-2 rounded-lg transition-all ${colors[color]||colors.blue}`}>
      {children}
    </button>
  );
};

// ── شارة الحالة — تغطي كل حالات DB ───────────────────────────
const StatusBadge = ({ status, tr }) => {
  const map = {
    waiting:     { cls:'bg-blue-500/20 text-blue-400',    label: tr('في الانتظار','Waiting') },
    called:      { cls:'bg-orange-500/20 text-orange-400', label: tr('تم الاستدعاء','Called') },
    serving:     { cls:'bg-yellow-500/20 text-yellow-400', label: tr('قيد الفحص','In Service') },
    in_progress: { cls:'bg-yellow-500/20 text-yellow-400', label: tr('قيد الفحص','In Progress') },
    done:        { cls:'bg-green-500/20 text-green-400',   label: tr('تم الفحص','Done') },
    completed:   { cls:'bg-green-500/20 text-green-400',   label: tr('مكتمل','Completed') },
    no_show:     { cls:'bg-red-500/20 text-red-400',       label: tr('تغيب','Absent') },
    absent:      { cls:'bg-red-500/20 text-red-400',       label: tr('تغيب','Absent') },
    cancelled:   { cls:'bg-gray-500/20 text-gray-400',     label: tr('ملغي','Cancelled') },
  };
  const cfg = map[status] || { cls:'bg-gray-500/20 text-gray-400', label: status };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
};

export default DoctorControl;

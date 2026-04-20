/**
 * DoctorControl — لوحة تحكم الطبيب في شاشة الإدارة
 * إصلاح كامل: أعمدة حقيقية، توقيت قطر، RPCs صحيحة، حالات صحيحة
 */
import React, { useState, useEffect } from 'react';
import {
  Users, Clock, CheckCircle, Activity, Phone,
  RotateCcw, UserCheck, Search, RefreshCw, UserX, Play
} from 'lucide-react';
import { supabase } from '../lib/supabase-client';
import toast from 'react-hot-toast';

// توقيت قطر (UTC+3) — يطابق qatar_today() في Supabase
const getQatarDate = () =>
  new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split('T')[0];

const DoctorControl = ({ language = 'ar', t = (ar) => ar, doctorId, clinicId }) => {
  const [patients,       setPatients]       = useState([]);
  const [clinics,        setClinics]        = useState([]);
  const [selectedClinic, setSelectedClinic] = useState(clinicId || '');
  const [loading,        setLoading]        = useState(true);
  const [stats,          setStats]          = useState({ waiting:0, inProgress:0, completed:0, missed:0, avgWaitTime:0 });
  const [currentPatient, setCurrentPatient] = useState(null);
  const [searchTerm,     setSearchTerm]     = useState('');
  const [filterStatus,   setFilterStatus]   = useState('all');

  const tr = (ar, en) => language === 'ar' ? ar : en;

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
      const today = getQatarDate();   // توقيت قطر الصحيح
      const { data, error } = await supabase
        .from('unified_queue')
        .select([
          'id','display_number','patient_name','patient_id',
          'military_id','personal_id','gender','exam_type',
          'status','entered_at','called_at','exam_start_time',
          'exam_end_time','completed_at','is_vip','is_priority',
          'is_military_committee','notes','queue_date'
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
    setStats({ waiting, inProgress, completed, missed, avgWaitTime });
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

  // ── إنهاء الفحص — يُسجَّل في exam_records + يُقدّم المسار ──
  const completePatient = async (patient) => {
    try {
      // 1) إغلاق سجل الفحص مع حساب المدة
      const { error: re } = await supabase.rpc('finish_exam_record', {
        p_queue_id: patient.id,
        p_status:   'completed',
        p_result:   null,
        p_notes:    null,
      });
      if (re) {
        // fallback مباشر إذا فشل RPC
        await supabase.from('unified_queue').update({
          status: 'done',
          completed_at: new Date().toISOString(),
          exam_end_time: new Date().toISOString(),
        }).eq('id', patient.id);
      }

      // 2) تقدم مسار المريض تلقائياً
      if (patient.patient_id) {
        await supabase.rpc('advance_patient_route', {
          p_patient_id: patient.patient_id,
          p_clinic_id:  selectedClinic,
        }).catch(() => null);
      }

      // 3) تسجيل النشاط
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

      // fallback مباشر
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

  // ── تسجيل النشاط ───────────────────────────────────────────
  const logActivity = async (actionType, description, metadata = {}) => {
    try {
      await supabase.from('activity_logs').insert([{
        action_type:  actionType,
        description:  description,
        // user_id يجب أن يكون UUID صالح أو null
        user_id:      (doctorId && /^[0-9a-f-]{36}$/i.test(doctorId)) ? doctorId : null,
        metadata:     metadata,
      }]);
    } catch (e) { /* النشاط اختياري — لا نوقف الإجراء */ }
  };

  // ── مدة الفحص ──────────────────────────────────────────────
  const formatDuration = (start, end = new Date()) => {
    if (!start) return '—';
    const diff = new Date(end).getTime() - new Date(start).getTime();
    const m = Math.floor(diff / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${m}:${String(s).padStart(2,'0')}`;
  };

  // ── Real-time + تحميل أولي ─────────────────────────────────
  useEffect(() => {
    loadClinics();
  }, []);

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
  // الحالة 'missed' في الـ UI = ['no_show','absent'] في DB
  const filtered = patients.filter(p => {
    const idStr  = `${p.patient_id||''} ${p.military_id||''} ${p.personal_id||''}`.toLowerCase();
    const search = searchTerm.toLowerCase();
    const matchSearch = idStr.includes(search)
      || (p.patient_name||'').toLowerCase().includes(search)
      || String(p.display_number||'').includes(search);

    let matchStatus = filterStatus === 'all';
    if (!matchStatus) {
      if (filterStatus === 'waiting')     matchStatus = p.status === 'waiting';
      if (filterStatus === 'in_progress') matchStatus = ['serving','called','in_progress'].includes(p.status);
      if (filterStatus === 'completed')   matchStatus = ['done','completed'].includes(p.status);
      if (filterStatus === 'missed')      matchStatus = ['no_show','absent'].includes(p.status);
    }
    return matchSearch && matchStatus;
  });

  // ── مساعد اسم المريض (أعمدة حقيقية) ───────────────────────
  const patientId = (p) => p.military_id || p.personal_id || p.patient_id || '—';

  // ════════════════════════════════════════════════════════════
  // واجهة المستخدم
  // ════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <UserCheck className="text-[#C9A54C]" size={28} />
          {tr('لوحة تحكم الطبيب','Doctor Control Panel')}
        </h2>
        <div className="flex items-center gap-3">
          <select
            value={selectedClinic}
            onChange={e => setSelectedClinic(e.target.value)}
            className="bg-[#1A1A1A] border border-white/10 rounded-lg px-4 py-2 text-white">
            {clinics.map(c => (
              <option key={c.id} value={c.id}>
                {language === 'ar' ? c.name_ar : (c.name_en || c.name_ar)}
              </option>
            ))}
          </select>
          <button onClick={loadPatients}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all">
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* إحصائيات موحدة */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { icon:<Users    className="text-blue-400"/>,   val:stats.waiting,    label:tr('في الانتظار','Waiting'),   cls:'from-blue-500/20 to-blue-600/10 border-blue-500/30' },
          { icon:<Activity className="text-yellow-400"/>, val:stats.inProgress, label:tr('قيد الفحص','In Progress'),cls:'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30' },
          { icon:<CheckCircle className="text-green-400"/>,val:stats.completed, label:tr('تم الفحص','Completed'),   cls:'from-green-500/20 to-green-600/10 border-green-500/30' },
          { icon:<UserX    className="text-red-400"/>,    val:stats.missed,     label:tr('تغيب','Missed'),          cls:'from-red-500/20 to-red-600/10 border-red-500/30' },
          { icon:<Clock    className="text-purple-400"/>, val:`${stats.avgWaitTime}m`, label:tr('متوسط الانتظار','Avg Wait'), cls:'from-purple-500/20 to-purple-600/10 border-purple-500/30' },
        ].map((s,i) => (
          <div key={i} className={`bg-gradient-to-br ${s.cls} rounded-xl p-4 border`}>
            <div className="flex items-center justify-between mb-2">{s.icon}<span className="text-2xl font-bold">{s.val}</span></div>
            <div className="text-sm text-gray-400">{s.label}</div>
          </div>
        ))}
      </div>

      {/* المريض الحالي */}
      {currentPatient ? (
        <div className="bg-gradient-to-r from-[#C9A54C]/20 to-[#8A1538]/20 rounded-xl p-6 border border-[#C9A54C]/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Play className="text-green-400" size={20} />
              {tr('المريض الحالي','Current Patient')}
            </h3>
            <span className="text-3xl font-bold text-[#C9A54C]">#{currentPatient.display_number}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-sm text-gray-400">{tr('الرقم العسكري/الشخصي','Military/Personal ID')}</div>
              <div className="font-mono text-lg">{patientId(currentPatient)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">{tr('الاسم','Name')}</div>
              <div className="font-medium">{currentPatient.patient_name || '—'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">{tr('الجنس','Gender')}</div>
              <div className="font-medium">
                {currentPatient.gender === 'female' ? tr('أنثى','Female') : tr('ذكر','Male')}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400">{tr('مدة الفحص','Exam Duration')}</div>
              <div className="font-mono text-lg text-[#C9A54C]">
                {formatDuration(currentPatient.exam_start_time || currentPatient.called_at)}
              </div>
            </div>
          </div>
          {currentPatient.is_vip && (
            <span className="inline-block mb-3 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-500/30">
              ⭐ VIP
            </span>
          )}
          {currentPatient.is_military_committee && (
            <span className="inline-block mb-3 ml-2 text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/30">
              🛡 {tr('لجنة عسكرية','Military Committee')}
            </span>
          )}
          <div className="flex gap-3">
            <button onClick={() => completePatient(currentPatient)}
              className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-all">
              <CheckCircle size={20} />
              {tr('إنهاء الفحص','Complete Exam')}
            </button>
            <button onClick={() => markMissed(currentPatient)}
              className="px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg font-medium flex items-center gap-2 transition-all">
              <UserX size={20} />
              {tr('تغيب','Absent')}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={callNextPatient} disabled={stats.waiting === 0}
          className="w-full py-4 bg-gradient-to-r from-[#C9A54C] to-[#8A1538] hover:from-[#D4B55D] hover:to-[#9A2548] text-white rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
          <Phone size={24} />
          {tr('استدعاء المريض التالي','Call Next Patient')}
          {stats.waiting > 0 && (
            <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
              {stats.waiting} {tr('في الانتظار','waiting')}
            </span>
          )}
        </button>
      )}

      {/* بحث + فلتر */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            placeholder={tr('بحث برقم أو اسم المريض...','Search by ID or name...')}
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
        <table className="w-full">
          <thead className="bg-white/5">
            <tr>
              {[tr('الرقم','No.'), tr('الهوية','ID'), tr('الاسم','Name'),
                tr('الجنس','Gender'), tr('الحالة','Status'),
                tr('وقت الاستدعاء','Called At'), tr('المدة','Duration'), tr('إجراءات','Actions')
              ].map((h,i) => (
                <th key={i} className="text-right p-3 text-gray-400 font-medium text-sm">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className="border-t border-white/5 hover:bg-white/5 transition-all">
                <td className="p-3 font-mono font-bold text-[#C9A54C]">#{p.display_number}</td>
                <td className="p-3 font-mono text-sm">{patientId(p)}</td>
                <td className="p-3">
                  <div className="font-medium">{p.patient_name || '—'}</div>
                  {p.exam_type && <div className="text-xs text-gray-500">{p.exam_type}</div>}
                </td>
                <td className="p-3 text-sm">
                  {p.gender === 'female' ? tr('أنثى','Female') : tr('ذكر','Male')}
                </td>
                <td className="p-3"><StatusBadge status={p.status} tr={tr} /></td>
                <td className="p-3 text-gray-400 text-sm">
                  {p.called_at ? new Date(p.called_at).toLocaleTimeString(language==='ar'?'ar-SA':'en-US',{hour:'2-digit',minute:'2-digit'}) : '—'}
                </td>
                <td className="p-3 font-mono text-sm text-[#C9A54C]">
                  {['serving','called','in_progress'].includes(p.status)
                    ? formatDuration(p.exam_start_time || p.called_at)
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
                          <RotateCcw size={14} />
                        </ActionBtn>
                      </>
                    )}
                    {['done','completed','no_show','absent'].includes(p.status) && (
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
        {filtered.length === 0 && (
          <div className="p-12 text-center text-gray-400">
            <Users size={48} className="mx-auto mb-4 opacity-30" />
            <p>{loading ? tr('جارٍ التحميل...','Loading...') : tr('لا يوجد مرضى','No patients found')}</p>
          </div>
        )}
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

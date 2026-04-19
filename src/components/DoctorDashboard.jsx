/**
 * @file DoctorDashboard.jsx
 * @description لوحة تحكم الطبيب — استدعاء المراجعين، إنهاء الفحص، تحريك المسار التلقائي.
 *
 * الإصلاحات في هذا الإصدار:
 * ✅ استخدام complete_exam_and_advance بدلاً من تحديث مباشر → يُحرّك المسار تلقائياً
 * ✅ mark_patient_absent → status='no_show' (لا 'missed' التي تسبب خطأ check constraint)
 * ✅ call_next_patient(clinicId) → RPC ذرية تمنع race conditions
 * ✅ إحصاءات حية من get_doctor_dashboard_stats
 * ✅ Real-time subscription على unified_queue
 * ✅ عداد وقت الفحص يعمل عند تبويب المتصفح
 * ✅ أزرار واضحة: كبير لإنهاء الفحص، صغير لتمرير/غياب
 *
 * @module DoctorDashboard
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase-client';
import {
  Phone, CheckCircle, UserX, SkipForward, RefreshCw,
  Clock, Users, Activity, Globe, LogOut, Play, X
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

/** @param {string} msg رسالة النجاح */
const toastOk = (msg) => toast.success(msg, {
  duration: 3500, position: 'top-center',
  style: { background: '#10B981', color: '#fff', fontWeight: 'bold', borderRadius: '12px', padding: '14px 24px', fontSize: '16px' }
});

/** @param {string} msg رسالة الخطأ */
const toastErr = (msg) => toast.error(msg, {
  duration: 4000, position: 'top-center',
  style: { background: '#EF4444', color: '#fff', fontWeight: 'bold', borderRadius: '12px', padding: '14px 24px', fontSize: '16px' }
});

/**
 * @component DoctorDashboard
 * @param {Object}   doctorData      بيانات الطبيب من الجلسة
 * @param {Function} onLogout        تسجيل الخروج
 * @param {string}   language        ar | en
 * @param {Function} t               (ar,en)=>string
 * @param {Function} toggleLanguage  تبديل اللغة
 */
export const DoctorDashboard = ({ doctorData, onLogout, language, t, toggleLanguage }) => {
  const [waiting,        setWaiting]        = useState([]);
  const [current,        setCurrent]        = useState(null);
  const [stats,          setStats]          = useState({ waiting:0, in_progress:0, done:0, absent:0, avg_wait_min:0 });
  const [busy,           setBusy]           = useState(false);
  const [timer,          setTimer]          = useState('00:00');
  const timerRef = useRef(null);

  const clinicId   = doctorData?.clinic_id;
  const clinicName = doctorData?.clinic_name   || (language==='ar' ? 'العيادة' : 'Clinic');
  const drName     = doctorData?.name || doctorData?.full_name || (language==='ar' ? 'الطبيب' : 'Doctor');

  // ── جلب الطابور والإحصاءات ──────────────────────────────────────────────
  /**
   * يجلب قائمة الانتظار والإحصاءات من Supabase في طلبَين متوازيَين.
   * @async
   */
  const refresh = useCallback(async () => {
    if (!clinicId) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const [qRes, sRes] = await Promise.all([
        supabase
          .from('unified_queue')
          .select('id,patient_id,patient_name,military_id,personal_id,display_number,status,called_at,entered_at,exam_start_time,gender')
          .eq('clinic_id',  clinicId)
          .eq('queue_date', today)
          .in('status', ['waiting','called','serving','in_progress'])
          .order('is_vip',         { ascending:false })
          .order('is_priority',    { ascending:false })
          .order('display_number', { ascending:true }),
        supabase.rpc('get_doctor_dashboard_stats', { p_clinic_id: clinicId })
      ]);

      if (qRes.error) console.error('[DD] queue:', qRes.error.message);
      if (sRes.error) console.error('[DD] stats:', sRes.error.message);

      const rows = qRes.data || [];
      setCurrent(rows.find(r => r.status==='in_progress' || r.status==='serving') || null);
      setWaiting(rows.filter(r => r.status==='waiting' || r.status==='called'));
      if (sRes.data) setStats(sRes.data);
    } catch (e) { console.error('[DD] refresh:', e); }
  }, [clinicId]);

  // ── عداد وقت الفحص ──────────────────────────────────────────────────────
  useEffect(() => {
    if (current?.exam_start_time) {
      const s = new Date(current.exam_start_time).getTime();
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        const d = Date.now()-s;
        setTimer(`${String(Math.floor(d/60000)).padStart(2,'0')}:${String(Math.floor((d%60000)/1000)).padStart(2,'0')}`);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setTimer('00:00');
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [current?.exam_start_time]);

  // ── تحميل أولي + Real-time ───────────────────────────────────────────────
  useEffect(() => {
    if (!clinicId) return;
    refresh();
    const ch = supabase.channel(`dd_${clinicId}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'unified_queue', filter:`clinic_id=eq.${clinicId}` }, () => refresh())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [clinicId, refresh]);

  // ── إجراءات ──────────────────────────────────────────────────────────────

  /**
   * يستدعي المراجع التالي عبر RPC ذرية (تمنع race conditions).
   * @async
   */
  const callNext = async () => {
    if (!clinicId || busy) return;
    try {
      setBusy(true);
      const { data, error } = await supabase.rpc('call_next_patient', {
        p_clinic_id: clinicId, p_mark_current_done: false
      });
      if (error) throw error;
      if (data?.data?.display_number)
        toastOk(t(`تم استدعاء المراجع رقم ${data.data.display_number}`, `Called #${data.data.display_number}`));
      else
        toastErr(t('لا يوجد مراجعون في الانتظار','No patients waiting'));
      await refresh();
    } catch (e) { toastErr(t('فشل الاستدعاء','Call failed')); console.error(e.message); }
    finally { setBusy(false); }
  };

  /**
   * ينهي الفحص ويُحرّك المريض للعيادة التالية في مساره تلقائياً.
   * يستخدم complete_exam_and_advance بدلاً من UPDATE مباشر.
   * @async
   * @param {string} queueId   UUID سجل الطابور
   * @param {string} patientId patient_id نصي
   */
  const finishExam = async (queueId, patientId) => {
    if (busy) return;
    try {
      setBusy(true);
      const { data, error } = await supabase.rpc('complete_exam_and_advance', {
        p_queue_id:   queueId,
        p_clinic_id:  clinicId,
        p_patient_id: patientId
      });
      if (error) throw error;
      if (data?.advance?.completed)
        toastOk(t('تم الانتهاء من كل المحطات','All stations done'));
      else if (data?.advance?.next_clinic_name)
        toastOk(t(`تم الفحص — انتقل إلى: ${data.advance.next_clinic_name}`,`Done → ${data.advance.next_clinic_name}`));
      else
        toastOk(t('تم إنهاء الفحص','Exam completed'));
      await refresh();
    } catch (e) { toastErr(t('فشل إنهاء الفحص','Finish failed')); console.error(e.message); }
    finally { setBusy(false); }
  };

  /**
   * يُسجّل غياب مراجع — يضبط status='no_show' (لا 'missed' التي تخالف CHECK constraint).
   * @async
   * @param {string} queueId UUID سجل الطابور
   */
  const absent = async (queueId) => {
    if (busy) return;
    try {
      setBusy(true);
      const { error } = await supabase.rpc('mark_patient_absent', { p_queue_id: queueId });
      if (error) throw error;
      toastOk(t('تم تسجيل الغياب','Absence recorded'));
      await refresh();
    } catch (e) { toastErr(t('فشل تسجيل الغياب','Absent failed')); console.error(e.message); }
    finally { setBusy(false); }
  };

  /**
   * يُرجّئ دور المراجع — يعيده لآخر القائمة (بحد أقصى 3 مرات).
   * @async
   * @param {string} queueId UUID سجل الطابور
   */
  const postpone = async (queueId) => {
    if (busy) return;
    try {
      setBusy(true);
      const { error } = await supabase.rpc('postpone_patient_secure', { p_queue_id: queueId });
      if (error) throw error;
      toastOk(t('تم تأجيل الدور','Turn postponed'));
      await refresh();
    } catch (e) { toastErr(t('فشل تأجيل الدور','Postpone failed')); console.error(e.message); }
    finally { setBusy(false); }
  };

  // ── بطاقات الإحصاءات ─────────────────────────────────────────────────────
  const cards = [
    { lbl: t('في الانتظار','Waiting'),    val: stats.waiting,     bg:'from-[#1a2744]/80 to-[#0d1b3a]/80', tx:'text-blue-300',   ico:<Users size={20} className="text-blue-400"/>    },
    { lbl: t('قيد الفحص','In Progress'), val: stats.in_progress, bg:'from-[#C9A54C]/20 to-[#b08e3d]/10', tx:'text-[#C9A54C]', ico:<Activity size={20} className="text-[#C9A54C]"/>  },
    { lbl: t('تغيب','Absent'),            val: stats.absent,      bg:'from-red-900/30 to-red-900/10',     tx:'text-red-400',   ico:<UserX size={20} className="text-red-400"/>        },
    { lbl: t('تم الفحص','Done'),          val: stats.done,        bg:'from-green-900/30 to-green-900/10', tx:'text-green-400', ico:<CheckCircle size={20} className="text-green-400"/>},
    { lbl: t('متوسط الانتظار','Avg Wait'),val: `${stats.avg_wait_min||0}م`, bg:'from-purple-900/30 to-purple-900/10', tx:'text-purple-400', ico:<Clock size={20} className="text-purple-400"/> },
  ];

  // ── الواجهة ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white" dir={language==='ar' ? 'rtl' : 'ltr'}>
      <Toaster/>

      {/* ── رأس الصفحة ──────────────────────────────────────────────────── */}
      <div className="bg-[#8A1538] px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#C9A54C] rounded-xl flex items-center justify-center font-black text-black text-lg">د</div>
          <div>
            <div className="font-bold text-lg leading-tight">{t('لوحة تحكم الطبيب','Doctor Dashboard')}</div>
            <div className="text-xs text-white/70">{clinicName} — {drName}</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={toggleLanguage} className="px-3 py-1.5 bg-white/10 rounded-lg text-sm hover:bg-white/20 flex items-center gap-1">
            <Globe size={14}/> {language==='ar' ? 'EN' : 'عر'}
          </button>
          <button onClick={refresh} className="p-2 bg-white/10 rounded-lg hover:bg-white/20">
            <RefreshCw size={16} className={busy ? 'animate-spin' : ''}/>
          </button>
          <button onClick={onLogout} className="px-3 py-1.5 bg-red-600/80 rounded-lg text-sm hover:bg-red-600 flex items-center gap-1">
            <LogOut size={14}/> {t('خروج','Logout')}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-4">

        {/* ── إحصاءات ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-5 gap-2">
          {cards.map((c,i) => (
            <div key={i} className={`bg-gradient-to-br ${c.bg} rounded-xl p-3 border border-white/10`}>
              <div className="flex justify-between items-start mb-1">
                <span className={`text-2xl font-black ${c.tx}`}>{c.val}</span>
                {c.ico}
              </div>
              <div className="text-xs text-gray-400 text-right">{c.lbl}</div>
            </div>
          ))}
        </div>

        {/* ── المراجع الحالي ─────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-[#C9A54C]/15 to-transparent border border-[#C9A54C]/30 rounded-2xl p-5">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-[#C9A54C] text-xs font-bold uppercase tracking-widest mb-1">
                {t('المراجع الحالي','Current Patient')}
              </p>
              <h2 className="text-3xl font-black">
                {current ? (current.patient_name||t('مراجع','Patient')) : t('لا يوجد مراجع حالياً','No active patient')}
              </h2>
              {current && (
                <p className="text-gray-400 text-sm mt-1 font-mono">
                  {current.military_id||current.personal_id||current.patient_id}
                  {' — '}{t('رقم','#')}{current.display_number}
                </p>
              )}
            </div>
            {current && (
              <div className="text-center bg-black/30 rounded-xl px-4 py-2">
                <div className="text-xs text-gray-400 mb-0.5">{t('وقت الفحص','Exam Time')}</div>
                <div className="text-2xl font-mono font-bold text-[#C9A54C]">{timer}</div>
              </div>
            )}
          </div>

          {current ? (
            <div className="space-y-3">
              {/* الزر الكبير: إنهاء الفحص والانتقال للعيادة التالية */}
              <button
                onClick={() => finishExam(current.id, current.patient_id)}
                disabled={busy}
                className="w-full py-5 bg-gradient-to-r from-green-600 to-green-700 text-white text-xl font-black rounded-2xl hover:from-green-500 hover:to-green-600 transition-all shadow-lg shadow-green-900/40 disabled:opacity-60 flex items-center justify-center gap-3"
              >
                <CheckCircle size={26}/>
                {t('تم الفحص ← الانتقال للعيادة التالية','Complete → Move to Next Clinic')}
              </button>
              {/* الأزرار الثانوية */}
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => postpone(current.id)} disabled={busy}
                  className="py-3 bg-[#C9A54C]/10 border border-[#C9A54C]/30 text-[#C9A54C] font-bold rounded-xl hover:bg-[#C9A54C]/20 transition-all flex items-center justify-center gap-2">
                  <SkipForward size={18}/> {t('تمرير الدور','Skip Turn')}
                </button>
                <button onClick={() => absent(current.id)} disabled={busy}
                  className="py-3 bg-red-900/20 border border-red-500/30 text-red-400 font-bold rounded-xl hover:bg-red-900/40 transition-all flex items-center justify-center gap-2">
                  <UserX size={18}/> {t('تغيب','Absent')}
                </button>
              </div>
            </div>
          ) : (
            /* زر استدعاء التالي */
            <button onClick={callNext} disabled={waiting.length===0||busy}
              className="w-full py-6 bg-gradient-to-r from-[#8A1538] to-[#C9A54C] text-white text-xl font-black rounded-2xl hover:opacity-90 transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3">
              <Phone size={26}/>
              {t('استدعاء المراجع التالي','Call Next Patient')}
              {waiting.length>0 && (
                <span className="bg-white/20 rounded-full px-3 py-0.5 text-base">
                  {waiting.length} {t('في الانتظار','waiting')}
                </span>
              )}
            </button>
          )}
        </div>

        {/* ── قائمة الانتظار ─────────────────────────────────────────── */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 flex justify-between items-center bg-white/5">
            <h3 className="font-bold flex items-center gap-2">
              <Users size={18} className="text-blue-400"/>
              {t('قائمة الانتظار','Waiting List')}
            </h3>
            <span className="text-xs bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full">
              {waiting.length} {t('مراجع','patients')}
            </span>
          </div>

          {/* رؤوس الجدول */}
          <div className="grid grid-cols-12 px-5 py-2 text-xs text-gray-500 border-b border-white/5 font-semibold">
            <span className="col-span-1">#</span>
            <span className="col-span-3">{t('الرقم العسكري','Mil. ID')}</span>
            <span className="col-span-4">{t('الاسم','Name')}</span>
            <span className="col-span-2">{t('الحالة','Status')}</span>
            <span className="col-span-2 text-center">{t('إجراء','Action')}</span>
          </div>

          <div className="divide-y divide-white/5">
            {waiting.length===0 && (
              <div className="py-16 text-center text-gray-500">
                {t('لا يوجد مراجعون في الانتظار','No patients waiting')}
              </div>
            )}
            {waiting.map(p => (
              <div key={p.id} className="grid grid-cols-12 px-5 py-3 items-center hover:bg-white/5 transition-all">
                <span className="col-span-1 font-black text-[#C9A54C]">#{p.display_number}</span>
                <span className="col-span-3 text-sm font-mono text-gray-400">{p.military_id||p.personal_id||'—'}</span>
                <span className="col-span-4 font-medium">
                  <span>{p.patient_name||t('مراجع','Patient')}</span>
                  {p.gender && <span className={`text-xs ml-1 ${p.gender==='female'?'text-pink-300':'text-blue-300'}`}>{p.gender==='female'?'👩':'👨'} {t(p.gender==='female'?'أنثى':'ذكر', p.gender==='female'?'Female':'Male')}</span>}
                </span>
                <span className="col-span-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${p.status==='called'?'bg-yellow-500/20 text-yellow-400':'bg-blue-500/20 text-blue-400'}`}>
                    {p.status==='called' ? t('مستدعى','Called') : t('انتظار','Waiting')}
                  </span>
                </span>
                <div className="col-span-2 flex justify-center gap-1">
                  {/* استدعاء مباشر */}
                  <button
                    onClick={async () => {
                      if (busy) return; setBusy(true);
                      try {
                        await supabase.from('unified_queue').update({ status:'serving', called_at:new Date().toISOString() }).eq('id',p.id);
                        toastOk(t(`استدعاء #${p.display_number}`,`Called #${p.display_number}`));
                        await refresh();
                      } catch { toastErr(t('خطأ','Error')); } finally { setBusy(false); }
                    }}
                    disabled={busy}
                    title={t('استدعاء','Call')}
                    className="p-1.5 bg-[#C9A54C]/10 hover:bg-[#C9A54C]/30 text-[#C9A54C] rounded-lg transition-all disabled:opacity-40"
                  ><Play size={14}/></button>
                  {/* تسجيل غياب */}
                  <button onClick={() => absent(p.id)} disabled={busy}
                    title={t('تغيب','Absent')}
                    className="p-1.5 bg-red-900/10 hover:bg-red-900/30 text-red-400 rounded-lg transition-all disabled:opacity-40"
                  ><X size={14}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default DoctorDashboard;

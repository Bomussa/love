/**
 * @file ClinicDashboard.jsx
 * @description لوحة العيادة المتكاملة — تعرض جميع العيادات النشطة وطوابيرها الحية،
 *              وتُمكّن استدعاء المراجع التالي لكل عيادة مباشرةً.
 *
 * هذه اللوحة مخصصة لمشرف العيادة أو الطبيب الذي يُشرف على
 * عدة عيادات في آنٍ واحد.
 *
 * الاتصالات:
 * - قراءة عيادات اليوم من unified_queue
 * - استدعاء التالي → call_next_patient(clinicId)
 * - Real-time subscription على unified_queue
 *
 * @module ClinicDashboard
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase-client';
import { Play, Users, CheckCircle, RefreshCw, Globe, LogOut, UserPlus } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

/** @param {string} msg */
const ok  = (msg) => toast.success(msg, { duration:3000, position:'top-center', style:{background:'#10B981',color:'#fff',fontWeight:'bold',borderRadius:'12px',padding:'12px 24px'} });
/** @param {string} msg */
const err = (msg) => toast.error(msg,   { duration:4000, position:'top-center', style:{background:'#EF4444',color:'#fff',fontWeight:'bold',borderRadius:'12px',padding:'12px 24px'} });

/**
 * @component ClinicDashboard
 * @param {Object}   props.clinicData  بيانات الجلسة (قد تكون null = عرض كل العيادات)
 * @param {Function} props.onLogout    تسجيل الخروج
 * @param {string}   props.language    ar | en
 * @param {Function} props.t           (ar,en)=>string
 */
export const ClinicDashboard = ({ clinicData, onLogout, language, t }) => {
  const [clinics,  setClinics]  = useState([]);
  const [queues,   setQueues]   = useState({});   // { clinicId: [ ...rows ] }
  const [loading,  setLoading]  = useState({});   // { clinicId: bool }
  const [busy,     setBusy]     = useState(false);

  const tr = t || ((ar, en) => language === 'ar' ? ar : en);

  // ── جلب كل العيادات النشطة ──────────────────────────────────────────────
  const loadClinics = useCallback(async () => {
    const { data, error } = await supabase
      .from('clinics')
      .select('id, name_ar, name_en, floor, is_active')
      .eq('is_active', true)
      .order('name_ar');
    if (!error && data) setClinics(data);
  }, []);

  // ── جلب طابور عيادة واحدة ────────────────────────────────────────────────
  /**
   * @async
   * @param {string} clinicId
   */
  const loadQueue = useCallback(async (clinicId) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('unified_queue')
        .select('id, patient_id, patient_name, military_id, display_number, status, entered_at, queue_number')
        .eq('clinic_id',  clinicId)
        .eq('queue_date', today)
        .in('status', ['waiting','called','serving','in_progress'])
        .order('display_number', { ascending: true });

      if (!error) {
        setQueues(prev => ({ ...prev, [clinicId]: data || [] }));
      }
    } catch (e) { console.error('[CD] loadQueue', clinicId, e); }
  }, []);

  // ── تحميل أولي ──────────────────────────────────────────────────────────
  useEffect(() => {
    loadClinics();
  }, [loadClinics]);

  useEffect(() => {
    if (!clinics.length) return;
    clinics.forEach(c => loadQueue(c.id));

    // Real-time على unified_queue لكل تغيير
    const ch = supabase
      .channel('clinic_dashboard_realtime')
      .on('postgres_changes', { event:'*', schema:'public', table:'unified_queue' },
        (payload) => {
          const cid = payload.new?.clinic_id || payload.old?.clinic_id;
          if (cid) loadQueue(cid);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(ch);
  }, [clinics, loadQueue]);

  // ── استدعاء التالي لعيادة معيّنة ─────────────────────────────────────────
  /**
   * يستدعي المراجع التالي في عيادة محددة عبر RPC ذرية.
   * @async
   * @param {string} clinicId
   * @param {string} clinicName
   */
  const callNext = async (clinicId, clinicName) => {
    if (busy) return;
    try {
      setBusy(true);
      setLoading(p => ({ ...p, [clinicId]: true }));

      const { data, error } = await supabase.rpc('call_next_patient', {
        p_clinic_id: clinicId,
        p_mark_current_done: false
      });
      if (error) throw error;

      if (data?.data?.display_number) {
        ok(tr(`${clinicName} — تم استدعاء #${data.data.display_number}`, `${clinicName} — Called #${data.data.display_number}`));
      } else {
        err(tr(`${clinicName} — لا يوجد مراجعون`, `${clinicName} — No patients`));
      }
      await loadQueue(clinicId);
    } catch (e) {
      err(tr('فشل الاستدعاء', 'Call failed'));
      console.error('[CD] callNext', e.message);
    } finally {
      setBusy(false);
      setLoading(p => ({ ...p, [clinicId]: false }));
    }
  };

  // ── إحصاء مختصر لعيادة ───────────────────────────────────────────────────
  const getStats = (clinicId) => {
    const rows = queues[clinicId] || [];
    return {
      waiting:     rows.filter(r => r.status === 'waiting' || r.status === 'called').length,
      inProgress:  rows.filter(r => r.status === 'in_progress' || r.status === 'serving').length,
    };
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#8A1538]" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <Toaster />

      {/* Header */}
      <div className="bg-black/30 px-4 py-3 flex items-center justify-between">
        <h1 className="text-white font-black text-xl">{tr('لوحة العيادات','Clinic Dashboard')}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { clinics.forEach(c => loadQueue(c.id)); }}
            className="p-2 bg-white/10 rounded-lg hover:bg-white/20 text-white"
          >
            <RefreshCw size={16} className={busy ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={onLogout}
            className="px-3 py-1.5 bg-red-600/80 text-white rounded-lg text-sm hover:bg-red-600 flex items-center gap-1"
          >
            <LogOut size={14} /> {tr('خروج','Logout')}
          </button>
        </div>
      </div>

      {/* Clinics Grid */}
      <div className="p-4 space-y-3 max-w-2xl mx-auto">
        {clinics.map(clinic => {
          const st   = getStats(clinic.id);
          const rows = queues[clinic.id] || [];
          const isLoading = loading[clinic.id];
          const cName = language === 'ar' ? clinic.name_ar : (clinic.name_en || clinic.name_ar);

          return (
            <div key={clinic.id} className="bg-[#6b1030] rounded-2xl overflow-hidden border border-white/10">
              {/* Clinic header */}
              <div className="px-4 py-3 flex items-center justify-between">
                <div>
                  <h2 className="text-white font-black text-lg">{cName}</h2>
                  <p className="text-white/60 text-xs">
                    {tr('انتظار','Waiting')}: <span className="text-[#C9A54C] font-bold">{st.waiting}</span>
                    {'  '}
                    {tr('مكتمل','Done')}: <span className="text-green-400 font-bold">0</span>
                  </p>
                </div>
                <div className="flex gap-2 items-center">
                  {/* Add patient button */}
                  <button
                    onClick={() => err(tr('استخدم صفحة تسجيل الدخول لإضافة مراجع', 'Use login page to add patient'))}
                    className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all"
                    title={tr('إضافة مراجع','Add patient')}
                  >
                    <UserPlus size={18} />
                  </button>
                  {/* Call next button */}
                  <button
                    onClick={() => callNext(clinic.id, cName)}
                    disabled={busy || st.waiting === 0}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#C9A54C] text-black font-black rounded-xl hover:bg-[#b08e3d] transition-all disabled:opacity-40 disabled:cursor-not-allowed text-base"
                  >
                    <Play size={16} className={isLoading ? 'animate-pulse' : ''} />
                    {tr('التالي','Next')}
                  </button>
                </div>
              </div>

              {/* Waiting list */}
              {rows.length > 0 && (
                <div className="border-t border-white/10">
                  <p className="text-white/50 text-xs px-4 py-1">{tr('قائمة الانتظار','Waiting list')}</p>
                  <div className="divide-y divide-white/5">
                    {rows.map(p => (
                      <div key={p.id} className="px-4 py-2 flex items-center justify-between text-sm">
                        <span className="text-[#C9A54C] font-black w-8">#{p.display_number}</span>
                        <span className="flex-1 text-white font-medium px-2 truncate">
                          {p.patient_name || p.patient_id}
                        </span>
                        <span className="text-white/50 font-mono text-xs">{p.military_id || ''}</span>
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-bold ${
                          p.status === 'called' || p.status === 'serving'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {p.status === 'called' || p.status === 'serving'
                            ? tr('مستدعى','Called')
                            : tr('انتظار','Waiting')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {clinics.length === 0 && (
          <div className="text-center py-20 text-white/50">
            {tr('جارٍ تحميل العيادات...','Loading clinics...')}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClinicDashboard;

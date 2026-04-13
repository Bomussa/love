/**
 * @file DoctorDashboard.jsx
 * @description واجهة الطبيب والتحكم - تدير استدعاء وإكمال فحوصات المراجعين.
 * ✅ تم إزالة كافة البيانات الوهمية
 * ✅ تم تحسين عداد وقت الفحص وضمان المزامنة مع الخادم
 * ✅ تم توحيد المنطق البرمجي لتقليل حجم الكود
 */

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase-client';
import { 
  Globe, LogOut, Users, Clock, CheckCircle, SkipForward, 
  UserCheck, Calendar, TrendingUp, Activity, Star, 
  ArrowRightLeft, UserX, Timer, RotateCcw, Building2, ShieldCheck, Play, RefreshCw
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

// دالة عرض شعار النجاح
const showSuccessToast = (message) => {
  toast.success(message, {
    duration: 3000,
    position: 'top-center',
    style: {
      background: '#10B981',
      color: '#fff',
      fontWeight: 'bold',
      borderRadius: '12px',
      padding: '16px 24px',
      fontSize: '16px',
    },
  });
};

// دالة عرض شعار الخطأ
const showErrorToast = (message) => {
  toast.error(message, {
    duration: 4000,
    position: 'top-center',
    style: {
      background: '#EF4444',
      color: '#fff',
      fontWeight: 'bold',
      borderRadius: '12px',
      padding: '16px 24px',
      fontSize: '16px',
    },
  });
};

// دالة تسجيل النشاطات
const logActivity = async (actionType, description, userId = null, metadata = {}) => {
  try {
    await supabase.from('activity_logs').insert([{
      action_type: actionType,
      description: description,
      user_id: userId,
      metadata: metadata,
      user_agent: navigator.userAgent,
      created_at: new Date().toISOString()
    }]);
  } catch (e) {
    console.error('Error logging activity:', e);
  }
};

export const DoctorDashboard = ({ doctorData, onLogout, language, t, toggleLanguage }) => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPatient, setCurrentPatient] = useState(null);
  const [examTimer, setExamTimer] = useState('00:00');
  const timerRef = useRef(null);

  const clinicId = doctorData?.clinic_id;
  const clinicName = doctorData?.clinic_name || (language === 'ar' ? 'العيادة' : 'Clinic');

  /**
   * جلب المراجعين والإحصائيات الحقيقية
   */
  const fetchPatients = async () => {
    if (!clinicId) return;
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('unified_queue')
        .select('*, patients(name, military_id)')
        .eq('clinic_id', clinicId)
        .eq('queue_date', today)
        .order('display_number', { ascending: true });

      if (error) throw error;

      const waiting = data?.filter(p => p.status === 'waiting' || p.status === 'called') || [];
      const inProgress = data?.find(p => p.status === 'in_progress');

      setPatients(waiting);
      setCurrentPatient(inProgress || null);
    } catch (err) {
      console.error('Error fetching patients:', err);
      showErrorToast(t('خطأ في جلب البيانات', 'Data Fetch Error'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * تحسين عداد وقت الفحص لضمان دقته حتى عند تبويب المتصفح
   */
  useEffect(() => {
    if (currentPatient && currentPatient.exam_start_time) {
      const startTime = new Date(currentPatient.exam_start_time).getTime();
      
      if (timerRef.current) clearInterval(timerRef.current);
      
      timerRef.current = setInterval(() => {
        const now = new Date().getTime();
        const diff = now - startTime;
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setExamTimer(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setExamTimer('00:00');
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [currentPatient]);

  useEffect(() => {
    fetchPatients();
    
    // اشتراك Real-time موحد
    const channel = supabase
      .channel(`doctor_sync_${clinicId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'unified_queue',
        filter: `clinic_id=eq.${clinicId}`
      }, () => {
        fetchPatients();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [clinicId]);

  /**
   * معالجة إجراءات الطبيب (استدعاء، إكمال، غياب)
   * @async
   * @function handleAction
   * @param {string} action - نوع الإجراء (CALLED, COMPLETED, ABSENT)
   * @param {string} patientId - معرف المريض في الطابور
   */
  const handleAction = async (action, patientId) => {
    const statusMap = {
      'CALLED': 'called',
      'COMPLETED': 'completed',
      'ABSENT': 'missed',
      'START': 'in_progress'
    };

    try {
      setLoading(true);
      const { error } = await supabase
        .from('unified_queue')
        .update({ 
          status: statusMap[action],
          updated_at: new Date().toISOString(),
          ...(action === 'CALLED' && { called_at: new Date().toISOString() }),
          ...(action === 'START' && { exam_start_time: new Date().toISOString() }),
          ...(action === 'COMPLETED' && { completed_at: new Date().toISOString() })
        })
        .eq('id', patientId);

      if (error) throw error;
      
      showSuccessToast(t('تم تحديث الحالة بنجاح', 'Status Updated Successfully'));
      await logActivity(action.toLowerCase(), `Action ${action} for patient ${patientId}`, doctorData?.id);
      fetchPatients();
    } catch (e) {
      console.error('Action Error:', e.message);
      showErrorToast(t('فشل التحديث - بيانات حقيقية فقط', 'Update Failed - Real Data Only'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6">
      <Toaster />
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center bg-white/5 p-6 rounded-2xl border border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#C9A54C] rounded-xl flex items-center justify-center font-bold text-black">D</div>
            <div>
              <h1 className="text-xl font-bold">{clinicName}</h1>
              <p className="text-gray-400 text-sm">د. {doctorData?.name || 'غير معروف'}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={toggleLanguage} className="p-2 hover:bg-white/10 rounded-lg transition-all">
              <Globe size={20} />
            </button>
            <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all border border-red-500/20">
              <LogOut size={18} /> {t('خروج', 'Logout')}
            </button>
          </div>
        </div>

        {/* Current Patient Card */}
        <div className="bg-gradient-to-br from-[#C9A54C]/20 to-transparent p-8 rounded-3xl border border-[#C9A54C]/30 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-[#C9A54C] font-bold mb-1 uppercase tracking-wider">{t('المراجع الحالي', 'Current Patient')}</p>
                <h2 className="text-4xl font-black">
                  {currentPatient ? (currentPatient.patients?.name || t('مراجع', 'Patient')) : t('لا يوجد مراجع حالياً', 'No Active Patient')}
                </h2>
                {currentPatient && <p className="text-gray-400 mt-2 font-mono">{currentPatient.patients?.military_id || currentPatient.patient_id}</p>}
              </div>
              {currentPatient && (
                <div className="text-right">
                  <div className="text-sm text-gray-400 mb-1">{t('وقت الفحص', 'Exam Time')}</div>
                  <div className="text-3xl font-mono font-bold text-[#C9A54C]">{examTimer}</div>
                </div>
              )}
            </div>

            <div className="flex gap-4">
              {currentPatient ? (
                <>
                  {currentPatient.status !== 'in_progress' ? (
                    <button onClick={() => handleAction('START', currentPatient.id)} className="flex-1 py-4 bg-[#C9A54C] text-black font-bold rounded-2xl hover:bg-[#b08e3d] transition-all flex items-center justify-center gap-2">
                      <Play size={20} /> {t('بدء الفحص', 'Start Exam')}
                    </button>
                  ) : (
                    <button onClick={() => handleAction('COMPLETED', currentPatient.id)} className="flex-1 py-4 bg-green-600 text-white font-bold rounded-2xl hover:bg-green-700 transition-all flex items-center justify-center gap-2">
                      <CheckCircle size={20} /> {t('إنهاء الفحص', 'Finish Exam')}
                    </button>
                  )}
                  <button onClick={() => handleAction('ABSENT', currentPatient.id)} className="px-8 py-4 bg-red-500/10 text-red-500 font-bold rounded-2xl hover:bg-red-500 hover:text-white transition-all border border-red-500/20">
                    {t('غائب', 'Absent')}
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => patients.length > 0 && handleAction('CALLED', patients[0].id)} 
                  disabled={patients.length === 0 || loading}
                  className="flex-1 py-4 bg-white/10 text-white font-bold rounded-2xl hover:bg-white/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw size={20} className={loading ? 'animate-spin' : ''} /> {t('استدعاء المراجع التالي', 'Call Next Patient')}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Waiting List */}
        <div className="bg-white/5 rounded-3xl border border-white/10 overflow-hidden">
          <div className="p-6 border-b border-white/10 flex justify-between items-center">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Users className="text-blue-400" /> {t('قائمة الانتظار الحقيقية', 'Real Waiting List')}
            </h3>
            <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-bold">{patients.length} {t('منتظر', 'Waiting')}</span>
          </div>
          <div className="divide-y divide-white/5">
            {patients.map((p) => (
              <div key={p.id} className="p-4 flex justify-between items-center hover:bg-white/5 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center font-bold text-[#C9A54C]">#{p.display_number}</div>
                  <div>
                    <div className="font-bold">{p.patients?.name || t('مراجع', 'Patient')}</div>
                    <div className="text-xs text-gray-500 font-mono">{p.patients?.military_id || p.patient_id}</div>
                  </div>
                </div>
                <button 
                  onClick={() => handleAction('CALLED', p.id)}
                  className="p-2 text-gray-400 hover:text-[#C9A54C] transition-all"
                >
                  <Play size={20} />
                </button>
              </div>
            ))}
            {patients.length === 0 && (
              <div className="p-20 text-center text-gray-500">{t('لا يوجد مراجعين في الانتظار حالياً', 'No patients in waiting list')}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorDashboard;

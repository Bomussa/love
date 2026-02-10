import { DiagnosticsPanel } from './DiagnosticsPanel';
import React, { useState, useEffect } from 'react';
import authService, { USER_ROLES } from '../lib/auth-service';
import toast, { Toaster } from 'react-hot-toast';
import { 
  LayoutDashboard, Users, Clock, CheckCircle, Activity, 
  Settings, FileText, MapPin, Key, RefreshCw, Trash2, 
  Edit, Plus, LogOut, Home, AlertCircle, ChevronRight,
  Search, Filter, Download, MoreVertical, Shield, Play,
  Pause, SkipForward, Phone, Bell, BarChart3, Calendar,
  UserCheck, XCircle, Eye, Printer, Menu, X, Send, Palette, Type, Move, Timer, Square,
  UserCog, History, Database, Save, Upload, Wifi, WifiOff, Lock, Unlock, Copy, Share2,
  UserPlus, Zap
} from 'lucide-react';

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
    iconTheme: {
      primary: '#fff',
      secondary: '#10B981',
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
import NotificationsManagementV2 from './NotificationsManagementV2';
import ReportsPanel from './ReportsPanel';
import AdvancedNotificationsManager from './AdvancedNotificationsManager';
import FeatureControlPanel from './FeatureControlPanel';
import EnhancedClinicsManager from './EnhancedClinicsManager';
import APIMonitor from './APIMonitor';
import supabase from '../lib/supabase-client';

// دالة تسجيل النشاطات - تسجل كل عملية في التطبيق
const logActivity = async (actionType, description, userId = null, metadata = {}) => {
  try {
    await supabase.from('activity_logs').insert([{
      action_type: actionType,
      description: description,
      user_id: userId,
      metadata: metadata,
      ip_address: null,
      user_agent: navigator.userAgent,
      created_at: new Date().toISOString()
    }]);
  } catch (e) {
    console.error('Error logging activity:', e);
  }
};

// مكونات إدارة الطوابير
const QueueManagement = ({ language, t }) => {
  const [queues, setQueues] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClinic, setSelectedClinic] = useState(null);
  // حالات ميزة تمرير الدور
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [priorityClinicId, setPriorityClinicId] = useState(null);
  const [priorityPatientId, setPriorityPatientId] = useState('');
  const [priorityLoading, setPriorityLoading] = useState(false);
  
  // حالات تعديل الرقم العسكري للمراجع
  const [showEditPatientModal, setShowEditPatientModal] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [newPatientId, setNewPatientId] = useState('');
  const [editPatientLoading, setEditPatientLoading] = useState(false);

  useEffect(() => {
    loadQueues();
    loadClinics();
    
    // اشتراك Real-time لتحديثات الطوابير اللحظية
    const subscription = supabase
      .channel('queues_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unified_queue' }, (payload) => {
        console.log('Queue change detected:', payload);
        loadQueues();
      })
      .subscribe();
    
    // تحديث احتياطي كل 30 ثانية
    const interval = setInterval(loadQueues, 30000);
    
    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, []);

  const loadClinics = async () => {
    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('*')
        .order('name_ar');
      if (!error && data) setClinics(data);
    } catch (e) {
      console.error('Error loading clinics:', e);
    }
  };

  const loadQueues = async () => {
    try {
      setLoading(true);
      // ✅ جلب الطوابير لليوم الحالي فقط باستخدام queue_date
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('unified_queue')
        .select('*')
        .eq('queue_date', today) // ✅ فلترة دقيقة بالتاريخ
        .order('display_number', { ascending: true });
      
      if (!error && data) {
        setQueues(data);
      } else {
        console.error('Error loading queues:', error);
      }
    } catch (e) {
      console.error('Error loading queues:', e);
    } finally {
      setLoading(false);
    }
  };

  const callNext = async (clinicId) => {
    try {
      // ترتيب المنتظرين حسب رقم الدور
      const waitingQueue = queues
        .filter(q => q.clinic_id === clinicId && q.status === 'waiting')
        .sort((a, b) => (a.display_number || 0) - (b.display_number || 0));
      
      if (waitingQueue.length === 0) {
        showErrorToast(t('لا يوجد مرضى في الانتظار', 'No patients waiting'));
        return;
      }
      
      const nextPatient = waitingQueue[0];
      const { error } = await supabase
        .from('unified_queue')
        .update({ status: 'called', called_at: new Date().toISOString() })
        .eq('id', nextPatient.id);
      
      if (!error) {
        showSuccessToast(t(`تم استدعاء الرقم: ${nextPatient.display_number}`, `Called number: ${nextPatient.display_number}`));
        await logActivity('queue_call', `تم استدعاء الرقم ${nextPatient.display_number} في عيادة ${clinicId}`);
        loadQueues();
      } else {
        showErrorToast(t('حدث خطأ أثناء الاستدعاء', 'Error calling patient'));
      }
    } catch (e) {
      console.error('Error calling next:', e);
      showErrorToast(t('حدث خطأ غير متوقع', 'Unexpected error'));
    }
  };

  const completePatient = async (queueId) => {
    try {
      const queue = queues.find(q => q.id === queueId);
      const { error } = await supabase
        .from('unified_queue')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', queueId);
      
      if (!error) {
        showSuccessToast(t('تم إكمال الفحص بنجاح', 'Examination completed'));
        await logActivity('queue_complete', `تم إكمال الرقم ${queue?.display_number} في عيادة ${queue?.clinic_id}`);
        loadQueues();
      }
    } catch (e) {
      console.error('Error completing patient:', e);
    }
  };

  const skipPatient = async (queueId) => {
    try {
      const queue = queues.find(q => q.id === queueId);
      const postponeCount = (queue?.postpone_count || 0) + 1;
      
      // إذا تجاوز الحد الأقصى للترحيلات، يتم الإلغاء
      const maxPostpones = 3;
      if (postponeCount >= maxPostpones) {
        const { error } = await supabase
          .from('unified_queue')
          .update({ status: 'cancelled', postpone_count: postponeCount })
          .eq('id', queueId);
        
        if (!error) {
          showErrorToast(t('تم إلغاء المراجع بعد تجاوز الحد الأقصى', 'Patient cancelled after max postpones'));
          await logActivity('queue_cancel', `تم إلغاء الرقم ${queue?.display_number} بعد ${postponeCount} ترحيلات`);
        }
      } else {
        // ترحيل لنهاية الدور برقم جديد
        const { data: maxQueue } = await supabase
          .from('unified_queue')
          .select('display_number')
          .eq('clinic_id', queue?.clinic_id)
          .order('display_number', { ascending: false })
          .limit(1)
          .single();
        
        const newDisplayNumber = (maxQueue?.display_number || 0) + 1;
        
        const { error } = await supabase
          .from('unified_queue')
          .update({ 
            status: 'waiting', 
            display_number: newDisplayNumber,
            postpone_count: postponeCount,
            called_at: null
          })
          .eq('id', queueId);
        
        if (!error) {
          showSuccessToast(t(`تم ترحيل المراجع للرقم ${newDisplayNumber}`, `Patient moved to number ${newDisplayNumber}`));
          await logActivity('queue_postpone', `تم ترحيل الرقم ${queue?.display_number} إلى ${newDisplayNumber}`);
        }
      }
      loadQueues();
    } catch (e) {
      console.error('Error skipping patient:', e);
    }
  };

  // تمرير الدور لمراجع معين بالرقم العسكري/الشخصي
  const priorityCallPatient = async () => {
    if (!priorityPatientId.trim()) {
      alert(t('يرجى إدخال الرقم العسكري أو الشخصي', 'Please enter military or personal ID'));
      return;
    }

    try {
      setPriorityLoading(true);
      
      // البحث عن المراجع في قائمة الانتظار
      const { data: patientQueue, error: searchError } = await supabase
        .from('unified_queue')
        .select('*')
        .eq('clinic_id', priorityClinicId)
        .eq('status', 'waiting')
        .or(`patient_id.eq.${priorityPatientId},military_id.eq.${priorityPatientId},personal_id.eq.${priorityPatientId}`)
        .single();

      if (searchError || !patientQueue) {
        // إذا لم يوجد في الانتظار، نبحث في جدول المرضى
        const { data: patient, error: patientError } = await supabase
          .from('patients')
          .select('*')
          .or(`military_id.eq.${priorityPatientId},personal_id.eq.${priorityPatientId},id.eq.${priorityPatientId}`)
          .single();

        if (patientError || !patient) {
          alert(t('لم يتم العثور على المراجع', 'Patient not found'));
          return;
        }

        // إضافة المراجع مباشرة إلى الطابور بحالة "يستدعى"
        const { error: insertError } = await supabase
          .from('unified_queue')
          .insert({
            clinic_id: priorityClinicId,
            patient_id: patient.id,
            military_id: patient.military_id,
            personal_id: patient.personal_id,
            status: 'called',
            called_at: new Date().toISOString(),
            is_priority: true,
            priority_reason: 'تمرير دور مباشر',
            queue_number: `P-${Date.now().toString().slice(-4)}`,
            display_number: `أولوية`
          });

        if (insertError) {
          console.error('Error inserting priority queue:', insertError);
          alert(t('حدث خطأ أثناء تمرير الدور', 'Error processing priority call'));
          return;
        }

        alert(t(`تم تمرير الدور للمراجع: ${patient.name || patient.military_id}`, `Priority call for: ${patient.name || patient.military_id}`));
      } else {
        // المراجع موجود في الانتظار، نقوم بتمرير دوره مباشرة
        await supabase
          .from('unified_queue')
          .update({ 
            status: 'called', 
            called_at: new Date().toISOString(),
            is_priority: true,
            priority_reason: 'تمرير دور من الإدارة'
          })
          .eq('id', patientQueue.id);

        alert(t(`تم تمرير الدور للمراجع رقم: ${patientQueue.queue_number}`, `Priority call for queue: ${patientQueue.queue_number}`));
      }

      // إغلاق النافذة وتحديث البيانات
      setShowPriorityModal(false);
      setPriorityPatientId('');
      setPriorityClinicId(null);
      loadQueues();
    } catch (e) {
      console.error('Error in priority call:', e);
      alert(t('حدث خطأ غير متوقع', 'Unexpected error occurred'));
    } finally {
      setPriorityLoading(false);
    }
  };

  // فتح نافذة تمرير الدور
  const openPriorityModal = (clinicId) => {
    setPriorityClinicId(clinicId);
    setPriorityPatientId('');
    setShowPriorityModal(true);
  };

  // فتح نافذة تعديل الرقم العسكري
  const openEditPatientModal = (patient) => {
    setEditingPatient(patient);
    setNewPatientId(patient.patient_id || '');
    setShowEditPatientModal(true);
  };

  // تعديل الرقم العسكري للمراجع
  const updatePatientId = async () => {
    if (!newPatientId.trim()) {
      showErrorToast(t('يرجى إدخال الرقم الجديد', 'Please enter the new ID'));
      return;
    }

    try {
      setEditPatientLoading(true);
      const oldPatientId = editingPatient.patient_id;
      
      // تحديث الرقم في unified_queue
      const { error: queueError } = await supabase
        .from('unified_queue')
        .update({ patient_id: newPatientId.trim() })
        .eq('id', editingPatient.id);

      if (queueError) {
        console.error('Error updating queue:', queueError);
        showErrorToast(t('حدث خطأ أثناء التحديث', 'Error updating patient ID'));
        return;
      }

      // تحديث جدول device_logins إذا كان موجوداً
      const today = new Date().toISOString().split('T')[0];
      await supabase
        .from('device_logins')
        .update({ patient_id: newPatientId.trim() })
        .eq('patient_id', oldPatientId)
        .eq('login_date', today);

      // تحديث جدول patients إذا كان موجوداً
      await supabase
        .from('patients')
        .update({ patient_id: newPatientId.trim() })
        .eq('patient_id', oldPatientId);

      // تسجيل النشاط
      await logActivity('patient_id_update', `تم تعديل الرقم العسكري من ${oldPatientId} إلى ${newPatientId}`, null, {
        old_patient_id: oldPatientId,
        new_patient_id: newPatientId,
        queue_id: editingPatient.id
      });

      showSuccessToast(t(`تم تعديل الرقم بنجاح: ${oldPatientId} → ${newPatientId}`, `ID updated: ${oldPatientId} → ${newPatientId}`));
      
      // إغلاق النافذة وتحديث البيانات
      setShowEditPatientModal(false);
      setEditingPatient(null);
      setNewPatientId('');
      loadQueues();
    } catch (e) {
      console.error('Error updating patient ID:', e);
      showErrorToast(t('حدث خطأ غير متوقع', 'Unexpected error'));
    } finally {
      setEditPatientLoading(false);
    }
  };

  // تجميع الطوابير حسب العيادة
  const queuesByClinic = clinics.map(clinic => ({
    ...clinic,
    waiting: queues.filter(q => q.clinic_id === clinic.id && q.status === 'waiting'),
    called: queues.filter(q => q.clinic_id === clinic.id && q.status === 'called'),
    completed: queues.filter(q => q.clinic_id === clinic.id && q.status === 'completed').length
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">{t('إدارة الطوابير', 'Queue Management')}</h3>
        <button 
          onClick={loadQueues}
          className="p-2 bg-[#C9A54C] text-black rounded-xl hover:bg-[#B8943D] transition-all"
        >
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {queuesByClinic.map(clinic => (
          <div key={clinic.id} className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-gold-500/20 to-transparent border-b border-white/10">
              <h4 className="font-bold text-lg">{language === 'ar' ? (clinic.name_ar || clinic.name_en) : (clinic.name_en || clinic.name_ar)}</h4>
              <div className="flex gap-4 mt-2 text-sm">
                <span className="text-yellow-400">{t('انتظار', 'Waiting')}: {clinic.waiting.length}</span>
                <span className="text-green-400">{t('مكتمل', 'Done')}: {clinic.completed}</span>
              </div>
            </div>
            
            <div className="p-4 space-y-3">
              {clinic.called.length > 0 && (
                <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-3">
                  <div className="text-xs text-green-400 mb-1">{t('يُستدعى الآن', 'Now Calling')}</div>
                  <div className="text-2xl font-bold text-green-400">
                    {clinic.called[0]?.display_number || clinic.called[0]?.queue_number}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => callNext(clinic.id)}
                  className="flex-1 py-2 bg-[#C9A54C] text-black rounded-lg font-medium hover:bg-[#B8943D] transition-all flex items-center justify-center gap-2"
                >
                  <Play size={16} />
                  {t('التالي', 'Next')}
                </button>
                <button
                  onClick={() => openPriorityModal(clinic.id)}
                  className="p-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-all"
                  title={t('تمرير دور', 'Priority Call')}
                >
                  <UserPlus size={20} />
                </button>
                {clinic.called.length > 0 && (
                  <>
                    <button
                      onClick={() => completePatient(clinic.called[0].id)}
                      className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-all"
                    >
                      <CheckCircle size={20} />
                    </button>
                    <button
                      onClick={() => skipPatient(clinic.called[0].id)}
                      className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all"
                    >
                      <SkipForward size={20} />
                    </button>
                  </>
                )}
              </div>

              {clinic.waiting.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs text-gray-400 mb-2">{t('قائمة الانتظار', 'Waiting List')}</div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {clinic.waiting.slice(0, 5).map((q, i) => (
                      <div key={q.id} className="flex items-center justify-between text-sm bg-white/5 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold">{q.display_number || q.queue_number}</span>
                          <span className="text-xs text-gray-500">({q.patient_id})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditPatientModal(q)}
                            className="p-1 text-blue-400 hover:bg-blue-500/20 rounded transition-all"
                            title={t('تعديل الرقم', 'Edit ID')}
                          >
                            <Edit size={14} />
                          </button>
                          <span className="text-gray-400">{i + 1}</span>
                        </div>
                      </div>
                    ))}
                    {clinic.waiting.length > 5 && (
                      <div className="text-xs text-gray-500 text-center py-1">
                        +{clinic.waiting.length - 5} {t('آخرين', 'more')}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* نافذة تمرير الدور */}
      {showPriorityModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-2xl border border-white/10 p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <UserPlus className="text-purple-400" size={24} />
                {t('تمرير دور مراجع', 'Priority Patient Call')}
              </h3>
              <button
                onClick={() => setShowPriorityModal(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  {t('الرقم العسكري أو الشخصي', 'Military or Personal ID')}
                </label>
                <input
                  type="text"
                  value={priorityPatientId}
                  onChange={(e) => setPriorityPatientId(e.target.value)}
                  placeholder={t('أدخل الرقم هنا...', 'Enter ID here...')}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all text-lg"
                  autoFocus
                />
              </div>

              <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-purple-400 mt-0.5" size={20} />
                  <div className="text-sm text-gray-300">
                    <p className="font-medium text-purple-400 mb-1">{t('ملاحظة', 'Note')}</p>
                    <p>{t('سيتم استدعاء المراجع مباشرة للعيادة بدون انتظار في الطابور.', 'The patient will be called directly to the clinic without waiting in queue.')}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowPriorityModal(false)}
                  className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  onClick={priorityCallPatient}
                  disabled={priorityLoading || !priorityPatientId.trim()}
                  className="flex-1 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {priorityLoading ? (
                    <RefreshCw className="animate-spin" size={20} />
                  ) : (
                    <>
                      <Play size={20} />
                      {t('تمرير الدور', 'Call Now')}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تعديل الرقم العسكري */}
      {showEditPatientModal && editingPatient && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-2xl border border-white/10 p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Edit className="text-blue-400" size={24} />
                {t('تعديل الرقم العسكري', 'Edit Military ID')}
              </h3>
              <button
                onClick={() => setShowEditPatientModal(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-white/5 rounded-xl p-4">
                <div className="text-sm text-gray-400 mb-1">{t('رقم الدور', 'Queue Number')}</div>
                <div className="text-2xl font-bold text-[#C9A54C]">{editingPatient.display_number || editingPatient.queue_number}</div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  {t('الرقم العسكري الحالي', 'Current Military ID')}
                </label>
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 font-mono">
                  {editingPatient.patient_id || 'غير محدد'}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  {t('الرقم العسكري الجديد', 'New Military ID')}
                </label>
                <input
                  type="text"
                  value={newPatientId}
                  onChange={(e) => setNewPatientId(e.target.value)}
                  placeholder={t('أدخل الرقم الصحيح...', 'Enter correct ID...')}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-lg font-mono"
                  autoFocus
                />
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-yellow-400 mt-0.5" size={20} />
                  <div className="text-sm text-gray-300">
                    <p className="font-medium text-yellow-400 mb-1">{t('تنبيه', 'Warning')}</p>
                    <p>{t('سيتم تحديث الرقم في جميع الجداول المرتبطة (الطابور، الأجهزة، المراجعين).', 'The ID will be updated in all related tables (queue, devices, patients).')}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowEditPatientModal(false)}
                  className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  onClick={updatePatientId}
                  disabled={editPatientLoading || !newPatientId.trim() || newPatientId === editingPatient.patient_id}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {editPatientLoading ? (
                    <RefreshCw className="animate-spin" size={20} />
                  ) : (
                    <>
                      <Save size={20} />
                      {t('حفظ التعديل', 'Save Changes')}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// مكون إدارة الأرقام السرية - محسّن
const PINManagement = ({ language, t }) => {
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkGenerate, setShowBulkGenerate] = useState(false);
  const [newPin, setNewPin] = useState({ pin_code: '', clinic_id: '', max_uses: 100 });
  const [clinics, setClinics] = useState([]);
  const [generatingBulk, setGeneratingBulk] = useState(false);

  useEffect(() => {
    loadPins();
    loadClinics();
    
    // Real-time subscription
    const subscription = supabase
      .channel('pins_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pins' }, () => {
        loadPins();
      })
      .subscribe();
    
    return () => subscription.unsubscribe();
  }, []);

  const loadClinics = async () => {
    const { data } = await supabase.from('clinics').select('*').order('name_ar');
    if (data) setClinics(data);
  };

  const loadPins = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pins')
        .select('*')
        .order('clinic_code', { ascending: true })
        .order('created_at', { ascending: false });
      
      if (!error && data) setPins(data);
    } catch (e) {
      console.error('Error loading pins:', e);
    } finally {
      setLoading(false);
    }
  };

  const generatePin = () => {
    // PIN من رقمين فقط (10-99)
    return Math.floor(10 + Math.random() * 90).toString();
  };

  const generateUniquePin = (existingPins) => {
    let pin;
    let attempts = 0;
    do {
      pin = generatePin();
      attempts++;
    } while (existingPins.includes(pin) && attempts < 100);
    return pin;
  };

  const addPin = async () => {
    try {
      if (!newPin.clinic_id) {
        showErrorToast(t('يرجى اختيار العيادة', 'Please select a clinic'));
        return;
      }
      
      const existingPins = pins.filter(p => p.clinic_code === newPin.clinic_id).map(p => p.pin);
      const pinCode = newPin.pin_code || generateUniquePin(existingPins);
      
      // التحقق من عدم تكرار الرقم لنفس العيادة
      if (existingPins.includes(pinCode)) {
        showErrorToast(t('هذا الرقم موجود بالفعل لهذه العيادة', 'This PIN already exists for this clinic'));
        return;
      }
      
      const { error } = await supabase.from('pins').insert({
        pin: pinCode,
        clinic_code: newPin.clinic_id,
        is_active: true,
        generated_at: new Date().toISOString(),
        expires_at: new Date(new Date().setHours(23, 59, 59, 999)).toISOString(),
        created_at: new Date().toISOString(),
        max_uses: newPin.max_uses || 100,
        used_count: 0
      });
      
      if (!error) {
        showSuccessToast(t(`تم إنشاء الرقم السري: ${pinCode}`, `PIN created: ${pinCode}`));
        await logActivity('pin_created', `تم إنشاء رقم سري ${pinCode} للعيادة ${newPin.clinic_id}`);
        loadPins();
        setShowAddForm(false);
        setNewPin({ pin_code: '', clinic_id: '', max_uses: 100 });
      } else {
        showErrorToast(t('حدث خطأ أثناء الإنشاء', 'Error creating PIN'));
      }
    } catch (e) {
      console.error('Error adding pin:', e);
    }
  };

  // توليد أرقام سرية لجميع العيادات
  const generateBulkPins = async () => {
    try {
      setGeneratingBulk(true);
      const existingPinsByClinic = {};
      pins.forEach(p => {
        if (!existingPinsByClinic[p.clinic_code]) existingPinsByClinic[p.clinic_code] = [];
        existingPinsByClinic[p.clinic_code].push(p.pin);
      });
      
      const newPins = [];
      for (const clinic of clinics) {
        const existingPins = existingPinsByClinic[clinic.id] || [];
        const pinCode = generateUniquePin(existingPins);
        newPins.push({
          pin: pinCode,
          clinic_code: clinic.id,
          is_active: true,
          generated_at: new Date().toISOString(),
          expires_at: new Date(new Date().setHours(23, 59, 59, 999)).toISOString(),
          created_at: new Date().toISOString(),
          max_uses: 100,
          used_count: 0
        });
      }
      
      const { error } = await supabase.from('pins').insert(newPins);
      
      if (!error) {
        showSuccessToast(t(`تم توليد ${newPins.length} رقم سري`, `Generated ${newPins.length} PINs`));
        await logActivity('pins_bulk_generated', `تم توليد ${newPins.length} رقم سري لجميع العيادات`);
        loadPins();
      }
    } catch (e) {
      console.error('Error generating bulk pins:', e);
      showErrorToast(t('حدث خطأ', 'Error occurred'));
    } finally {
      setGeneratingBulk(false);
      setShowBulkGenerate(false);
    }
  };

  // حذف جميع الأرقام المنتهية الصلاحية
  const deleteExpiredPins = async () => {
    try {
      const now = new Date().toISOString();
      const { error, count } = await supabase
        .from('pins')
        .delete()
        .lt('expires_at', now);
      
      if (!error) {
        showSuccessToast(t('تم حذف الأرقام المنتهية', 'Expired PINs deleted'));
        loadPins();
      }
    } catch (e) {
      console.error('Error deleting expired pins:', e);
    }
  };

  const togglePinStatus = async (pinId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('pins')
        .update({ is_active: !currentStatus })
        .eq('id', pinId);
      
      if (!error) {
        showSuccessToast(t(!currentStatus ? 'تم التفعيل' : 'تم التعطيل', !currentStatus ? 'Activated' : 'Deactivated'));
        loadPins();
      }
    } catch (e) {
      console.error('Error toggling pin:', e);
    }
  };

  const deletePin = async (pinId) => {
    if (!window.confirm(t('هل أنت متأكد من حذف هذا الرقم؟', 'Are you sure you want to delete this PIN?'))) return;
    try {
      const { error } = await supabase.from('pins').delete().eq('id', pinId);
      if (!error) {
        showSuccessToast(t('تم الحذف', 'Deleted'));
        loadPins();
      }
    } catch (e) {
      console.error('Error deleting pin:', e);
    }
  };

  const getClinicName = (clinicCode) => {
    const clinic = clinics.find(c => c.id === clinicCode);
    return clinic ? (language === 'ar' ? clinic.name_ar : clinic.name_en) : clinicCode;
  };

  const isPinExpired = (expiresAt) => {
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h3 className="text-xl font-bold">{t('إدارة الأرقام السرية', 'PIN Management')}</h3>
        <div className="flex gap-2 flex-wrap">
          <button 
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-[#C9A54C] text-black rounded-xl hover:bg-[#B8943D] transition-all flex items-center gap-2"
          >
            <Plus size={18} />
            {t('إضافة', 'Add')}
          </button>
          <button 
            onClick={generateBulkPins}
            disabled={generatingBulk}
            className="px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {generatingBulk ? <RefreshCw size={18} className="animate-spin" /> : <Zap size={18} />}
            {t('توليد للكل', 'Generate All')}
          </button>
          <button 
            onClick={deleteExpiredPins}
            className="px-4 py-2 bg-red-600/20 text-red-400 rounded-xl hover:bg-red-600/30 transition-all flex items-center gap-2"
          >
            <Trash2 size={18} />
            {t('حذف المنتهية', 'Delete Expired')}
          </button>
          <button 
            onClick={loadPins}
            className="p-2 bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] border border-white/10 rounded-xl hover:bg-[#8A1538] transition-all"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-xl border border-white/10 p-4">
          <div className="text-2xl font-bold text-[#C9A54C]">{pins.length}</div>
          <div className="text-sm text-gray-400">{t('إجمالي الأرقام', 'Total PINs')}</div>
        </div>
        <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-xl border border-white/10 p-4">
          <div className="text-2xl font-bold text-green-400">{pins.filter(p => p.is_active).length}</div>
          <div className="text-sm text-gray-400">{t('نشطة', 'Active')}</div>
        </div>
        <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-xl border border-white/10 p-4">
          <div className="text-2xl font-bold text-red-400">{pins.filter(p => isPinExpired(p.expires_at)).length}</div>
          <div className="text-sm text-gray-400">{t('منتهية', 'Expired')}</div>
        </div>
        <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-xl border border-white/10 p-4">
          <div className="text-2xl font-bold text-blue-400">{clinics.length}</div>
          <div className="text-sm text-gray-400">{t('العيادات', 'Clinics')}</div>
        </div>
      </div>

      {showAddForm && (
        <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-6">
          <h4 className="font-bold mb-4">{t('إضافة رقم سري جديد', 'Add New PIN')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('الرقم السري', 'PIN Code')}</label>
              <input
                type="text"
                value={newPin.pin_code}
                onChange={(e) => setNewPin({...newPin, pin_code: e.target.value})}
                placeholder={t('اتركه فارغاً للتوليد التلقائي', 'Leave empty for auto-generate')}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('العيادة', 'Clinic')}</label>
              <select
                value={newPin.clinic_id}
                onChange={(e) => setNewPin({...newPin, clinic_id: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
              >
                <option value="">{t('اختر العيادة', 'Select Clinic')}</option>
                {clinics.map(c => (
                  <option key={c.id} value={c.id}>{language === 'ar' ? (c.name_ar || c.name_en) : (c.name_en || c.name_ar)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('رقم المريض', 'Patient ID')}</label>
              <input
                type="text"
                value={newPin.patient_id}
                onChange={(e) => setNewPin({...newPin, patient_id: e.target.value})}
                placeholder={t('اختياري', 'Optional')}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={addPin}
              className="px-6 py-2 bg-[#C9A54C] text-black rounded-xl hover:bg-[#B8943D] transition-all"
            >
              {t('حفظ', 'Save')}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-6 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all"
            >
              {t('إلغاء', 'Cancel')}
            </button>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 overflow-hidden">
        <table className="w-full">
          <thead className="bg-white/5">
            <tr>
              <th className="text-right p-4 text-gray-400 font-medium">{t('الرقم السري', 'PIN')}</th>
              <th className="text-right p-4 text-gray-400 font-medium">{t('العيادة', 'Clinic')}</th>
              <th className="text-right p-4 text-gray-400 font-medium">{t('الحالة', 'Status')}</th>
              <th className="text-right p-4 text-gray-400 font-medium">{t('التاريخ', 'Date')}</th>
              <th className="text-right p-4 text-gray-400 font-medium">{t('الإجراءات', 'Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {pins.map(pin => (
              <tr key={pin.id} className="border-t border-white/5 hover:bg-white/5 transition-all">
                <td className="p-4 font-mono text-lg font-bold text-[#B8943D]">{pin.pin}</td>
                <td className="p-4">{clinics.find(c => c.id === pin.clinic_code)?.name_ar || pin.clinic_code}</td>
                <td className="p-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    pin.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {pin.is_active ? t('نشط', 'Active') : t('معطل', 'Inactive')}
                  </span>
                </td>
                <td className="p-4 text-gray-400 text-sm">
                  {new Date(pin.created_at).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                </td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => togglePinStatus(pin.id, pin.is_active)}
                      className={`p-2 rounded-lg transition-all ${
                        pin.is_active ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                      }`}
                    >
                      {pin.is_active ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <button
                      onClick={() => deletePin(pin.id)}
                      className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pins.length === 0 && (
          <div className="p-8 text-center text-gray-400">
            {t('لا توجد أرقام سرية', 'No PINs found')}
          </div>
        )}
      </div>
    </div>
  );
};

// مكون التقارير - محدث لاستخدام حساب الأوزان
const ReportsSection = ({ language, t }) => {
  const [stats, setStats] = useState({
    todayPatients: 0,
    weekPatients: 0,
    monthPatients: 0,
    yearPatients: 0,
    avgWaitTime: 0,
    completionRate: 0,
    avgWeightedCompletion: 0,
    clinicStats: [],
    hourlyStats: []
  });
  const [loading, setLoading] = useState(true);
  const [reportPeriod, setReportPeriod] = useState('today');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');

  useEffect(() => {
    loadStats();
  }, []);

  // دالة حساب نسبة الإنجاز بالأوزان لمريض واحد
  const calculateWeightedCompletion = (stations, currentIndex) => {
    if (!stations || !Array.isArray(stations) || stations.length === 0) return 0;
    
    const totalWeight = stations.reduce((sum, s) => sum + (parseFloat(s.weight) || 1), 0);
    if (totalWeight === 0) return 0;
    
    const completedWeight = stations.slice(0, currentIndex).reduce((sum, s) => sum + (parseFloat(s.weight) || 1), 0);
    return (completedWeight / totalWeight) * 100;
  };

  const loadStats = async () => {
    try {
      setLoading(true);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      
      const yearAgo = new Date();
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);

      // إحصائيات اليوم
      const todayStr = today.toISOString().split('T')[0];
      const { data: todayData } = await supabase
        .from('unified_queue')
        .select('*')
        .eq('queue_date', todayStr);

      // إحصائيات الأسبوع
      const { data: weekData } = await supabase
        .from('unified_queue')
        .select('*')
        .gte('created_at', weekAgo.toISOString());

      // إحصائيات الشهر
      const { data: monthData } = await supabase
        .from('unified_queue')
        .select('*')
        .gte('created_at', monthAgo.toISOString());

      // إحصائيات السنة
      const { data: yearData } = await supabase
        .from('unified_queue')
        .select('*')
        .gte('created_at', yearAgo.toISOString());

      // إحصائيات العيادات
      const { data: clinicsData } = await supabase
        .from('clinics')
        .select('id, name_ar, name');

      // حساب إحصائيات كل عيادة
      const clinicStats = clinicsData?.map(clinic => {
        const clinicQueues = todayData?.filter(q => q.clinic_id === clinic.id) || [];
        const completed = clinicQueues.filter(q => q.status === 'completed');
        const waiting = clinicQueues.filter(q => q.status === 'waiting');
        const avgWait = completed.length > 0
          ? completed.reduce((acc, q) => {
              if (q.called_at && q.created_at) {
                return acc + (new Date(q.called_at) - new Date(q.created_at));
              }
              return acc;
            }, 0) / completed.length / 60000
          : 0;
        const avgStay = completed.length > 0
          ? completed.reduce((acc, q) => {
              if (q.completed_at && q.called_at) {
                return acc + (new Date(q.completed_at) - new Date(q.called_at));
              }
              return acc;
            }, 0) / completed.length / 60000
          : 0;
        return {
          id: clinic.id,
          name: clinic.name_ar || clinic.name,
          total: clinicQueues.length,
          completed: completed.length,
          waiting: waiting.length,
          avgWaitTime: Math.round(avgWait),
          avgStayTime: Math.round(avgStay)
        };
      }) || [];

      // جلب مسارات المرضى لحساب نسبة الإنجاز بالأوزان
      const { data: patientRoutes } = await supabase
        .from('patient_routes')
        .select('patient_id, stations, current_station_index, status')
        .gte('created_at', weekAgo.toISOString());

      const completed = weekData?.filter(q => q.status === 'completed') || [];
      const avgWait = completed.length > 0
        ? completed.reduce((acc, q) => {
            if (q.called_at && q.created_at) {
              return acc + (new Date(q.called_at) - new Date(q.created_at));
            }
            return acc;
          }, 0) / completed.length / 60000
        : 0;

      // حساب متوسط نسبة الإنجاز بالأوزان
      let avgWeightedCompletion = 0;
      if (patientRoutes && patientRoutes.length > 0) {
        const totalCompletion = patientRoutes.reduce((sum, route) => {
          const stations = typeof route.stations === 'string' 
            ? JSON.parse(route.stations) 
            : route.stations;
          const currentIndex = route.current_station_index || 0;
          return sum + calculateWeightedCompletion(stations, currentIndex);
        }, 0);
        avgWeightedCompletion = Math.round(totalCompletion / patientRoutes.length);
      }

      setStats({
        todayPatients: todayData?.length || 0,
        weekPatients: weekData?.length || 0,
        monthPatients: monthData?.length || 0,
        yearPatients: yearData?.length || 0,
        avgWaitTime: Math.round(avgWait),
        completionRate: weekData?.length > 0 
          ? Math.round((completed.length / weekData.length) * 100) 
          : 0,
        avgWeightedCompletion,
        clinicStats
      });
    } catch (e) {
      console.error('Error loading stats:', e);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = (format = 'txt') => {
    const periodLabel = {
      today: 'اليوم',
      week: 'الأسبوع',
      month: 'الشهر',
      year: 'السنة'
    }[reportPeriod];
    
    const patientCount = {
      today: stats.todayPatients,
      week: stats.weekPatients,
      month: stats.monthPatients,
      year: stats.yearPatients
    }[reportPeriod];

    const clinicStatsTable = stats.clinicStats?.map(c => 
      `| ${c.name} | ${c.total} | ${c.completed} | ${c.waiting} | ${c.avgWaitTime} د | ${c.avgStayTime} د |`
    ).join('\n') || '';

    const reportData = `
══════════════════════════════════════════════════
       اللجنة الطبية العسكرية
       Military Medical Committee
══════════════════════════════════════════════════
المركز الطبي التخصصي العسكري - العطار

تقرير ${periodLabel}
التاريخ: ${new Date().toLocaleDateString('ar-SA')}
الوقت: ${new Date().toLocaleTimeString('ar-SA')}

──────────────────────────────────────────────────
الإحصائيات العامة:
──────────────────────────────────────────────────
• عدد المراجعين: ${patientCount}
• متوسط وقت الانتظار: ${stats.avgWaitTime} دقيقة
• نسبة إكمال الطوابير: ${stats.completionRate}%
• نسبة الإنجاز بالأوزان: ${stats.avgWeightedCompletion}%

──────────────────────────────────────────────────
إحصائيات العيادات:
──────────────────────────────────────────────────
| العيادة | إجمالي | مكتمل | انتظار | متوسط الانتظار | متوسط البقاء |
|-------|------|------|------|-------------|------------|
${clinicStatsTable}

══════════════════════════════════════════════════
تم إنشاء هذا التقرير آلياً بواسطة نظام إدارة الطوابير
    `;
    
    const blob = new Blob([reportData], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${reportPeriod}-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
  };

  const printReport = () => {
    const periodLabel = {
      today: 'اليوم',
      week: 'الأسبوع',
      month: 'الشهر',
      year: 'السنة'
    }[reportPeriod];
    
    const patientCount = {
      today: stats.todayPatients,
      week: stats.weekPatients,
      month: stats.monthPatients,
      year: stats.yearPatients
    }[reportPeriod];

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>تقرير اللجنة الطبية العسكرية</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 20px; direction: rtl; }
          .header { text-align: center; border-bottom: 3px double #8A1538; padding-bottom: 20px; margin-bottom: 20px; }
          .logo { width: 80px; height: 80px; margin: 0 auto 10px; }
          .title { color: #8A1538; font-size: 24px; font-weight: bold; margin: 10px 0; }
          .subtitle { color: #666; font-size: 14px; }
          .section { margin: 20px 0; }
          .section-title { background: #8A1538; color: white; padding: 10px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: center; }
          th { background: #f5f5f5; }
          .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
          .stat-card { background: #f9f9f9; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #ddd; }
          .stat-value { font-size: 28px; font-weight: bold; color: #8A1538; }
          .stat-label { color: #666; font-size: 12px; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
          @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">اللجنة الطبية العسكرية</div>
          <div class="subtitle">Military Medical Committee</div>
          <div class="subtitle">المركز الطبي التخصصي العسكري - العطار</div>
        </div>
        
        <div class="section">
          <div class="section-title">تقرير ${periodLabel} - ${new Date().toLocaleDateString('ar-SA')}</div>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">${patientCount}</div>
              <div class="stat-label">عدد المراجعين</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${stats.avgWaitTime} د</div>
              <div class="stat-label">متوسط الانتظار</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${stats.completionRate}%</div>
              <div class="stat-label">نسبة الإكمال</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${stats.avgWeightedCompletion}%</div>
              <div class="stat-label">نسبة الإنجاز</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">إحصائيات العيادات</div>
          <table>
            <thead>
              <tr>
                <th>العيادة</th>
                <th>إجمالي الزيارات</th>
                <th>مكتملة</th>
                <th>في الانتظار</th>
                <th>متوسط الانتظار</th>
                <th>متوسط البقاء</th>
              </tr>
            </thead>
            <tbody>
              ${stats.clinicStats?.map(c => `
                <tr>
                  <td>${c.name}</td>
                  <td>${c.total}</td>
                  <td>${c.completed}</td>
                  <td>${c.waiting}</td>
                  <td>${c.avgWaitTime} د</td>
                  <td>${c.avgStayTime} د</td>
                </tr>
              `).join('') || ''}
            </tbody>
          </table>
        </div>

        <div class="footer">
          <p>تم إنشاء هذا التقرير آلياً بواسطة نظام إدارة الطوابير</p>
          <p>${new Date().toLocaleString('ar-SA')}</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const sendReportByEmail = async () => {
    if (!emailAddress || !emailAddress.includes('@')) {
      alert(t('يرجى إدخال بريد إلكتروني صحيح', 'Please enter a valid email'));
      return;
    }
    // حفظ طلب الإرسال في قاعدة البيانات
    try {
      await supabase.from('email_queue').insert({
        to_email: emailAddress,
        subject: `تقرير اللجنة الطبية - ${new Date().toLocaleDateString('ar-SA')}`,
        body: JSON.stringify(stats),
        status: 'pending',
        created_at: new Date().toISOString()
      });
      alert(t('تم إرسال التقرير بنجاح', 'Report sent successfully'));
      setShowEmailModal(false);
      setEmailAddress('');
    } catch (e) {
      console.error('Error sending email:', e);
      alert(t('حدث خطأ أثناء الإرسال', 'Error sending report'));
    }
  };

  return (
    <div className="space-y-6">
      {/* العنوان وأزرار التحكم */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-xl font-bold">{t('التقارير والإحصائيات', 'Reports & Statistics')}</h3>
        
        {/* تصنيف الفترة */}
        <div className="flex items-center gap-2 bg-black/20 rounded-xl p-1">
          {[{id: 'today', label: 'اليوم'}, {id: 'week', label: 'الأسبوع'}, {id: 'month', label: 'الشهر'}, {id: 'year', label: 'السنة'}].map(period => (
            <button
              key={period.id}
              onClick={() => setReportPeriod(period.id)}
              className={`px-4 py-2 rounded-lg transition-all ${reportPeriod === period.id ? 'bg-[#C9A54C] text-black' : 'text-gray-400 hover:text-white'}`}
            >
              {t(period.label, period.label)}
            </button>
          ))}
        </div>

        {/* أزرار الإجراءات */}
        <div className="flex items-center gap-2">
          <button 
            onClick={printReport}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2"
          >
            <Printer size={18} />
            {t('طباعة', 'Print')}
          </button>
          <button 
            onClick={() => exportReport()}
            className="px-4 py-2 bg-[#C9A54C] text-black rounded-xl hover:bg-[#B8943D] transition-all flex items-center gap-2"
          >
            <Download size={18} />
            {t('تصدير', 'Export')}
          </button>
          <button 
            onClick={() => setShowEmailModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all flex items-center gap-2"
          >
            <Send size={18} />
            {t('إرسال', 'Send')}
          </button>
        </div>
      </div>

      {/* بطاقات الإحصائيات */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <Users className="text-blue-400" size={24} />
            </div>
            <span className="text-gray-400">{t('مرضى اليوم', 'Today\'s Patients')}</span>
          </div>
          <div className="text-3xl font-bold">{stats.todayPatients}</div>
        </div>

        <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-purple-500/20 rounded-xl">
              <Calendar className="text-purple-400" size={24} />
            </div>
            <span className="text-gray-400">{t('مرضى الأسبوع', 'Week\'s Patients')}</span>
          </div>
          <div className="text-3xl font-bold">{stats.weekPatients}</div>
        </div>

        <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-yellow-500/20 rounded-xl">
              <Clock className="text-yellow-400" size={24} />
            </div>
            <span className="text-gray-400">{t('متوسط الانتظار', 'Avg Wait Time')}</span>
          </div>
          <div className="text-3xl font-bold">{stats.avgWaitTime} <span className="text-lg text-gray-400">{t('دقيقة', 'min')}</span></div>
        </div>

        <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-500/20 rounded-xl">
              <CheckCircle className="text-green-400" size={24} />
            </div>
            <span className="text-gray-400">{t('نسبة الإنجاز', 'Completion Rate')}</span>
          </div>
          <div className="text-3xl font-bold">{stats.avgWeightedCompletion}%</div>
          <div className="text-sm text-gray-500 mt-1">
            {t('إكمال الطوابير', 'Queue Completion')}: {stats.completionRate}%
          </div>
        </div>
      </div>

      {/* جدول إحصائيات العيادات */}
      {stats.clinicStats && stats.clinicStats.length > 0 && (
        <div className="bg-black/20 rounded-2xl border border-white/10 p-6">
          <h4 className="text-lg font-bold mb-4">{t('إحصائيات العيادات التفصيلية', 'Detailed Clinic Statistics')}</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-right p-3">{t('العيادة', 'Clinic')}</th>
                  <th className="text-center p-3">{t('إجمالي', 'Total')}</th>
                  <th className="text-center p-3">{t('مكتمل', 'Completed')}</th>
                  <th className="text-center p-3">{t('انتظار', 'Waiting')}</th>
                  <th className="text-center p-3">{t('متوسط الانتظار', 'Avg Wait')}</th>
                  <th className="text-center p-3">{t('متوسط البقاء', 'Avg Stay')}</th>
                </tr>
              </thead>
              <tbody>
                {stats.clinicStats.filter(c => c.total > 0).map((clinic, idx) => (
                  <tr key={clinic.id} className={idx % 2 === 0 ? 'bg-white/5' : ''}>
                    <td className="p-3 font-medium">{clinic.name}</td>
                    <td className="text-center p-3">{clinic.total}</td>
                    <td className="text-center p-3 text-green-400">{clinic.completed}</td>
                    <td className="text-center p-3 text-yellow-400">{clinic.waiting}</td>
                    <td className="text-center p-3">{clinic.avgWaitTime} {t('د', 'm')}</td>
                    <td className="text-center p-3">{clinic.avgStayTime} {t('د', 'm')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* نافذة الإرسال بالبريد */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-md">
            <h4 className="text-lg font-bold mb-4">{t('إرسال التقرير بالبريد الإلكتروني', 'Send Report by Email')}</h4>
            <input
              type="email"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              placeholder={t('البريد الإلكتروني', 'Email address')}
              className="w-full p-3 bg-black/30 border border-white/10 rounded-xl mb-4 text-white"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowEmailModal(false)}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-xl hover:bg-gray-700"
              >
                {t('إلغاء', 'Cancel')}
              </button>
              <button
                onClick={sendReportByEmail}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700"
              >
                {t('إرسال', 'Send')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// مكون إدارة العيادات
const ClinicsManagement = ({ language, t }) => {
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingClinic, setEditingClinic] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newClinic, setNewClinic] = useState({ name_ar: '', name_en: '', floor: '', code: '', weight: 1, exam_duration: 5, call_interval: 2, late_threshold: 4 });
  const [transferModal, setTransferModal] = useState(null);
  const [transferReason, setTransferReason] = useState('');
  const [targetClinicId, setTargetClinicId] = useState('');

  useEffect(() => {
    loadClinics();
  }, []);

  const loadClinics = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clinics')
        .select('*')
        .order('name_ar');
      
      if (!error && data) setClinics(data);
    } catch (e) {
      console.error('Error loading clinics:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleClinicStatus = async (clinicId, currentStatus) => {
    try {
      const updates = { is_active: !currentStatus };
      if (!currentStatus) {
        // عند فتح العيادة - مسح سبب الإغلاق
        updates.closure_reason = null;
        updates.closed_at = null;
      }
      await supabase
        .from('clinics')
        .update(updates)
        .eq('id', clinicId);
      loadClinics();
    } catch (e) {
      console.error('Error toggling clinic:', e);
    }
  };

  const updateClinic = async (clinicId, updates) => {
    try {
      const { error } = await supabase
        .from('clinics')
        .update(updates)
        .eq('id', clinicId);
      if (!error) {
        loadClinics();
        setEditingClinic(null);
        showSuccessToast(t('تم حفظ التعديلات بنجاح', 'Changes saved successfully'));
      } else {
        showErrorToast(t('حدث خطأ أثناء الحفظ', 'Error saving changes'));
      }
    } catch (e) {
      console.error('Error updating clinic:', e);
      showErrorToast(t('حدث خطأ أثناء الحفظ', 'Error saving changes'));
    }
  };

  const addClinic = async () => {
    if (!newClinic.name_ar || !newClinic.name_en) {
      showErrorToast(t('يرجى إدخال اسم العيادة', 'Please enter clinic name'));
      return;
    }
    try {
      // استخدام الرمز كـ ID أو إنشاء ID من الاسم الإنجليزي
      const clinicId = newClinic.code || newClinic.name_en.substring(0, 5).toUpperCase().replace(/\s/g, '');
      const { error } = await supabase.from('clinics').insert({
        id: clinicId,
        name: newClinic.name_en,
        name_ar: newClinic.name_ar,
        name_en: newClinic.name_en,
        floor: newClinic.floor || 'الطابق الأول',
        call_interval: newClinic.call_interval || 2,
        call_interval_seconds: (newClinic.call_interval || 2) * 60,
        is_active: true,
        system_enabled: true,
        category: 'clinic',
        gender_constraint: 'mixed',
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      if (!error) {
        loadClinics();
        setShowAddForm(false);
        setNewClinic({ name_ar: '', name_en: '', floor: '', code: '', weight: 1, exam_duration: 5, call_interval: 2, late_threshold: 4 });
        showSuccessToast(t('تم إضافة العيادة بنجاح', 'Clinic added successfully'));
      } else {
        showErrorToast(t('حدث خطأ أثناء الإضافة', 'Error adding clinic'));
      }
    } catch (e) {
      console.error('Error adding clinic:', e);
      showErrorToast(t('حدث خطأ أثناء الإضافة', 'Error adding clinic'));
    }
  };

  const deleteClinic = async (clinicId) => {
    if (!window.confirm(t('هل أنت متأكد من حذف هذه العيادة؟', 'Are you sure you want to delete this clinic?'))) return;
    try {
      const { error } = await supabase.from('clinics').delete().eq('id', clinicId);
      if (!error) {
        loadClinics();
        showSuccessToast(t('تم حذف العيادة بنجاح', 'Clinic deleted successfully'));
      } else {
        showErrorToast(t('حدث خطأ أثناء الحذف', 'Error deleting clinic'));
      }
    } catch (e) {
      console.error('Error deleting clinic:', e);
      showErrorToast(t('حدث خطأ أثناء الحذف', 'Error deleting clinic'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">{t('إدارة العيادات', 'Clinics Management')}</h3>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-[#C9A54C] text-black rounded-xl hover:bg-[#B8943D] transition-all flex items-center gap-2"
          >
            <Plus size={18} />
            {t('إضافة عيادة', 'Add Clinic')}
          </button>
          <button 
            onClick={loadClinics}
            className="p-2 bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] border border-white/10 rounded-xl hover:bg-[#8A1538] transition-all"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-6">
          <h4 className="font-bold mb-4">{t('إضافة عيادة جديدة', 'Add New Clinic')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('الاسم بالعربية', 'Arabic Name')} *</label>
              <input
                type="text"
                value={newClinic.name_ar}
                onChange={(e) => setNewClinic({...newClinic, name_ar: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
                placeholder="عيادة العيون"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('الاسم بالإنجليزية', 'English Name')} *</label>
              <input
                type="text"
                value={newClinic.name_en}
                onChange={(e) => setNewClinic({...newClinic, name_en: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
                placeholder="Eye Clinic"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('الرمز', 'Code')}</label>
              <input
                type="text"
                value={newClinic.code}
                onChange={(e) => setNewClinic({...newClinic, code: e.target.value.toUpperCase()})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
                placeholder="EYE"
                maxLength={5}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('الطابق', 'Floor')}</label>
              <input
                type="text"
                value={newClinic.floor}
                onChange={(e) => setNewClinic({...newClinic, floor: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
                placeholder="الطابق الأول"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('الوزن', 'Weight')}</label>
              <input
                type="number"
                value={newClinic.weight}
                onChange={(e) => setNewClinic({...newClinic, weight: parseInt(e.target.value) || 1})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
                min="1"
                max="10"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('مدة الفحص (دقيقة)', 'Exam Duration (min)')}</label>
              <input
                type="number"
                value={newClinic.exam_duration}
                onChange={(e) => setNewClinic({...newClinic, exam_duration: parseInt(e.target.value) || 5})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
                min="1"
                max="60"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('النداء التالي (دقيقة)', 'Next Call (min)')}</label>
              <input
                type="number"
                value={newClinic.call_interval}
                onChange={(e) => setNewClinic({...newClinic, call_interval: parseInt(e.target.value) || 2})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
                min="1"
                max="15"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('التأخير (دقيقة)', 'Late After (min)')}</label>
              <input
                type="number"
                value={newClinic.late_threshold}
                onChange={(e) => setNewClinic({...newClinic, late_threshold: parseInt(e.target.value) || 4})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
                min="1"
                max="30"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={addClinic} className="px-6 py-2 bg-[#C9A54C] text-black rounded-xl hover:bg-[#B8943D] transition-all">
              {t('حفظ', 'Save')}
            </button>
            <button onClick={() => setShowAddForm(false)} className="px-6 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all">
              {t('إلغاء', 'Cancel')}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clinics.map(clinic => (
          <div key={clinic.id} className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="font-bold text-lg">{language === 'ar' ? (clinic.name_ar || clinic.name_en) : (clinic.name_en || clinic.name_ar)}</h4>
                <p className="text-gray-400 text-sm">{clinic.floor || t('الطابق غير محدد', 'Floor not set')}</p>
              </div>
              <div className="text-right">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  clinic.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {clinic.is_active ? t('مفتوح', 'Open') : t('مغلق', 'Closed')}
                </span>
                {clinic.closure_reason && !clinic.is_active && (
                  <p className="text-xs text-red-400 mt-1">{clinic.closure_reason}</p>
                )}
              </div>
            </div>


            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => clinic.is_active ? setTransferModal(clinic) : toggleClinicStatus(clinic.id, clinic.is_active)}
                className={`flex-1 py-2 rounded-lg font-medium transition-all ${
                  clinic.is_active 
                    ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30' 
                    : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                }`}
              >
                {clinic.is_active ? t('إغلاق/تحويل', 'Close/Transfer') : t('فتح', 'Open')}
              </button>
              <button
                onClick={() => setEditingClinic(clinic)}
                className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all"
              >
                <Edit size={18} />
              </button>
              <button
                onClick={() => deleteClinic(clinic.id)}
                className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {editingClinic && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4">
          <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-6 w-full max-w-md">
            <h4 className="font-bold text-lg mb-4">{t('تعديل العيادة', 'Edit Clinic')}</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t('الاسم بالعربية', 'Arabic Name')}</label>
                <input
                  type="text"
                  value={editingClinic.name_ar}
                  onChange={(e) => setEditingClinic({...editingClinic, name_ar: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t('الاسم بالإنجليزية', 'English Name')}</label>
                <input
                  type="text"
                  value={editingClinic.name_en}
                  onChange={(e) => setEditingClinic({...editingClinic, name_en: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t('الطابق', 'Floor')}</label>
                <input
                  type="text"
                  value={editingClinic.floor || ''}
                  onChange={(e) => setEditingClinic({...editingClinic, floor: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
                />
              </div>

            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => updateClinic(editingClinic.id, {
                  name_ar: editingClinic.name_ar,
                  name_en: editingClinic.name_en,
                  floor: editingClinic.floor
                })}
                className="flex-1 py-2 bg-[#C9A54C] text-black rounded-xl hover:bg-[#B8943D] transition-all font-medium"
              >
                {t('حفظ', 'Save')}
              </button>
              <button
                onClick={() => setEditingClinic(null)}
                className="flex-1 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all"
              >
                {t('إلغاء', 'Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal التحويل */}
      {transferModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4">
          <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-6 w-full max-w-md">
            <h4 className="font-bold text-lg mb-4">{t('إغلاق وتحويل العيادة', 'Close & Transfer Clinic')}</h4>
            <p className="text-gray-400 mb-4">
              {language === 'ar' ? (transferModal.name_ar || transferModal.name_en) : (transferModal.name_en || transferModal.name_ar)}
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t('سبب الإغلاق', 'Closure Reason')} *</label>
                <select
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
                >
                  <option value="">{t('اختر السبب', 'Select reason')}</option>
                  <option value="غياب الطبيب">{t('غياب الطبيب', 'Doctor absent')}</option>
                  <option value="إجازة">{t('إجازة', 'On leave')}</option>
                  <option value="صيانة">{t('صيانة', 'Maintenance')}</option>
                  <option value="اجتماع">{t('اجتماع', 'Meeting')}</option>
                  <option value="طوارئ">{t('طوارئ', 'Emergency')}</option>
                  <option value="أخرى">{t('أخرى', 'Other')}</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t('تحويل المراجعين إلى', 'Transfer patients to')}</label>
                <select
                  value={targetClinicId}
                  onChange={(e) => setTargetClinicId(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
                >
                  <option value="">{t('بدون تحويل', 'No transfer')}</option>
                  {clinics.filter(c => c.id !== transferModal.id && c.is_active).map(c => (
                    <option key={c.id} value={c.id}>
                      {language === 'ar' ? (c.name_ar || c.name_en) : (c.name_en || c.name_ar)}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">{t('اختياري - لتحويل المراجعين المنتظرين', 'Optional - to transfer waiting patients')}</p>
              </div>
            </div>
            
            <div className="flex gap-2 mt-6">
              <button
                onClick={async () => {
                  if (!transferReason) {
                    alert(t('يرجى اختيار سبب الإغلاق', 'Please select closure reason'));
                    return;
                  }
                  try {
                    // تحديث حالة العيادة
                    await supabase.from('clinics').update({
                      is_active: false,
                      closure_reason: transferReason,
                      closed_at: new Date().toISOString()
                    }).eq('id', transferModal.id);
                    
                    // تحويل المراجعين إذا تم اختيار عيادة
                    if (targetClinicId) {
                      await supabase.from('unified_queue').update({
                        clinic_id: targetClinicId,
                        transferred_from: transferModal.id,
                        transfer_reason: transferReason
                      }).eq('clinic_id', transferModal.id).eq('status', 'waiting');
                    }
                    
                    loadClinics();
                    setTransferModal(null);
                    setTransferReason('');
                    setTargetClinicId('');
                    alert(t('تم إغلاق العيادة بنجاح', 'Clinic closed successfully'));
                  } catch (e) {
                    console.error('Error:', e);
                  }
                }}
                className="flex-1 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all font-medium"
              >
                {t('إغلاق العيادة', 'Close Clinic')}
              </button>
              <button
                onClick={() => {
                  setTransferModal(null);
                  setTransferReason('');
                  setTargetClinicId('');
                }}
                className="flex-1 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all"
              >
                {t('إلغاء', 'Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// مكون إدارة الإشعارات - متكامل
const NotificationsManagement = ({ language, t }) => {
  const [notifications, setNotifications] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingNotification, setEditingNotification] = useState(null);
  const [newNotification, setNewNotification] = useState({ 
    title: '', 
    message: '', 
    status: 'queued',
    clinic_id: null,
    priority: 'normal',
    metadata: {}
  });

  useEffect(() => {
    loadNotifications();
    loadClinics();
  }, []);

  const loadClinics = async () => {
    try {
      const { data } = await supabase.from('clinics').select('id, name_ar, name_en').order('name_ar');
      if (data) setClinics(data);
    } catch (e) {
      console.error('Error loading clinics:', e);
    }
  };

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*, clinics(name_ar, name_en)')
        .order('created_at', { ascending: false });
      
      if (!error && data) setNotifications(data);
    } catch (e) {
      console.error('Error loading notifications:', e);
    } finally {
      setLoading(false);
    }
  };

  const addNotification = async () => {
    try {
      const notifData = {
        title: newNotification.title,
        message: newNotification.message,
        status: newNotification.status || 'queued',
        clinic_id: newNotification.clinic_id || null,
        is_read: false,
        metadata: {
          priority: newNotification.priority || 'normal',
          ...newNotification.metadata
        }
      };
      
      const { error } = await supabase.from('notifications').insert(notifData);
      
      if (error) {
        console.error('Error adding notification:', error);
        alert(t('خطأ في إضافة الإشعار', 'Error adding notification'));
        return;
      }
      
      loadNotifications();
      setShowAddForm(false);
      setNewNotification({ title: '', message: '', status: 'queued', clinic_id: null, priority: 'normal', metadata: {} });
      alert(t('تم إضافة الإشعار بنجاح', 'Notification added successfully'));
    } catch (e) {
      console.error('Error adding notification:', e);
    }
  };

  const updateNotification = async () => {
    if (!editingNotification) return;
    try {
      const { error } = await supabase.from('notifications').update({
        title: editingNotification.title,
        message: editingNotification.message,
        status: editingNotification.status,
        clinic_id: editingNotification.clinic_id,
        metadata: {
          ...editingNotification.metadata,
          priority: editingNotification.priority || 'normal'
        }
      }).eq('id', editingNotification.id);
      
      if (!error) {
        loadNotifications();
        setEditingNotification(null);
        alert(t('تم تحديث الإشعار بنجاح', 'Notification updated successfully'));
      }
    } catch (e) {
      console.error('Error updating notification:', e);
    }
  };

  const sendNotification = async (id) => {
    try {
      await supabase.from('notifications').update({ 
        status: 'sent',
        sent_at: new Date().toISOString()
      }).eq('id', id);
      loadNotifications();
      alert(t('تم إرسال الإشعار', 'Notification sent'));
    } catch (e) {
      console.error('Error sending notification:', e);
    }
  };

  const markAsRead = async (id) => {
    try {
      await supabase.from('notifications').update({ 
        is_read: true,
        read_at: new Date().toISOString()
      }).eq('id', id);
      loadNotifications();
    } catch (e) {
      console.error('Error marking as read:', e);
    }
  };

  const deleteNotification = async (id) => {
    if (!window.confirm(t('هل أنت متأكد من الحذف؟', 'Are you sure you want to delete?'))) return;
    try {
      await supabase.from('notifications').delete().eq('id', id);
      loadNotifications();
    } catch (e) {
      console.error('Error deleting notification:', e);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('ar-QA', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">{t('إدارة الإشعارات', 'Notifications Management')}</h3>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-[#C9A54C] text-black rounded-xl hover:bg-[#B8943D] transition-all flex items-center gap-2"
          >
            <Plus size={18} />
            {t('إضافة إشعار', 'Add Notification')}
          </button>
          <button 
            onClick={loadNotifications}
            className="p-2 bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] border border-white/10 rounded-xl hover:bg-[#8A1538] transition-all"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* نموذج إضافة إشعار جديد */}
      {showAddForm && (
        <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-6">
          <h4 className="font-bold mb-4">{t('إضافة إشعار جديد', 'Add New Notification')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('العنوان', 'Title')} *</label>
              <input
                type="text"
                value={newNotification.title}
                onChange={(e) => setNewNotification({...newNotification, title: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
                placeholder={t('عنوان الإشعار', 'Notification title')}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('العيادة', 'Clinic')}</label>
              <select
                value={newNotification.clinic_id || ''}
                onChange={(e) => setNewNotification({...newNotification, clinic_id: e.target.value || null})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
              >
                <option value="">{t('جميع العيادات', 'All Clinics')}</option>
                {clinics.map(c => (
                  <option key={c.id} value={c.id}>{language === 'ar' ? (c.name_ar || c.name_en) : (c.name_en || c.name_ar)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('الأولوية', 'Priority')}</label>
              <select
                value={newNotification.priority}
                onChange={(e) => setNewNotification({...newNotification, priority: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
              >
                <option value="low">{t('منخفضة', 'Low')}</option>
                <option value="normal">{t('عادية', 'Normal')}</option>
                <option value="high">{t('عالية', 'High')}</option>
                <option value="urgent">{t('عاجلة', 'Urgent')}</option>
              </select>
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-sm text-gray-400 mb-2">{t('الرسالة', 'Message')} *</label>
              <textarea
                value={newNotification.message}
                onChange={(e) => setNewNotification({...newNotification, message: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white h-24"
                placeholder={t('نص الإشعار', 'Notification message')}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button 
              onClick={addNotification} 
              disabled={!newNotification.title || !newNotification.message}
              className="px-6 py-2 bg-[#C9A54C] text-black rounded-xl hover:bg-[#B8943D] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('حفظ', 'Save')}
            </button>
            <button onClick={() => setShowAddForm(false)} className="px-6 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all">
              {t('إلغاء', 'Cancel')}
            </button>
          </div>
        </div>
      )}

      {/* نموذج تعديل إشعار */}
      {editingNotification && (
        <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-[#C9A54C]/50 p-6">
          <h4 className="font-bold mb-4 text-[#B8943D]">{t('تعديل الإشعار', 'Edit Notification')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('العنوان', 'Title')}</label>
              <input
                type="text"
                value={editingNotification.title}
                onChange={(e) => setEditingNotification({...editingNotification, title: e.target.value})}
                className="w-full bg-white/5 border border-[#C9A54C]/30 rounded-xl px-4 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('العيادة', 'Clinic')}</label>
              <select
                value={editingNotification.clinic_id || ''}
                onChange={(e) => setEditingNotification({...editingNotification, clinic_id: e.target.value || null})}
                className="w-full bg-white/5 border border-[#C9A54C]/30 rounded-xl px-4 py-2 text-white"
              >
                <option value="">{t('جميع العيادات', 'All Clinics')}</option>
                {clinics.map(c => (
                  <option key={c.id} value={c.id}>{language === 'ar' ? (c.name_ar || c.name_en) : (c.name_en || c.name_ar)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('الحالة', 'Status')}</label>
              <select
                value={editingNotification.status}
                onChange={(e) => setEditingNotification({...editingNotification, status: e.target.value})}
                className="w-full bg-white/5 border border-[#C9A54C]/30 rounded-xl px-4 py-2 text-white"
              >
                <option value="queued">{t('في الانتظار', 'Queued')}</option>
                <option value="sent">{t('مرسل', 'Sent')}</option>
                <option value="read">{t('مقروء', 'Read')}</option>
              </select>
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-sm text-gray-400 mb-2">{t('الرسالة', 'Message')}</label>
              <textarea
                value={editingNotification.message}
                onChange={(e) => setEditingNotification({...editingNotification, message: e.target.value})}
                className="w-full bg-white/5 border border-[#C9A54C]/30 rounded-xl px-4 py-2 text-white h-24"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={updateNotification} className="px-6 py-2 bg-[#C9A54C] text-black rounded-xl hover:bg-[#B8943D] transition-all">
              {t('تحديث', 'Update')}
            </button>
            <button onClick={() => setEditingNotification(null)} className="px-6 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all">
              {t('إلغاء', 'Cancel')}
            </button>
          </div>
        </div>
      )}

      {/* جدول الإشعارات */}
      <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="text-right p-4 text-gray-400 font-medium">{t('العنوان', 'Title')}</th>
                <th className="text-right p-4 text-gray-400 font-medium">{t('العيادة', 'Clinic')}</th>
                <th className="text-right p-4 text-gray-400 font-medium">{t('الحالة', 'Status')}</th>
                <th className="text-right p-4 text-gray-400 font-medium">{t('وقت الإنشاء', 'Created')}</th>
                <th className="text-right p-4 text-gray-400 font-medium">{t('وقت الإرسال', 'Sent')}</th>
                <th className="text-right p-4 text-gray-400 font-medium">{t('الإجراءات', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map(notif => (
                <tr key={notif.id} className="border-t border-white/5 hover:bg-white/5 transition-all">
                  <td className="p-4">
                    <div className="font-medium">{notif.title}</div>
                    <div className="text-sm text-gray-400 truncate max-w-xs">{notif.message}</div>
                  </td>
                  <td className="p-4">
                    <span className="text-sm">
                      {notif.clinics ? (language === 'ar' ? (notif.clinics.name_ar || notif.clinics.name_en) : (notif.clinics.name_en || notif.clinics.name_ar)) : t('عام', 'General')}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      notif.status === 'sent' ? 'bg-green-500/20 text-green-400' :
                      notif.status === 'read' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {notif.status === 'sent' ? t('مرسل', 'Sent') :
                       notif.status === 'read' ? t('مقروء', 'Read') :
                       t('في الانتظار', 'Queued')}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-gray-400">{formatDate(notif.created_at)}</td>
                  <td className="p-4 text-sm text-gray-400">{formatDate(notif.sent_at)}</td>
                  <td className="p-4">
                    <div className="flex gap-1">
                      {notif.status === 'queued' && (
                        <button
                          onClick={() => sendNotification(notif.id)}
                          className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-all"
                          title={t('إرسال', 'Send')}
                        >
                          <Play size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => setEditingNotification({...notif, priority: notif.metadata?.priority || 'normal'})}
                        className="p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all"
                        title={t('تعديل', 'Edit')}
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => deleteNotification(notif.id)}
                        className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all"
                        title={t('حذف', 'Delete')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {notifications.length === 0 && (
          <div className="p-8 text-center text-gray-400">
            <Bell size={48} className="mx-auto mb-4 opacity-50" />
            {t('لا توجد إشعارات', 'No notifications found')}
          </div>
        )}
      </div>
    </div>
  );
};

// مكون إدارة المسارات - محدث ليتوافق مع هيكل قاعدة البيانات
const RoutesManagement = ({ language, t }) => {
  const [routes, setRoutes] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRoute, setEditingRoute] = useState(null);
  const [newRoute, setNewRoute] = useState({ 
    exam_type: '', 
    route_name: '', 
    clinics: [], 
    order_sequence: 1, 
    is_active: true 
  });

  // أنواع الفحوصات المتاحة
  const examTypes = [
    { id: 'general', name_ar: 'فحص عام', name_en: 'General Exam' },
    { id: 'periodic', name_ar: 'فحص دوري', name_en: 'Periodic Exam' },
    { id: 'pre_employment', name_ar: 'فحص ما قبل التوظيف', name_en: 'Pre-Employment Exam' },
    { id: 'fitness', name_ar: 'فحص اللياقة', name_en: 'Fitness Exam' },
    { id: 'specialized', name_ar: 'فحص تخصصي', name_en: 'Specialized Exam' },
    { id: 'follow_up', name_ar: 'متابعة', name_en: 'Follow-up' },
    { id: 'emergency', name_ar: 'طوارئ', name_en: 'Emergency' }
  ];

  useEffect(() => {
    loadRoutes();
    loadClinics();
  }, []);

  const loadClinics = async () => {
    try {
      const { data } = await supabase.from('clinics').select('*').order('name_ar');
      if (data) {
        // إزالة التكرارات بناءً على الاسم العربي
        const uniqueClinics = data.reduce((acc, clinic) => {
          const existingClinic = acc.find(c => c.name_ar === clinic.name_ar);
          if (!existingClinic) {
            acc.push(clinic);
          }
          return acc;
        }, []);
        setClinics(uniqueClinics);
      }
    } catch (e) {
      console.error('Error loading clinics:', e);
    }
  };

  const loadRoutes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('routes')
        .select('*')
        .order('order_sequence', { ascending: true });
      
      if (!error && data) setRoutes(data);
    } catch (e) {
      console.error('Error loading routes:', e);
    } finally {
      setLoading(false);
    }
  };

  const addRoute = async () => {
    console.log('addRoute called with:', newRoute);
    if (!newRoute.exam_type || !newRoute.route_name) {
      console.log('Validation failed - missing fields');
      alert(t('يرجى ملء جميع الحقول المطلوبة', 'Please fill all required fields'));
      return;
    }
    try {
      console.log('Inserting route...');
      const { data, error } = await supabase.from('routes').insert({
        exam_type: newRoute.exam_type,
        route_name: newRoute.route_name,
        clinics: newRoute.clinics,
        order_sequence: newRoute.order_sequence || 1,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      console.log('Insert result - data:', data, 'error:', error);
      if (!error) {
        console.log('Route added successfully!');
        await logActivity('route_created', `تم إنشاء مسار جديد: ${newRoute.route_name}`);
        loadRoutes();
        setShowAddForm(false);
        setNewRoute({ exam_type: '', route_name: '', clinics: [], order_sequence: 1, is_active: true });
      } else {
        console.error('Error adding route:', error);
        alert(t('حدث خطأ أثناء إضافة المسار', 'Error adding route'));
      }
    } catch (e) {
      console.error('Error adding route:', e);
    }
  };

  const updateRoute = async () => {
    if (!editingRoute) return;
    try {
      const { error } = await supabase.from('routes').update({
        exam_type: editingRoute.exam_type,
        route_name: editingRoute.route_name,
        clinics: editingRoute.clinics,
        order_sequence: editingRoute.order_sequence,
        updated_at: new Date().toISOString()
      }).eq('id', editingRoute.id);
      
      if (!error) {
        await logActivity('route_updated', `تم تحديث المسار: ${editingRoute.route_name}`);
        loadRoutes();
        setEditingRoute(null);
      }
    } catch (e) {
      console.error('Error updating route:', e);
    }
  };

  const toggleRoute = async (id, currentStatus) => {
    try {
      await supabase.from('routes').update({ 
        is_active: !currentStatus,
        updated_at: new Date().toISOString()
      }).eq('id', id);
      await logActivity('route_toggled', `تم ${!currentStatus ? 'تفعيل' : 'تعطيل'} المسار`);
      loadRoutes();
    } catch (e) {
      console.error('Error toggling route:', e);
    }
  };

  const deleteRoute = async (id) => {
    if (!window.confirm(t('هل أنت متأكد من الحذف؟', 'Are you sure you want to delete?'))) return;
    try {
      await supabase.from('routes').delete().eq('id', id);
      await logActivity('route_deleted', 'تم حذف مسار');
      loadRoutes();
    } catch (e) {
      console.error('Error deleting route:', e);
    }
  };

  const toggleClinicSelection = (clinicId, isEditing = false) => {
    if (isEditing && editingRoute) {
      const currentClinics = editingRoute.clinics || [];
      const newClinics = currentClinics.includes(clinicId)
        ? currentClinics.filter(id => id !== clinicId)
        : [...currentClinics, clinicId];
      setEditingRoute({...editingRoute, clinics: newClinics});
    } else {
      const currentClinics = newRoute.clinics || [];
      const newClinics = currentClinics.includes(clinicId)
        ? currentClinics.filter(id => id !== clinicId)
        : [...currentClinics, clinicId];
      setNewRoute({...newRoute, clinics: newClinics});
    }
  };

  const getClinicName = (clinicId) => {
    const clinic = clinics.find(c => c.id === clinicId);
    return clinic ? (language === 'ar' ? clinic.name_ar : clinic.name_en) : clinicId;
  };

  const getExamTypeName = (examType) => {
    const type = examTypes.find(t => t.id === examType);
    return type ? (language === 'ar' ? type.name_ar : type.name_en) : examType;
  };

  // نموذج إضافة/تعديل المسار
  const RouteForm = ({ route, isEditing, onSave, onCancel }) => {
    const currentRoute = isEditing ? editingRoute : newRoute;
    const setCurrentRoute = isEditing ? setEditingRoute : setNewRoute;

    return (
      <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-6">
        <h4 className="font-bold mb-4 text-lg">
          {isEditing ? t('تعديل المسار', 'Edit Route') : t('إضافة مسار جديد', 'Add New Route')}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* نوع الفحص */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              {t('نوع الفحص', 'Exam Type')} <span className="text-red-400">*</span>
            </label>
            <select
              value={currentRoute?.exam_type || ''}
              onChange={(e) => setCurrentRoute({...currentRoute, exam_type: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
            >
              <option value="">{t('اختر نوع الفحص', 'Select Exam Type')}</option>
              {examTypes.map(type => (
                <option key={type.id} value={type.id}>
                  {language === 'ar' ? type.name_ar : type.name_en}
                </option>
              ))}
            </select>
          </div>

          {/* اسم المسار */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              {t('اسم المسار', 'Route Name')} <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={currentRoute?.route_name || ''}
              onChange={(e) => setCurrentRoute({...currentRoute, route_name: e.target.value})}
              placeholder={t('مثال: مسار الفحص الشامل', 'Example: Complete Exam Route')}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
            />
          </div>

          {/* الترتيب */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">{t('الترتيب', 'Order')}</label>
            <input
              type="number"
              min="1"
              value={currentRoute?.order_sequence || 1}
              onChange={(e) => setCurrentRoute({...currentRoute, order_sequence: parseInt(e.target.value) || 1})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
            />
          </div>

          {/* العيادات المحددة */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              {t('العيادات المحددة', 'Selected Clinics')}: {(currentRoute?.clinics || []).length}
            </label>
            <div className="flex flex-wrap gap-2 min-h-[48px] bg-white/5 border border-white/10 rounded-xl p-2">
              {(currentRoute?.clinics || []).map(clinicId => (
                <span 
                  key={clinicId} 
                  className="px-2 py-1 bg-[#C9A54C]/20 text-[#C9A54C] rounded-lg text-sm flex items-center gap-1"
                >
                  {getClinicName(clinicId)}
                  <button 
                    onClick={() => toggleClinicSelection(clinicId, isEditing)}
                    className="hover:text-red-400"
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
              {(currentRoute?.clinics || []).length === 0 && (
                <span className="text-gray-500 text-sm">{t('لم يتم اختيار عيادات', 'No clinics selected')}</span>
              )}
            </div>
          </div>
        </div>

        {/* قائمة العيادات للاختيار */}
        <div className="mt-4">
          <label className="block text-sm text-gray-400 mb-2">
            {t('اختر العيادات (اضغط للإضافة/الإزالة)', 'Select Clinics (Click to add/remove)')}
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto bg-white/5 border border-white/10 rounded-xl p-3">
            {clinics.map(clinic => {
              const isSelected = (currentRoute?.clinics || []).includes(clinic.id);
              return (
                <button
                  key={clinic.id}
                  onClick={() => toggleClinicSelection(clinic.id, isEditing)}
                  className={`px-3 py-2 rounded-lg text-sm transition-all text-right ${
                    isSelected 
                      ? 'bg-[#C9A54C] text-black font-medium' 
                      : 'bg-white/5 text-white hover:bg-white/10'
                  }`}
                >
                  {language === 'ar' ? clinic.name_ar : clinic.name_en}
                </button>
              );
            })}
          </div>
        </div>

        {/* أزرار الحفظ والإلغاء */}
        <div className="flex gap-2 mt-6">
          <button 
            onClick={onSave} 
            className="px-6 py-2 bg-[#C9A54C] text-black rounded-xl hover:bg-[#B8943D] transition-all font-medium flex items-center gap-2"
          >
            <Save size={18} />
            {t('حفظ', 'Save')}
          </button>
          <button 
            onClick={onCancel} 
            className="px-6 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all"
          >
            {t('إلغاء', 'Cancel')}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h3 className="text-xl font-bold">{t('إدارة المسارات الطبية', 'Medical Routes Management')}</h3>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              setShowAddForm(true);
              setEditingRoute(null);
            }}
            className="px-4 py-2 bg-[#C9A54C] text-black rounded-xl hover:bg-[#B8943D] transition-all flex items-center gap-2 font-medium"
          >
            <Plus size={18} />
            {t('إضافة مسار', 'Add Route')}
          </button>
          <button 
            onClick={loadRoutes}
            className="p-2 bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] border border-white/10 rounded-xl hover:bg-[#8A1538] transition-all"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* نموذج إضافة مسار جديد */}
      {showAddForm && !editingRoute && (
        <RouteForm 
          route={newRoute} 
          isEditing={false} 
          onSave={addRoute} 
          onCancel={() => {
            setShowAddForm(false);
            setNewRoute({ exam_type: '', route_name: '', clinics: [], order_sequence: 1, is_active: true });
          }} 
        />
      )}

      {/* نموذج تعديل المسار */}
      {editingRoute && (
        <RouteForm 
          route={editingRoute} 
          isEditing={true} 
          onSave={updateRoute} 
          onCancel={() => setEditingRoute(null)} 
        />
      )}

      {/* قائمة المسارات */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {routes.map(route => (
          <div key={route.id} className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-lg">{route.route_name}</h4>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                route.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {route.is_active ? t('نشط', 'Active') : t('معطل', 'Inactive')}
              </span>
            </div>
            
            <div className="space-y-2 mb-4">
              <p className="text-gray-400 text-sm">
                <span className="text-[#C9A54C]">{t('نوع الفحص:', 'Exam Type:')}</span> {getExamTypeName(route.exam_type)}
              </p>
              <p className="text-gray-400 text-sm">
                <span className="text-[#C9A54C]">{t('الترتيب:', 'Order:')}</span> {route.order_sequence}
              </p>
              <div className="text-gray-400 text-sm">
                <span className="text-[#C9A54C]">{t('العيادات:', 'Clinics:')}</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(route.clinics || []).slice(0, 3).map(clinicId => (
                    <span key={clinicId} className="px-2 py-0.5 bg-white/10 rounded text-xs">
                      {getClinicName(clinicId)}
                    </span>
                  ))}
                  {(route.clinics || []).length > 3 && (
                    <span className="px-2 py-0.5 bg-white/10 rounded text-xs">
                      +{(route.clinics || []).length - 3} {t('أخرى', 'more')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditingRoute(route);
                  setShowAddForm(false);
                }}
                className="flex-1 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all flex items-center justify-center gap-2"
              >
                <Edit size={16} />
                {t('تعديل', 'Edit')}
              </button>
              <button
                onClick={() => toggleRoute(route.id, route.is_active)}
                className={`p-2 rounded-lg transition-all ${
                  route.is_active ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'
                }`}
              >
                {route.is_active ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <button
                onClick={() => deleteRoute(route.id)}
                className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {routes.length === 0 && !loading && (
        <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-8 text-center text-gray-400">
          <MapPin size={48} className="mx-auto mb-4 opacity-50" />
          <p>{t('لا توجد مسارات. اضغط على "إضافة مسار" لإنشاء مسار جديد.', 'No routes found. Click "Add Route" to create a new route.')}</p>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-8">
          <RefreshCw size={32} className="animate-spin text-[#C9A54C]" />
        </div>
      )}
    </div>
  );
};

// مكون حالة النظام وقاعدة البيانات
const SystemStatus = ({ language, t }) => {
  const [status, setStatus] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSystemStatus();
  }, []);

  const checkSystemStatus = async () => {
    setLoading(true);
    const results = {};
    
    // قائمة الجداول للفحص
    const tables = [
      { name: 'clinics', label: t('العيادات', 'Clinics') },
      { name: 'queue', label: t('الطابور (queue)', 'Queue') },
      { name: 'queues', label: t('الطوابير (queues)', 'Queues') },
      { name: 'pins', label: t('الأرقام السرية', 'PINs') },
      { name: 'settings', label: t('الإعدادات', 'Settings') },
      { name: 'notifications', label: t('الإشعارات', 'Notifications') },
      { name: 'routes', label: t('المسارات', 'Routes') },
      { name: 'patients', label: t('المرضى', 'Patients') },
      { name: 'admins', label: t('المسؤولين', 'Admins') },
      { name: 'users', label: t('المستخدمين', 'Users') },
      { name: 'sessions', label: t('الجلسات', 'Sessions') },
    ];

    for (const table of tables) {
      try {
        const { data, error, count } = await supabase
          .from(table.name)
          .select('*', { count: 'exact', head: false })
          .limit(1);
        
        if (error) {
          results[table.name] = { status: 'error', label: table.label, message: error.message, count: 0 };
        } else {
          const { count: totalCount } = await supabase.from(table.name).select('*', { count: 'exact', head: true });
          results[table.name] = { status: 'ok', label: table.label, count: totalCount || 0 };
        }
      } catch (e) {
        results[table.name] = { status: 'error', label: table.label, message: e.message, count: 0 };
      }
    }

    setStatus(results);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">{t('حالة النظام وقاعدة البيانات', 'System & Database Status')}</h3>
        <button 
          onClick={checkSystemStatus}
          className="px-4 py-2 bg-[#C9A54C] text-black rounded-xl hover:bg-[#B8943D] transition-all flex items-center gap-2"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          {t('تحديث', 'Refresh')}
        </button>
      </div>

      {/* ملخص الحالة */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-green-500/20 rounded-xl">
              <Activity className="text-green-400" size={24} />
            </div>
            <span className="text-gray-400">{t('الجداول النشطة', 'Active Tables')}</span>
          </div>
          <div className="text-3xl font-bold text-green-400">
            {Object.values(status).filter(s => s.status === 'ok').length}
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-red-500/20 rounded-xl">
              <XCircle className="text-red-400" size={24} />
            </div>
            <span className="text-gray-400">{t('الجداول المعطلة', 'Failed Tables')}</span>
          </div>
          <div className="text-3xl font-bold text-red-400">
            {Object.values(status).filter(s => s.status === 'error').length}
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <BarChart3 className="text-blue-400" size={24} />
            </div>
            <span className="text-gray-400">{t('إجمالي السجلات', 'Total Records')}</span>
          </div>
          <div className="text-3xl font-bold text-blue-400">
            {Object.values(status).reduce((acc, s) => acc + (s.count || 0), 0)}
          </div>
        </div>
      </div>

      {/* تفاصيل الجداول */}
      <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 overflow-hidden">
        <div className="p-4 bg-white/5 border-b border-white/10">
          <h4 className="font-bold">{t('تفاصيل الجداول', 'Table Details')}</h4>
        </div>
        <table className="w-full">
          <thead className="bg-white/5">
            <tr>
              <th className="text-right p-4 text-gray-400 font-medium">{t('الجدول', 'Table')}</th>
              <th className="text-right p-4 text-gray-400 font-medium">{t('الحالة', 'Status')}</th>
              <th className="text-right p-4 text-gray-400 font-medium">{t('عدد السجلات', 'Records')}</th>
              <th className="text-right p-4 text-gray-400 font-medium">{t('الملاحظات', 'Notes')}</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(status).map(([key, value]) => (
              <tr key={key} className="border-t border-white/5 hover:bg-white/5 transition-all">
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <code className="text-[#B8943D] bg-[#C9A54C]/10 px-2 py-1 rounded text-sm">{key}</code>
                    <span className="text-gray-400 text-sm">({value.label})</span>
                  </div>
                </td>
                <td className="p-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${
                    value.status === 'ok' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {value.status === 'ok' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                    {value.status === 'ok' ? t('متصل', 'Connected') : t('خطأ', 'Error')}
                  </span>
                </td>
                <td className="p-4 font-mono text-lg">{value.count || 0}</td>
                <td className="p-4 text-sm text-gray-400">
                  {value.status === 'error' ? value.message : 
                    value.count === 0 ? t('فارغ', 'Empty') : t('يعمل بشكل طبيعي', 'Working normally')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* معلومات الاتصال */}
      <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-6">
        <h4 className="font-bold mb-4">{t('معلومات الاتصال', 'Connection Info')}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-white/5 rounded-xl">
            <span className="text-gray-400 text-sm">{t('عنوان Supabase', 'Supabase URL')}</span>
            <p className="font-mono text-sm mt-1 text-[#B8943D]">rujwuruuosffcxazymit.supabase.co</p>
          </div>
          <div className="p-4 bg-white/5 rounded-xl">
            <span className="text-gray-400 text-sm">{t('حالة الاتصال', 'Connection Status')}</span>
            <p className="font-medium text-green-400 mt-1 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              {t('متصل', 'Connected')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// مكون الإعدادات
const SettingsSection = ({ language, t }) => {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('settings')
        .select('*');
      
      const settingsObj = {};
      if (!error && data) {
        data.forEach(s => { settingsObj[s.key] = s.value; });
      }
      
      // جلب إعداد device_restriction من system_settings
      const { getSystemSetting } = await import('../lib/supabase-client.js');
      const deviceRestriction = await getSystemSetting('device_restriction_enabled', false);
      settingsObj.device_restriction_enabled = deviceRestriction;
      
      setSettings(settingsObj);
    } catch (e) {
      console.error('Error loading settings:', e);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key, value) => {
    try {
      // التحقق من وجود الإعداد أولاً
      const { data: existing } = await supabase
        .from('settings')
        .select('id')
        .eq('key', key)
        .single();
      
      let error;
      if (existing) {
        // تحديث الإعداد الموجود
        const result = await supabase
          .from('settings')
          .update({ value: value, updated_at: new Date().toISOString() })
          .eq('key', key);
        error = result.error;
      } else {
        // إنشاء إعداد جديد
        const result = await supabase
          .from('settings')
          .insert({ 
            key, 
            value: value, 
            updated_at: new Date().toISOString(),
            is_public: false
          });
        error = result.error;
      }
      
      if (!error) {
        setSettings(prev => ({ ...prev, [key]: value }));
        showSuccessToast(t('تم حفظ الإعدادات', 'Settings saved'));
      } else {
        console.error('Error saving setting:', error);
        showErrorToast(t('حدث خطأ أثناء الحفظ', 'Error saving settings'));
      }
    } catch (e) {
      console.error('Error updating setting:', e);
      showErrorToast(t('حدث خطأ أثناء الحفظ', 'Error saving settings'));
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold">{t('الإعدادات', 'Settings')}</h3>

      <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-6 space-y-6">
        <div>
          <label className="block text-sm text-gray-400 mb-2">{t('اسم المركز', 'Center Name')}</label>
          <input
            type="text"
            value={settings.center_name || ''}
            onChange={(e) => updateSetting('center_name', e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
            placeholder={t('المركز الطبي التخصصي العسكري', 'Military Specialized Medical Center')}
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">{t('وقت انتهاء الدوام', 'Working Hours End')}</label>
          <input
            type="time"
            value={settings.working_hours_end || '16:00'}
            onChange={(e) => updateSetting('working_hours_end', e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">{t('الحد الأقصى للانتظار (دقيقة)', 'Max Wait Time (minutes)')}</label>
          <input
            type="number"
            value={settings.max_wait_time || 60}
            onChange={(e) => updateSetting('max_wait_time', e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
          />
        </div>

        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
          <div>
            <h4 className="font-medium">{t('تفعيل الإشعارات', 'Enable Notifications')}</h4>
            <p className="text-sm text-gray-400">{t('إرسال إشعارات للمرضى', 'Send notifications to patients')}</p>
          </div>
          <button
            onClick={() => updateSetting('notifications_enabled', settings.notifications_enabled === 'true' ? 'false' : 'true')}
            className={`w-14 h-8 rounded-full transition-all ${
              settings.notifications_enabled === 'true' ? 'bg-[#C9A54C]' : 'bg-white/20'
            }`}
          >
            <div className={`w-6 h-6 bg-white rounded-full transition-all ${
              settings.notifications_enabled === 'true' ? 'translate-x-7' : 'translate-x-1'
            }`} />
          </button>
        </div>

        {/* إعدادات منع التكرار */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <h4 className="text-lg font-bold mb-4">{t('إعدادات التسجيل', 'Registration Settings')}</h4>
          
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl mb-4">
            <div>
              <h4 className="font-medium">{t('منع تكرار الرقم العسكري', 'Prevent Duplicate Patient ID')}</h4>
              <p className="text-sm text-gray-400">{t('منع تسجيل نفس الرقم مرتين في نفس اليوم', 'Prevent same ID registration twice daily')}</p>
            </div>
            <button
              onClick={() => updateSetting('prevent_duplicate_patient_daily', !settings.prevent_duplicate_patient_daily)}
              className={`w-14 h-8 rounded-full transition-all ${
                settings.prevent_duplicate_patient_daily ? 'bg-green-500' : 'bg-white/20'
              }`}
            >
              <div className={`w-6 h-6 bg-white rounded-full transition-all ${
                settings.prevent_duplicate_patient_daily ? 'translate-x-7' : 'translate-x-1'
              }`} />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl mb-4">
            <div>
              <h4 className="font-medium">{t('منع تكرار الجهاز', 'Prevent Duplicate Device')}</h4>
              <p className="text-sm text-gray-400">{t('منع نفس الجهاز من التسجيل مرة أخرى', 'Prevent same device from registering again')}</p>
            </div>
            <button
              onClick={() => updateSetting('prevent_duplicate_device_daily', !settings.prevent_duplicate_device_daily)}
              className={`w-14 h-8 rounded-full transition-all ${
                settings.prevent_duplicate_device_daily ? 'bg-green-500' : 'bg-white/20'
              }`}
            >
              <div className={`w-6 h-6 bg-white rounded-full transition-all ${
                settings.prevent_duplicate_device_daily ? 'translate-x-7' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {/* نظام منع الجهاز من استخدام رقم مختلف */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-xl border border-orange-500/30">
            <div>
              <h4 className="font-medium text-orange-300">{t('منع الجهاز من استخدام رقم مختلف', 'Prevent Device from Using Different ID')}</h4>
              <p className="text-sm text-gray-400">{t('ربط الجهاز بالرقم العسكري الأول فقط لنفس اليوم', 'Lock device to first military ID for the day')}</p>
            </div>
            <button
              onClick={async () => {
                const newValue = !settings.device_restriction_enabled;
                // تحديث في system_settings
                const { setSystemSetting } = await import('../lib/supabase-client.js');
                await setSystemSetting('device_restriction_enabled', newValue, 'تفعيل/إيقاف نظام منع الجهاز من استخدام رقم مختلف');
                setSettings(prev => ({ ...prev, device_restriction_enabled: newValue }));
                showSuccessToast(newValue ? t('تم تفعيل نظام ربط الجهاز', 'Device restriction enabled') : t('تم إيقاف نظام ربط الجهاز', 'Device restriction disabled'));
              }}
              className={`w-14 h-8 rounded-full transition-all ${
                settings.device_restriction_enabled ? 'bg-orange-500' : 'bg-white/20'
              }`}
            >
              <div className={`w-6 h-6 bg-white rounded-full transition-all ${
                settings.device_restriction_enabled ? 'translate-x-7' : 'translate-x-1'
              }`} />
            </button>
          </div>
          {settings.device_restriction_enabled && (
            <p className="text-xs text-orange-400 mt-2 px-4">
              ⚠️ {t('تحذير: عند التفعيل، لن يتمكن الجهاز من تسجيل رقم عسكري مختلف في نفس اليوم', 'Warning: When enabled, device cannot register different military ID same day')}
            </p>
          )}
        </div>

        {/* إعدادات التوقيت */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <h4 className="text-lg font-bold mb-4">{t('إعدادات التوقيت', 'Timing Settings')}</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('النداء التالي بعد (دقيقة)', 'Next Call After (minutes)')}</label>
              <input
                type="number"
                value={settings.queue_skip_time || 2}
                onChange={(e) => updateSetting('queue_skip_time', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
                min="1"
                max="10"
              />
              <p className="text-xs text-gray-500 mt-1">{t('المدة قبل النداء للرقم التالي', 'Time before calling next number')}</p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('نقل للنهاية بعد (دقيقة)', 'Move to End After (minutes)')}</label>
              <input
                type="number"
                value={settings.queue_late_time || 4}
                onChange={(e) => updateSetting('queue_late_time', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
                min="1"
                max="15"
              />
              <p className="text-xs text-gray-500 mt-1">{t('المدة قبل نقل المراجع لنهاية الدور ووسمه متأخر', 'Time before moving patient to end and marking as late')}</p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('مدة الفحص (دقيقة)', 'Exam Duration (minutes)')}</label>
              <input
                type="number"
                value={settings.exam_duration || 5}
                onChange={(e) => updateSetting('exam_duration', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
                min="1"
                max="30"
              />
              <p className="text-xs text-gray-500 mt-1">{t('المدة المتوقعة للفحص داخل العيادة', 'Expected exam time inside clinic')}</p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('الحد الأقصى للمراجعين يومياً', 'Max Daily Patients')}</label>
              <input
                type="number"
                value={settings.max_daily_patients || 150}
                onChange={(e) => updateSetting('max_daily_patients', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
                min="1"
                max="500"
              />
              <p className="text-xs text-gray-500 mt-1">{t('بعد هذا العدد يتم إيقاف التسجيل', 'Registration stops after this number')}</p>
            </div>
          </div>
        </div>

        {/* إعدادات البن التلقائي */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <h4 className="text-lg font-bold mb-4">{t('إعدادات البن التلقائي', 'Auto PIN Settings')}</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('وقت إصدار البن (توقيت الدوحة)', 'PIN Generate Time (Doha Time)')}</label>
              <input
                type="time"
                value={settings.pin_auto_generate_time || '05:00'}
                onChange={(e) => updateSetting('pin_auto_generate_time', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
              />
              <p className="text-xs text-gray-500 mt-1">{t('الوقت اليومي لإصدار أرقام البن الجديدة', 'Daily time to generate new PIN codes')}</p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('وقت حذف البن', 'PIN Delete Time')}</label>
              <input
                type="time"
                value={settings.pin_auto_delete_time || '00:00'}
                onChange={(e) => updateSetting('pin_auto_delete_time', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
              />
              <p className="text-xs text-gray-500 mt-1">{t('الوقت اليومي لحذف أرقام البن القديمة', 'Daily time to delete old PIN codes')}</p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('وقت إيقاف التسجيل', 'Registration Stop Time')}</label>
              <input
                type="time"
                value={settings.registration_stop_time || '13:00'}
                onChange={(e) => updateSetting('registration_stop_time', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
              />
              <p className="text-xs text-gray-500 mt-1">{t('الوقت اليومي لإيقاف استقبال المراجعين', 'Daily time to stop accepting patients')}</p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('وقت بدء التسجيل', 'Registration Start Time')}</label>
              <input
                type="time"
                value={settings.registration_start_time || '06:00'}
                onChange={(e) => updateSetting('registration_start_time', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
              />
              <p className="text-xs text-gray-500 mt-1">{t('الوقت اليومي لبدء استقبال المراجعين', 'Daily time to start accepting patients')}</p>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm text-gray-400 mb-2">{t('رسالة إيقاف التسجيل', 'Registration Closed Message')}</label>
            <textarea
              value={settings.registration_closed_message || ''}
              onChange={(e) => updateSetting('registration_closed_message', e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white h-24"
              placeholder={t('نعتذر، تم إيقاف التسجيل لهذا اليوم. يرجى الحضور والتسجيل غداً.', 'Sorry, registration is closed for today. Please come back tomorrow.')}
            />
          </div>

          {/* أيام العمل */}
          <div className="mt-4">
            <label className="block text-sm text-gray-400 mb-2">{t('أيام العمل', 'Working Days')}</label>
            <div className="grid grid-cols-7 gap-2">
              {[
                { key: 'sunday', ar: 'الأحد', en: 'Sun' },
                { key: 'monday', ar: 'الاثنين', en: 'Mon' },
                { key: 'tuesday', ar: 'الثلاثاء', en: 'Tue' },
                { key: 'wednesday', ar: 'الأربعاء', en: 'Wed' },
                { key: 'thursday', ar: 'الخميس', en: 'Thu' },
                { key: 'friday', ar: 'الجمعة', en: 'Fri' },
                { key: 'saturday', ar: 'السبت', en: 'Sat' }
              ].map(day => {
                const workingDays = settings.working_days ? settings.working_days.split(',') : ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'];
                const isActive = workingDays.includes(day.key);
                return (
                  <button
                    key={day.key}
                    onClick={() => {
                      const newDays = isActive
                        ? workingDays.filter(d => d !== day.key)
                        : [...workingDays, day.key];
                      updateSetting('working_days', newDays.join(','));
                    }}
                    className={`p-2 rounded-lg text-xs font-medium transition-all ${
                      isActive ? 'bg-green-500 text-white' : 'bg-white/10 text-gray-400'
                    }`}
                  >
                    {language === 'ar' ? day.ar : day.en}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-2">{t('اضغط على اليوم لتفعيله أو إيقافه', 'Click on day to enable or disable')}</p>
          </div>
        </div>

        {/* إعدادات التحكم في الميزات */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <h4 className="text-lg font-bold mb-4">{t('التحكم في الميزات', 'Feature Controls')}</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* نظام البن كود */}
            <div className="bg-white/5 rounded-xl p-4">
              <h5 className="font-medium text-[#C9A54C] mb-3">{t('نظام البن كود', 'PIN Code System')}</h5>
              
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-sm">{t('تفعيل النظام', 'Enable System')}</span>
                </div>
                <button
                  onClick={() => updateSetting('pin_system_enabled', settings.pin_system_enabled === 'true' ? 'false' : 'true')}
                  className={`w-14 h-8 rounded-full transition-all ${settings.pin_system_enabled === 'true' ? 'bg-green-500' : 'bg-red-500'}`}
                >
                  <div className={`w-6 h-6 bg-white rounded-full transition-all ${settings.pin_system_enabled === 'true' ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm">{t('إظهار في الواجهة', 'Show in UI')}</span>
                </div>
                <button
                  onClick={() => updateSetting('pin_system_visible', settings.pin_system_visible === 'true' ? 'false' : 'true')}
                  className={`w-14 h-8 rounded-full transition-all ${settings.pin_system_visible === 'true' ? 'bg-green-500' : 'bg-red-500'}`}
                >
                  <div className={`w-6 h-6 bg-white rounded-full transition-all ${settings.pin_system_visible === 'true' ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
            
            {/* نظام الدور */}
            <div className="bg-white/5 rounded-xl p-4">
              <h5 className="font-medium text-[#C9A54C] mb-3">{t('نظام الدور', 'Queue System')}</h5>
              
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-sm">{t('تفعيل النظام', 'Enable System')}</span>
                </div>
                <button
                  onClick={() => updateSetting('queue_system_enabled', settings.queue_system_enabled === 'true' ? 'false' : 'true')}
                  className={`w-14 h-8 rounded-full transition-all ${settings.queue_system_enabled === 'true' ? 'bg-green-500' : 'bg-red-500'}`}
                >
                  <div className={`w-6 h-6 bg-white rounded-full transition-all ${settings.queue_system_enabled === 'true' ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm">{t('إظهار في الواجهة', 'Show in UI')}</span>
                </div>
                <button
                  onClick={() => updateSetting('queue_system_visible', settings.queue_system_visible === 'true' ? 'false' : 'true')}
                  className={`w-14 h-8 rounded-full transition-all ${settings.queue_system_visible === 'true' ? 'bg-green-500' : 'bg-red-500'}`}
                >
                  <div className={`w-6 h-6 bg-white rounded-full transition-all ${settings.queue_system_visible === 'true' ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
            <h5 className="font-medium text-blue-400 mb-2">{t('ملاحظة', 'Note')}</h5>
            <p className="text-sm text-blue-300/80">
              {t('إيقاف النظام يعني توقف العمل به، بينما الإخفاء يعني عدم ظهوره للمراجع فقط مع استمرار عمله في الخلفية.', 'Disabling means the system stops working, while hiding means it won\'t appear to patients but continues working in the background.')}
            </p>
          </div>
        </div>

        {/* إعدادات أرقام الدور */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <h4 className="text-lg font-bold mb-4">{t('إعدادات أرقام الدور', 'Queue Number Settings')}</h4>
          
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl mb-4">
            <div>
              <h4 className="font-medium">{t('أرقام منفصلة لكل عيادة', 'Separate Numbers Per Clinic')}</h4>
              <p className="text-sm text-gray-400">{t('كل عيادة لها تسلسل أرقام منفصل يبدأ من 1', 'Each clinic has separate number sequence starting from 1')}</p>
            </div>
            <button
              onClick={() => updateSetting('separate_queue_per_clinic', settings.separate_queue_per_clinic !== 'false' ? 'false' : 'true')}
              className={`w-14 h-8 rounded-full transition-all ${settings.separate_queue_per_clinic !== 'false' ? 'bg-green-500' : 'bg-white/20'}`}
            >
              <div className={`w-6 h-6 bg-white rounded-full transition-all ${settings.separate_queue_per_clinic !== 'false' ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
            <div>
              <h4 className="font-medium">{t('إعادة تعيين الأرقام يومياً', 'Reset Numbers Daily')}</h4>
              <p className="text-sm text-gray-400">{t('تبدأ الأرقام من 1 كل يوم جديد', 'Numbers start from 1 each new day')}</p>
            </div>
            <button
              onClick={() => updateSetting('reset_queue_daily', settings.reset_queue_daily !== 'false' ? 'false' : 'true')}
              className={`w-14 h-8 rounded-full transition-all ${settings.reset_queue_daily !== 'false' ? 'bg-green-500' : 'bg-white/20'}`}
            >
              <div className={`w-6 h-6 bg-white rounded-full transition-all ${settings.reset_queue_daily !== 'false' ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        {/* إعدادات الترحيل والإلغاء */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <h4 className="text-lg font-bold mb-4">{t('إعدادات الترحيل والإلغاء', 'Postpone & Cancel Settings')}</h4>
          
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl mb-4">
            <div>
              <h4 className="font-medium">{t('تفعيل نظام الترحيل', 'Enable Postpone System')}</h4>
              <p className="text-sm text-gray-400">{t('ترحيل المراجع المتأخر لنهاية الدور برقم جديد', 'Move late patient to end of queue with new number')}</p>
            </div>
            <button
              onClick={() => updateSetting('postpone_enabled', settings.postpone_enabled !== 'false' ? 'false' : 'true')}
              className={`w-14 h-8 rounded-full transition-all ${settings.postpone_enabled !== 'false' ? 'bg-green-500' : 'bg-white/20'}`}
            >
              <div className={`w-6 h-6 bg-white rounded-full transition-all ${settings.postpone_enabled !== 'false' ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('مهلة الانتظار قبل الترحيل (دقيقة)', 'Wait Time Before Postpone (minutes)')}</label>
              <input
                type="number"
                value={settings.postpone_wait_minutes || 2}
                onChange={(e) => updateSetting('postpone_wait_minutes', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
                min="1"
                max="10"
              />
              <p className="text-xs text-gray-500 mt-1">{t('المدة قبل ترحيل المراجع لنهاية الدور', 'Time before moving patient to end')}</p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('الحد الأقصى لمرات الترحيل', 'Max Postpone Count')}</label>
              <input
                type="number"
                value={settings.max_postpones || 3}
                onChange={(e) => updateSetting('max_postpones', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
                min="1"
                max="10"
              />
              <p className="text-xs text-gray-500 mt-1">{t('بعد هذا العدد يتم إلغاء المراجع نهائياً', 'After this count patient is cancelled')}</p>
            </div>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mt-4">
            <h5 className="font-medium text-yellow-400 mb-2">{t('ملخص النظام', 'System Summary')}</h5>
            <ul className="text-sm text-yellow-300/80 space-y-1">
              <li>• {t('عند استدعاء المراجع: يبدأ عداد', 'When patient is called: timer starts')} {settings.postpone_wait_minutes || 2} {t('دقيقة', 'minutes')}</li>
              <li>• {t('إذا لم يدخل: يتم ترحيله لنهاية الدور برقم جديد', 'If not entered: moved to end with new number')}</li>
              <li>• {t('بعد', 'After')} {settings.max_postpones || 3} {t('ترحيلات لنفس العيادة: إلغاء نهائي', 'postpones for same clinic: permanent cancel')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

// مكون إدارة المستخدمين والصلاحيات
const UsersManagement = ({ language, t }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'STAFF', is_active: true, permissions: [], assigned_clinic: '' });
  const [clinics, setClinics] = useState([]);
  
  // قائمة الصلاحيات المتاحة
  const allPermissions = [
    { id: 'dashboard', label: t('لوحة التحكم', 'Dashboard') },
    { id: 'queues', label: t('إدارة الطوابير', 'Queue Management') },
    { id: 'pins', label: t('الأرقام السرية', 'PIN Codes') },
    { id: 'notifications', label: t('الإشعارات', 'Notifications') },
    { id: 'routes', label: t('المسارات', 'Routes') },
    { id: 'reports', label: t('التقارير', 'Reports') },
    { id: 'clinics', label: t('العيادات', 'Clinics') },
    { id: 'system', label: t('حالة النظام', 'System Status') },
    { id: 'settings', label: t('الإعدادات', 'Settings') },
    { id: 'users', label: t('إدارة المستخدمين', 'Users') },
    { id: 'activity', label: t('سجل النشاطات', 'Activity Log') },
    { id: 'backup', label: t('النسخ والتصدير', 'Backup & Export') },
    { id: 'offline', label: t('العمل أوفلاين', 'Offline Mode') },
    { id: 'content', label: t('إدارة المحتوى', 'Content') },
    { id: 'appearance', label: t('المظهر', 'Appearance') },
    { id: 'database', label: t('قاعدة البيانات', 'Database') }
  ];
  const [editingUser, setEditingUser] = useState(null);

  useEffect(() => {
    loadUsers();
    loadClinics();
  }, []);

  const loadClinics = async () => {
    try {
      const { data } = await supabase.from('clinics').select('id, name_ar, name_en');
      if (data) setClinics(data);
    } catch (e) {
      console.error('Error loading clinics:', e);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error && data) setUsers(data);
    } catch (e) {
      console.error('Error loading users:', e);
    } finally {
      setLoading(false);
    }
  };

  // دوال مساعدة لإدارة الصلاحيات
  const togglePermission = (permId) => {
    if (newUser.permissions.includes(permId)) {
      setNewUser({...newUser, permissions: newUser.permissions.filter(p => p !== permId)});
    } else {
      setNewUser({...newUser, permissions: [...newUser.permissions, permId]});
    }
  };

  const toggleAllPermissions = () => {
    setNewUser({...newUser, permissions: allPermissions.map(p => p.id)});
  };

  const clearAllPermissions = () => {
    setNewUser({...newUser, permissions: []});
  };

  const toggleEditPermission = (permId) => {
    if (!editingUser) return;
    const currentPerms = editingUser.permissions || [];
    if (currentPerms.includes(permId)) {
      setEditingUser({...editingUser, permissions: currentPerms.filter(p => p !== permId)});
    } else {
      setEditingUser({...editingUser, permissions: [...currentPerms, permId]});
    }
  };

  const addUser = async () => {
    try {
      // السوبر أدمن له جميع الصلاحيات
      const permissions = newUser.role === 'SUPER_ADMIN' 
        ? allPermissions.map(p => p.id) 
        : newUser.permissions;
      
      const { error } = await supabase
        .from('admin_users')
        .insert([{
          username: newUser.username,
          password_hash: newUser.password,
          role: newUser.role,
          is_active: true,
          permissions: permissions,
          assigned_clinic: newUser.assigned_clinic || null,
          created_at: new Date().toISOString()
        }]);
      
      if (!error) {
        setShowAddModal(false);
        setNewUser({ username: '', password: '', role: 'STAFF', is_active: true, permissions: [], assigned_clinic: '' });
        loadUsers();
        alert(t('تم إضافة المستخدم بنجاح', 'User added successfully'));
      }
    } catch (e) {
      console.error('Error adding user:', e);
    }
  };

  const updateUserPermissions = async (userId, permissions) => {
    try {
      await supabase
        .from('admin_users')
        .update({ permissions })
        .eq('id', userId);
      loadUsers();
    } catch (e) {
      console.error('Error updating permissions:', e);
    }
  };

  const updateUserStatus = async (userId, isActive) => {
    try {
      await supabase
        .from('admin_users')
        .update({ is_active: isActive })
        .eq('id', userId);
      loadUsers();
    } catch (e) {
      console.error('Error updating user:', e);
    }
  };

  const updateUserRole = async (userId, role) => {
    try {
      await supabase
        .from('admin_users')
        .update({ role })
        .eq('id', userId);
      loadUsers();
    } catch (e) {
      console.error('Error updating role:', e);
    }
  };

  const deleteUser = async (userId) => {
    if (!confirm(t('هل أنت متأكد من حذف هذا المستخدم؟', 'Are you sure you want to delete this user?'))) return;
    try {
      await supabase
        .from('admin_users')
        .delete()
        .eq('id', userId);
      loadUsers();
    } catch (e) {
      console.error('Error deleting user:', e);
    }
  };

  const roleColors = {
    'SUPER_ADMIN': 'bg-purple-500',
    'ADMIN': 'bg-blue-500',
    'STAFF': 'bg-green-500'
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <UserCog size={24} className="text-[#C9A54C]" />
          {t('إدارة المستخدمين', 'Users Management')}
        </h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#C9A54C] to-[#B8943D] text-black font-medium rounded-xl"
        >
          <Plus size={18} /> {t('إضافة مستخدم', 'Add User')}
        </button>
      </div>

      {/* جدول المستخدمين */}
      <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 overflow-hidden">
        <table className="w-full">
          <thead className="bg-black/20">
            <tr>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">{t('اسم المستخدم', 'Username')}</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">{t('الصلاحية', 'Role')}</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">{t('الحالة', 'Status')}</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">{t('آخر دخول', 'Last Login')}</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">{t('الإجراءات', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-white/5">
                <td className="px-4 py-3 font-medium">{user.username}</td>
                <td className="px-4 py-3">
                  <select
                    value={user.role}
                    onChange={(e) => updateUserRole(user.id, e.target.value)}
                    className={`px-2 py-1 rounded-lg text-white text-sm ${roleColors[user.role]} bg-opacity-80`}
                  >
                    <option value="SUPER_ADMIN">Super Admin</option>
                    <option value="ADMIN">Admin</option>
                    <option value="STAFF">Staff</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => updateUserStatus(user.id, !user.is_active)}
                    className={`px-3 py-1 rounded-full text-xs font-medium ${user.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
                  >
                    {user.is_active ? t('نشط', 'Active') : t('معطل', 'Inactive')}
                  </button>
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {user.last_login ? new Date(user.last_login).toLocaleString('ar-QA') : '-'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => setEditingUser(user)} className="p-2 hover:bg-white/10 rounded-lg">
                      <Edit size={16} className="text-[#C9A54C]" />
                    </button>
                    <button onClick={() => deleteUser(user.id)} className="p-2 hover:bg-white/10 rounded-lg">
                      <Trash2 size={16} className="text-red-400" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal إضافة مستخدم */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4 overflow-y-auto">
          <div className="bg-[#1a1a24] rounded-2xl p-6 w-full max-w-lg border border-white/10 my-4">
            <h4 className="text-lg font-bold mb-4">{t('إضافة مستخدم جديد', 'Add New User')}</h4>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <input
                type="text"
                placeholder={t('اسم المستخدم', 'Username')}
                value={newUser.username}
                onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
              />
              <input
                type="password"
                placeholder={t('كلمة المرور', 'Password')}
                value={newUser.password}
                onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
              />
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({...newUser, role: e.target.value, permissions: e.target.value === 'SUPER_ADMIN' ? allPermissions.map(p => p.id) : []})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
              >
                <option value="STAFF">{t('موظف', 'Staff')}</option>
                <option value="ADMIN">{t('مدير', 'Admin')}</option>
                <option value="SUPER_ADMIN">{t('سوبر أدمن', 'Super Admin')}</option>
              </select>
              
              {/* تعيين عيادة للطبيب/الموظف */}
              {newUser.role !== 'SUPER_ADMIN' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">{t('تعيين عيادة (اختياري)', 'Assign Clinic (optional)')}</label>
                  <select
                    value={newUser.assigned_clinic}
                    onChange={(e) => setNewUser({...newUser, assigned_clinic: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
                  >
                    <option value="">{t('بدون تعيين', 'No assignment')}</option>
                    {clinics.map(c => (
                      <option key={c.id} value={c.id}>
                        {language === 'ar' ? (c.name_ar || c.name_en) : (c.name_en || c.name_ar)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* الصلاحيات */}
              {newUser.role !== 'SUPER_ADMIN' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">{t('الصلاحيات', 'Permissions')}</label>
                  <div className="grid grid-cols-2 gap-2 bg-white/5 rounded-xl p-3">
                    {allPermissions.map(perm => (
                      <label key={perm.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white/5 p-1 rounded">
                        <input
                          type="checkbox"
                          data-permission-id={perm.id}
                          data-testid={`permission-${perm.id}`}
                          checked={newUser.permissions.includes(perm.id)}
                          onChange={() => togglePermission(perm.id)}
                          className="rounded border-white/20 bg-white/5 text-[#C9A54C]"
                        />
                        {perm.label}
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={toggleAllPermissions}
                      className="text-xs text-[#C9A54C] hover:underline"
                    >
                      {t('تحديد الكل', 'Select All')}
                    </button>
                    <button
                      type="button"
                      onClick={clearAllPermissions}
                      className="text-xs text-gray-400 hover:underline"
                    >
                      {t('إلغاء الكل', 'Clear All')}
                    </button>
                  </div>
                </div>
              )}
              
              {newUser.role === 'SUPER_ADMIN' && (
                <div className="bg-purple-500/20 text-purple-300 p-3 rounded-xl text-sm">
                  {t('السوبر أدمن له جميع الصلاحيات تلقائياً', 'Super Admin has all permissions automatically')}
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewUser({ username: '', password: '', role: 'STAFF', is_active: true, permissions: [], assigned_clinic: '' });
                }}
                className="flex-1 px-4 py-2 bg-white/10 rounded-xl"
              >
                {t('إلغاء', 'Cancel')}
              </button>
              <button
                onClick={addUser}
                disabled={!newUser.username || !newUser.password}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-[#C9A54C] to-[#B8943D] text-black font-medium rounded-xl disabled:opacity-50"
              >
                {t('إضافة', 'Add')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal تعديل صلاحيات المستخدم */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4">
          <div className="bg-[#1a1a24] rounded-2xl p-6 w-full max-w-lg border border-white/10">
            <h4 className="text-lg font-bold mb-4">{t('تعديل صلاحيات', 'Edit Permissions')}: {editingUser.username}</h4>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-2 bg-white/5 rounded-xl p-3">
                {allPermissions.map(perm => (
                  <label key={perm.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white/5 p-1 rounded">
                    <input
                      type="checkbox"
                      data-permission-id={perm.id}
                      data-testid={`edit-permission-${perm.id}`}
                      checked={(editingUser.permissions || []).includes(perm.id)}
                      onChange={() => toggleEditPermission(perm.id)}
                      className="rounded border-white/20 bg-white/5 text-[#C9A54C]"
                    />
                    {perm.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingUser(null)}
                className="flex-1 px-4 py-2 bg-white/10 rounded-xl"
              >
                {t('إلغاء', 'Cancel')}
              </button>
              <button
                onClick={() => {
                  updateUserPermissions(editingUser.id, editingUser.permissions);
                  setEditingUser(null);
                }}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-[#C9A54C] to-[#B8943D] text-black font-medium rounded-xl"
              >
                {t('حفظ', 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// مكون سجل النشاطات
const ActivityLog = ({ language, t }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ type: 'all', date: '' });

  useEffect(() => {
    loadLogs();
  }, [filter]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (filter.type !== 'all') {
        query = query.eq('action_type', filter.type);
      }
      
      const { data, error } = await query;
      if (!error && data) setLogs(data);
    } catch (e) {
      console.error('Error loading logs:', e);
    } finally {
      setLoading(false);
    }
  };

  const exportLogs = () => {
    const csv = logs.map(log => 
      `${log.created_at},${log.user_id},${log.action_type},${log.description}`
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity_log_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const actionIcons = {
    'login': <Lock size={16} className="text-blue-400" />,
    'logout': <Unlock size={16} className="text-gray-400" />,
    'create': <Plus size={16} className="text-green-400" />,
    'update': <Edit size={16} className="text-yellow-400" />,
    'delete': <Trash2 size={16} className="text-red-400" />
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <History size={24} className="text-[#C9A54C]" />
          {t('سجل النشاطات', 'Activity Log')}
        </h3>
        <div className="flex gap-3">
          <select
            value={filter.type}
            onChange={(e) => setFilter({...filter, type: e.target.value})}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
          >
            <option value="all">{t('الكل', 'All')}</option>
            <option value="login">{t('تسجيل دخول', 'Login')}</option>
            <option value="create">{t('إنشاء', 'Create')}</option>
            <option value="update">{t('تعديل', 'Update')}</option>
            <option value="delete">{t('حذف', 'Delete')}</option>
          </select>
          <button
            onClick={exportLogs}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#C9A54C] to-[#B8943D] text-black font-medium rounded-xl"
          >
            <Download size={18} /> {t('تصدير', 'Export')}
          </button>
        </div>
      </div>

      <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 overflow-hidden">
        <div className="max-h-[500px] overflow-y-auto">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              {t('لا توجد سجلات', 'No logs found')}
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {logs.map(log => (
                <div key={log.id} className="p-4 hover:bg-white/5 flex items-center gap-4">
                  <div className="p-2 bg-white/10 rounded-lg">
                    {actionIcons[log.action_type] || <Activity size={16} />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{log.description}</p>
                    <p className="text-sm text-gray-400">{log.user_id}</p>
                  </div>
                  <div className="text-sm text-gray-400">
                    {new Date(log.created_at).toLocaleString('ar-QA')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// مكون النسخ الاحتياطي والتصدير
const BackupExport = ({ language, t }) => {
  const [backups, setBackups] = useState([]);
  const [exporting, setExporting] = useState(false);

  const exportData = async (type) => {
    setExporting(true);
    try {
      let data = [];
      let filename = '';
      
      switch(type) {
        case 'diagnostics':
          return <DiagnosticsPanel />;
        case 'queues':
          const { data: queuesData } = await supabase.from('unified_queue').select('*');
          data = queuesData;
          filename = 'queues_export';
          break;
        case 'clinics':
          const { data: clinicsData } = await supabase.from('clinics').select('*');
          data = clinicsData;
          filename = 'clinics_export';
          break;
        case 'patients':
          const { data: patientsData } = await supabase.from('patients').select('*');
          data = patientsData;
          filename = 'patients_export';
          break;
        case 'all':
          const { data: allQueues } = await supabase.from('unified_queue').select('*');
          const { data: allClinics } = await supabase.from('clinics').select('*');
          const { data: allPatients } = await supabase.from('patients').select('*');
          data = { queues: allQueues, clinics: allClinics, patients: allPatients };
          filename = 'full_backup';
          break;
      }
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
    } catch (e) {
      console.error('Export error:', e);
    } finally {
      setExporting(false);
    }
  };

  const exportToCSV = async (tableName) => {
    try {
      const { data } = await supabase.from(tableName).select('*');
      if (!data || data.length === 0) return;
      
      const headers = Object.keys(data[0]).join(',');
      const rows = data.map(row => Object.values(row).join(',')).join('\n');
      const csv = headers + '\n' + rows;
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${tableName}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    } catch (e) {
      console.error('CSV export error:', e);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold flex items-center gap-2">
        <Database size={24} className="text-[#C9A54C]" />
        {t('النسخ الاحتياطي والتصدير', 'Backup & Export')}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* تصدير JSON */}
        <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-6">
          <h4 className="font-bold mb-4 flex items-center gap-2">
            <Download size={20} /> {t('تصدير JSON', 'Export JSON')}
          </h4>
          <div className="space-y-3">
            <button
              onClick={() => exportData('queues')}
              disabled={exporting}
              className="w-full px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-between"
            >
              <span>{t('الطوابير', 'Queues')}</span>
              <Download size={16} />
            </button>
            <button
              onClick={() => exportData('clinics')}
              disabled={exporting}
              className="w-full px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-between"
            >
              <span>{t('العيادات', 'Clinics')}</span>
              <Download size={16} />
            </button>
            <button
              onClick={() => exportData('patients')}
              disabled={exporting}
              className="w-full px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-between"
            >
              <span>{t('المرضى', 'Patients')}</span>
              <Download size={16} />
            </button>
            <button
              onClick={() => exportData('all')}
              disabled={exporting}
              className="w-full px-4 py-3 bg-gradient-to-r from-[#C9A54C] to-[#B8943D] text-black font-medium rounded-xl flex items-center justify-center gap-2"
            >
              <Save size={18} /> {t('نسخة احتياطية كاملة', 'Full Backup')}
            </button>
          </div>
        </div>

        {/* تصدير CSV */}
        <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-6">
          <h4 className="font-bold mb-4 flex items-center gap-2">
            <FileText size={20} /> {t('تصدير CSV', 'Export CSV')}
          </h4>
          <div className="space-y-3">
            <button
              onClick={() => exportToCSV('queues')}
              className="w-full px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-between"
            >
              <span>{t('الطوابير', 'Queues')}</span>
              <Download size={16} />
            </button>
            <button
              onClick={() => exportToCSV('clinics')}
              className="w-full px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-between"
            >
              <span>{t('العيادات', 'Clinics')}</span>
              <Download size={16} />
            </button>
            <button
              onClick={() => exportToCSV('patients')}
              className="w-full px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-between"
            >
              <span>{t('المرضى', 'Patients')}</span>
              <Download size={16} />
            </button>
            <button
              onClick={() => exportToCSV('settings')}
              className="w-full px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-between"
            >
              <span>{t('الإعدادات', 'Settings')}</span>
              <Download size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* إعدادات الطباعة */}
      <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-6">
        <h4 className="font-bold mb-4 flex items-center gap-2">
          <Printer size={20} /> {t('إعدادات الطباعة', 'Print Settings')}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => window.print()}
            className="px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center gap-2"
          >
            <Printer size={18} /> {t('طباعة التقرير', 'Print Report')}
          </button>
          <button
            onClick={() => {
              const printWindow = window.open('', '_blank');
              printWindow.document.write('<html><head><title>Queue Report</title></head><body>');
              printWindow.document.write('<h1>تقرير الطوابير</h1>');
              printWindow.document.write('</body></html>');
              printWindow.print();
            }}
            className="px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center gap-2"
          >
            <FileText size={18} /> {t('طباعة الطوابير', 'Print Queues')}
          </button>
          <button
            className="px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center gap-2"
          >
            <Share2 size={18} /> {t('مشاركة', 'Share')}
          </button>
        </div>
      </div>
    </div>
  );
};

// مكون إعدادات العمل أوفلاين
const OfflineSettings = ({ language, t }) => {
  const [offlineEnabled, setOfflineEnabled] = useState(false);
  const [syncStatus, setSyncStatus] = useState('synced');
  const [storageUsed, setStorageUsed] = useState(0);

  useEffect(() => {
    checkOfflineStatus();
    calculateStorage();
  }, []);

  const checkOfflineStatus = () => {
    const enabled = localStorage.getItem('offline_mode') === 'true';
    setOfflineEnabled(enabled);
  };

  const calculateStorage = () => {
    let total = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += localStorage[key].length * 2; // UTF-16
      }
    }
    setStorageUsed(total);
  };

  const toggleOfflineMode = () => {
    const newValue = !offlineEnabled;
    localStorage.setItem('offline_mode', newValue.toString());
    setOfflineEnabled(newValue);
  };

  const syncNow = async () => {
    setSyncStatus('syncing');
    try {
      // محاكاة المزامنة
      await new Promise(resolve => setTimeout(resolve, 2000));
      setSyncStatus('synced');
    } catch (e) {
      setSyncStatus('error');
    }
  };

  const clearOfflineData = () => {
    if (confirm(t('هل أنت متأكد من حذف البيانات المحلية؟', 'Are you sure you want to clear offline data?'))) {
      localStorage.clear();
      calculateStorage();
    }
  };

  const formatBytes = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold flex items-center gap-2">
        {navigator.onLine ? <Wifi size={24} className="text-green-400" /> : <WifiOff size={24} className="text-red-400" />}
        {t('إعدادات العمل أوفلاين', 'Offline Settings')}
      </h3>

      <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-6 space-y-6">
        {/* حالة الاتصال */}
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
          <div className="flex items-center gap-3">
            {navigator.onLine ? (
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            ) : (
              <div className="w-3 h-3 bg-red-500 rounded-full" />
            )}
            <div>
              <h4 className="font-medium">{t('حالة الاتصال', 'Connection Status')}</h4>
              <p className="text-sm text-gray-400">
                {navigator.onLine ? t('متصل بالإنترنت', 'Online') : t('غير متصل', 'Offline')}
              </p>
            </div>
          </div>
        </div>

        {/* تفعيل الوضع أوفلاين */}
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
          <div>
            <h4 className="font-medium">{t('تفعيل الوضع أوفلاين', 'Enable Offline Mode')}</h4>
            <p className="text-sm text-gray-400">{t('حفظ البيانات محلياً للعمل بدون إنترنت', 'Save data locally for offline work')}</p>
          </div>
          <button
            onClick={toggleOfflineMode}
            className={`w-14 h-8 rounded-full transition-all ${offlineEnabled ? 'bg-green-500' : 'bg-white/20'}`}
          >
            <div className={`w-6 h-6 bg-white rounded-full transition-all ${offlineEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>

        {/* حالة المزامنة */}
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
          <div>
            <h4 className="font-medium">{t('حالة المزامنة', 'Sync Status')}</h4>
            <p className="text-sm text-gray-400">
              {syncStatus === 'synced' && t('متزامن', 'Synced')}
              {syncStatus === 'syncing' && t('جاري المزامنة...', 'Syncing...')}
              {syncStatus === 'error' && t('خطأ في المزامنة', 'Sync Error')}
            </p>
          </div>
          <button
            onClick={syncNow}
            disabled={syncStatus === 'syncing'}
            className="px-4 py-2 bg-[#C9A54C] text-black font-medium rounded-xl flex items-center gap-2"
          >
            <RefreshCw size={16} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
            {t('مزامنة الآن', 'Sync Now')}
          </button>
        </div>

        {/* التخزين المستخدم */}
        <div className="p-4 bg-white/5 rounded-xl">
          <div className="flex justify-between mb-2">
            <h4 className="font-medium">{t('التخزين المستخدم', 'Storage Used')}</h4>
            <span className="text-[#C9A54C]">{formatBytes(storageUsed)}</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <div 
              className="bg-[#C9A54C] h-2 rounded-full" 
              style={{ width: `${Math.min((storageUsed / (5 * 1024 * 1024)) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">{t('الحد الأقصى: 5 MB', 'Max: 5 MB')}</p>
        </div>

        {/* حذف البيانات المحلية */}
        <button
          onClick={clearOfflineData}
          className="w-full px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl flex items-center justify-center gap-2"
        >
          <Trash2 size={18} /> {t('حذف البيانات المحلية', 'Clear Offline Data')}
        </button>
      </div>
    </div>
  );
};

// مكون إدارة المحتوى - تحكم كامل في جميع النصوص
const ContentManagement = ({ language, t }) => {
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState(null);
  const [activeCategory, setActiveCategory] = useState('general');

  const categories = [
    { id: 'general', label: t('عام', 'General'), icon: Type },
    { id: 'clinics', label: t('العيادات', 'Clinics'), icon: Activity },
    { id: 'messages', label: t('الرسائل', 'Messages'), icon: Bell },
    { id: 'buttons', label: t('الأزرار', 'Buttons'), icon: Square },
    { id: 'labels', label: t('التسميات', 'Labels'), icon: FileText },
  ];

  const defaultContents = {
    general: [
      { key: 'app_title', ar: 'اللجنة الطبية العسكرية', en: 'Military Medical Committee', description: 'عنوان التطبيق' },
      { key: 'center_name', ar: 'المركز الطبي العسكري التخصصي', en: 'Military Specialized Medical Center', description: 'اسم المركز' },
      { key: 'welcome_message', ar: 'مرحباً بك', en: 'Welcome', description: 'رسالة الترحيب' },
      { key: 'footer_text', ar: 'جميع الحقوق محفوظة', en: 'All Rights Reserved', description: 'نص التذييل' },
    ],
    clinics: [
      { key: 'clinic_dermatology', ar: 'الجلدية', en: 'Dermatology', description: 'عيادة الجلدية' },
      { key: 'clinic_internal', ar: 'الباطنية', en: 'Internal Medicine', description: 'عيادة الباطنية' },
      { key: 'clinic_orthopedics', ar: 'العظام', en: 'Orthopedics', description: 'عيادة العظام' },
      { key: 'clinic_ophthalmology', ar: 'العيون', en: 'Ophthalmology', description: 'عيادة العيون' },
      { key: 'clinic_dental', ar: 'الأسنان', en: 'Dentistry', description: 'عيادة الأسنان' },
      { key: 'clinic_lab', ar: 'المختبر', en: 'Laboratory', description: 'المختبر' },
      { key: 'clinic_radiology', ar: 'الأشعة', en: 'Radiology', description: 'قسم الأشعة' },
    ],
    messages: [
      { key: 'msg_success', ar: 'تمت العملية بنجاح', en: 'Operation successful', description: 'رسالة النجاح' },
      { key: 'msg_error', ar: 'حدث خطأ', en: 'An error occurred', description: 'رسالة الخطأ' },
      { key: 'msg_confirm', ar: 'هل أنت متأكد؟', en: 'Are you sure?', description: 'رسالة التأكيد' },
      { key: 'msg_loading', ar: 'جاري التحميل...', en: 'Loading...', description: 'رسالة التحميل' },
      { key: 'msg_no_data', ar: 'لا توجد بيانات', en: 'No data found', description: 'رسالة عدم وجود بيانات' },
      { key: 'msg_wait', ar: 'يرجى الانتظار', en: 'Please wait', description: 'رسالة الانتظار' },
    ],
    buttons: [
      { key: 'btn_save', ar: 'حفظ', en: 'Save', description: 'زر الحفظ' },
      { key: 'btn_cancel', ar: 'إلغاء', en: 'Cancel', description: 'زر الإلغاء' },
      { key: 'btn_delete', ar: 'حذف', en: 'Delete', description: 'زر الحذف' },
      { key: 'btn_edit', ar: 'تعديل', en: 'Edit', description: 'زر التعديل' },
      { key: 'btn_add', ar: 'إضافة', en: 'Add', description: 'زر الإضافة' },
      { key: 'btn_next', ar: 'التالي', en: 'Next', description: 'زر التالي' },
      { key: 'btn_back', ar: 'رجوع', en: 'Back', description: 'زر الرجوع' },
      { key: 'btn_confirm', ar: 'تأكيد', en: 'Confirm', description: 'زر التأكيد' },
    ],
    labels: [
      { key: 'lbl_patient_id', ar: 'الرقم العسكري', en: 'Military ID', description: 'تسمية الرقم العسكري' },
      { key: 'lbl_queue_number', ar: 'رقم الدور', en: 'Queue Number', description: 'تسمية رقم الدور' },
      { key: 'lbl_status', ar: 'الحالة', en: 'Status', description: 'تسمية الحالة' },
      { key: 'lbl_waiting', ar: 'بانتظار', en: 'Waiting', description: 'حالة الانتظار' },
      { key: 'lbl_called', ar: 'تم الاستدعاء', en: 'Called', description: 'حالة الاستدعاء' },
      { key: 'lbl_completed', ar: 'مكتمل', en: 'Completed', description: 'حالة الاكتمال' },
    ],
  };

  useEffect(() => {
    loadContents();
  }, [activeCategory]);

  const loadContents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_contents')
        .select('*')
        .eq('category', activeCategory);
      
      if (!error && data && data.length > 0) {
        setContents(data);
      } else {
        // استخدام القيم الافتراضية
        setContents(defaultContents[activeCategory] || []);
      }
    } catch (e) {
      setContents(defaultContents[activeCategory] || []);
    } finally {
      setLoading(false);
    }
  };

  const saveContent = async (item) => {
    try {
      const { error } = await supabase
        .from('app_contents')
        .upsert({
          key: item.key,
          category: activeCategory,
          value_ar: item.ar,
          value_en: item.en,
          description: item.description,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      
      if (!error) {
        setEditingItem(null);
        loadContents();
      }
    } catch (e) {
      console.error('Error saving content:', e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Type size={24} className="text-[#C9A54C]" />
          {t('إدارة المحتوى', 'Content Management')}
        </h3>
      </div>

      {/* تبويبات الفئات */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-all ${
              activeCategory === cat.id
                ? 'bg-[#C9A54C] text-black font-medium'
                : 'bg-white/5 hover:bg-white/10'
            }`}
          >
            <cat.icon size={16} />
            {cat.label}
          </button>
        ))}
      </div>

      {/* قائمة المحتوى */}
      <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
            {t('جاري التحميل...', 'Loading...')}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {contents.map((item, index) => (
              <div key={item.key || index} className="p-4 hover:bg-white/5">
                {editingItem?.key === item.key ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">{t('العربية', 'Arabic')}</label>
                        <input
                          type="text"
                          value={editingItem.ar}
                          onChange={(e) => setEditingItem({...editingItem, ar: e.target.value})}
                          className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-right"
                          dir="rtl"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">{t('الإنجليزية', 'English')}</label>
                        <input
                          type="text"
                          value={editingItem.en}
                          onChange={(e) => setEditingItem({...editingItem, en: e.target.value})}
                          className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setEditingItem(null)}
                        className="px-4 py-2 bg-white/10 rounded-lg"
                      >
                        {t('إلغاء', 'Cancel')}
                      </button>
                      <button
                        onClick={() => saveContent(editingItem)}
                        className="px-4 py-2 bg-[#C9A54C] text-black font-medium rounded-lg flex items-center gap-2"
                      >
                        <Save size={16} /> {t('حفظ', 'Save')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm text-gray-400 mb-1">{item.description}</p>
                      <div className="flex gap-4">
                        <span className="text-white" dir="rtl">{item.ar}</span>
                        <span className="text-gray-300">|</span>
                        <span className="text-gray-300">{item.en}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setEditingItem({...item})}
                      className="p-2 hover:bg-white/10 rounded-lg"
                    >
                      <Edit size={18} className="text-[#C9A54C]" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// مكون إدارة المظهر - تحكم كامل في الألوان والخطوط
const AppearanceManagement = ({ language, t }) => {
  const [settings, setSettings] = useState({
    primaryColor: '#8A1538',
    secondaryColor: '#C9A54C',
    backgroundColor: '#0b0b0f',
    textColor: '#ffffff',
    fontFamily: 'Inter, Cairo',
    fontSize: 'medium',
    borderRadius: 'rounded',
    darkMode: true,
    rtlSupport: true,
    logoUrl: '/mms-logo.png',
    faviconUrl: '/favicon.ico',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('category', 'appearance')
        .single();
      
      if (!error && data) {
        setSettings({...settings, ...data.value});
      }
    } catch (e) {
      console.error('Error loading appearance settings:', e);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await supabase
        .from('app_settings')
        .upsert({
          key: 'appearance',
          category: 'appearance',
          value: settings,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      
      // تطبيق التغييرات مباشرة
      document.documentElement.style.setProperty('--primary-color', settings.primaryColor);
      document.documentElement.style.setProperty('--secondary-color', settings.secondaryColor);
      document.documentElement.style.setProperty('--bg-color', settings.backgroundColor);
      
      alert(t('تم حفظ الإعدادات', 'Settings saved'));
    } catch (e) {
      console.error('Error saving settings:', e);
    } finally {
      setSaving(false);
    }
  };

  const colorPresets = [
    { name: t('قطري', 'Qatari'), primary: '#8A1538', secondary: '#C9A54C' },
    { name: t('أزرق', 'Blue'), primary: '#1e40af', secondary: '#3b82f6' },
    { name: t('أخضر', 'Green'), primary: '#166534', secondary: '#22c55e' },
    { name: t('بنفسجي', 'Purple'), primary: '#7c3aed', secondary: '#a855f7' },
    { name: t('برتقالي', 'Orange'), primary: '#c2410c', secondary: '#f97316' },
  ];

  const fontSizes = [
    { id: 'small', label: t('صغير', 'Small') },
    { id: 'medium', label: t('متوسط', 'Medium') },
    { id: 'large', label: t('كبير', 'Large') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Palette size={24} className="text-[#C9A54C]" />
          {t('إدارة المظهر', 'Appearance Management')}
        </h3>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#C9A54C] to-[#B8943D] text-black font-medium rounded-xl"
        >
          <Save size={18} /> {saving ? t('جاري الحفظ...', 'Saving...') : t('حفظ التغييرات', 'Save Changes')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* الألوان */}
        <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-6">
          <h4 className="font-bold mb-4 flex items-center gap-2">
            <Palette size={18} /> {t('الألوان', 'Colors')}
          </h4>
          
          {/* قوالب جاهزة */}
          <div className="mb-4">
            <label className="text-sm text-gray-400 mb-2 block">{t('قوالب جاهزة', 'Presets')}</label>
            <div className="flex flex-wrap gap-2">
              {colorPresets.map(preset => (
                <button
                  key={preset.name}
                  onClick={() => setSettings({...settings, primaryColor: preset.primary, secondaryColor: preset.secondary})}
                  className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg hover:bg-white/20"
                >
                  <div className="w-4 h-4 rounded-full" style={{backgroundColor: preset.primary}} />
                  <div className="w-4 h-4 rounded-full" style={{backgroundColor: preset.secondary}} />
                  <span className="text-sm">{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">{t('اللون الرئيسي', 'Primary Color')}</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={settings.primaryColor}
                  onChange={(e) => setSettings({...settings, primaryColor: e.target.value})}
                  className="w-12 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={settings.primaryColor}
                  onChange={(e) => setSettings({...settings, primaryColor: e.target.value})}
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">{t('اللون الثانوي', 'Secondary Color')}</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={settings.secondaryColor}
                  onChange={(e) => setSettings({...settings, secondaryColor: e.target.value})}
                  className="w-12 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={settings.secondaryColor}
                  onChange={(e) => setSettings({...settings, secondaryColor: e.target.value})}
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">{t('لون الخلفية', 'Background')}</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={settings.backgroundColor}
                  onChange={(e) => setSettings({...settings, backgroundColor: e.target.value})}
                  className="w-12 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={settings.backgroundColor}
                  onChange={(e) => setSettings({...settings, backgroundColor: e.target.value})}
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">{t('لون النص', 'Text Color')}</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={settings.textColor}
                  onChange={(e) => setSettings({...settings, textColor: e.target.value})}
                  className="w-12 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={settings.textColor}
                  onChange={(e) => setSettings({...settings, textColor: e.target.value})}
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* الخطوط والحجم */}
        <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-6">
          <h4 className="font-bold mb-4 flex items-center gap-2">
            <Type size={18} /> {t('الخطوط والحجم', 'Fonts & Size')}
          </h4>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-2 block">{t('حجم الخط', 'Font Size')}</label>
              <div className="flex gap-2">
                {fontSizes.map(size => (
                  <button
                    key={size.id}
                    onClick={() => setSettings({...settings, fontSize: size.id})}
                    className={`flex-1 py-2 rounded-lg transition-all ${
                      settings.fontSize === size.id
                        ? 'bg-[#C9A54C] text-black font-medium'
                        : 'bg-white/10 hover:bg-white/20'
                    }`}
                  >
                    {size.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-2 block">{t('الخط', 'Font Family')}</label>
              <select
                value={settings.fontFamily}
                onChange={(e) => setSettings({...settings, fontFamily: e.target.value})}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2"
              >
                <option value="Inter, Cairo">Inter + Cairo</option>
                <option value="Roboto, Tajawal">Roboto + Tajawal</option>
                <option value="Open Sans, Almarai">Open Sans + Almarai</option>
                <option value="system-ui">System Default</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
              <span>{t('الوضع الليلي', 'Dark Mode')}</span>
              <button
                onClick={() => setSettings({...settings, darkMode: !settings.darkMode})}
                className={`w-12 h-6 rounded-full transition-all ${
                  settings.darkMode ? 'bg-[#C9A54C]' : 'bg-white/20'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  settings.darkMode ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
              <span>{t('دعم RTL', 'RTL Support')}</span>
              <button
                onClick={() => setSettings({...settings, rtlSupport: !settings.rtlSupport})}
                className={`w-12 h-6 rounded-full transition-all ${
                  settings.rtlSupport ? 'bg-[#C9A54C]' : 'bg-white/20'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  settings.rtlSupport ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* الشعار والأيقونة */}
        <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-6 lg:col-span-2">
          <h4 className="font-bold mb-4 flex items-center gap-2">
            <Eye size={18} /> {t('الشعار والأيقونة', 'Logo & Icon')}
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm text-gray-400 mb-2 block">{t('الشعار', 'Logo')}</label>
              <div className="flex items-center gap-4">
                <img src={settings.logoUrl} alt="Logo" className="w-16 h-16 object-contain bg-white/10 rounded-lg p-2" />
                <div className="flex-1">
                  <input
                    type="text"
                    value={settings.logoUrl}
                    onChange={(e) => setSettings({...settings, logoUrl: e.target.value})}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 mb-2"
                    placeholder="URL or path"
                  />
                  <button className="px-4 py-2 bg-white/10 rounded-lg text-sm flex items-center gap-2">
                    <Upload size={16} /> {t('رفع شعار', 'Upload Logo')}
                  </button>
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-2 block">{t('أيقونة الموقع', 'Favicon')}</label>
              <div className="flex items-center gap-4">
                <img src={settings.faviconUrl} alt="Favicon" className="w-16 h-16 object-contain bg-white/10 rounded-lg p-2" />
                <div className="flex-1">
                  <input
                    type="text"
                    value={settings.faviconUrl}
                    onChange={(e) => setSettings({...settings, faviconUrl: e.target.value})}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 mb-2"
                    placeholder="URL or path"
                  />
                  <button className="px-4 py-2 bg-white/10 rounded-lg text-sm flex items-center gap-2">
                    <Upload size={16} /> {t('رفع أيقونة', 'Upload Icon')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* معاينة */}
      <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-6">
        <h4 className="font-bold mb-4">{t('معاينة', 'Preview')}</h4>
        <div 
          className="p-6 rounded-xl"
          style={{
            backgroundColor: settings.backgroundColor,
            color: settings.textColor,
            fontFamily: settings.fontFamily
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full" style={{backgroundColor: settings.primaryColor}} />
            <div>
              <h5 className="font-bold" style={{color: settings.secondaryColor}}>{t('عنوان تجريبي', 'Sample Title')}</h5>
              <p className="text-sm opacity-70">{t('نص تجريبي للمعاينة', 'Sample text for preview')}</p>
            </div>
          </div>
          <button 
            className="px-4 py-2 rounded-lg font-medium"
            style={{backgroundColor: settings.secondaryColor, color: settings.backgroundColor}}
          >
            {t('زر تجريبي', 'Sample Button')}
          </button>
        </div>
      </div>
    </div>
  );
};

// مكون إدارة قاعدة البيانات - تحكم كامل في الجداول
const DatabaseManagement = ({ language, t }) => {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRow, setEditingRow] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRow, setNewRow] = useState({});

  const availableTables = [
    { name: 'clinics', label: t('العيادات', 'Clinics'), icon: Activity },
    { name: 'queues', label: t('الطوابير', 'Queues'), icon: Users },
    { name: 'patients', label: t('المرضى', 'Patients'), icon: UserCheck },
    { name: 'notifications', label: t('الإشعارات', 'Notifications'), icon: Bell },
    { name: 'routes', label: t('المسارات', 'Routes'), icon: MapPin },
    { name: 'pins', label: t('الأرقام السرية', 'PINs'), icon: Key },
  ];

  useEffect(() => {
    setTables(availableTables);
    setLoading(false);
  }, []);

  const loadTableData = async (tableName) => {
    setLoading(true);
    setSelectedTable(tableName);
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (!error && data) {
        setTableData(data);
      } else {
        setTableData([]);
      }
    } catch (e) {
      console.error('Error loading table:', e);
      setTableData([]);
    } finally {
      setLoading(false);
    }
  };

  const deleteRow = async (id) => {
    if (!window.confirm(t('هل أنت متأكد من الحذف؟', 'Are you sure you want to delete?'))) return;
    
    try {
      await supabase.from(selectedTable).delete().eq('id', id);
      loadTableData(selectedTable);
    } catch (e) {
      console.error('Error deleting row:', e);
    }
  };

  const saveRow = async (row) => {
    try {
      await supabase.from(selectedTable).upsert(row);
      setEditingRow(null);
      loadTableData(selectedTable);
    } catch (e) {
      console.error('Error saving row:', e);
    }
  };

  const addRow = async () => {
    try {
      await supabase.from(selectedTable).insert(newRow);
      setShowAddModal(false);
      setNewRow({});
      loadTableData(selectedTable);
    } catch (e) {
      console.error('Error adding row:', e);
    }
  };

  const exportTable = () => {
    const json = JSON.stringify(tableData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTable}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Database size={24} className="text-[#C9A54C]" />
          {t('إدارة قاعدة البيانات', 'Database Management')}
        </h3>
        {selectedTable && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-xl"
            >
              <Plus size={18} /> {t('إضافة', 'Add')}
            </button>
            <button
              onClick={exportTable}
              className="flex items-center gap-2 px-4 py-2 bg-[#C9A54C] text-black font-medium rounded-xl"
            >
              <Download size={18} /> {t('تصدير', 'Export')}
            </button>
          </div>
        )}
      </div>

      {/* قائمة الجداول */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tables.map(table => (
          <button
            key={table.name}
            onClick={() => loadTableData(table.name)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-all ${
              selectedTable === table.name
                ? 'bg-[#C9A54C] text-black font-medium'
                : 'bg-white/5 hover:bg-white/10'
            }`}
          >
            <table.icon size={16} />
            {table.label}
          </button>
        ))}
      </div>

      {/* بيانات الجدول */}
      {selectedTable && (
        <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
              {t('جاري التحميل...', 'Loading...')}
            </div>
          ) : tableData.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              {t('لا توجد بيانات', 'No data found')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    {Object.keys(tableData[0]).slice(0, 6).map(key => (
                      <th key={key} className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                        {key}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                      {t('إجراءات', 'Actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {tableData.map((row, index) => (
                    <tr key={row.id || index} className="hover:bg-white/5">
                      {Object.entries(row).slice(0, 6).map(([key, value]) => (
                        <td key={key} className="px-4 py-3 text-sm">
                          {editingRow?.id === row.id ? (
                            <input
                              type="text"
                              value={editingRow[key] || ''}
                              onChange={(e) => setEditingRow({...editingRow, [key]: e.target.value})}
                              className="bg-white/10 border border-white/20 rounded px-2 py-1 w-full"
                            />
                          ) : (
                            <span className="truncate block max-w-[150px]">
                              {typeof value === 'object' ? JSON.stringify(value) : String(value || '-')}
                            </span>
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {editingRow?.id === row.id ? (
                            <>
                              <button
                                onClick={() => saveRow(editingRow)}
                                className="p-1.5 bg-green-500/20 text-green-400 rounded"
                              >
                                <Save size={14} />
                              </button>
                              <button
                                onClick={() => setEditingRow(null)}
                                className="p-1.5 bg-white/10 rounded"
                              >
                                <X size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setEditingRow({...row})}
                                className="p-1.5 bg-white/10 hover:bg-white/20 rounded"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => deleteRow(row.id)}
                                className="p-1.5 bg-red-500/20 text-red-400 rounded"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* مودال إضافة سجل جديد */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]">
          <div className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-md mx-4">
            <h4 className="text-lg font-bold mb-4">{t('إضافة سجل جديد', 'Add New Record')}</h4>
            {tableData[0] && Object.keys(tableData[0]).filter(k => k !== 'id' && k !== 'created_at').map(key => (
              <div key={key} className="mb-3">
                <label className="text-sm text-gray-400 mb-1 block">{key}</label>
                <input
                  type="text"
                  value={newRow[key] || ''}
                  onChange={(e) => setNewRow({...newRow, [key]: e.target.value})}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2"
                />
              </div>
            ))}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 bg-white/10 rounded-lg"
              >
                {t('إلغاء', 'Cancel')}
              </button>
              <button
                onClick={addRow}
                className="flex-1 px-4 py-2 bg-[#C9A54C] text-black font-medium rounded-lg"
              >
                {t('إضافة', 'Add')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// المكون الرئيسي
export const AdminDashboardV2 = ({ onLogout, language, toggleLanguage }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({
    totalPatients: 0,
    waiting: 0,
    completed: 0,
    avgWaitTime: 0,
    activePins: 0,
    systemHealth: 100
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    loadAllData();
    const interval = setInterval(loadAllData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // جلب بيانات الطوابير مع تفاصيل العيادة
      const { data: queueData, error: queueError } = await supabase
        .from('unified_queue')
        .select('patient_id, clinic_id, status, entered_at, called_at, completed_at');
      
      if (!queueError && queueData) {
        processQueueData(queueData, 'entered_at');
      }

      // جلب بيانات العيادات
      const { data: clinicsData } = await supabase
        .from('clinics')
        .select('id, name_ar, name_en');

      // Active PINs
      const { count: pinCount } = await supabase
        .from('pins')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // حساب إحصائيات كل عيادة
      const clinicStats = {};
      if (queueData && clinicsData) {
        clinicsData.forEach(clinic => {
          const clinicQueues = queueData.filter(q => q.clinic_id === clinic.id);
          const completed = clinicQueues.filter(q => q.status === 'completed');
          // في الانتظار للعيادة تشمل الحالات النشطة (waiting, called, serving)
              // في الانتظار للعيادة تشمل الحالات النشطة (waiting, called, serving)
              const waiting = clinicQueues.filter(q => ['waiting', 'called', 'serving'].includes(q.status));
          
          // حساب متوسط مدة الانتظار (من entered_at إلى called_at)
          let avgWaitTime = 0;
          const withWaitTime = completed.filter(q => q.entered_at && q.called_at);
          if (withWaitTime.length > 0) {
            const totalWait = withWaitTime.reduce((acc, q) => {
              return acc + (new Date(q.called_at) - new Date(q.entered_at));
            }, 0);
            avgWaitTime = Math.round(totalWait / withWaitTime.length / 60000); // بالدقائق
          }
          
          // حساب متوسط مدة البقاء داخل العيادة (من called_at إلى completed_at)
          let avgStayTime = 0;
          const withStayTime = completed.filter(q => q.called_at && q.completed_at);
          if (withStayTime.length > 0) {
            const totalStay = withStayTime.reduce((acc, q) => {
              return acc + (new Date(q.completed_at) - new Date(q.called_at));
            }, 0);
            avgStayTime = Math.round(totalStay / withStayTime.length / 60000); // بالدقائق
          }
          
          clinicStats[clinic.id] = {
            name_ar: clinic.name_ar,
            name_en: clinic.name_en,
            id: clinic.id,
            total: clinicQueues.length,
            completed: completed.length,
            waiting: waiting.length,
            avgWaitTime,
            avgStayTime
          };
        });
      }

      setStats(prev => ({
        ...prev,
        activePins: pinCount || 0,
        systemHealth: 100,
        clinicStats
      }));
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const processQueueData = (data, dateField) => {
    // إجمالي المرضى = عدد السجلات الكلي (مجموع جميع الزيارات)
    const totalPatients = data.length;
    // في الانتظار = مجموع المنتظرين + من تم استدعاؤهم ولم يكتملوا بعد (called, serving)
        // في الانتظار = مجموع المنتظرين + من تم استدعاؤهم ولم يكتملوا بعد (called, serving)
        const waitingCount = data.filter(item => ['waiting', 'called', 'serving'].includes(item.status)).length;
    const completedCount = data.filter(item => item.status === 'completed').length;

    let avgWait = 0;
    const completedItems = data.filter(item => item.status === 'completed' && item[dateField] && item.called_at);
    if (completedItems.length > 0) {
      const totalWait = completedItems.reduce((acc, item) => {
        const wait = new Date(item.called_at) - new Date(item[dateField]);
        return acc + wait;
      }, 0);
      avgWait = Math.round(totalWait / completedItems.length / 60000);
    }

    setStats(prev => ({
      ...prev,
      totalPatients: totalPatients,
      waiting: waitingCount,
      completed: completedCount,
      avgWaitTime: avgWait
    }));
  };

  const handleResetStats = async () => {
    if (!window.confirm(t('هل أنت متأكد من تصفير جميع البيانات؟', 'Are you sure you want to reset all data?'))) return;
    
    try {
      // حذف من جدول الطابور
      await supabase.from('unified_queue').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      loadAllData();
      alert(t('تم تصفير البيانات بنجاح', 'Data reset successfully'));
    } catch (error) {
      alert(t('خطأ في تصفير البيانات', 'Error resetting data'));
    }
  };

  const t = (ar, en) => language === 'ar' ? ar : en;

  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: t('لوحة التحكم', 'Dashboard') },
    { id: 'queues', icon: Users, label: t('إدارة الطوابير', 'Queues') },
    { id: 'pins', icon: Key, label: t('الأرقام السرية', 'PIN Codes') },
    { id: 'notifications', icon: Bell, label: t('الإشعارات', 'Notifications') },
    { id: 'routes', icon: MapPin, label: t('المسارات', 'Routes') },
    { id: 'reports', icon: FileText, label: t('التقارير', 'Reports') },
    { id: 'clinics', icon: Activity, label: t('العيادات', 'Clinics') },
    { id: 'system', icon: Shield, label: t('حالة النظام', 'System Status') },
    { id: 'settings', icon: Settings, label: t('الإعدادات', 'Settings') },
    { id: 'users', icon: UserCog, label: t('إدارة المستخدمين', 'Users') },
    { id: 'activity', icon: History, label: t('سجل النشاطات', 'Activity Log') },
    { id: 'backup', icon: Database, label: t('النسخ والتصدير', 'Backup & Export') },
    { id: 'offline', icon: Wifi, label: t('العمل أوفلاين', 'Offline Mode') },
    { id: 'content', icon: Type, label: t('إدارة المحتوى', 'Content Management') },
    { id: 'appearance', icon: Palette, label: t('المظهر', 'Appearance') },
    { id: 'database', icon: Database, label: t('قاعدة البيانات', 'Database') },
    { id: 'features', icon: Settings, label: t('التحكم بالميزات', 'Feature Control') },
    { id: 'apimonitor', icon: Activity, label: t('مراقبة API', 'API Monitor') },
  ];

  return (
    <div className="min-h-screen min-h-[-webkit-fill-available] bg-[#0b0b0f] text-white font-sans selection:bg-[#C9A54C]/30">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-[120] p-3 bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-xl border border-white/10 shadow-lg touch-manipulation active:scale-95 transition-transform"
        aria-label="Toggle Menu"
      >
        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <aside 
        data-sidebar="admin"
        data-mobile-open={mobileMenuOpen}
        className={`fixed left-0 top-0 h-full w-64 sm:w-72 bg-[#12121a] border-r border-white/5 z-[100] transform transition-transform duration-300 flex flex-col ${
          mobileMenuOpen ? 'translate-x-0 sidebar-open' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{ 
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y'
        }}
      >
        {/* Header */}
        <div className="p-4 sm:p-6 flex items-center gap-3 border-b border-white/5 flex-shrink-0">
          <img src="/mms-logo.png" alt="قيادة الخدمات الطبية" className="w-10 h-10 sm:w-12 sm:h-12 object-contain rounded-full border-2 border-[#C9A54C]/30" />
          <div>
            <h1 className="font-bold text-base sm:text-lg tracking-tight">{t('لوحة الإدارة', 'Admin Panel')}</h1>
            <p className="text-[9px] sm:text-[10px] text-[#C9A54C]/70 uppercase tracking-widest font-medium">{t('قيادة الخدمات الطبية', 'Medical Services')}</p>
          </div>
        </div>

        {/* Scrollable Navigation */}
        <nav 
          className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-1 sm:space-y-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {menuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActiveTab(item.id);
                setMobileMenuOpen(false);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                setActiveTab(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all duration-300 touch-manipulation select-none ${
                activeTab === item.id 
                ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 shadow-lg shadow-yellow-500/5' 
                : 'text-gray-400 hover:bg-white/5 hover:text-white active:bg-white/10'
              }`}
              style={{ 
                WebkitTapHighlightColor: 'rgba(201, 165, 76, 0.2)',
                minHeight: '48px',
                cursor: 'pointer'
              }}
            >
              <item.icon size={18} className="sm:w-5 sm:h-5 flex-shrink-0 pointer-events-none" />
              <span className="font-medium text-sm sm:text-base truncate pointer-events-none">{item.label}</span>
              {activeTab === item.id && <ChevronRight size={14} className="ml-auto flex-shrink-0 sm:w-4 sm:h-4 pointer-events-none" />}
            </button>
          ))}
        </nav>

        {/* Footer Buttons */}
        <div className="flex-shrink-0 p-3 sm:p-4 border-t border-white/5 space-y-1 sm:space-y-2">
          <button 
            type="button"
            onClick={(e) => {
              e.preventDefault();
              window.location.href = '/';
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              window.location.href = '/';
            }}
            className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 text-gray-400 hover:bg-white/5 hover:text-white active:bg-white/10 rounded-xl transition-all touch-manipulation select-none"
            style={{ 
              WebkitTapHighlightColor: 'rgba(255, 255, 255, 0.1)',
              minHeight: '48px',
              cursor: 'pointer'
            }}
          >
            <Home size={18} className="sm:w-5 sm:h-5 flex-shrink-0 pointer-events-none" />
            <span className="text-sm sm:text-base pointer-events-none">{t('الرئيسية', 'Home')}</span>
          </button>
          <button 
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onLogout();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              onLogout();
            }}
            className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 text-red-400 hover:bg-red-500/10 active:bg-red-500/20 rounded-xl transition-all touch-manipulation select-none"
            style={{ 
              WebkitTapHighlightColor: 'rgba(239, 68, 68, 0.2)',
              minHeight: '48px',
              cursor: 'pointer'
            }}
          >
            <LogOut size={18} className="sm:w-5 sm:h-5 flex-shrink-0 pointer-events-none" />
            <span className="text-sm sm:text-base pointer-events-none">{t('تسجيل الخروج', 'Logout')}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-[90]"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:mr-64 lg:ml-0 p-3 sm:p-4 lg:p-8 pt-16 sm:pt-20 lg:pt-8 min-h-screen overflow-x-hidden">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">
              {t('مرحباً بك في لوحة التحكم', 'Welcome to Dashboard')}
            </h2>
            <p className="text-gray-400 text-sm flex items-center gap-2">
              <Clock size={14} />
              {t('آخر تحديث:', 'Last update:')} {lastUpdate.toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US')}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button 
              onClick={toggleLanguage}
              className="px-4 py-2 bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] border border-white/5 rounded-xl hover:bg-[#8A1538] transition-all flex items-center gap-2"
            >
              <Activity size={18} className="text-yellow-500" />
              <span>{language === 'ar' ? 'English' : 'العربية'}</span>
            </button>
            <button 
              onClick={loadAllData}
              className="p-2 bg-yellow-500 text-black rounded-xl hover:bg-yellow-400 transition-all shadow-lg shadow-yellow-500/20"
              title={t('تحديث البيانات', 'Refresh Data')}
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
            <button 
              onClick={handleResetStats}
              className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-all flex items-center gap-2"
            >
              <Trash2 size={18} />
              <span className="hidden sm:inline">{t('تصفير', 'Reset')}</span>
            </button>
          </div>
        </header>

        {/* Content based on active tab */}
        {activeTab === 'dashboard' && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
              {[
                { label: t('إجمالي المرضى', 'Total Patients'), value: stats.totalPatients, icon: Users, color: 'blue' },
                { label: t('في الانتظار', 'Waiting'), value: stats.waiting, icon: Clock, color: 'yellow' },
                { label: t('زيارات مكتملة', 'Completed Visits'), value: stats.completed, icon: CheckCircle, color: 'green' },
                { label: t('الأرقام السرية', 'Active PINs'), value: stats.activePins, icon: Key, color: 'purple' },
              ].map((stat, i) => (
                <div key={i} className="bg-[#12121a] p-4 lg:p-6 rounded-2xl border border-white/5 hover:border-white/10 transition-all group">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-2 lg:p-3 rounded-xl ${
                      stat.color === 'blue' ? 'bg-blue-500/10 text-blue-500' :
                      stat.color === 'yellow' ? 'bg-yellow-500/10 text-yellow-500' :
                      stat.color === 'green' ? 'bg-green-500/10 text-green-500' :
                      'bg-purple-500/10 text-purple-500'
                    } group-hover:scale-110 transition-transform`}>
                      <stat.icon size={20} className="lg:w-6 lg:h-6" />
                    </div>
                    <span className="text-[10px] lg:text-xs font-medium text-gray-500 uppercase tracking-wider">{t('مباشر', 'Live')}</span>
                  </div>
                  <h3 className="text-gray-400 text-xs lg:text-sm font-medium mb-1">{stat.label}</h3>
                  <div className="text-2xl lg:text-3xl font-bold text-white tracking-tight">{stat.value}</div>
                </div>
              ))}
            </div>

            {/* إحصائيات العيادات التفصيلية */}
            {stats.clinicStats && Object.keys(stats.clinicStats).length > 0 && (
              <div className="bg-[#12121a] rounded-2xl border border-white/5 p-6 mb-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <BarChart3 size={20} className="text-yellow-500" />
                    {t('إحصائيات العيادات التفصيلية', 'Detailed Clinic Statistics')}
                  </h3>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-right py-3 px-4 text-gray-400 font-medium">{t('العيادة', 'Clinic')}</th>
                        <th className="text-center py-3 px-4 text-gray-400 font-medium">{t('إجمالي الزيارات', 'Total Visits')}</th>
                        <th className="text-center py-3 px-4 text-gray-400 font-medium">{t('مكتملة', 'Completed')}</th>
                        <th className="text-center py-3 px-4 text-gray-400 font-medium">{t('في الانتظار', 'Waiting')}</th>
                        <th className="text-center py-3 px-4 text-gray-400 font-medium">{t('متوسط الانتظار', 'Avg Wait')}</th>
                        <th className="text-center py-3 px-4 text-gray-400 font-medium">{t('متوسط البقاء', 'Avg Stay')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(stats.clinicStats)
                        .filter(([_, data]) => data.total > 0)
                        .sort((a, b) => b[1].total - a[1].total)
                        .map(([clinicId, data]) => (
                          <tr key={clinicId} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-500 rounded font-mono">{clinicId}</span>
                                <span className="text-white">{language === 'ar' ? data.name_ar : data.name_en}</span>
                              </div>
                            </td>
                            <td className="text-center py-3 px-4 text-white font-bold">{data.total}</td>
                            <td className="text-center py-3 px-4">
                              <span className="text-green-500 font-medium">{data.completed}</span>
                            </td>
                            <td className="text-center py-3 px-4">
                              <span className="text-yellow-500 font-medium">{data.waiting}</span>
                            </td>
                            <td className="text-center py-3 px-4">
                              <span className="text-blue-400">{data.avgWaitTime} {t('د', 'min')}</span>
                            </td>
                            <td className="text-center py-3 px-4">
                              <span className="text-purple-400">{data.avgStayTime} {t('د', 'min')}</span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                
                {Object.values(stats.clinicStats).every(c => c.total === 0) && (
                  <div className="text-center py-8 text-gray-500">
                    {t('لا توجد بيانات للعرض', 'No data to display')}
                  </div>
                )}
              </div>
            )}

            {/* System Health */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-[#12121a] rounded-2xl border border-white/5 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Activity size={20} className="text-yellow-500" />
                    {t('حالة النظام والخدمات', 'System Health & Services')}
                  </h3>
                </div>
                
                <div className="space-y-4">
                  {[
                    { name: t('قاعدة البيانات', 'Database'), status: 'connected', label: t('متصلة', 'Connected') },
                    { name: t('خدمة الطوابير', 'Queue Service'), status: 'active', label: t('نشطة', 'Active') },
                    { name: t('خدمة الإشعارات', 'Notification Service'), status: 'active', label: t('نشطة', 'Active') },
                  ].map((service, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                      <span className="font-medium">{service.name}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-sm text-green-500 font-medium">{service.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#12121a] rounded-2xl border border-white/5 p-6">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <AlertCircle size={20} className="text-yellow-500" />
                  {t('تنبيهات النظام', 'System Alerts')}
                </h3>
                <div className="space-y-4">
                  <div className="p-4 bg-yellow-500/5 border border-yellow-500/10 rounded-xl">
                    <p className="text-sm text-yellow-500 leading-relaxed">
                      {t('النظام يعمل بشكل مثالي. جميع الخدمات مستقرة والاتصال بقاعدة البيانات سريع.', 'System is running perfectly. All services are stable and database connection is fast.')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'queues' && <QueueManagement language={language} t={t} />}
        {activeTab === 'pins' && <PINManagement language={language} t={t} />}
        {activeTab === 'notifications' && <NotificationsManagementV2 language={language} t={t} />}
        {activeTab === 'routes' && <RoutesManagement language={language} t={t} />}
        {activeTab === 'reports' && <ReportsSection language={language} t={t} />}
        {activeTab === 'clinics' && <ClinicsManagement language={language} t={t} />}
        {activeTab === 'system' && <SystemStatus language={language} t={t} />}
        {activeTab === 'settings' && <SettingsSection language={language} t={t} />}
        {activeTab === 'users' && <UsersManagement language={language} t={t} />}
        {activeTab === 'activity' && <ActivityLog language={language} t={t} />}
        {activeTab === 'backup' && <BackupExport language={language} t={t} />}
        {activeTab === 'offline' && <OfflineSettings language={language} t={t} />}
        {activeTab === 'content' && <ContentManagement language={language} t={t} />}
        {activeTab === 'appearance' && <AppearanceManagement language={language} t={t} />}
        {activeTab === 'database' && <DatabaseManagement language={language} t={t} />}
        {activeTab === 'features' && <FeatureControlPanel language={language} t={t} />}
        {activeTab === 'apimonitor' && <APIMonitor language={language} t={t} />}
        {activeTab === 'advanced-notifications' && <AdvancedNotificationsManager language={language} t={t} />}
      </main>
      <Toaster />
    </div>
  );
};

export default AdminDashboardV2;

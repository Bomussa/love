import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Users, Clock, CheckCircle, Activity, 
  Settings, FileText, MapPin, Key, RefreshCw, Trash2, 
  Edit, Plus, LogOut, Home, AlertCircle, ChevronRight,
  Search, Filter, Download, MoreVertical, Shield, Play,
  Pause, SkipForward, Phone, Bell, BarChart3, Calendar,
  UserCheck, XCircle, Eye, Printer, Menu, X
} from 'lucide-react';
import supabase from '../lib/supabase-client';

// مكونات إدارة الطوابير
const QueueManagement = ({ language, t }) => {
  const [queues, setQueues] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClinic, setSelectedClinic] = useState(null);

  useEffect(() => {
    loadQueues();
    loadClinics();
    // تحديث كل 10 ثواني
    const interval = setInterval(loadQueues, 10000);
    return () => clearInterval(interval);
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
      const { data, error } = await supabase
        .from('queue')
        .select('*, clinics(name_ar, name_en)')
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setQueues(data);
      }
    } catch (e) {
      console.error('Error loading queues:', e);
    } finally {
      setLoading(false);
    }
  };

  const callNext = async (clinicId) => {
    try {
      const waitingQueue = queues.filter(q => q.clinic_id === clinicId && q.status === 'waiting');
      if (waitingQueue.length === 0) {
        alert(t('لا يوجد مرضى في الانتظار', 'No patients waiting'));
        return;
      }
      
      const nextPatient = waitingQueue[0];
      await supabase
        .from('queue')
        .update({ status: 'called', called_at: new Date().toISOString() })
        .eq('id', nextPatient.id);
      
      loadQueues();
    } catch (e) {
      console.error('Error calling next:', e);
    }
  };

  const completePatient = async (queueId) => {
    try {
      await supabase
        .from('queue')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', queueId);
      loadQueues();
    } catch (e) {
      console.error('Error completing patient:', e);
    }
  };

  const skipPatient = async (queueId) => {
    try {
      await supabase
        .from('queue')
        .update({ status: 'skipped' })
        .eq('id', queueId);
      loadQueues();
    } catch (e) {
      console.error('Error skipping patient:', e);
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
          className="p-2 bg-gold-500 text-black rounded-xl hover:bg-gold-400 transition-all"
        >
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {queuesByClinic.map(clinic => (
          <div key={clinic.id} className="bg-[#1a1a24] rounded-2xl border border-white/10 overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-gold-500/20 to-transparent border-b border-white/10">
              <h4 className="font-bold text-lg">{language === 'ar' ? clinic.name_ar : clinic.name_en}</h4>
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
                  className="flex-1 py-2 bg-gold-500 text-black rounded-lg font-medium hover:bg-gold-400 transition-all flex items-center justify-center gap-2"
                >
                  <Play size={16} />
                  {t('التالي', 'Next')}
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
                        <span className="font-mono">{q.display_number || q.queue_number}</span>
                        <span className="text-gray-400">{i + 1}</span>
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
    </div>
  );
};

// مكون إدارة الأرقام السرية
const PINManagement = ({ language, t }) => {
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPin, setNewPin] = useState({ pin_code: '', clinic_id: '', patient_id: '' });
  const [clinics, setClinics] = useState([]);

  useEffect(() => {
    loadPins();
    loadClinics();
  }, []);

  const loadClinics = async () => {
    const { data } = await supabase.from('clinics').select('*');
    if (data) setClinics(data);
  };

  const loadPins = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pins')
        .select('*, clinics(name_ar, name_en)')
        .order('created_at', { ascending: false });
      
      if (!error && data) setPins(data);
    } catch (e) {
      console.error('Error loading pins:', e);
    } finally {
      setLoading(false);
    }
  };

  const generatePin = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  const addPin = async () => {
    try {
      const pinCode = newPin.pin_code || generatePin();
      const { error } = await supabase.from('pins').insert({
        pin_code: pinCode,
        clinic_id: newPin.clinic_id,
        patient_id: newPin.patient_id || null,
        is_active: true,
        created_at: new Date().toISOString()
      });
      
      if (!error) {
        loadPins();
        setShowAddForm(false);
        setNewPin({ pin_code: '', clinic_id: '', patient_id: '' });
      }
    } catch (e) {
      console.error('Error adding pin:', e);
    }
  };

  const togglePinStatus = async (pinId, currentStatus) => {
    try {
      await supabase
        .from('pins')
        .update({ is_active: !currentStatus })
        .eq('id', pinId);
      loadPins();
    } catch (e) {
      console.error('Error toggling pin:', e);
    }
  };

  const deletePin = async (pinId) => {
    if (!window.confirm(t('هل أنت متأكد من حذف هذا الرقم؟', 'Are you sure you want to delete this PIN?'))) return;
    try {
      await supabase.from('pins').delete().eq('id', pinId);
      loadPins();
    } catch (e) {
      console.error('Error deleting pin:', e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">{t('إدارة الأرقام السرية', 'PIN Management')}</h3>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-gold-500 text-black rounded-xl hover:bg-gold-400 transition-all flex items-center gap-2"
          >
            <Plus size={18} />
            {t('إضافة', 'Add')}
          </button>
          <button 
            onClick={loadPins}
            className="p-2 bg-[#1a1a24] border border-white/10 rounded-xl hover:bg-[#22222e] transition-all"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="bg-[#1a1a24] rounded-2xl border border-white/10 p-6">
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
                  <option key={c.id} value={c.id}>{language === 'ar' ? c.name_ar : c.name_en}</option>
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
              className="px-6 py-2 bg-gold-500 text-black rounded-xl hover:bg-gold-400 transition-all"
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

      <div className="bg-[#1a1a24] rounded-2xl border border-white/10 overflow-hidden">
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
                <td className="p-4 font-mono text-lg font-bold text-gold-400">{pin.pin_code}</td>
                <td className="p-4">{pin.clinics ? (language === 'ar' ? pin.clinics.name_ar : pin.clinics.name_en) : '-'}</td>
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

// مكون التقارير
const ReportsSection = ({ language, t }) => {
  const [stats, setStats] = useState({
    todayPatients: 0,
    weekPatients: 0,
    avgWaitTime: 0,
    completionRate: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      // إحصائيات اليوم
      const { data: todayData } = await supabase
        .from('queue')
        .select('*')
        .gte('created_at', today.toISOString());

      // إحصائيات الأسبوع
      const { data: weekData } = await supabase
        .from('queue')
        .select('*')
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

      setStats({
        todayPatients: todayData?.length || 0,
        weekPatients: weekData?.length || 0,
        avgWaitTime: Math.round(avgWait),
        completionRate: weekData?.length > 0 
          ? Math.round((completed.length / weekData.length) * 100) 
          : 0
      });
    } catch (e) {
      console.error('Error loading stats:', e);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    const reportData = `
تقرير المركز الطبي التخصصي العسكري
=====================================
التاريخ: ${new Date().toLocaleDateString('ar-SA')}

إحصائيات اليوم:
- عدد المرضى: ${stats.todayPatients}

إحصائيات الأسبوع:
- إجمالي المرضى: ${stats.weekPatients}
- متوسط وقت الانتظار: ${stats.avgWaitTime} دقيقة
- نسبة الإنجاز: ${stats.completionRate}%
    `;
    
    const blob = new Blob([reportData], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">{t('التقارير والإحصائيات', 'Reports & Statistics')}</h3>
        <button 
          onClick={exportReport}
          className="px-4 py-2 bg-gold-500 text-black rounded-xl hover:bg-gold-400 transition-all flex items-center gap-2"
        >
          <Download size={18} />
          {t('تصدير', 'Export')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#1a1a24] rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <Users className="text-blue-400" size={24} />
            </div>
            <span className="text-gray-400">{t('مرضى اليوم', 'Today\'s Patients')}</span>
          </div>
          <div className="text-3xl font-bold">{stats.todayPatients}</div>
        </div>

        <div className="bg-[#1a1a24] rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-purple-500/20 rounded-xl">
              <Calendar className="text-purple-400" size={24} />
            </div>
            <span className="text-gray-400">{t('مرضى الأسبوع', 'Week\'s Patients')}</span>
          </div>
          <div className="text-3xl font-bold">{stats.weekPatients}</div>
        </div>

        <div className="bg-[#1a1a24] rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-yellow-500/20 rounded-xl">
              <Clock className="text-yellow-400" size={24} />
            </div>
            <span className="text-gray-400">{t('متوسط الانتظار', 'Avg Wait Time')}</span>
          </div>
          <div className="text-3xl font-bold">{stats.avgWaitTime} <span className="text-lg text-gray-400">{t('دقيقة', 'min')}</span></div>
        </div>

        <div className="bg-[#1a1a24] rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-500/20 rounded-xl">
              <CheckCircle className="text-green-400" size={24} />
            </div>
            <span className="text-gray-400">{t('نسبة الإنجاز', 'Completion Rate')}</span>
          </div>
          <div className="text-3xl font-bold">{stats.completionRate}%</div>
        </div>
      </div>
    </div>
  );
};

// مكون إدارة العيادات
const ClinicsManagement = ({ language, t }) => {
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingClinic, setEditingClinic] = useState(null);

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
      await supabase
        .from('clinics')
        .update({ is_active: !currentStatus })
        .eq('id', clinicId);
      loadClinics();
    } catch (e) {
      console.error('Error toggling clinic:', e);
    }
  };

  const updateClinic = async (clinicId, updates) => {
    try {
      await supabase
        .from('clinics')
        .update(updates)
        .eq('id', clinicId);
      loadClinics();
      setEditingClinic(null);
    } catch (e) {
      console.error('Error updating clinic:', e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">{t('إدارة العيادات', 'Clinics Management')}</h3>
        <button 
          onClick={loadClinics}
          className="p-2 bg-[#1a1a24] border border-white/10 rounded-xl hover:bg-[#22222e] transition-all"
        >
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clinics.map(clinic => (
          <div key={clinic.id} className="bg-[#1a1a24] rounded-2xl border border-white/10 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="font-bold text-lg">{language === 'ar' ? clinic.name_ar : clinic.name_en}</h4>
                <p className="text-gray-400 text-sm">{clinic.floor || t('الطابق غير محدد', 'Floor not set')}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                clinic.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {clinic.is_active ? t('مفتوح', 'Open') : t('مغلق', 'Closed')}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => toggleClinicStatus(clinic.id, clinic.is_active)}
                className={`flex-1 py-2 rounded-lg font-medium transition-all ${
                  clinic.is_active 
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                    : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                }`}
              >
                {clinic.is_active ? t('إغلاق', 'Close') : t('فتح', 'Open')}
              </button>
              <button
                onClick={() => setEditingClinic(clinic)}
                className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all"
              >
                <Edit size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {editingClinic && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a24] rounded-2xl border border-white/10 p-6 w-full max-w-md">
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
                className="flex-1 py-2 bg-gold-500 text-black rounded-xl hover:bg-gold-400 transition-all font-medium"
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
      
      if (!error && data) {
        const settingsObj = {};
        data.forEach(s => { settingsObj[s.key] = s.value; });
        setSettings(settingsObj);
      }
    } catch (e) {
      console.error('Error loading settings:', e);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key, value) => {
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ key, value, updated_at: new Date().toISOString() });
      
      if (!error) {
        setSettings(prev => ({ ...prev, [key]: value }));
      }
    } catch (e) {
      console.error('Error updating setting:', e);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold">{t('الإعدادات', 'Settings')}</h3>

      <div className="bg-[#1a1a24] rounded-2xl border border-white/10 p-6 space-y-6">
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
              settings.notifications_enabled === 'true' ? 'bg-gold-500' : 'bg-white/20'
            }`}
          >
            <div className={`w-6 h-6 bg-white rounded-full transition-all ${
              settings.notifications_enabled === 'true' ? 'translate-x-7' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </div>
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
      // استخدام جدول queue الصحيح
      const { data: queueData, error: queueError } = await supabase
        .from('queue')
        .select('patient_id, status, created_at, called_at, completed_at');
      
      if (queueError) {
        console.error('Queue error:', queueError);
        // محاولة استخدام جدول queues كبديل
        const { data: queuesData, error: queuesError } = await supabase
          .from('queues')
          .select('patient_id, status, entered_at, called_at, completed_at');
        
        if (!queuesError && queuesData) {
          processQueueData(queuesData, 'entered_at');
        }
      } else if (queueData) {
        processQueueData(queueData, 'created_at');
      }

      // Active PINs
      const { count: pinCount } = await supabase
        .from('pins')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      setStats(prev => ({
        ...prev,
        activePins: pinCount || 0,
        systemHealth: 100
      }));
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const processQueueData = (data, dateField) => {
    const uniquePatients = new Set(data.map(item => item.patient_id)).size;
    const waitingCount = data.filter(item => item.status === 'waiting').length;
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
      totalPatients: uniquePatients,
      waiting: waitingCount,
      completed: completedCount,
      avgWaitTime: avgWait
    }));
  };

  const handleResetStats = async () => {
    if (!window.confirm(t('هل أنت متأكد من تصفير جميع البيانات؟', 'Are you sure you want to reset all data?'))) return;
    
    try {
      // حذف من كلا الجدولين
      await supabase.from('queue').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('queues').delete().neq('id', '00000000-0000-0000-0000-000000000000');
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
    { id: 'reports', icon: FileText, label: t('التقارير', 'Reports') },
    { id: 'clinics', icon: MapPin, label: t('العيادات', 'Clinics') },
    { id: 'settings', icon: Settings, label: t('الإعدادات', 'Settings') },
  ];

  return (
    <div className="min-h-screen min-h-[-webkit-fill-available] bg-[#0b0b0f] text-white font-sans selection:bg-gold-500/30">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="lg:hidden fixed top-4 right-4 z-[60] p-3 bg-[#1a1a24] rounded-xl border border-white/10"
      >
        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full w-64 bg-[#12121a] border-r border-white/5 z-50 transform transition-transform duration-300 ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="p-6 flex items-center gap-3 border-b border-white/5">
          <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg shadow-yellow-500/20">
            <Shield className="text-black w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">{t('لوحة الإدارة', 'Admin Panel')}</h1>
            <p className="text-[10px] text-yellow-500/70 uppercase tracking-widest font-medium">{t('نظام اللجنة الطبية', 'Medical System')}</p>
          </div>
        </div>

        <nav className="p-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                activeTab === item.id 
                ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 shadow-lg shadow-yellow-500/5' 
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
              {activeTab === item.id && <ChevronRight size={16} className="ml-auto" />}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 w-full p-4 border-t border-white/5 space-y-2">
          <button 
            onClick={() => window.location.href = '/'}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-white/5 hover:text-white rounded-xl transition-all"
          >
            <Home size={20} />
            <span>{t('الرئيسية', 'Home')}</span>
          </button>
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
          >
            <LogOut size={20} />
            <span>{t('تسجيل الخروج', 'Logout')}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:mr-64 p-4 lg:p-8 pt-20 lg:pt-8">
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
              className="px-4 py-2 bg-[#1a1a24] border border-white/5 rounded-xl hover:bg-[#22222e] transition-all flex items-center gap-2"
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
                { label: t('المكتملين', 'Completed'), value: stats.completed, icon: CheckCircle, color: 'green' },
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
        {activeTab === 'reports' && <ReportsSection language={language} t={t} />}
        {activeTab === 'clinics' && <ClinicsManagement language={language} t={t} />}
        {activeTab === 'settings' && <SettingsSection language={language} t={t} />}
      </main>
    </div>
  );
};

export default AdminDashboardV2;

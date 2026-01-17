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
        .from('queues')
        .select('*')
        .order('entered_at', { ascending: false });
      
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
      const waitingQueue = queues.filter(q => q.clinic_id === clinicId && q.status === 'waiting');
      if (waitingQueue.length === 0) {
        alert(t('لا يوجد مرضى في الانتظار', 'No patients waiting'));
        return;
      }
      
      const nextPatient = waitingQueue[0];
      await supabase
        .from('queues')
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
        .from('queues')
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
        .from('queues')
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
          className="p-2 bg-[#C9A54C] text-black rounded-xl hover:bg-[#B8943D] transition-all"
        >
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {queuesByClinic.map(clinic => (
          <div key={clinic.id} className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 overflow-hidden">
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
                  className="flex-1 py-2 bg-[#C9A54C] text-black rounded-lg font-medium hover:bg-[#B8943D] transition-all flex items-center justify-center gap-2"
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
        .select('*')
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

  const addPin = async () => {
    try {
      const pinCode = newPin.pin_code || generatePin();
      const { error } = await supabase.from('pins').insert({
        pin: pinCode,
        clinic_code: newPin.clinic_id,
        is_active: true,
        generated_at: new Date().toISOString(),
        expires_at: new Date(new Date().setHours(23, 59, 59, 999)).toISOString(),
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
            className="px-4 py-2 bg-[#C9A54C] text-black rounded-xl hover:bg-[#B8943D] transition-all flex items-center gap-2"
          >
            <Plus size={18} />
            {t('إضافة', 'Add')}
          </button>
          <button 
            onClick={loadPins}
            className="p-2 bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] border border-white/10 rounded-xl hover:bg-[#8A1538] transition-all"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
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
    avgWaitTime: 0,
    completionRate: 0,
    avgWeightedCompletion: 0 // نسبة الإنجاز بالأوزان
  });
  const [loading, setLoading] = useState(true);

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

      // إحصائيات اليوم
      const { data: todayData } = await supabase
        .from('queues')
        .select('*')
        .gte('created_at', today.toISOString());

      // إحصائيات الأسبوع
      const { data: weekData } = await supabase
        .from('queues')
        .select('*')
        .gte('created_at', weekAgo.toISOString());

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
        avgWaitTime: Math.round(avgWait),
        completionRate: weekData?.length > 0 
          ? Math.round((completed.length / weekData.length) * 100) 
          : 0,
        avgWeightedCompletion
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
- نسبة إكمال الطوابير: ${stats.completionRate}%
- نسبة الإنجاز بالأوزان: ${stats.avgWeightedCompletion}%
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
          className="px-4 py-2 bg-[#C9A54C] text-black rounded-xl hover:bg-[#B8943D] transition-all flex items-center gap-2"
        >
          <Download size={18} />
          {t('تصدير', 'Export')}
        </button>
      </div>

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
            <span className="text-gray-400">{t('نسبة الإنجاز (بالأوزان)', 'Completion Rate (Weighted)')}</span>
          </div>
          <div className="text-3xl font-bold">{stats.avgWeightedCompletion}%</div>
          <div className="text-sm text-gray-500 mt-1">
            {t('إكمال الطوابير', 'Queue Completion')}: {stats.completionRate}%
          </div>
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
  const [showAddForm, setShowAddForm] = useState(false);
  const [newClinic, setNewClinic] = useState({ name_ar: '', name_en: '', floor: '', code: '', weight: 1 });

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

  const addClinic = async () => {
    if (!newClinic.name_ar || !newClinic.name_en) {
      alert(t('يرجى إدخال اسم العيادة', 'Please enter clinic name'));
      return;
    }
    try {
      const { error } = await supabase.from('clinics').insert({
        name_ar: newClinic.name_ar,
        name_en: newClinic.name_en,
        floor: newClinic.floor || 'الطابق الأول',
        code: newClinic.code || newClinic.name_en.substring(0, 3).toUpperCase(),
        weight: newClinic.weight || 1,
        is_active: true,
        created_at: new Date().toISOString()
      });
      if (!error) {
        loadClinics();
        setShowAddForm(false);
        setNewClinic({ name_ar: '', name_en: '', floor: '', code: '', weight: 1 });
        alert(t('تم إضافة العيادة بنجاح', 'Clinic added successfully'));
      }
    } catch (e) {
      console.error('Error adding clinic:', e);
    }
  };

  const deleteClinic = async (clinicId) => {
    if (!window.confirm(t('هل أنت متأكد من حذف هذه العيادة؟', 'Are you sure you want to delete this clinic?'))) return;
    try {
      await supabase.from('clinics').delete().eq('id', clinicId);
      loadClinics();
    } catch (e) {
      console.error('Error deleting clinic:', e);
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
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
        .order('entered_at', { ascending: false });
      
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
                  <option key={c.id} value={c.id}>{language === 'ar' ? c.name_ar : c.name_en}</option>
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
                  <option key={c.id} value={c.id}>{language === 'ar' ? c.name_ar : c.name_en}</option>
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
                      {notif.clinics ? (language === 'ar' ? notif.clinics.name_ar : notif.clinics.name_en) : t('عام', 'General')}
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

// مكون إدارة المسارات
const RoutesManagement = ({ language, t }) => {
  const [routes, setRoutes] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRoute, setNewRoute] = useState({ name_ar: '', name_en: '', clinics: [], order: 1, is_active: true });

  useEffect(() => {
    loadRoutes();
    loadClinics();
  }, []);

  const loadClinics = async () => {
    const { data } = await supabase.from('clinics').select('*').order('name_ar');
    if (data) setClinics(data);
  };

  const loadRoutes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('routes')
        .select('*')
        .order('order_num', { ascending: true });
      
      if (!error && data) setRoutes(data);
    } catch (e) {
      console.error('Error loading routes:', e);
    } finally {
      setLoading(false);
    }
  };

  const addRoute = async () => {
    try {
      const { error } = await supabase.from('routes').insert({
        name_ar: newRoute.name_ar,
        name_en: newRoute.name_en,
        clinic_ids: newRoute.clinics,
        order_num: newRoute.order,
        is_active: true,
        created_at: new Date().toISOString()
      });
      
      if (!error) {
        loadRoutes();
        setShowAddForm(false);
        setNewRoute({ name_ar: '', name_en: '', clinics: [], order: 1, is_active: true });
      }
    } catch (e) {
      console.error('Error adding route:', e);
    }
  };

  const toggleRoute = async (id, currentStatus) => {
    try {
      await supabase.from('routes').update({ is_active: !currentStatus }).eq('id', id);
      loadRoutes();
    } catch (e) {
      console.error('Error toggling route:', e);
    }
  };

  const deleteRoute = async (id) => {
    if (!window.confirm(t('هل أنت متأكد من الحذف؟', 'Are you sure you want to delete?'))) return;
    try {
      await supabase.from('routes').delete().eq('id', id);
      loadRoutes();
    } catch (e) {
      console.error('Error deleting route:', e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">{t('إدارة المسارات الطبية', 'Medical Routes Management')}</h3>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-[#C9A54C] text-black rounded-xl hover:bg-[#B8943D] transition-all flex items-center gap-2"
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

      {showAddForm && (
        <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-6">
          <h4 className="font-bold mb-4">{t('إضافة مسار جديد', 'Add New Route')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('اسم المسار (عربي)', 'Route Name (Arabic)')}</label>
              <input
                type="text"
                value={newRoute.name_ar}
                onChange={(e) => setNewRoute({...newRoute, name_ar: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('اسم المسار (إنجليزي)', 'Route Name (English)')}</label>
              <input
                type="text"
                value={newRoute.name_en}
                onChange={(e) => setNewRoute({...newRoute, name_en: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('الترتيب', 'Order')}</label>
              <input
                type="number"
                value={newRoute.order}
                onChange={(e) => setNewRoute({...newRoute, order: parseInt(e.target.value)})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('العيادات', 'Clinics')}</label>
              <select
                multiple
                value={newRoute.clinics}
                onChange={(e) => setNewRoute({...newRoute, clinics: Array.from(e.target.selectedOptions, o => o.value)})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white h-32"
              >
                {clinics.map(c => (
                  <option key={c.id} value={c.id}>{language === 'ar' ? c.name_ar : c.name_en}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={addRoute} className="px-6 py-2 bg-[#C9A54C] text-black rounded-xl hover:bg-[#B8943D] transition-all">
              {t('حفظ', 'Save')}
            </button>
            <button onClick={() => setShowAddForm(false)} className="px-6 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all">
              {t('إلغاء', 'Cancel')}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {routes.map(route => (
          <div key={route.id} className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-lg">{language === 'ar' ? route.name_ar : route.name_en}</h4>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                route.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {route.is_active ? t('نشط', 'Active') : t('معطل', 'Inactive')}
              </span>
            </div>
            <p className="text-gray-400 text-sm mb-4">{t('الترتيب:', 'Order:')} {route.order_num}</p>
            <div className="flex gap-2">
              <button
                onClick={() => toggleRoute(route.id, route.is_active)}
                className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-2 ${
                  route.is_active ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'
                }`}
              >
                {route.is_active ? <><Pause size={16} /> {t('إيقاف', 'Disable')}</> : <><Play size={16} /> {t('تفعيل', 'Enable')}</>}
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

      {routes.length === 0 && (
        <div className="bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-2xl border border-white/10 p-8 text-center text-gray-400">
          {t('لا توجد مسارات. اضغط على "إضافة مسار" لإنشاء مسار جديد.', 'No routes found. Click "Add Route" to create a new route.')}
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

          <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
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
        .from('queues')
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
      await supabase.from('queues').delete().neq('id', '00000000-0000-0000-0000-000000000000');
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
    { id: 'notifications', icon: Bell, label: t('الإشعارات', 'Notifications') },
    { id: 'routes', icon: MapPin, label: t('المسارات', 'Routes') },
    { id: 'reports', icon: FileText, label: t('التقارير', 'Reports') },
    { id: 'clinics', icon: Activity, label: t('العيادات', 'Clinics') },
    { id: 'system', icon: Shield, label: t('حالة النظام', 'System Status') },
    { id: 'settings', icon: Settings, label: t('الإعدادات', 'Settings') },
  ];

  return (
    <div className="min-h-screen min-h-[-webkit-fill-available] bg-[#0b0b0f] text-white font-sans selection:bg-[#C9A54C]/30">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="lg:hidden fixed top-4 right-4 z-[60] p-3 bg-gradient-to-br from-[#8A1538] to-[#6B0F2A] rounded-xl border border-white/10"
      >
        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full w-64 bg-[#12121a] border-r border-white/5 z-50 transform transition-transform duration-300 ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="p-6 flex items-center gap-3 border-b border-white/5">
          <img src="/mms-logo.png" alt="قيادة الخدمات الطبية" className="w-12 h-12 object-contain rounded-full border-2 border-[#C9A54C]/30" />
          <div>
            <h1 className="font-bold text-lg tracking-tight">{t('لوحة الإدارة', 'Admin Panel')}</h1>
            <p className="text-[10px] text-[#C9A54C]/70 uppercase tracking-widest font-medium">{t('قيادة الخدمات الطبية', 'Medical Services')}</p>
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
        {activeTab === 'notifications' && <NotificationsManagement language={language} t={t} />}
        {activeTab === 'routes' && <RoutesManagement language={language} t={t} />}
        {activeTab === 'reports' && <ReportsSection language={language} t={t} />}
        {activeTab === 'clinics' && <ClinicsManagement language={language} t={t} />}
        {activeTab === 'system' && <SystemStatus language={language} t={t} />}
        {activeTab === 'settings' && <SettingsSection language={language} t={t} />}
      </main>
    </div>
  );
};

export default AdminDashboardV2;

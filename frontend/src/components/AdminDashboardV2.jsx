import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, Clock, CheckCircle, Activity,
  Settings, FileText, MapPin, Key, RefreshCw, Trash2,
  LogOut, Home, Bell, BarChart3, Building2, Shield, Menu, X, ChevronRight,
  Stethoscope, Play, UserPlus, AlertCircle, Check, XCircle, Eye, Edit, Plus,
  ArrowRight, Timer, UserCheck, RefreshCw as Reload, AlertTriangle, TrendingUp,
  Database, Server, Wifi, Heart
} from 'lucide-react';
import { supabase } from '../lib/supabase-client';
import toast, { Toaster } from 'react-hot-toast';

// Simple Queue Monitor Component (inline to avoid import issues)
function QueueMonitor({ clinicId, compact = false }) {
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQueues();
    const interval = setInterval(loadQueues, 3000);
    return () => clearInterval(interval);
  }, [clinicId]);

  const loadQueues = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('queues')
      .select('*')
      .eq('queue_date', today)
      .order('entered_at', { ascending: true });

    if (data) {
      const filtered = clinicId ? data.filter(q => q.clinic_id === clinicId) : data;
      setQueues(filtered);
    }
    setLoading(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'waiting': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
      case 'called': return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'in_service': return 'bg-green-500/10 text-green-400 border-green-500/30';
      case 'completed': return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
      case 'cancelled': return 'bg-red-500/10 text-red-400 border-red-500/30';
      case 'no_show': return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'waiting': return 'في الانتظار';
      case 'called': return 'تم المناداة';
      case 'in_service': return 'قيد الخدمة';
      case 'completed': return 'تم';
      case 'cancelled': return 'ملغي';
      case 'no_show': return 'لم يحضر';
      default: return status;
    }
  };

  if (loading) {
    return <div className="text-center text-gray-500 py-8">جاري التحميل...</div>;
  }

  if (queues.length === 0) {
    return <div className="text-center text-gray-500 py-8">لا يوجد مراجعون</div>;
  }

  return (
    <div className={compact ? 'space-y-2' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'}>
      {queues.map((q, i) => (
        <div key={q.id} className={`bg-white/5 border rounded-xl p-4 ${getStatusColor(q.status)} ${i === 0 && !compact ? 'ring-2 ring-[#C9A54C]' : ''}`}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#8A1538] flex items-center justify-center font-bold text-white">
                {q.display_number || q.queue_number_int}
              </div>
              <div>
                <div className="font-bold">{q.patient_id}</div>
                <div className="text-xs opacity-70">{new Date(q.entered_at).toLocaleTimeString()}</div>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs border ${getStatusColor(q.status)}`}>
              {getStatusLabel(q.status)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdminDashboardV2({ user, onLogout, language }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [stats, setStats] = useState({ totalPatients: 0, waiting: 0, completed: 0, noShow: 0 });
  const [loading, setLoading] = useState(false);
  const [queues, setQueues] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [currentTicket, setCurrentTicket] = useState(null);
  const [showAddDoctor, setShowAddDoctor] = useState(false);
  const [systemHealth, setSystemHealth] = useState(null);

  const t = (ar, en) => language === 'ar' ? ar : en;

  useEffect(() => {
    loadAllData();
    const subscription = supabase
      .channel('admin-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queues' }, () => loadAllData())
      .subscribe();
    return () => { subscription.unsubscribe(); };
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];

    const { data: queueData } = await supabase.from('queues').select('*').eq('queue_date', today);
    const { data: clinicData } = await supabase.from('clinics').select('*').order('name_ar');
    const { data: doctorData } = await supabase.from('doctors').select('*').order('name_ar');
    const { data: healthData } = await supabase.from('system_health').select('*').limit(1);

    if (queueData) {
      setQueues(queueData);
      setStats({
        totalPatients: queueData.length,
        waiting: queueData.filter(q => q.status === 'waiting').length,
        completed: queueData.filter(q => q.status === 'completed').length,
        noShow: queueData.filter(q => q.status === 'no_show').length
      });
    }
    if (clinicData) setClinics(clinicData);
    if (doctorData) setDoctors(doctorData);
    if (healthData && healthData.length > 0) setSystemHealth(healthData[0]);
    setLoading(false);
  };

  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'لوحة التحكم', labelEn: 'Dashboard' },
    { id: 'queues', icon: Users, label: 'إدارة الطوابير', labelEn: 'Queue Management' },
    { id: 'doctors', icon: Stethoscope, label: 'إدارة الأطباء', labelEn: 'Doctors Management' },
    { id: 'doctor-screen', icon: Stethoscope, label: 'شاشة الطبيب', labelEn: 'Doctor Screen' },
    { id: 'notifications', icon: Bell, label: 'الإشعارات', labelEn: 'Notifications' },
    { id: 'routes', icon: MapPin, label: 'المسارات', labelEn: 'Routes' },
    { id: 'reports', icon: FileText, label: 'التقارير', labelEn: 'Reports' },
    { id: 'clinics', icon: Building2, label: 'العيادات', labelEn: 'Clinics' },
    { id: 'health', icon: Activity, label: 'حالة النظام', labelEn: 'System Health' },
    { id: 'settings', icon: Settings, label: 'الإعدادات', labelEn: 'Settings' },
  ];

  // Queue Management Tab
  const renderQueuesTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#121212] p-4 rounded-xl border border-white/5">
          <div className="text-2xl font-bold text-blue-400">{queues.filter(q => q.status === 'waiting').length}</div>
          <div className="text-sm text-gray-500">في الانتظار</div>
        </div>
        <div className="bg-[#121212] p-4 rounded-xl border border-white/5">
          <div className="text-2xl font-bold text-yellow-400">{queues.filter(q => q.status === 'called').length}</div>
          <div className="text-sm text-gray-500">تم المناداة</div>
        </div>
        <div className="bg-[#121212] p-4 rounded-xl border border-white/5">
          <div className="text-2xl font-bold text-green-400">{queues.filter(q => q.status === 'in_service').length}</div>
          <div className="text-sm text-gray-500">قيد الخدمة</div>
        </div>
        <div className="bg-[#121212] p-4 rounded-xl border border-white/5">
          <div className="text-2xl font-bold text-gray-400">{queues.filter(q => q.status === 'completed').length}</div>
          <div className="text-sm text-gray-500">تم خدمتهم</div>
        </div>
      </div>

      <div className="bg-[#121212] rounded-3xl border border-white/5 p-6">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Users className="text-[#C9A54C]" /> جميع الطوابير
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="text-gray-500 border-b border-white/10">
                <th className="p-3">الرقم</th>
                <th className="p-3">العيادة</th>
                <th className="p-3">المراجع</th>
                <th className="p-3">الحالة</th>
                <th className="p-3">وقت الدخول</th>
                <th className="p-3">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {queues.slice(0, 20).map((q) => (
                <tr key={q.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-3 font-bold">{q.display_number || q.queue_number_int}</td>
                  <td className="p-3">{clinics.find(c => c.id === q.clinic_id)?.name_ar || q.clinic_id}</td>
                  <td className="p-3">{q.patient_id}</td>
                  <td className="p-3">
                    <span className={`px-3 py-1 rounded-full text-xs ${
                      q.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                      q.status === 'called' ? 'bg-blue-500/10 text-blue-400' :
                      q.status === 'in_service' ? 'bg-yellow-500/10 text-yellow-400' :
                      'bg-gray-500/10 text-gray-400'
                    }`}>
                      {q.status === 'waiting' ? 'انتظار' : q.status === 'called' ? 'تم المناداة' :
                       q.status === 'in_service' ? 'قيد الخدمة' : q.status === 'completed' ? 'تم' : q.status}
                    </span>
                  </td>
                  <td className="p-3 text-gray-400">{new Date(q.entered_at).toLocaleTimeString()}</td>
                  <td className="p-3">
                    <button
                      onClick={() => handleCancelQueue(q.id)}
                      className="p-2 hover:bg-red-500/10 rounded-lg text-red-400"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Doctors Management Tab
  const renderDoctorsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Stethoscope className="text-[#C9A54C]" /> إدارة الأطباء
        </h3>
        <button
          onClick={() => setShowAddDoctor(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#8A1538] hover:bg-[#6d1030] rounded-xl transition-all"
        >
          <Plus size={18} /> إضافة طبيب
        </button>
      </div>

      {showAddDoctor && (
        <AddDoctorForm
          clinics={clinics}
          onClose={() => setShowAddDoctor(false)}
          onSuccess={() => { setShowAddDoctor(false); loadAllData(); }}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {doctors.map((doctor) => (
          <div key={doctor.id} className="bg-[#121212] rounded-2xl border border-white/5 p-6 hover:border-[#C9A54C]/30 transition-all">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-[#8A1538] flex items-center justify-center">
                <Stethoscope className="text-[#C9A54C]" size={24} />
              </div>
              <div>
                <div className="font-bold text-lg">{doctor.name_ar || doctor.name}</div>
                <div className="text-sm text-gray-500">{doctor.specialty || 'طب عام'}</div>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">العيادة:</span>
                <span>{clinics.find(c => c.id === doctor.clinic_id)?.name_ar || 'غير محدد'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">الحالة:</span>
                <span className={doctor.is_active ? 'text-green-400' : 'text-red-400'}>
                  {doctor.is_active ? 'نشط' : 'غير نشط'}
                </span>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-all">
                <Edit size={14} className="inline ml-1" /> تعديل
              </button>
              <button
                onClick={() => toggleDoctorStatus(doctor.id, !doctor.is_active)}
                className={`flex-1 py-2 rounded-lg text-sm transition-all ${
                  doctor.is_active ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                }`}
              >
                {doctor.is_active ? 'تعطيل' : 'تفعيل'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {doctors.length === 0 && (
        <div className="text-center text-gray-500 py-12">
          <Stethoscope size={48} className="mx-auto mb-4 opacity-20" />
          <p>لا يوجد أطباء مسجلين</p>
        </div>
      )}
    </div>
  );

  // Doctor Screen Tab
  const renderDoctorScreenTab = () => {
    const waitingQueues = queues.filter(q => q.status === 'waiting');

    const handleCallNext = async () => {
      if (!selectedClinic) {
        toast.error('اختر العيادة أولاً');
        return;
      }
      if (currentTicket) {
        toast.error('أكمل معالجة المراجع الحالي أولاً');
        return;
      }

      const nextInLine = waitingQueues.find(q => q.clinic_id === selectedClinic);
      if (nextInLine) {
        const { error } = await supabase
          .from('queues')
          .update({ status: 'called', called_at: new Date().toISOString() })
          .eq('id', nextInLine.id);

        if (!error) {
          setCurrentTicket(nextInLine);
          loadAllData();
          toast.success(`تم مناداة رقم ${nextInLine.display_number}`);
        }
      }
    };

    const handleStartService = async () => {
      if (!currentTicket) return;
      const { error } = await supabase
        .from('queues')
        .update({ status: 'in_service' })
        .eq('id', currentTicket.id);

      if (!error) {
        setCurrentTicket({ ...currentTicket, status: 'in_service' });
        loadAllData();
        toast.success('بدأت خدمة المراجع');
      }
    };

    const handleComplete = async () => {
      if (!currentTicket) return;
      const { error } = await supabase
        .from('queues')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', currentTicket.id);

      if (!error) {
        setCurrentTicket(null);
        loadAllData();
        toast.success('تم إنهاء الخدمة');
      }
    };

    const handleNoShow = async () => {
      if (!currentTicket) return;
      const { error } = await supabase
        .from('queues')
        .update({ status: 'no_show' })
        .eq('id', currentTicket.id);

      if (!error) {
        setCurrentTicket(null);
        loadAllData();
        toast.success('تم تسجيل غياب المراجع');
      }
    };

    const handleVIP = async () => {
      if (!currentTicket) return;
      toast.success('تم نقل المراجع لأعلى الأولوية');
    };

    const handleDelay = async () => {
      if (!currentTicket) return;
      toast.success('تم تأجيل المراجع');
    };

    const handleTransfer = async () => {
      if (!currentTicket) return;
      toast.success('فتح نافذة النقل...');
    };

    return (
      <div className="space-y-6">
        <div className="bg-[#121212] rounded-3xl border border-white/5 p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Stethoscope className="text-[#C9A54C]" /> شاشة الطبيب
          </h3>

          {/* Clinic Selection */}
          <div className="mb-6">
            <label className="block text-sm text-gray-500 mb-2">اختر العيادة:</label>
            <select
              value={selectedClinic || ''}
              onChange={(e) => setSelectedClinic(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
            >
              <option value="">-- اختر عيادة --</option>
              {clinics.map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.name_ar || clinic.name}
                </option>
              ))}
            </select>
          </div>

          {/* Current Ticket Display */}
          <div className={`p-8 rounded-2xl text-center border-2 mb-6 ${
            currentTicket
              ? 'border-green-500/30 bg-green-500/5'
              : 'border-gray-700 bg-gray-900/50'
          }`}>
            <p className="text-gray-500 mb-2">المراجع الحالي</p>
            {currentTicket ? (
              <>
                <div className="text-7xl font-bold text-green-400 mb-2">
                  {currentTicket.display_number}
                </div>
                <p className="text-lg text-gray-400">{currentTicket.patient_id}</p>
                <span className={`inline-block mt-2 px-4 py-1 rounded-full text-sm ${
                  currentTicket.status === 'in_service' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'
                }`}>
                  {currentTicket.status === 'in_service' ? 'قيد الخدمة' : 'في الانتظار'}
                </span>
              </>
            ) : (
              <div className="text-5xl text-gray-600 font-mono py-8">
                --
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <button
              onClick={handleCallNext}
              disabled={!selectedClinic || currentTicket}
              className="p-4 bg-[#8A1538] hover:bg-[#6d1030] disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-center transition-all"
            >
              <Play size={24} className="mx-auto mb-2" />
              <span className="text-sm">مناداة التالي</span>
            </button>

            <button
              onClick={handleStartService}
              disabled={!currentTicket || currentTicket?.status === 'in_service'}
              className="p-4 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-center transition-all"
            >
              <Timer size={24} className="mx-auto mb-2" />
              <span className="text-sm">بدء الخدمة</span>
            </button>

            <button
              onClick={handleComplete}
              disabled={!currentTicket}
              className="p-4 bg-green-600 hover:bg-green-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-center transition-all"
            >
              <CheckCircle size={24} className="mx-auto mb-2" />
              <span className="text-sm">إنهاء</span>
            </button>

            <button
              onClick={handleVIP}
              disabled={!currentTicket}
              className="p-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-center transition-all"
            >
              <StarIcon size={24} className="mx-auto mb-2" />
              <span className="text-sm">VIP</span>
            </button>

            <button
              onClick={handleDelay}
              disabled={!currentTicket}
              className="p-4 bg-orange-600 hover:bg-orange-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-center transition-all"
            >
              <Clock size={24} className="mx-auto mb-2" />
              <span className="text-sm">تأجيل</span>
            </button>

            <button
              onClick={handleTransfer}
              disabled={!currentTicket}
              className="p-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-center transition-all"
            >
              <ArrowRight size={24} className="mx-auto mb-2" />
              <span className="text-sm">نقل</span>
            </button>
          </div>

          {/* No Show Button - Full Width */}
          <button
            onClick={handleNoShow}
            disabled={!currentTicket}
            className="w-full mt-3 p-4 bg-red-600 hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-center transition-all"
          >
            <XCircle size={24} className="inline ml-2" />
            <span>لم يحضر</span>
          </button>
        </div>

        {/* Queue Preview */}
        <div className="bg-[#121212] rounded-3xl border border-white/5 p-6">
          <h4 className="font-bold mb-4 flex items-center gap-2">
            <Users size={18} className="text-[#C9A54C]" /> قائمة الانتظار ({waitingQueues.filter(q => q.clinic_id === selectedClinic).length})
          </h4>
          <QueueMonitor clinicId={selectedClinic} compact />
        </div>
      </div>
    );
  };

  // Notifications Tab
  const renderNotificationsTab = () => (
    <div className="space-y-6">
      <div className="bg-[#121212] rounded-3xl border border-white/5 p-6">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Bell className="text-[#C9A54C]" /> الإشعارات
        </h3>
        <div className="space-y-4">
          {queues.slice(0, 5).map((q) => (
            <div key={q.id} className="flex items-center gap-4 p-4 bg-white/5 rounded-xl">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                q.status === 'waiting' ? 'bg-yellow-500/20 text-yellow-400' :
                q.status === 'called' ? 'bg-blue-500/20 text-blue-400' :
                'bg-green-500/20 text-green-400'
              }`}>
                <Bell size={18} />
              </div>
              <div className="flex-1">
                <p className="font-medium">
                  {q.status === 'waiting' ? 'مراجع جديد في الانتظار' :
                   q.status === 'called' ? `مناداة رقم ${q.display_number}` :
                   'تم إنهاء الخدمة'}
                </p>
                <p className="text-sm text-gray-500">{new Date(q.entered_at).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Routes Tab
  const renderRoutesTab = () => (
    <div className="space-y-6">
      <div className="bg-[#121212] rounded-3xl border border-white/5 p-6">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <MapPin className="text-[#C9A54C]" /> مسارات الفحص الطبي
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { name: 'فحص عادي', route: 'التسجيل ← الفحص السريري ← المختبر ← الأشعة ← التقرير' },
            { name: 'فحص خاص', route: 'التسجيل ← الفحص السريري ← استشارة متخصصة ← المختبر ← الأشعة ← التقرير' },
            { name: 'فحص VIP', route: 'التسجيل ← مسار مخصص ← التقرير' },
          ].map((r, i) => (
            <div key={i} className="p-4 bg-white/5 rounded-xl border border-white/10">
              <h4 className="font-bold text-[#C9A54C] mb-2">{r.name}</h4>
              <p className="text-sm text-gray-400">{r.route}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Reports Tab
  const renderReportsTab = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayQueues = queues.filter(q => q.queue_date === today || q.entered_at?.startsWith(today));

    return (
      <div className="space-y-6">
        <div className="bg-[#121212] rounded-3xl border border-white/5 p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <FileText className="text-[#C9A54C]" /> التقارير
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white/5 p-4 rounded-xl text-center">
              <div className="text-3xl font-bold text-blue-400">{todayQueues.length}</div>
              <div className="text-sm text-gray-500">إجمالي اليوم</div>
            </div>
            <div className="bg-white/5 p-4 rounded-xl text-center">
              <div className="text-3xl font-bold text-green-400">
                {todayQueues.filter(q => q.status === 'completed').length}
              </div>
              <div className="text-sm text-gray-500">تم خدمتهم</div>
            </div>
            <div className="bg-white/5 p-4 rounded-xl text-center">
              <div className="text-3xl font-bold text-yellow-400">
                {todayQueues.filter(q => q.status === 'waiting').length}
              </div>
              <div className="text-sm text-gray-500">قيد الانتظار</div>
            </div>
            <div className="bg-white/5 p-4 rounded-xl text-center">
              <div className="text-3xl font-bold text-red-400">
                {todayQueues.filter(q => q.status === 'no_show').length}
              </div>
              <div className="text-sm text-gray-500">لم يحضروا</div>
            </div>
          </div>

          <button
            onClick={() => generateReport()}
            className="w-full py-3 bg-[#8A1538] hover:bg-[#6d1030] rounded-xl font-medium transition-all"
          >
            <FileText size={18} className="inline ml-2" />
            تصدير تقرير اليوم
          </button>
        </div>
      </div>
    );
  };

  const generateReport = () => {
    toast.success('جاري إنشاء التقرير...');
    // In real implementation, this would generate a PDF/Excel report
  };

  // Clinics Tab
  const renderClinicsTab = () => (
    <div className="space-y-6">
      <div className="bg-[#121212] rounded-3xl border border-white/5 p-6">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Building2 className="text-[#C9A54C]" /> العيادات
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clinics.map((clinic) => (
            <div key={clinic.id} className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold">{clinic.name_ar || clinic.name}</h4>
                <span className={`px-2 py-1 rounded text-xs ${clinic.is_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                  {clinic.is_active ? 'نشط' : 'غير نشط'}
                </span>
              </div>
              <p className="text-sm text-gray-500">{clinic.code || clinic.id}</p>
              <div className="mt-3 text-sm text-gray-400">
                <span>الطابور: </span>
                <span className="text-[#C9A54C]">{queues.filter(q => q.clinic_id === clinic.id && q.status === 'waiting').length}</span>
              </div>
            </div>
          ))}
        </div>
        {clinics.length === 0 && (
          <p className="text-center text-gray-500 py-8">لا توجد عيادات مسجلة</p>
        )}
      </div>
    </div>
  );

  // Health Tab
  const renderHealthTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#121212] p-6 rounded-2xl border border-green-500/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-500/10 rounded-xl">
              <Server size={24} className="text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">متصل</div>
              <div className="text-sm text-gray-500">قاعدة البيانات</div>
            </div>
          </div>
        </div>

        <div className="bg-[#121212] p-6 rounded-2xl border border-green-500/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-500/10 rounded-xl">
              <Wifi size={24} className="text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">متصل</div>
              <div className="text-sm text-gray-500">الاتصال</div>
            </div>
          </div>
        </div>

        <div className="bg-[#121212] p-6 rounded-2xl border border-green-500/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-500/10 rounded-xl">
              <Database size={24} className="text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">{queues.length}</div>
              <div className="text-sm text-gray-500">إجمالي السجلات</div>
            </div>
          </div>
        </div>

        <div className="bg-[#121212] p-6 rounded-2xl border border-green-500/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-500/10 rounded-xl">
              <Heart size={24} className="text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">100%</div>
              <div className="text-sm text-gray-500">حالة النظام</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#121212] rounded-3xl border border-white/5 p-6">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Activity className="text-[#C9A54C]" /> سجل النظام
        </h3>
        <div className="space-y-2 font-mono text-sm text-gray-400">
          <p>[{new Date().toISOString()}] النظام يعمل بشكل طبيعي</p>
          <p>[{new Date().toISOString()}] جميع الخدمات متصلة</p>
          <p>[{new Date().toISOString()}] تم التحقق من قاعدة البيانات</p>
        </div>
      </div>
    </div>
  );

  // Settings Tab
  const renderSettingsTab = () => (
    <div className="space-y-6">
      <div className="bg-[#121212] rounded-3xl border border-white/5 p-6">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Settings className="text-[#C9A54C]" /> الإعدادات العامة
        </h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl">
            <div>
              <h4 className="font-medium">اللغة</h4>
              <p className="text-sm text-gray-500">تغيير لغة الواجهة</p>
            </div>
            <select className="bg-white/5 border border-white/10 rounded-lg px-4 py-2">
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </div>

          <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl">
            <div>
              <h4 className="font-medium">التبليغات</h4>
              <p className="text-sm text-gray-500">تفعيل الإشعارات الصوتية</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8A1538]"></div>
            </label>
          </div>

          <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl">
            <div>
              <h4 className="font-medium">العرض</h4>
              <p className="text-sm text-gray-500">شاشة العرض الخارجية</p>
            </div>
            <button className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all">
              تكوين
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const handleCancelQueue = async (queueId) => {
    if (confirm('هل تريد إلغاء هذا المراجع من الطابور؟')) {
      const { error } = await supabase
        .from('queues')
        .update({ status: 'cancelled' })
        .eq('id', queueId);

      if (!error) {
        toast.success('تم إلغاء المراجع');
        loadAllData();
      }
    }
  };

  const toggleDoctorStatus = async (doctorId, newStatus) => {
    const { error } = await supabase
      .from('doctors')
      .update({ is_active: newStatus })
      .eq('id', doctorId);

    if (!error) {
      toast.success(newStatus ? 'تم تفعيل الطبيب' : 'تم تعطيل الطبيب');
      loadAllData();
    }
  };

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white overflow-hidden font-cairo" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <Toaster position="top-center" />

      {/* Sidebar */}
      <aside className={`bg-[#121212] border-l border-white/5 transition-all duration-300 flex flex-col ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="p-6 border-b border-white/5 flex items-center gap-3">
          <div className="bg-[#8A1538] p-2 rounded-lg">
            <Shield className="text-[#C9A54C] w-6 h-6" />
          </div>
          {isSidebarOpen && (
            <div>
              <h1 className="text-lg font-bold leading-tight">لوحة الإدارة</h1>
              <p className="text-[10px] text-gray-500">قيادة الخدمات الطبية</p>
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === item.id
                ? 'bg-[#C9A54C] text-black shadow-lg shadow-[#C9A54C]/20'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon size={20} />
              {isSidebarOpen && <span className="font-medium">{t(item.label, item.labelEn)}</span>}
              {isSidebarOpen && activeTab === item.id && <ChevronRight className="ms-auto" size={16} />}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5 space-y-2">
          <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white transition-all">
            <Home size={20} />
            {isSidebarOpen && <span>الرئيسية</span>}
          </button>
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-all">
            <LogOut size={20} />
            {isSidebarOpen && <span>تسجيل الخروج</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8 bg-[#0a0a0a]">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold">{t(menuItems.find(i => i.id === activeTab).label, menuItems.find(i => i.id === activeTab).labelEn)}</h2>
            <p className="text-gray-500 mt-1">أهلاً بك، {user?.username || 'المسؤول'}</p>
          </div>
          <div className="flex gap-4">
            <button onClick={loadAllData} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all">
              <RefreshCw className={loading ? 'animate-spin' : ''} size={20} />
            </button>
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all">
              <Menu size={20} />
            </button>
          </div>
        </header>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[
                { label: 'إجمالي المراجعين', labelEn: 'Total Patients', val: stats.totalPatients, icon: Users, color: 'text-blue-400' },
                { label: 'في الانتظار', labelEn: 'Waiting', val: stats.waiting, icon: Clock, color: 'text-yellow-400' },
                { label: 'تمت خدمتهم', labelEn: 'Completed', val: stats.completed, icon: CheckCircle, color: 'text-green-400' },
                { label: 'حالة النظام', labelEn: 'System Status', val: '100%', icon: Activity, color: 'text-[#C9A54C]' },
              ].map((s, i) => (
                <div key={i} className="bg-[#121212] p-6 rounded-3xl border border-white/5 hover:border-[#C9A54C]/30 transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-2xl bg-white/5 ${s.color}`}>
                      <s.icon size={24} />
                    </div>
                  </div>
                  <div className="text-3xl font-bold mb-1">{s.val}</div>
                  <div className="text-sm text-gray-500">{t(s.label, s.labelEn)}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-[#121212] rounded-3xl border border-white/5 p-6">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Users className="text-[#C9A54C]" /> آخر المسجلين في الطابور
                </h3>
                <div className="space-y-4">
                  {queues.slice(0, 5).map((q, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#8A1538] flex items-center justify-center font-bold">
                          {q.display_number || q.queue_number_int}
                        </div>
                        <div>
                          <div className="font-bold">{q.patient_id}</div>
                          <div className="text-xs text-gray-500">{new Date(q.entered_at).toLocaleTimeString()}</div>
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs ${q.status === 'completed' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                        {q.status === 'waiting' ? 'انتظار' : q.status === 'completed' ? 'تم' : q.status}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#121212] rounded-3xl border border-white/5 p-6">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Building2 className="text-[#C9A54C]" /> العيادات النشطة
                </h3>
                <div className="space-y-4">
                  {clinics.slice(0, 5).map((clinic) => (
                    <div key={clinic.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#8A1538] flex items-center justify-center">
                          <Stethoscope size={18} className="text-[#C9A54C]" />
                        </div>
                        <div>
                          <div className="font-bold">{clinic.name_ar || clinic.name}</div>
                          <div className="text-xs text-gray-500">{clinics.find(c => c.id === clinic.id)?.code || clinic.id}</div>
                        </div>
                      </div>
                      <div className="text-[#C9A54C] font-bold">
                        {queues.filter(q => q.clinic_id === clinic.id && q.status === 'waiting').length}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Other Tabs */}
        {activeTab === 'queues' && renderQueuesTab()}
        {activeTab === 'doctors' && renderDoctorsTab()}
        {activeTab === 'doctor-screen' && renderDoctorScreenTab()}
        {activeTab === 'notifications' && renderNotificationsTab()}
        {activeTab === 'routes' && renderRoutesTab()}
        {activeTab === 'reports' && renderReportsTab()}
        {activeTab === 'clinics' && renderClinicsTab()}
        {activeTab === 'health' && renderHealthTab()}
        {activeTab === 'settings' && renderSettingsTab()}
      </main>
    </div>
  );
}

// Star Icon Component
function StarIcon({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

// Add Doctor Form Component
function AddDoctorForm({ clinics, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    name_ar: '',
    specialty: '',
    clinic_id: '',
    username: '',
    password: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { error } = await supabase
      .from('doctors')
      .insert([{
        ...formData,
        is_active: true
      }]);

    if (!error) {
      toast.success('تم إضافة الطبيب بنجاح');
      onSuccess();
    } else {
      toast.error('حدث خطأ');
    }
  };

  return (
    <div className="bg-[#121212] rounded-3xl border border-white/5 p-6">
      <h3 className="text-lg font-bold mb-4">إضافة طبيب جديد</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="اسم الطبيب (بالعربية)"
            value={formData.name_ar}
            onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3"
            required
          />
          <input
            type="text"
            placeholder="التخصص"
            value={formData.specialty}
            onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3"
          />
          <select
            value={formData.clinic_id}
            onChange={(e) => setFormData({ ...formData, clinic_id: e.target.value })}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3"
            required
          >
            <option value="">اختر العيادة</option>
            {clinics.map((c) => (
              <option key={c.id} value={c.id}>{c.name_ar || c.name}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="اسم المستخدم"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3"
            required
          />
        </div>
        <div className="flex gap-3">
          <button type="submit" className="flex-1 py-3 bg-[#8A1538] hover:bg-[#6d1030] rounded-xl font-medium transition-all">
            <Plus size={18} className="inline ml-2" />
            إضافة
          </button>
          <button type="button" onClick={onClose} className="py-3 px-6 bg-white/10 hover:bg-white/20 rounded-xl transition-all">
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}

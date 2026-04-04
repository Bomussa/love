import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Users, Clock, CheckCircle, Activity, 
  Settings, FileText, MapPin, Key, RefreshCw, Trash2, 
  LogOut, Home, Bell, BarChart3, Building2, Shield, Menu, X, ChevronRight, Stethoscope, Play, UserPlus
} from 'lucide-react';
import { supabase } from '../lib/supabase-client';
import toast, { Toaster } from 'react-hot-toast';

export function AdminDashboardV2({ user, onLogout, language }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [stats, setStats] = useState({ totalPatients: 0, waiting: 0, completed: 0, activePins: 0 });
  const [loading, setLoading] = useState(false);
  const [queues, setQueues] = useState([]);
  const [clinics, setClinics] = useState([]);

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
    
    if (queueData) {
      setQueues(queueData);
      setStats({
        totalPatients: queueData.length,
        waiting: queueData.filter(q => q.status === 'waiting').length,
        completed: queueData.filter(q => q.status === 'completed').length,
        activePins: 0
      });
    }
    if (clinicData) setClinics(clinicData);
    setLoading(false);
  };

  const t = (ar, en) => language === 'ar' ? ar : en;

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

        {activeTab === 'dashboard' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[
                { label: 'إجمالي المراجعين', val: stats.totalPatients, icon: Users, color: 'text-blue-400' },
                { label: 'في الانتظار', val: stats.waiting, icon: Clock, color: 'text-yellow-400' },
                { label: 'تمت خدمتهم', val: stats.completed, icon: CheckCircle, color: 'text-green-400' },
                { label: 'حالة النظام', val: '100%', icon: Activity, color: 'text-[#C9A54C]' },
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
                  <Users className="text-[#C9A54C]" />
                  آخر المسجلين في الطابور
                </h3>
                <div className="space-y-4">
                  {queues.slice(0, 5).map((q, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#8A1538] flex items-center justify-center font-bold">
                          {q.display_number}
                        </div>
                        <div>
                          <div className="font-bold">{q.patient_id}</div>
                          <div className="text-xs text-gray-500">{new Date(q.entered_at).toLocaleTimeString()}</div>
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs ${q.status === 'completed' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                        {q.status}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab !== 'dashboard' && (
          <div className="bg-[#121212] rounded-3xl border border-white/5 p-12 text-center">
            <Shield size={64} className="mx-auto text-[#C9A54C] mb-6 opacity-20" />
            <h3 className="text-xl font-bold mb-2">شاشة {t(menuItems.find(i => i.id === activeTab).label, menuItems.find(i => i.id === activeTab).labelEn)}</h3>
            <p className="text-gray-500">جاري تحميل المحتوى من قاعدة البيانات...</p>
          </div>
        )}
      </main>
    </div>
  );
}

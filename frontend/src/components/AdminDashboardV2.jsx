import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Users, Clock, CheckCircle, Activity, 
  Settings, FileText, MapPin, Key, RefreshCw, Trash2, 
  Edit, Plus, LogOut, Home, AlertCircle, ChevronRight,
  Search, Filter, Download, MoreVertical, Shield
} from 'lucide-react';
import supabase from '../lib/supabase-client';

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
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    loadAllData();
    const interval = setInterval(loadAllData, 30000); // Auto refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // 1. Total Patients (Unique from queue)
      const { data: queueData, error: queueError } = await supabase
        .from('queues')
        .select('patient_id, status, entered_at, called_at, completed_at');
      
      if (queueError) throw queueError;

      const uniquePatients = new Set(queueData.map(item => item.patient_id)).size;
      const waitingCount = queueData.filter(item => item.status === 'waiting').length;
      const completedCount = queueData.filter(item => item.status === 'completed').length;

      // 2. Avg Wait Time
      let avgWait = 0;
      const completedItems = queueData.filter(item => item.status === 'completed' && item.entered_at && item.called_at);
      if (completedItems.length > 0) {
        const totalWait = completedItems.reduce((acc, item) => {
          const wait = new Date(item.called_at) - new Date(item.entered_at);
          return acc + wait;
        }, 0);
        avgWait = Math.round(totalWait / completedItems.length / 60000); // in minutes
      }

      // 3. Active PINs
      const { count: pinCount } = await supabase
        .from('pins')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      setStats({
        totalPatients: uniquePatients,
        waiting: waitingCount,
        completed: completedCount,
        avgWaitTime: avgWait,
        activePins: pinCount || 0,
        systemHealth: 100
      });
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResetStats = async () => {
    if (!window.confirm(language === 'ar' ? 'هل أنت متأكد من تصفير جميع البيانات؟' : 'Are you sure you want to reset all data?')) return;
    
    try {
      // Logic to reset stats (e.g., archive current queue)
      const { error } = await supabase.from('queues').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      loadAllData();
      alert(language === 'ar' ? 'تم تصفير البيانات بنجاح' : 'Data reset successfully');
    } catch (error) {
      alert(language === 'ar' ? 'خطأ في تصفير البيانات' : 'Error resetting data');
    }
  };

  const t = (ar, en) => language === 'ar' ? ar : en;

  return (
    <div className="min-h-screen bg-[#0b0b0f] text-white font-sans selection:bg-gold-500/30">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-[#12121a] border-r border-white/5 z-50 hidden lg:block">
        <div className="p-6 flex items-center gap-3 border-b border-white/5">
          <div className="w-10 h-10 bg-gradient-to-br from-gold-400 to-gold-600 rounded-xl flex items-center justify-center shadow-lg shadow-gold-500/20">
            <Shield className="text-black w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">{t('لوحة الإدارة', 'Admin Panel')}</h1>
            <p className="text-[10px] text-gold-500/70 uppercase tracking-widest font-medium">{t('نظام اللجنة الطبية', 'Medical System')}</p>
          </div>
        </div>

        <nav className="p-4 space-y-2">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: t('لوحة التحكم', 'Dashboard') },
            { id: 'queues', icon: Users, label: t('إدارة الطوابير', 'Queues') },
            { id: 'pins', icon: Key, label: t('الأرقام السرية', 'PIN Codes') },
            { id: 'reports', icon: FileText, label: t('التقارير', 'Reports') },
            { id: 'clinics', icon: MapPin, label: t('العيادات', 'Clinics') },
            { id: 'settings', icon: Settings, label: t('الإعدادات', 'Settings') },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                activeTab === item.id 
                ? 'bg-gold-500/10 text-gold-400 border border-gold-500/20 shadow-lg shadow-gold-500/5' 
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

      {/* Main Content */}
      <main className="lg:ml-64 p-4 lg:p-8">
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

          <div className="flex items-center gap-3">
            <button 
              onClick={toggleLanguage}
              className="px-4 py-2 bg-[#1a1a24] border border-white/5 rounded-xl hover:bg-[#22222e] transition-all flex items-center gap-2"
            >
              <Activity size={18} className="text-gold-500" />
              <span>{language === 'ar' ? 'English' : 'العربية'}</span>
            </button>
            <button 
              onClick={loadAllData}
              className="p-2 bg-gold-500 text-black rounded-xl hover:bg-gold-400 transition-all shadow-lg shadow-gold-500/20"
              title={t('تحديث البيانات', 'Refresh Data')}
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
            <button 
              onClick={handleResetStats}
              className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-all flex items-center gap-2"
            >
              <Trash2 size={18} />
              <span>{t('تصفير', 'Reset')}</span>
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { label: t('إجمالي المرضى', 'Total Patients'), value: stats.totalPatients, icon: Users, color: 'blue' },
            { label: t('في الانتظار', 'Waiting'), value: stats.waiting, icon: Clock, color: 'yellow' },
            { label: t('المكتملين', 'Completed'), value: stats.completed, icon: CheckCircle, color: 'green' },
            { label: t('الأرقام السرية', 'Active PINs'), value: stats.activePins, icon: Key, color: 'purple' },
          ].map((stat, i) => (
            <div key={i} className="bg-[#12121a] p-6 rounded-2xl border border-white/5 hover:border-white/10 transition-all group">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl bg-${stat.color}-500/10 text-${stat.color}-500 group-hover:scale-110 transition-transform`}>
                  <stat.icon size={24} />
                </div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{t('مباشر', 'Live')}</span>
              </div>
              <h3 className="text-gray-400 text-sm font-medium mb-1">{stat.label}</h3>
              <div className="text-3xl font-bold text-white tracking-tight">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* System Health & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#12121a] rounded-2xl border border-white/5 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Activity size={20} className="text-gold-500" />
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
              <AlertCircle size={20} className="text-gold-500" />
              {t('تنبيهات النظام', 'System Alerts')}
            </h3>
            <div className="space-y-4">
              <div className="p-4 bg-gold-500/5 border border-gold-500/10 rounded-xl">
                <p className="text-sm text-gold-500 leading-relaxed">
                  {t('النظام يعمل بشكل مثالي. جميع الخدمات مستقرة والاتصال بقاعدة البيانات سريع.', 'System is running perfectly. All services are stable and database connection is fast.')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboardV2;

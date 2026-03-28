import React, { useState, useEffect } from 'react';
import authService from '../lib/auth-service';
import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api/client';
import { 
  LayoutDashboard, Users, Clock, CheckCircle, Shield, LogOut, Home, 
  BarChart3, Settings, Bell, Activity, RefreshCw
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export function AdminDashboardV2({ language = 'ar' }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    totalPatients: 0,
    waiting: 0,
    serving: 0,
    completed: 0
  });
  const [loading, setLoading] = useState(true);

  const t = (ar, en) => language === 'ar' ? ar : en;

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      // جلب الإحصائيات عبر الـ API الموحد
      // ملاحظة: نستخدم عيادة افتراضية أو نجمع كل العيادات إذا كان الـ API يدعم ذلك
      const clinics = await apiClient.get('clinics');
      let totalStats = { totalPatients: 0, waiting: 0, serving: 0, completed: 0 };
      
      for (const clinic of clinics) {
        try {
          const clinicData = await apiClient.get('queueStatus', { clinicId: clinic.id });
          totalStats.waiting += clinicData.queueLength;
          totalStats.totalPatients += clinicData.queueLength;
          // يمكن إضافة المزيد من التفاصيل هنا
        } catch (e) {
          console.error(`Error fetching stats for clinic ${clinic.id}:`, e);
          toast.error(`خطأ في جلب بيانات العيادة ${clinic.id}`);
        }
      }
      setStats(totalStats);
      toast.success('تم تحديث الإحصائيات بنجاح');
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      toast.error('فشل تحديث الإحصائيات');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    authService.logout();
    window.location.href = '/';
  };

  // Repair 54-56: Button state management
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchStats();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <Toaster />
      
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold">{t('لوحة تحكم الإدارة', 'Admin Dashboard')}</h1>
            <p className="text-xs text-gray-400">{t('نظام اللجنة الطبية العسكرية', 'Military Medical Committee System')}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 hover:bg-gray-700 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('تحديث', 'Refresh')}
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <div className="h-8 w-px bg-gray-700 mx-2"></div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 px-4 py-2 rounded-lg border border-red-900/50 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline text-sm font-medium">{t('خروج', 'Logout')}</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-20 sm:w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
          <nav className="flex-1 p-4 space-y-2">
            {[
              { id: 'overview', icon: LayoutDashboard, labelAr: 'نظرة عامة', labelEn: 'Overview' },
              { id: 'queues', icon: Clock, labelAr: 'إدارة الطوابير', labelEn: 'Queue Management' },
              { id: 'clinics', icon: Home, labelAr: 'العيادات', labelEn: 'Clinics' },
              { id: 'users', icon: Users, labelAr: 'المستخدمين', labelEn: 'Users' },
              { id: 'reports', icon: BarChart3, labelAr: 'التقارير', labelEn: 'Reports' },
              { id: 'settings', icon: Settings, labelAr: 'الإعدادات', labelEn: 'Settings' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                  activeTab === item.id 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                    : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
                }`}
              >
                <item.icon className="w-6 h-6 shrink-0" />
                <span className="hidden sm:inline font-medium text-sm">{t(item.labelAr, item.labelEn)}</span>
              </button>
            ))}
          </nav>
          
          <div className="p-4 border-t border-gray-700">
            <div className="bg-gray-900/50 rounded-xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">
                AD
              </div>
              <div className="hidden sm:block overflow-hidden">
                <p className="text-xs font-bold truncate">Admin</p>
                <p className="text-[10px] text-gray-500 truncate">admin@mmc-mms.com</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Welcome Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">{t('مرحباً بك، أيها المدير', 'Welcome, Administrator')}</h2>
                <p className="text-gray-400">{t('هذه نظرة سريعة على حالة النظام اليوم', 'Here is a quick look at the system status today')}</p>
              </div>
              <div className="flex items-center gap-2 bg-gray-800 p-1 rounded-lg border border-gray-700">
                <div className="px-3 py-1.5 bg-blue-600 rounded-md text-xs font-bold">LIVE</div>
                <div className="px-3 py-1.5 text-xs text-gray-400">{new Date().toLocaleDateString(language === 'ar' ? 'ar-QA' : 'en-US')}</div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { labelAr: 'إجمالي المراجعين', labelEn: 'Total Patients', value: stats.totalPatients, color: 'blue', icon: Users },
                { labelAr: 'في الانتظار', labelEn: 'Waiting', value: stats.waiting, color: 'yellow', icon: Clock },
                { labelAr: 'قيد الفحص', labelEn: 'In Service', value: stats.serving, color: 'green', icon: Activity },
                { labelAr: 'تم الانتهاء', labelEn: 'Completed', value: stats.completed, color: 'purple', icon: CheckCircle },
              ].map((stat, idx) => (
                <div key={idx} className="bg-gray-800 border border-gray-700 p-6 rounded-2xl hover:border-gray-600 transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-xl bg-${stat.color}-500/10 text-${stat.color}-500 group-hover:scale-110 transition-transform`}>
                      <stat.icon className="w-6 h-6" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold mb-1">{stat.value}</p>
                  <p className="text-xs text-gray-400 font-medium">{t(stat.labelAr, stat.labelEn)}</p>
                </div>
              ))}
            </div>

            {/* Content Placeholder */}
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
              <div className="max-w-md mx-auto space-y-4">
                <div className="bg-gray-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                  <Activity className="w-8 h-8 text-blue-500" />
                </div>
                <h3 className="text-xl font-bold">{t('جاري تحديث البيانات...', 'Updating Data...')}</h3>
                <p className="text-gray-400 text-sm">
                  {t('يتم الآن مزامنة كافة الشاشات مع قاعدة البيانات الموحدة لضمان دقة المعلومات بنسبة 100%.', 'All screens are being synchronized with the unified database to ensure 100% data accuracy.')}
                </p>
                <div className="pt-4">
                  <div className="h-1.5 w-full bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 animate-progress w-2/3"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

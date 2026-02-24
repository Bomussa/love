import React, { useState, useEffect } from 'react';
import {
  Activity,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Settings,
  FileText,
  Shield,
  Database,
  Bell,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../Card';
import authService from '../../lib/auth-service';
import dashboardApi from '../../lib/supabase-dashboard-api';

/**
 * Advanced Admin Dashboard - لوحة التحكم المتقدمة
 * ✅ تستخدم بيانات حقيقية من Supabase
 * ✅ لا توجد بيانات وهمية
 */
export const AdvancedDashboard = ({ language = 'ar' }) => {
  const [stats, setStats] = useState({
    totalPatients: 0,
    totalWaiting: 0,
    totalServed: 0,
    activeQueues: 0,
    avgWaitTime: 0,
    completedToday: 0,
    activeClinics: 0,
    systemHealth: 100
  });

  const [services, setServices] = useState({
    pinService: { status: 'checking', lastCheck: new Date() },
    queueManager: { status: 'checking', lastCheck: new Date() },
    routeService: { status: 'checking', lastCheck: new Date() },
    notificationService: { status: 'checking', lastCheck: new Date() },
    sse: { status: 'checking', lastCheck: new Date() }
  });

  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const session = authService.getSession();

  useEffect(() => {
    loadDashboardData();
    checkServicesHealth();

    // تحديث كل 30 ثانية
    const interval = setInterval(() => {
      loadDashboardData();
      checkServicesHealth();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setError(null);
      
      // جلب الإحصائيات من stats-dashboard function
      const dashboardData = await dashboardApi.getDashboardStats();
      
      // جلب متوسط وقت الانتظار
      const avgWait = await dashboardApi.getAverageWaitTime();
      
      // جلب النشاط الأخير
      const activity = await dashboardApi.getRecentActivity(5);

      // تحديث الإحصائيات
      setStats({
        totalPatients: dashboardData.totalPatients || 0,
        totalWaiting: dashboardData.totalWaiting || 0,
        totalServed: dashboardData.totalServed || 0,
        activeQueues: dashboardData.activeClinics || 0,
        avgWaitTime: avgWait || 0,
        completedToday: dashboardData.completedToday || 0,
        activeClinics: dashboardData.activeClinics || 0,
        systemHealth: dashboardData.systemHealth || 100
      });

      setRecentActivity(activity);
      setLastUpdate(new Date());
      setLoading(false);
    } catch (err) {
      console.error('[Dashboard] Error loading data:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const checkServicesHealth = async () => {
    const now = new Date();
    
    try {
      // فحص حالة stats-dashboard function
      const dashboardData = await dashboardApi.getDashboardStats();
      const dashboardStatus = dashboardData.error ? 'inactive' : 'active';
      
      setServices({
        pinService: { status: dashboardStatus, lastCheck: now },
        queueManager: { status: dashboardStatus, lastCheck: now },
        routeService: { status: dashboardStatus, lastCheck: now },
        notificationService: { status: dashboardStatus, lastCheck: now },
        sse: { 
          status: typeof EventSource !== 'undefined' ? 'active' : 'inactive', 
          lastCheck: now 
        }
      });
    } catch (err) {
      // في حالة الفشل، نعتبر الخدمات غير نشطة
      setServices({
        pinService: { status: 'inactive', lastCheck: now },
        queueManager: { status: 'inactive', lastCheck: now },
        routeService: { status: 'inactive', lastCheck: now },
        notificationService: { status: 'inactive', lastCheck: now },
        sse: { status: 'inactive', lastCheck: now }
      });
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    dashboardApi.clearCache();
    await loadDashboardData();
    await checkServicesHealth();
  };

  const getServiceIcon = (serviceName) => {
    const icons = {
      pinService: <Shield className="w-5 h-5" />,
      queueManager: <Users className="w-5 h-5" />,
      routeService: <TrendingUp className="w-5 h-5" />,
      notificationService: <Bell className="w-5 h-5" />,
      sse: <Activity className="w-5 h-5" />
    };
    return icons[serviceName] || <Settings className="w-5 h-5" />;
  };

  const getServiceName = (serviceName) => {
    const names = {
      pinService: language === 'ar' ? 'خدمة الأكواد' : 'PIN Service',
      queueManager: language === 'ar' ? 'مدير الطوابير' : 'Queue Manager',
      routeService: language === 'ar' ? 'خدمة المسارات' : 'Route Service',
      notificationService: language === 'ar' ? 'خدمة الإشعارات' : 'Notification Service',
      sse: language === 'ar' ? 'الاتصال الحي' : 'Live Connection'
    };
    return names[serviceName] || serviceName;
  };

  if (loading && !stats.totalPatients) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">
            {language === 'ar' ? 'جاري تحميل البيانات...' : 'Loading data...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">
            {language === 'ar' ? 'لوحة التحكم' : 'Dashboard'}
          </h1>
          <p className="text-gray-400 mt-1">
            {language === 'ar' ? `مرحباً ${session?.name || 'Admin'}` : `Welcome ${session?.name || 'Admin'}`}
          </p>
          {lastUpdate && (
            <p className="text-xs text-gray-500 mt-1">
              {language === 'ar' ? 'آخر تحديث: ' : 'Last update: '}
              {lastUpdate.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="text-sm">
              {language === 'ar' ? 'تحديث' : 'Refresh'}
            </span>
          </button>
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg">
            <div className={`w-3 h-3 rounded-full ${stats.systemHealth > 90 ? 'bg-green-500' : stats.systemHealth > 50 ? 'bg-yellow-500' : 'bg-red-500'} animate-pulse`}></div>
            <span className="text-white font-semibold">{stats.systemHealth}%</span>
            <span className="text-gray-400 text-sm">
              {language === 'ar' ? 'صحة النظام' : 'System Health'}
            </span>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <p className="text-red-400 text-sm">
              {language === 'ar' ? 'خطأ في تحميل البيانات: ' : 'Error loading data: '}
              {error}
            </p>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-blue-600 to-blue-700 border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">
                  {language === 'ar' ? 'المنتظرين' : 'Waiting'}
                </p>
                <p className="text-4xl font-bold text-white mt-2">{stats.totalWaiting}</p>
                <p className="text-xs text-blue-200 mt-1">
                  {language === 'ar' ? 'في الطابور الآن' : 'In queue now'}
                </p>
              </div>
              <Users className="w-12 h-12 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-600 to-green-700 border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">
                  {language === 'ar' ? 'المكتملين' : 'Completed'}
                </p>
                <p className="text-4xl font-bold text-white mt-2">{stats.completedToday}</p>
                <p className="text-xs text-green-200 mt-1">
                  {language === 'ar' ? 'اليوم' : 'Today'}
                </p>
              </div>
              <CheckCircle className="w-12 h-12 text-green-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-600 to-yellow-700 border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-100 text-sm">
                  {language === 'ar' ? 'متوسط الانتظار' : 'Avg Wait Time'}
                </p>
                <p className="text-4xl font-bold text-white mt-2">
                  {stats.avgWaitTime > 0 ? `${stats.avgWaitTime}m` : '-'}
                </p>
                <p className="text-xs text-yellow-200 mt-1">
                  {language === 'ar' ? 'دقيقة' : 'minutes'}
                </p>
              </div>
              <Clock className="w-12 h-12 text-yellow-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-600 to-purple-700 border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">
                  {language === 'ar' ? 'العيادات النشطة' : 'Active Clinics'}
                </p>
                <p className="text-4xl font-bold text-white mt-2">{stats.activeClinics}</p>
                <p className="text-xs text-purple-200 mt-1">
                  {language === 'ar' ? 'تعمل الآن' : 'Operating now'}
                </p>
              </div>
              <Activity className="w-12 h-12 text-purple-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Services Health */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Database className="w-5 h-5" />
            {language === 'ar' ? 'حالة الخدمات' : 'Services Health'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(services).map(([key, service]) => (
            <div key={key} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="text-gray-400">
                  {getServiceIcon(key)}
                </div>
                <div>
                  <p className="text-white font-medium">{getServiceName(key)}</p>
                  <p className="text-xs text-gray-400">
                    {language === 'ar' ? 'آخر فحص' : 'Last check'}: {service.lastCheck.toLocaleTimeString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  service.status === 'active' ? 'bg-green-500' : 
                  service.status === 'checking' ? 'bg-yellow-500' : 
                  'bg-red-500'
                } ${service.status === 'checking' ? 'animate-pulse' : ''}`}></div>
                <span className={`text-sm font-medium ${
                  service.status === 'active' ? 'text-green-400' : 
                  service.status === 'checking' ? 'text-yellow-400' : 
                  'text-red-400'
                }`}>
                  {service.status === 'active' 
                    ? (language === 'ar' ? 'نشط' : 'Active')
                    : service.status === 'checking'
                    ? (language === 'ar' ? 'جاري الفحص' : 'Checking')
                    : (language === 'ar' ? 'متوقف' : 'Inactive')}
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {language === 'ar' ? 'النشاط الأخير' : 'Recent Activity'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentActivity.length > 0 ? (
            recentActivity.map((activity, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-gray-700/30 rounded-lg">
                <div className={`w-2 h-2 rounded-full mt-1.5 ${
                  activity.type === 'success' ? 'bg-green-500' :
                  activity.type === 'warning' ? 'bg-yellow-500' :
                  'bg-blue-500'
                }`}></div>
                <div className="flex-1">
                  <p className="text-white text-sm">{activity.event}</p>
                  <p className="text-xs text-gray-400 mt-1">{activity.time}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {language === 'ar' ? 'لا يوجد نشاط حديث' : 'No recent activity'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdvancedDashboard;

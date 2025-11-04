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
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../Card';
import authService from '../../lib/auth-service';

/**
 * Advanced Admin Dashboard - لوحة التحكم المتقدمة
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
    pinService: { status: 'active', lastCheck: new Date() },
    queueManager: { status: 'active', lastCheck: new Date() },
    routeService: { status: 'active', lastCheck: new Date() },
    notificationService: { status: 'active', lastCheck: new Date() },
    sse: { status: 'inactive', lastCheck: new Date() }
  });

  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

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
      // محاكاة جلب البيانات
      setStats({
        totalPatients: 45,
        totalWaiting: 23,
        totalServed: 22,
        activeQueues: 8,
        avgWaitTime: 12,
        completedToday: 22,
        activeClinics: 13,
        systemHealth: 98
      });

      setRecentActivity([
        { time: '10:30', event: 'Patient entered lab', type: 'info' },
        { time: '10:28', event: 'PIN regenerated for Internal Medicine', type: 'success' },
        { time: '10:25', event: 'Queue reset for Dental', type: 'warning' },
        { time: '10:20', event: 'New patient registered', type: 'info' }
      ]);

      setLoading(false);
    } catch (error) {
      console.error('[Dashboard] Error loading data:', error);
      setLoading(false);
    }
  };

  const checkServicesHealth = () => {
    // فحص حالة الخدمات
    const now = new Date();
    setServices({
      pinService: { status: 'active', lastCheck: now },
      queueManager: { status: 'active', lastCheck: now },
      routeService: { status: 'active', lastCheck: now },
      notificationService: { status: 'active', lastCheck: now },
      sse: { status: 'inactive', lastCheck: now }
    });
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
      sse: language === 'ar' ? 'الاتصال الحي' : 'SSE Connection'
    };
    return names[serviceName] || serviceName;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
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
            {language === 'ar' ? `مرحباً ${session?.name}` : `Welcome ${session?.name}`}
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg">
          <div className={`w-3 h-3 rounded-full ${stats.systemHealth > 90 ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`}></div>
          <span className="text-white font-semibold">{stats.systemHealth}%</span>
          <span className="text-gray-400 text-sm">
            {language === 'ar' ? 'صحة النظام' : 'System Health'}
          </span>
        </div>
      </div>

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
                <p className="text-4xl font-bold text-white mt-2">{stats.totalServed}</p>
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
                <p className="text-4xl font-bold text-white mt-2">{stats.avgWaitTime}m</p>
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
                  service.status === 'active' ? 'bg-green-500' : 'bg-red-500'
                } animate-pulse`}></div>
                <span className={`text-sm font-medium ${
                  service.status === 'active' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {service.status === 'active' 
                    ? (language === 'ar' ? 'نشط' : 'Active')
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
          {recentActivity.map((activity, index) => (
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
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdvancedDashboard;

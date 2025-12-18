import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
import {
  BarChart3,
  Users,
  Settings,
  FileText,
  LogOut,
  Clock,
  CheckCircle,
  Activity,
  RefreshCw,
  Globe,
  Shield,
  Database,
  Bell,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Home
} from 'lucide-react'
import { t } from '../lib/i18n'
import api from '../lib/api-unified'
import authService from '../lib/auth-service'

export function AdminPage({ onLogout, language, toggleLanguage, currentTheme, onThemeChange, systemHealth }) {
  console.log('[AdminPage] Component rendering...');
  
  const [session, setSession] = useState(() => authService.getSession())
  const [currentView, setCurrentView] = useState('dashboard')
  const [stats, setStats] = useState({
    totalPatients: 0,
    waitingPatients: 0,
    completedToday: 0,
    activeQueues: 0
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Load stats on mount
  useEffect(() => {
    loadStats()
    const interval = setInterval(loadStats, 60000)
    return () => clearInterval(interval)
  }, [])

  const loadStats = async () => {
    try {
      setLoading(true)
      const response = await api.getStats()
      if (response && response.data) {
        setStats(response.data)
      }
    } catch (err) {
      console.error('[AdminPage] Error loading stats:', err)
      setError('فشل في تحميل الإحصائيات')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    authService.logout()
    setSession(null)
    if (onLogout) onLogout()
  }

  const isRTL = language === 'ar'

  const menuItems = [
    { id: 'dashboard', icon: Home, label: isRTL ? 'لوحة التحكم' : 'Dashboard' },
    { id: 'patients', icon: Users, label: isRTL ? 'المرضى' : 'Patients' },
    { id: 'queues', icon: Clock, label: isRTL ? 'الطوابير' : 'Queues' },
    { id: 'reports', icon: FileText, label: isRTL ? 'التقارير' : 'Reports' },
    { id: 'settings', icon: Settings, label: isRTL ? 'الإعدادات' : 'Settings' },
  ]

  const statCards = [
    { 
      title: isRTL ? 'إجمالي المرضى' : 'Total Patients', 
      value: stats.totalPatients || 0, 
      icon: Users, 
      color: 'bg-blue-500' 
    },
    { 
      title: isRTL ? 'في الانتظار' : 'Waiting', 
      value: stats.waitingPatients || 0, 
      icon: Clock, 
      color: 'bg-yellow-500' 
    },
    { 
      title: isRTL ? 'مكتمل اليوم' : 'Completed Today', 
      value: stats.completedToday || 0, 
      icon: CheckCircle, 
      color: 'bg-green-500' 
    },
    { 
      title: isRTL ? 'الطوابير النشطة' : 'Active Queues', 
      value: stats.activeQueues || 0, 
      icon: Activity, 
      color: 'bg-purple-500' 
    },
  ]

  return (
    <div className={`min-h-screen bg-gray-900 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Shield className="w-8 h-8 text-blue-500" />
            <h1 className="text-xl font-bold text-white">
              {isRTL ? 'لوحة تحكم المسؤول' : 'Admin Dashboard'}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-2 px-3 py-2 bg-gray-700 rounded-lg text-gray-300 hover:bg-gray-600 transition-colors"
            >
              <Globe className="w-4 h-4" />
              {language === 'ar' ? 'English' : 'العربية'}
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 rounded-lg text-white hover:bg-red-700 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              {isRTL ? 'تسجيل الخروج' : 'Logout'}
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-800 min-h-[calc(100vh-73px)] border-r border-gray-700">
          <nav className="p-4 space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  currentView === item.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
              <AlertTriangle className="inline w-5 h-5 mr-2" />
              {error}
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {statCards.map((stat, index) => (
              <div key={index} className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-lg ${stat.color}`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                  {loading && <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />}
                </div>
                <h3 className="text-gray-400 text-sm mb-1">{stat.title}</h3>
                <p className="text-3xl font-bold text-white">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Content Area */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">
                {menuItems.find(m => m.id === currentView)?.label || 'Dashboard'}
              </h2>
              <button
                onClick={loadStats}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                {isRTL ? 'تحديث' : 'Refresh'}
              </button>
            </div>

            {currentView === 'dashboard' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* System Status */}
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Database className="w-5 h-5 text-green-500" />
                      {isRTL ? 'حالة النظام' : 'System Status'}
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">{isRTL ? 'قاعدة البيانات' : 'Database'}</span>
                        <span className="flex items-center gap-2 text-green-400">
                          <CheckCircle className="w-4 h-4" />
                          {isRTL ? 'متصل' : 'Connected'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">{isRTL ? 'الخادم' : 'Server'}</span>
                        <span className="flex items-center gap-2 text-green-400">
                          <CheckCircle className="w-4 h-4" />
                          {isRTL ? 'يعمل' : 'Running'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">{isRTL ? 'الإشعارات' : 'Notifications'}</span>
                        <span className="flex items-center gap-2 text-green-400">
                          <CheckCircle className="w-4 h-4" />
                          {isRTL ? 'نشط' : 'Active'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-blue-500" />
                      {isRTL ? 'إجراءات سريعة' : 'Quick Actions'}
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <button className="p-3 bg-blue-600 rounded-lg text-white hover:bg-blue-700 transition-colors">
                        {isRTL ? 'إضافة مريض' : 'Add Patient'}
                      </button>
                      <button className="p-3 bg-green-600 rounded-lg text-white hover:bg-green-700 transition-colors">
                        {isRTL ? 'تقرير جديد' : 'New Report'}
                      </button>
                      <button className="p-3 bg-purple-600 rounded-lg text-white hover:bg-purple-700 transition-colors">
                        {isRTL ? 'إدارة الطوابير' : 'Manage Queues'}
                      </button>
                      <button className="p-3 bg-yellow-600 rounded-lg text-white hover:bg-yellow-700 transition-colors">
                        {isRTL ? 'الإعدادات' : 'Settings'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Bell className="w-5 h-5 text-yellow-500" />
                    {isRTL ? 'النشاط الأخير' : 'Recent Activity'}
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-gray-600/50 rounded-lg">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-gray-300 flex-1">
                        {isRTL ? 'تم تسجيل مريض جديد' : 'New patient registered'}
                      </span>
                      <span className="text-gray-500 text-sm">
                        {isRTL ? 'منذ 5 دقائق' : '5 min ago'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-600/50 rounded-lg">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-gray-300 flex-1">
                        {isRTL ? 'تم تحديث الطابور' : 'Queue updated'}
                      </span>
                      <span className="text-gray-500 text-sm">
                        {isRTL ? 'منذ 10 دقائق' : '10 min ago'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-600/50 rounded-lg">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <span className="text-gray-300 flex-1">
                        {isRTL ? 'تم إنشاء تقرير' : 'Report generated'}
                      </span>
                      <span className="text-gray-500 text-sm">
                        {isRTL ? 'منذ 30 دقيقة' : '30 min ago'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentView === 'patients' && (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <h3 className="text-xl text-gray-300 mb-2">
                  {isRTL ? 'إدارة المرضى' : 'Patient Management'}
                </h3>
                <p className="text-gray-500">
                  {isRTL ? 'قريباً...' : 'Coming soon...'}
                </p>
              </div>
            )}

            {currentView === 'queues' && (
              <div className="text-center py-12">
                <Clock className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <h3 className="text-xl text-gray-300 mb-2">
                  {isRTL ? 'إدارة الطوابير' : 'Queue Management'}
                </h3>
                <p className="text-gray-500">
                  {isRTL ? 'قريباً...' : 'Coming soon...'}
                </p>
              </div>
            )}

            {currentView === 'reports' && (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <h3 className="text-xl text-gray-300 mb-2">
                  {isRTL ? 'التقارير' : 'Reports'}
                </h3>
                <p className="text-gray-500">
                  {isRTL ? 'قريباً...' : 'Coming soon...'}
                </p>
              </div>
            )}

            {currentView === 'settings' && (
              <div className="text-center py-12">
                <Settings className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <h3 className="text-xl text-gray-300 mb-2">
                  {isRTL ? 'الإعدادات' : 'Settings'}
                </h3>
                <p className="text-gray-500">
                  {isRTL ? 'قريباً...' : 'Coming soon...'}
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default AdminPage

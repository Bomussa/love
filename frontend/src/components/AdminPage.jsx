
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
import { AdminQueueMonitor } from './AdminQueueMonitor'
import { AdminPINMonitor } from './AdminPINMonitor'
import { ClinicsConfiguration } from './ClinicsConfiguration'

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
  const [selectedClinic, setSelectedClinic] = useState('INT')
  const [clinics, setClinics] = useState([])

  // Load stats & clinics on mount
  useEffect(() => {
    loadStats()
    loadClinics()
    const interval = setInterval(loadStats, 60000)
    return () => clearInterval(interval)
  }, [])

  const loadClinics = async () => {
      try {
          const res = await api.getClinics()
          if(res.success) setClinics(res.clinics)
      } catch(e) { console.error(e) }
  }

  const loadStats = async () => {
    try {
      setLoading(true)
      const response = await (api.getStats ? api.getStats() : api.getAdminStatus())
      if (response && (response.data || response.success)) {
        setStats(response.data || response)
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
    { id: 'queues', icon: Clock, label: isRTL ? 'مراقبة الطوابير' : 'Queue Monitor' },
    { id: 'pins', icon: Shield, label: isRTL ? 'إدارة الرموز (PIN)' : 'PIN Manager' },
    { id: 'settings', icon: Settings, label: isRTL ? 'إعدادات العيادات' : 'Clinic Settings' },
  ]

  const statCards = [
    { 
      title: isRTL ? 'إجمالي المرضى' : 'Total Patients', 
      value: stats.totalPatients || stats.totalToday || 0, 
      icon: Users, 
      color: 'bg-blue-500' 
    },
    { 
      title: isRTL ? 'في الانتظار' : 'Waiting', 
      value: stats.waitingPatients || stats.waiting || 0, 
      icon: Clock, 
      color: 'bg-yellow-500' 
    },
    { 
      title: isRTL ? 'مكتمل اليوم' : 'Completed Today', 
      value: stats.completedToday || stats.completed || 0, 
      icon: CheckCircle, 
      color: 'bg-green-500' 
    },
    { 
      title: isRTL ? 'الطوابير النشطة' : 'Active Queues', 
      value: stats.activeQueues || stats.activePins || 0, 
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
          {currentView === 'dashboard' && (
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
          )}

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
              <div className="text-center py-12 text-gray-400">
                {isRTL ? 'مرحباً بك في لوحة التحكم' : 'Welcome to Dashboard'}
              </div>
            )}

            {currentView === 'queues' && (
              <div className="space-y-4">
                  <div className="flex gap-4 mb-4">
                      <select 
                        className="bg-gray-700 text-white p-2 rounded"
                        value={selectedClinic}
                        onChange={(e) => setSelectedClinic(e.target.value)}
                      >
                          {clinics.map(c => <option key={c.id} value={c.id}>{isRTL ? c.name_ar : c.name_en}</option>)}
                      </select>
                  </div>
                  <AdminQueueMonitor clinicId={selectedClinic} autoRefresh={true} />
              </div>
            )}

            {currentView === 'pins' && (
              <div className="space-y-4">
                  <div className="flex gap-4 mb-4">
                      <select 
                        className="bg-gray-700 text-white p-2 rounded"
                        value={selectedClinic}
                        onChange={(e) => setSelectedClinic(e.target.value)}
                      >
                          {clinics.map(c => <option key={c.id} value={c.id}>{isRTL ? c.name_ar : c.name_en}</option>)}
                      </select>
                  </div>
                  <AdminPINMonitor clinicId={selectedClinic} autoRefresh={true} />
              </div>
            )}

            {currentView === 'settings' && (
              <ClinicsConfiguration />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default AdminPage

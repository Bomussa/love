
import React, { useState, useEffect } from 'react'
import {
  Users, Settings, FileText, LogOut, Clock, CheckCircle, Activity,
  RefreshCw, Globe, Shield, AlertTriangle, Home, Menu, X
} from 'lucide-react'
import { t } from '../lib/i18n'
import api from '../lib/api-unified'
import authService from '../lib/auth-service'
import { AdminQueueMonitor } from './AdminQueueMonitor'
import { AdminPINMonitor } from './AdminPINMonitor'
import { ClinicsConfiguration } from './ClinicsConfiguration'
import { EnhancedAdminDashboard } from './EnhancedAdminDashboard'
import { AdminReports } from './AdminReports'

export function AdminPage({ onLogout, language, toggleLanguage, currentTheme, onThemeChange, systemHealth }) {
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
  const [isSidebarOpen, setSidebarOpen] = useState(false) // Mobile Sidebar State

  const isRTL = language === 'ar'

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
      // console.error('[AdminPage] Error loading stats:', err)
      // setError('فشل في تحميل الإحصائيات') // Silent fail improved UI
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    authService.logout()
    setSession(null)
    if (onLogout) onLogout()
  }

  const menuItems = [
    { id: 'dashboard', icon: Home, label: isRTL ? 'لوحة التحكم' : 'Dashboard' },
    { id: 'enhanced', icon: Activity, label: isRTL ? 'لوحة التحكم المحسنة' : 'Enhanced Dashboard' },
    { id: 'queues', icon: Clock, label: isRTL ? 'إدارة الطوابير' : 'Queue Management' },
    { id: 'pins', icon: Shield, label: isRTL ? 'إدارة الأرقام السرية' : 'PIN Management' },
    { id: 'reports', icon: FileText, label: isRTL ? 'التقارير' : 'Reports' },
    { id: 'settings', icon: Settings, label: isRTL ? 'تكوين العيادات' : 'Clinic Configuration' },
  ]

  return (
    <div className={`min-h-screen bg-gray-900 ${isRTL ? 'rtl' : 'ltr'} flex flex-col`} dir={isRTL ? 'rtl' : 'ltr'}>
      
      {/* Mobile Header with Hamburger */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-3">
          <button 
            className="md:hidden text-white p-2 hover:bg-gray-700 rounded"
            onClick={() => setSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? <X /> : <Menu />}
          </button>
          <Shield className="w-6 h-6 text-blue-500" />
          <h1 className="text-lg font-bold text-white hidden sm:block">
            {isRTL ? 'لوحة الإدارة' : 'Admin'}
          </h1>
        </div>
        
        <div className="flex items-center gap-2">
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 rounded text-gray-300 text-sm hover:bg-gray-600"
            >
              <Globe className="w-4 h-4" />
              <span className="hidden sm:inline">{language === 'ar' ? 'EN' : 'AR'}</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-600/20 text-red-400 border border-red-600/50 rounded text-sm hover:bg-red-600/30"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{isRTL ? 'خروج' : 'Logout'}</span>
            </button>
        </div>
      </header>

      <div className="flex flex-1 relative">
        {/* Responsive Sidebar */}
        <aside className={`
            fixed inset-y-0 left-0 z-40 w-64 bg-gray-800 border-r border-gray-700 transform transition-transform duration-300 ease-in-out
            md:relative md:translate-x-0 md:top-0
            ${isSidebarOpen ? 'translate-x-0' : (isRTL ? 'translate-x-full' : '-translate-x-full')}
            ${isRTL ? 'right-0 left-auto border-l border-r-0' : ''}
        `}>
          <nav className="p-4 space-y-2 mt-16 md:mt-0">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                    setCurrentView(item.id)
                    setSidebarOpen(false)
                }}
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

        {/* Overlay for mobile sidebar */}
        {isSidebarOpen && (
            <div 
                className="fixed inset-0 bg-black/50 z-30 md:hidden"
                onClick={() => setSidebarOpen(false)}
            />
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden w-full">
          {error && (
            <div className="mb-4 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
              <AlertTriangle className="inline w-5 h-5 mr-2" />
              {error}
            </div>
          )}

          <div className="bg-gray-800 rounded-xl p-4 md:p-6 border border-gray-700 min-h-[500px]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
              <h2 className="text-xl font-bold text-white">
                {menuItems.find(m => m.id === currentView)?.label || 'Dashboard'}
              </h2>
              {/* Refresh Button */}
              <button
                onClick={loadStats}
                disabled={loading}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 rounded-lg text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                {isRTL ? 'تحديث' : 'Refresh'}
              </button>
            </div>

            {currentView === 'dashboard' && (
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Stat Cards */}
                  {[
                    { label: isRTL ? 'إجمالي المرضى' : 'Total Patients', value: stats.totalPatients || stats.totalToday || 0, icon: Users, color: 'bg-blue-500' },
                    { label: isRTL ? 'في الانتظار' : 'Waiting', value: stats.waitingPatients || stats.waiting || 0, icon: Clock, color: 'bg-yellow-500' },
                    { label: isRTL ? 'مكتمل' : 'Completed', value: stats.completedToday || stats.completed || 0, icon: CheckCircle, color: 'bg-green-500' },
                    { label: isRTL ? 'نشط' : 'Active', value: stats.activeQueues || stats.activePins || 0, icon: Activity, color: 'bg-purple-500' }
                  ].map((stat, idx) => (
                      <div key={idx} className="bg-gray-700 p-4 rounded-lg flex items-center justify-between">
                          <div>
                              <p className="text-gray-400 text-sm">{stat.label}</p>
                              <p className="text-2xl font-bold text-white">{stat.value}</p>
                          </div>
                          <div className={`p-3 rounded-full ${stat.color} bg-opacity-20`}>
                              <stat.icon className={`w-6 h-6 ${stat.color.replace('bg-', 'text-')}`} />
                          </div>
                      </div>
                  ))}
              </div>
            )}

            {currentView === 'queues' && (
              <div className="space-y-4">
                  <select 
                    className="w-full md:w-64 bg-gray-700 text-white p-2 rounded border border-gray-600"
                    value={selectedClinic}
                    onChange={(e) => setSelectedClinic(e.target.value)}
                  >
                      {clinics.map(c => <option key={c.id} value={c.id}>{isRTL ? c.name_ar : c.name_en}</option>)}
                  </select>
                  <AdminQueueMonitor clinicId={selectedClinic} autoRefresh={true} />
              </div>
            )}

            {currentView === 'pins' && (
              <div className="space-y-4">
                  <select 
                    className="w-full md:w-64 bg-gray-700 text-white p-2 rounded border border-gray-600"
                    value={selectedClinic}
                    onChange={(e) => setSelectedClinic(e.target.value)}
                  >
                      {clinics.map(c => <option key={c.id} value={c.id}>{isRTL ? c.name_ar : c.name_en}</option>)}
                  </select>
                  <AdminPINMonitor clinicId={selectedClinic} autoRefresh={true} />
              </div>
            )}

            {currentView === 'enhanced' && (
              <EnhancedAdminDashboard language={language} onLogout={handleLogout} />
            )}

            {currentView === 'reports' && (
              <AdminReports language={language} />
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

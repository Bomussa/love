import React, { useState, useEffect } from 'react'
import {
  Users, Settings, FileText, LogOut, Clock, CheckCircle, Activity,
  RefreshCw, Globe, Shield, AlertTriangle, Home, Menu, X, List
} from 'lucide-react'
import { t } from '../lib/i18n'
import api from '../lib/api-unified'
import authService from '../lib/auth-service'
import { AdminQueueMonitor } from './AdminQueueMonitor'
import { AdminPINMonitor } from './AdminPINMonitor'
import { ClinicsConfiguration } from './ClinicsConfiguration'
import { EnhancedAdminDashboard } from './EnhancedAdminDashboard'
import { AdminReports } from './AdminReports'
import { AdminPINList } from './AdminPINList'

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
  const [isSidebarOpen, setSidebarOpen] = useState(false)

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
      if (res.success) setClinics(res.clinics)
    } catch (e) {
      console.error(e)
    }
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
    { id: 'pins', icon: Shield, label: isRTL ? 'مراقبة PIN' : 'PIN Monitor' },
    { id: 'pinlist', icon: List, label: isRTL ? 'قائمة الأرقام السرية' : 'PIN List' },
    { id: 'reports', icon: FileText, label: isRTL ? 'التقارير' : 'Reports' },
    { id: 'settings', icon: Settings, label: isRTL ? 'تكوين العيادات' : 'Clinic Configuration' },
  ]

  return (
    <div className={`min-h-screen bg-gray-900 ${isRTL ? 'rtl' : 'ltr'} flex flex-col`} dir={isRTL ? 'rtl' : 'ltr'}>
      
      {/* Slim Mobile Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-2 sm:px-4 py-2 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-2">
          <button 
            className="md:hidden text-white p-1.5 hover:bg-gray-700 rounded"
            onClick={() => setSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <Shield className="w-5 h-5 text-blue-500" />
          <h1 className="text-base font-bold text-white hidden xs:block">
            {isRTL ? 'الإدارة' : 'Admin'}
          </h1>
        </div>
        
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1 px-2 py-1 bg-gray-700 rounded text-gray-300 text-xs hover:bg-gray-600"
          >
            <Globe size={14} />
            <span>{language === 'ar' ? 'EN' : 'AR'}</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 px-2 py-1 bg-red-600/20 text-red-400 border border-red-600/50 rounded text-xs hover:bg-red-600/30"
          >
            <LogOut size={14} />
            <span>{isRTL ? 'خروج' : 'Exit'}</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 relative overflow-hidden">
        {/* Sidebar */}
        <aside className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-gray-800 border-r border-gray-700 transform transition-transform duration-300 ease-in-out
          md:relative md:translate-x-0
          ${isSidebarOpen ? 'translate-x-0' : (isRTL ? 'translate-x-full' : '-translate-x-full')}
          ${isRTL ? 'right-0 left-auto border-l border-r-0' : ''}
        `}>
          <nav className="p-3 space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentView(item.id)
                  setSidebarOpen(false)
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                  currentView === item.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Overlay */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/60 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content - Reduced Padding for Mobile */}
        <main className="flex-1 p-2 sm:p-4 md:p-6 overflow-y-auto w-full bg-gray-900">
          {error && (
            <div className="mb-3 p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-200 text-sm">
              <AlertTriangle className="inline w-4 h-4 mr-2" />
              {error}
            </div>
          )}

          <div className="bg-gray-800 rounded-xl p-3 sm:p-5 md:p-6 border border-gray-700 shadow-xl min-h-full">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
              <h2 className="text-lg font-bold text-white border-b-2 border-blue-500 pb-0.5">
                {menuItems.find(m => m.id === currentView)?.label || 'Dashboard'}
              </h2>
              <button
                onClick={loadStats}
                disabled={loading}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-600 rounded-lg text-white text-sm hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 shadow-lg"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                {isRTL ? 'تحديث' : 'Refresh'}
              </button>
            </div>

            <div className="w-full">
              {currentView === 'dashboard' && (
                <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {[
                    { label: isRTL ? 'إجمالي المرضى' : 'Total Patients', value: stats.totalPatients || stats.totalToday || 0, icon: Users, color: 'bg-blue-500' },
                    { label: isRTL ? 'في الانتظار' : 'Waiting', value: stats.waitingPatients || stats.waiting || 0, icon: Clock, color: 'bg-yellow-500' },
                    { label: isRTL ? 'مكتمل' : 'Completed', value: stats.completedToday || stats.completed || 0, icon: CheckCircle, color: 'bg-green-500' },
                    { label: isRTL ? 'نشط' : 'Active', value: stats.activeQueues || stats.activePins || 0, icon: Activity, color: 'bg-purple-500' }
                  ].map((stat, idx) => (
                    <div key={idx} className="bg-gray-700/40 p-3 sm:p-4 rounded-xl flex items-center justify-between shadow-md border border-gray-600/30 hover:bg-gray-700/60 transition-colors">
                      <div className="min-w-0">
                        <p className="text-gray-400 text-[10px] sm:text-xs font-medium mb-0.5 truncate">{stat.label}</p>
                        <p className="text-xl sm:text-2xl font-black text-white">{stat.value}</p>
                      </div>
                      <div className={`p-2 sm:p-2.5 rounded-lg ${stat.color} bg-opacity-20 flex-shrink-0`}>
                        <stat.icon size={20} className={stat.color.replace('bg-', 'text-')} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {currentView === 'queues' && (
                <div className="space-y-3">
                  <select 
                    className="w-full md:w-64 bg-gray-700 text-white p-2 rounded border border-gray-600 text-sm"
                    value={selectedClinic}
                    onChange={(e) => setSelectedClinic(e.target.value)}
                  >
                    {clinics.map(c => <option key={c.id} value={c.id}>{isRTL ? c.name_ar : c.name_en}</option>)}
                  </select>
                  <AdminQueueMonitor clinicId={selectedClinic} autoRefresh={true} />
                </div>
              )}

              {currentView === 'pins' && (
                <div className="space-y-3">
                  <select 
                    className="w-full md:w-64 bg-gray-700 text-white p-2 rounded border border-gray-600 text-sm"
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

              {currentView === 'pinlist' && (
                <AdminPINList language={language} />
              )}

              {currentView === 'settings' && (
                <ClinicsConfiguration />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default AdminPage

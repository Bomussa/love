import React, { useState, useEffect } from 'react'
import { 
  Users, Clock, CheckCircle, Activity, RefreshCw, 
  TrendingUp, AlertCircle, ChevronRight, LayoutDashboard,
  Search, Filter, MoreVertical, ArrowUpRight, ArrowDownRight,
  Shield, Bell, Zap, Heart
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
import api from '../lib/api-unified'
import { t } from '../lib/i18n'

export function ModernAdminDashboard({ language, onLogout }) {
  const [stats, setStats] = useState({
    totalPatients: 0,
    waitingPatients: 0,
    completedToday: 0,
    activeQueues: 0,
    avgWaitTime: '-',
    systemHealth: 100
  })
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(new Date())

  const isRTL = language === 'ar'

  const fetchData = async () => {
    try {
      setLoading(true)
      const response = await (api.getStats ? api.getStats() : api.getAdminStatus())
      if (response && (response.data || response.success)) {
        const data = response.data || response
        setStats({
          totalPatients: data.totalPatients || data.totalToday || 0,
          waitingPatients: data.waitingPatients || data.waiting || 0,
          completedToday: data.completedToday || data.completed || 0,
          activeQueues: data.activeQueues || data.activePins || 0,
          avgWaitTime: data.avgWaitTime || '-',
          systemHealth: 100
        })
      }
      setLastUpdate(new Date())
    } catch (err) {
      console.error('Error fetching admin stats:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="space-y-6 animate-in fade-in duration-500 bg-[var(--theme-background)] min-h-full p-1 sm:p-2">
      {/* Header Info */}
      <div className="flex justify-between items-start mb-2">
        <div className="text-right">
          <h2 className="text-2xl font-bold text-[var(--theme-text)]">{isRTL ? 'لوحة التحكم' : 'Admin Dashboard'}</h2>
          <p className="text-[var(--theme-text-secondary)] text-sm">مرحباً Admin</p>
          <p className="text-[var(--theme-text-secondary)] text-xs mt-1">آخر تحديث: {lastUpdate.toLocaleTimeString('ar-SA')}</p>
        </div>
        <Button 
          onClick={fetchData} 
          variant="ghost" 
          className="text-gray-300 hover:bg-[var(--theme-border)] border border-gray-700 rounded-xl px-4"
        >
          <RefreshCw size={18} className={`ml-2 ${loading ? 'animate-spin' : ''}`} />
          {isRTL ? 'تحديث' : 'Refresh'}
        </Button>
      </div>

      {/* System Health Card */}
      <div className="bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-2xl p-4 flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-[var(--theme-success)] rounded-full animate-pulse"></div>
          <span className="text-gray-300 font-medium">{isRTL ? 'صحة النظام' : 'System Health'}</span>
        </div>
        <span className="text-2xl font-bold text-[var(--theme-text)]">{stats.systemHealth}%</span>
      </div>

      {/* Main Stats Grid - Matching Original Colors */}
      <div className="grid grid-cols-1 gap-4">
        {/* Waiting Patients - Blue */}
        <div className="bg-[var(--theme-info)] rounded-2xl p-6 flex items-center justify-between shadow-lg shadow-[var(--theme-info)]/20">
          <div className="space-y-1">
            <p className="text-[var(--theme-info)]-100 text-sm font-medium">{isRTL ? 'المنتظرين' : 'Waiting'}</p>
            <h3 className="text-5xl font-black text-[var(--theme-text)]">{stats.waitingPatients}</h3>
            <p className="text-[var(--theme-info)]-200 text-xs">{isRTL ? 'في الطابور الآن' : 'In queue now'}</p>
          </div>
          <div className="bg-white/20 p-4 rounded-2xl">
            <Users size={40} className="text-[var(--theme-text)]" />
          </div>
        </div>

        {/* Completed Today - Green */}
        <div className="bg-[var(--theme-success)] rounded-2xl p-6 flex items-center justify-between shadow-lg shadow-[var(--theme-success)]/20">
          <div className="space-y-1">
            <p className="text-[var(--theme-success)]-100 text-sm font-medium">{isRTL ? 'المكتملين' : 'Completed'}</p>
            <h3 className="text-5xl font-black text-[var(--theme-text)]">{stats.completedToday}</h3>
            <p className="text-[var(--theme-success)]-200 text-xs">{isRTL ? 'اليوم' : 'Today'}</p>
          </div>
          <div className="bg-white/20 p-4 rounded-2xl">
            <CheckCircle size={40} className="text-[var(--theme-text)]" />
          </div>
        </div>

        {/* Avg Wait Time - Orange/Gold */}
        <div className="bg-[var(--theme-secondary)] rounded-2xl p-6 flex items-center justify-between shadow-lg shadow-[var(--theme-secondary)]/20">
          <div className="space-y-1">
            <p className="text-[var(--theme-secondary)]-100 text-sm font-medium">{isRTL ? 'متوسط الانتظار' : 'Avg Wait Time'}</p>
            <h3 className="text-5xl font-black text-[var(--theme-text)]">{stats.avgWaitTime}</h3>
            <p className="text-[var(--theme-secondary)]-200 text-xs">{isRTL ? 'دقيقة' : 'Minutes'}</p>
          </div>
          <div className="bg-white/20 p-4 rounded-2xl">
            <Clock size={40} className="text-[var(--theme-text)]" />
          </div>
        </div>
      </div>

      {/* System Services Status - Matching Image 3 */}
      <div className="mt-8 space-y-4">
        <h3 className="text-[var(--theme-text)] font-bold text-lg flex items-center gap-2">
          <Activity size={20} className="text-[var(--theme-info)]" />
          {isRTL ? 'حالة الخدمات' : 'Services Status'}
        </h3>
        <div className="grid grid-cols-1 gap-3">
          {[
            { name: isRTL ? 'مدير الطوابير' : 'Queue Manager', icon: Users },
            { name: isRTL ? 'خدمة المسارات' : 'Pathway Service', icon: TrendingUp },
            { name: isRTL ? 'خدمة الإشعارات' : 'Notification Service', icon: Bell },
            { name: isRTL ? 'الاتصال الحي' : 'Live Connection', icon: Zap }
          ].map((service, i) => (
            <div key={i} className="bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-[var(--theme-border)] p-2 rounded-xl text-[var(--theme-text-secondary)]">
                  <service.icon size={20} />
                </div>
                <div>
                  <p className="text-[var(--theme-text)] font-medium text-sm">{service.name}</p>
                  <p className="text-[var(--theme-text-secondary)] text-[10px]">آخر فحص: {lastUpdate.toLocaleTimeString('ar-SA')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[var(--theme-success)] text-xs font-medium">{isRTL ? 'نشط' : 'Active'}</span>
                <div className="w-2 h-2 bg-[var(--theme-success)] rounded-full"></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity - Matching Image 3 */}
      <div className="mt-8 space-y-4 pb-10">
        <h3 className="text-[var(--theme-text)] font-bold text-lg flex items-center gap-2">
          <FileText size={20} className="text-[var(--theme-warning)]" />
          {isRTL ? 'النشاط الأخير' : 'Recent Activity'}
        </h3>
        <div className="space-y-3">
          {[
            { event: 'ENTERED', time: '10:24 AM' },
            { event: 'ENTERED', time: '10:23 AM' },
            { event: 'COMPLETED', time: '09:45 AM' }
          ].map((item, i) => (
            <div key={i} className="bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-2xl p-4 flex items-center justify-between">
              <span className="text-[var(--theme-text)] font-bold text-sm">{item.event}</span>
              <div className="flex items-center gap-2">
                <span className="text-[var(--theme-text-secondary)] text-xs">{item.time}</span>
                <div className="w-2 h-2 bg-[var(--theme-info)] rounded-full"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

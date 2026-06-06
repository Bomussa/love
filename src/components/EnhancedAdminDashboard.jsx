import React, { useState, useEffect, useCallback } from 'react'
  import {
    Activity, Users, Clock, TrendingUp,
    AlertCircle, BarChart3, RefreshCw,
    Eye, Filter
  } from 'lucide-react'
  import { supabase } from '../lib/supabase-client'
  import AdminQueueMonitor from './AdminQueueMonitor'

  import { AdminQrManager } from './AdminQrManager'

  /**
   * EnhancedAdminDashboard - لوحة التحكم المحسّنة
   * ✅ جميع البيانات من Supabase مباشرة - لا fallback وهمي
   * ✅ تحديث لحظي عبر Realtime
   */
  export function EnhancedAdminDashboard({ language, onLogout }) {
    const [stats, setStats] = useState(null)
    const [clinics, setClinics] = useState([])
    const [queue, setQueue] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [lastUpdate, setLastUpdate] = useState(new Date())
    const [activeView, setActiveView] = useState('dashboard')

    const t = (ar, en) => language === 'ar' ? ar : (en || ar)

    const fetchStats = useCallback(async () => {
      const today = new Date().toISOString().split('T')[0]
      const { data, error: err } = await supabase
        .from('unified_queue')
        .select('status, clinic_id')
        .eq('queue_date', today)
      if (err) throw err

      const totalWaiting  = data.filter(q => q.status === 'waiting').length
      const totalCalled   = data.filter(q => q.status === 'called').length
      const totalDone     = data.filter(q => q.status === 'done' || q.status === 'completed').length
      const activeQueues  = new Set(data.filter(q => q.status !== 'done' && q.status !== 'completed').map(q => q.clinic_id)).size

      return { totalWaiting, totalCalled, completedToday: totalDone, activeQueues }
    }, [])

    const fetchClinics = useCallback(async () => {
      const { data, error: err } = await supabase
        .from('clinics')
        .select('id, name_ar, name_en, is_active')
        .order('name_ar')
      if (err) throw err
      return data || []
    }, [])

    const fetchQueue = useCallback(async () => {
      const today = new Date().toISOString().split('T')[0]
      const { data, error: err } = await supabase
        .from('unified_queue')
        .select('id, display_number, status, patient_id, clinic_id, created_at, patients(name, military_id), clinics(name_ar, name_en)')
        .eq('queue_date', today)
        .in('status', ['waiting', 'called'])
        .order('display_number', { ascending: true })
        .limit(30)
      if (err) throw err
      return data || []
    }, [])

    const fetchData = useCallback(async () => {
      try {
        setLoading(true)
        setError(null)
        const [statsData, clinicsData, queueData] = await Promise.all([
          fetchStats(), fetchClinics(), fetchQueue()
        ])
        setStats(statsData)
        setClinics(clinicsData)
        setQueue(queueData)
        setLastUpdate(new Date())
      } catch (err) {
        setError(err.message || t('خطأ في جلب البيانات', 'Data fetch error'))
      } finally {
        setLoading(false)
      }
    }, [fetchStats, fetchClinics, fetchQueue])

    useEffect(() => {
      fetchData()
      const channel = supabase.channel('enhanced_admin_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'unified_queue' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'clinics' }, () => fetchClinics().then(setClinics))
        .subscribe()
      return () => supabase.removeChannel(channel)
    }, [])

    const getStatusText = (status) => {
      const map = { queued: t('في الانتظار', 'Waiting'), waiting: t('في الانتظار', 'Waiting'), called: t('مستدعى', 'Called'), started: t('جارٍ الفحص', 'In Progress'), completed: t('مكتمل', 'Completed'), done: t('مكتمل', 'Completed') }
      return map[status] || status
    }

    const getStatusColor = (status) => {
      const map = { waiting: 'bg-blue-100 text-blue-800', queued: 'bg-blue-100 text-blue-800', called: 'bg-yellow-100 text-yellow-800', started: 'bg-green-100 text-green-800', completed: 'bg-gray-100 text-gray-600', done: 'bg-gray-100 text-gray-600' }
      return map[status] || 'bg-gray-100 text-gray-600'
    }

    if (loading && !stats) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">{t('جاري تحميل البيانات من Supabase...', 'Loading from Supabase...')}</p>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-gray-50 p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <div className="max-w-7xl mx-auto">

          {/* Error Banner */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <p className="text-red-800 flex-1">{error}</p>
              <button onClick={fetchData} className="px-3 py-1 border border-red-300 rounded text-red-700 hover:bg-red-100 text-sm flex items-center gap-1">
                <RefreshCw className="h-3 w-3" /> {t('إعادة المحاولة', 'Retry')}
              </button>
            </div>
          )}

          {/* Header */}
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">{t('لوحة التحكم الإدارية', 'Admin Dashboard')}</h1>
              <p className="text-gray-500 text-sm">{t('آخر تحديث:', 'Last update:')} {lastUpdate.toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}</p>
            </div>
            <button onClick={fetchData} disabled={loading} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {t('تحديث', 'Refresh')}
            </button>
          </div>

          {/* View Tabs */}
          <div className="flex gap-2 mb-6 border-b border-gray-200">
            {[
              { id: 'dashboard', label: t('الإحصائيات', 'Statistics') },
              { id: 'queue', label: t('الطابور', 'Queue') },
              { id: 'qr', label: t('QR Manager', 'QR Manager') },
            ].map(v => (
              <button key={v.id} onClick={() => setActiveView(v.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeView === v.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {v.label}
              </button>
            ))}
          </div>

          {activeView === 'dashboard' && stats && (
            <>
              {/* Stats Cards - Real Data Only */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                  { label: t('في الانتظار', 'Waiting'), value: stats.totalWaiting, icon: Clock, color: 'text-blue-600 bg-blue-50 border-blue-200' },
                  { label: t('مستدعون', 'Called'), value: stats.totalCalled, icon: Users, color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
                  { label: t('مكتملون اليوم', 'Completed Today'), value: stats.completedToday, icon: Activity, color: 'text-green-600 bg-green-50 border-green-200' },
                  { label: t('عيادات نشطة', 'Active Clinics'), value: stats.activeQueues, icon: TrendingUp, color: 'text-purple-600 bg-purple-50 border-purple-200' },
                ].map((s, i) => (
                  <div key={i} className={`p-4 rounded-xl border ${s.color}`}>
                    <div className="flex justify-between items-start mb-2">
                      <s.icon className="h-5 w-5" />
                      <span className="text-2xl font-bold">{s.value}</span>
                    </div>
                    <p className="text-sm font-medium">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Clinics Status */}
              {clinics.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">{t('حالة العيادات', 'Clinics Status')}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {clinics.map(clinic => (
                      <div key={clinic.id} className={`p-3 rounded-lg border ${clinic.is_active ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-sm">{language === 'ar' ? clinic.name_ar : clinic.name_en}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${clinic.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {clinic.is_active ? t('مفتوح', 'Open') : t('مغلق', 'Closed')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {activeView === 'queue' && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-900">{t('طابور اليوم النشط', 'Today Active Queue')}</h2>
                <span className="text-sm text-gray-500">{queue.length} {t('مراجع', 'patients')}</span>
              </div>
              {queue.length === 0 ? (
                <div className="p-10 text-center text-gray-400">
                  {t('لا يوجد طابور نشط حالياً', 'No active queue currently')}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-right text-gray-500 font-medium">#</th>
                        <th className="px-4 py-3 text-right text-gray-500 font-medium">{t('المراجع', 'Patient')}</th>
                        <th className="px-4 py-3 text-right text-gray-500 font-medium">{t('العيادة', 'Clinic')}</th>
                        <th className="px-4 py-3 text-right text-gray-500 font-medium">{t('الحالة', 'Status')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {queue.map(q => (
                        <tr key={q.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-bold text-blue-600">#{q.display_number}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{q.patients?.name || t('غير معروف', 'Unknown')}</div>
                            <div className="text-xs text-gray-400 font-mono">{q.patients?.military_id || q.patient_id}</div>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{language === 'ar' ? q.clinics?.name_ar : q.clinics?.name_en}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(q.status)}`}>{getStatusText(q.status)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeView === 'qr' && <AdminQrManager language={language} />}
        </div>
      </div>
    )
  }

  export default EnhancedAdminDashboard
  
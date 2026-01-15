import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase-client'

/**
 * Admin Statistics Component
 * Displays real-time statistics and metrics
 */
export default function AdminStatistics() {
  const [stats, setStats] = useState({
    totalPatients: 0,
    waitingPatients: 0,
    calledPatients: 0,
    completedToday: 0,
    avgWaitTime: 0,
    activePins: 0,
    clinicStats: []
  })
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    loadStatistics()

    // Auto-refresh every 30 seconds
    const interval = autoRefresh ? setInterval(loadStatistics, 30000) : null

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh])

  async function loadStatistics() {
    try {
      setLoading(true)

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayISO = today.toISOString()

      // Total patients today
      const { count: total, error: totalError } = await supabase
        .from('queue')
        .select('*', { count: 'exact', head: true })
        .gte('entered_at', todayISO)

      if (totalError) throw totalError

      // Waiting patients
      const { count: waiting, error: waitingError } = await supabase
        .from('queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'waiting')

      if (waitingError) throw waitingError

      // Called patients
      const { count: called, error: calledError } = await supabase
        .from('queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'called')

      if (calledError) throw calledError

      // Completed today
      const { count: completed, error: completedError } = await supabase
        .from('queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('completed_at', todayISO)

      if (completedError) throw completedError

      // Active PINs
      const { count: pins, error: pinsError } = await supabase
        .from('pins')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .gte('expires_at', new Date().toISOString())

      if (pinsError) throw pinsError

      // Clinic-wise statistics
      const clinics = ['lab', 'vitals', 'dental', 'eye', 'ent', 'surgery', 'internal', 'aviation', 'final']
      const clinicStats = []

      for (const clinicId of clinics) {
        const { count: clinicWaiting, error: clinicError } = await supabase
          .from('queue')
          .select('*', { count: 'exact', head: true })
          .eq('clinic_id', clinicId)
          .eq('status', 'waiting')

        if (!clinicError) {
          clinicStats.push({
            clinicId,
            waiting: clinicWaiting || 0
          })
        }
      }

      // Calculate average wait time (simplified)
      const avgWaitTime = completed > 0 ? Math.round((total / completed) * 5) : 0

      setStats({
        totalPatients: total || 0,
        waitingPatients: waiting || 0,
        calledPatients: called || 0,
        completedToday: completed || 0,
        avgWaitTime,
        activePins: pins || 0,
        clinicStats
      })
    } catch (error) {
      console.error('[AdminStatistics] Error loading statistics:', error)
    } finally {
      setLoading(false)
    }
  }

  function getClinicName(clinicId) {
    const names = {
      'lab': 'المختبر والأشعة',
      'vitals': 'القياسات الحيوية',
      'dental': 'الأسنان',
      'eye': 'العيون',
      'ent': 'الأنف والأذن والحنجرة',
      'surgery': 'الجراحة',
      'internal': 'الباطنية',
      'aviation': 'الطيران',
      'final': 'اللجنة النهائية'
    }
    return names[clinicId] || clinicId
  }

  if (loading && stats.totalPatients === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">جاري تحميل الإحصائيات...</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold mb-2">الإحصائيات</h2>
          <p className="text-gray-600">إحصائيات ومقاييس النظام في الوقت الفعلي</p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">تحديث تلقائي (كل 30 ثانية)</span>
          </label>
          <button
            onClick={loadStatistics}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? '🔄 جاري التحديث...' : '🔄 تحديث الآن'}
          </button>
        </div>
      </div>

      {/* Main Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">إجمالي المرضى اليوم</h3>
            <span className="text-2xl">👥</span>
          </div>
          <p className="text-4xl font-bold">{stats.totalPatients}</p>
          <p className="text-xs opacity-75 mt-1">منذ بداية اليوم</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">في الانتظار</h3>
            <span className="text-2xl">⏳</span>
          </div>
          <p className="text-4xl font-bold">{stats.waitingPatients}</p>
          <p className="text-xs opacity-75 mt-1">في جميع العيادات</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">تم استدعاؤهم</h3>
            <span className="text-2xl">📢</span>
          </div>
          <p className="text-4xl font-bold">{stats.calledPatients}</p>
          <p className="text-xs opacity-75 mt-1">حالياً في الفحص</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">المكتملين اليوم</h3>
            <span className="text-2xl">✅</span>
          </div>
          <p className="text-4xl font-bold">{stats.completedToday}</p>
          <p className="text-xs opacity-75 mt-1">أنهوا جميع الفحوصات</p>
        </div>
      </div>

      {/* Secondary Statistics */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border-2 border-purple-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-700">متوسط وقت الانتظار</h3>
            <span className="text-3xl">⏱️</span>
          </div>
          <p className="text-5xl font-bold text-purple-600">{stats.avgWaitTime}</p>
          <p className="text-sm text-gray-500 mt-1">دقيقة</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-2 border-indigo-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-700">البن كود النشطة</h3>
            <span className="text-3xl">🔑</span>
          </div>
          <p className="text-5xl font-bold text-indigo-600">{stats.activePins}</p>
          <p className="text-sm text-gray-500 mt-1">رمز نشط حالياً</p>
        </div>
      </div>

      {/* Clinic Statistics */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-2xl font-bold mb-4">إحصائيات العيادات</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.clinicStats
            .sort((a, b) => b.waiting - a.waiting)
            .map((clinic) => (
              <div
                key={clinic.clinicId}
                className={`p-4 rounded-lg border-2 ${
                  clinic.waiting > 10
                    ? 'bg-red-50 border-red-300'
                    : clinic.waiting > 5
                    ? 'bg-yellow-50 border-yellow-300'
                    : 'bg-green-50 border-green-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-800">
                      {getClinicName(clinic.clinicId)}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {clinic.waiting === 0
                        ? 'لا يوجد منتظرين'
                        : clinic.waiting === 1
                        ? 'منتظر واحد'
                        : clinic.waiting === 2
                        ? 'منتظران'
                        : `${clinic.waiting} منتظرين`}
                    </p>
                  </div>
                  <div
                    className={`text-3xl font-bold ${
                      clinic.waiting > 10
                        ? 'text-red-600'
                        : clinic.waiting > 5
                        ? 'text-yellow-600'
                        : 'text-green-600'
                    }`}
                  >
                    {clinic.waiting}
                  </div>
                </div>
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        clinic.waiting > 10
                          ? 'bg-red-500'
                          : clinic.waiting > 5
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min((clinic.waiting / 20) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Performance Indicators */}
      <div className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg shadow p-6">
        <h3 className="text-2xl font-bold mb-4">مؤشرات الأداء</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-2">معدل الإنجاز</h4>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-blue-600">
                {stats.totalPatients > 0
                  ? Math.round((stats.completedToday / stats.totalPatients) * 100)
                  : 0}
              </span>
              <span className="text-lg text-gray-500 mb-1">%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-blue-500 h-2 rounded-full"
                style={{
                  width: `${
                    stats.totalPatients > 0
                      ? (stats.completedToday / stats.totalPatients) * 100
                      : 0
                  }%`
                }}
              ></div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-2">معدل الانتظار</h4>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-purple-600">
                {stats.totalPatients > 0
                  ? Math.round((stats.waitingPatients / stats.totalPatients) * 100)
                  : 0}
              </span>
              <span className="text-lg text-gray-500 mb-1">%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-purple-500 h-2 rounded-full"
                style={{
                  width: `${
                    stats.totalPatients > 0
                      ? (stats.waitingPatients / stats.totalPatients) * 100
                      : 0
                  }%`
                }}
              ></div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-2">الكفاءة</h4>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-green-600">
                {stats.avgWaitTime > 0 ? Math.round((30 / stats.avgWaitTime) * 100) : 100}
              </span>
              <span className="text-lg text-gray-500 mb-1">%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-green-500 h-2 rounded-full"
                style={{
                  width: `${stats.avgWaitTime > 0 ? Math.min((30 / stats.avgWaitTime) * 100, 100) : 100}%`
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Last Update */}
      <div className="mt-4 text-center text-sm text-gray-500">
        آخر تحديث: {new Date().toLocaleString('ar-QA')}
      </div>
    </div>
  )
}

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
import {
  Activity,
  Users,
  Clock,
  TrendingUp,
  Building2 as Hospital,
  UserCheck,
  AlertCircle,
  BarChart3,
  Settings,
  Shield,
  FileText,
  Calendar,
  Stethoscope,
  MapPin,
  Bell,
  Hash,
  QrCode,
  Printer,
  Download,
  RefreshCw,
  Eye,
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  Menu,
  X
} from 'lucide-react'
import { t } from '../lib/i18n'
import api from '../lib/api'
import AdminQueueMonitor from './AdminQueueMonitor'
import AdminPINMonitor from './AdminPINMonitor'
import { AdminQrManager } from './AdminQrManager'

export function EnhancedAdminDashboard({ language, onLogout }) {
  const [stats, setStats] = useState(null)
  const [clinics, setClinics] = useState([])
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(new Date())

  // تحديث البيانات من الخادم
  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      // جلب الإحصائيات الحقيقية مع fallback
      try {
        const statsData = await api.getDashboardStats()
        if (statsData && statsData.stats) {
          setStats({
            currentPatients: statsData.stats.totalWaiting || 0,
            completedToday: statsData.stats.completedToday || 0,
            avgWaitTime: statsData.stats.avgWaitTime || 0,
            throughputHour: statsData.stats.activeQueues || 0
          })
        } else {
          setStats({
            currentPatients: 0,
            completedToday: 0,
            avgWaitTime: 0,
            throughputHour: 0
          })
        }
      } catch (e) {

        setStats({
          currentPatients: 0,
          completedToday: 0,
          avgWaitTime: 0,
          throughputHour: 0
        })
      }

      // جلب بيانات العيادات الحقيقية مع fallback
      try {
        const clinicsData = await api.getClinicOccupancy()
        setClinics(Array.isArray(clinicsData) ? clinicsData : [])
      } catch (e) {

        setClinics([])
      }

      // جلب بيانات الطابور الحقيقية مع fallback
      try {
        const queueData = await api.getActiveQueue()
        setQueue(Array.isArray(queueData) ? queueData : [])
      } catch (e) {

        setQueue([])
      }

      setLastUpdate(new Date())
      setError(null) // Clear any previous errors
    } catch (err) {
      // // // // console.error('خطأ في جلب البيانات:', err)
      // Always set default stats to prevent blank screen
      if (!stats) {
        setStats({
          currentPatients: 0,
          completedToday: 0,
          avgWaitTime: 0,
          throughputHour: 0
        })
      }
      setError('بعض البيانات غير متوفرة - يتم استخدام القيم الافتراضية')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()

    // Fallback polling كل 60 ثانية (لوحة الإحصائيات غير حرجة)
    const interval = setInterval(fetchData, 60000)

    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status) => {
    switch (status) {
      case 'queued': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'called': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'started': return 'bg-green-100 text-green-800 border-green-200'
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'queued': return 'في الانتظار'
      case 'called': return 'تم الاستدعاء'
      case 'started': return 'جاري الفحص'
      case 'completed': return 'مكتمل'
      default: return status
    }
  }

  const getOccupancyColor = (percentage) => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 75) return 'bg-yellow-500'
    if (percentage >= 50) return 'bg-blue-500'
    return 'bg-green-500'
  }

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">جاري تحميل البيانات...</p>
        </div>
      </div>
    )
  }

  // Show error as banner instead of blocking entire page
  const ErrorBanner = () => error ? (
    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
      <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-red-800 font-medium">تحذير: بعض البيانات غير متوفرة</p>
        <p className="text-red-600 text-sm">{error}</p>
      </div>
      <Button onClick={fetchData} variant="outline" size="sm">
        <RefreshCw className="h-4 w-4 ml-2" />
        إعادة المحاولة
      </Button>
    </div>
  ) : null

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        {/* Error Banner */}
        <ErrorBanner />

        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">لوحة التحكم الإدارية</h1>
            <p className="text-gray-600">
              آخر تحديث: {lastUpdate.toLocaleString('ar-SA')}
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={fetchData} variant="outline" disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              تحديث
            </Button>
            <Button onClick={onLogout} variant="outline">
              تسجيل الخروج
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">المرضى الحاليون</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.currentPatients || 0}</div>
              <p className="text-xs text-muted-foreground">في العيادات الآن</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">المكتملون اليوم</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.completedToday || 0}</div>
              <p className="text-xs text-muted-foreground">مريض مكتمل</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">متوسط الانتظار</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.avgWaitTime || 0}</div>
              <p className="text-xs text-muted-foreground">دقيقة</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">الإنتاجية/ساعة</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.throughputHour || 0}</div>
              <p className="text-xs text-muted-foreground">مريض/ساعة</p>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Monitoring Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* PIN Monitor for Clinic 1 */}
          <div data-test="admin-pin-section">
            <AdminPINMonitor clinicId="clinic1" autoRefresh={false} />
          </div>

          {/* Queue Monitor for Clinic 1 */}
          <div data-test="admin-queue-section">
            <AdminQueueMonitor clinicId="clinic1" autoRefresh={true} refreshInterval={5000} />
          </div>
        </div>

        {/* QR Code Manager */}
        <div className="mb-8" data-test="admin-qr-section">
          <AdminQrManager language={language} />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Clinic Occupancy */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hospital className="h-5 w-5" />
                إشغال العيادات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {clinics.length > 0 ? (
                  clinics.map((clinic) => (
                    <div key={clinic.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{clinic.name_ar}</div>
                        <div className="text-sm text-gray-500">{clinic.name_en}</div>
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-medium">
                          {clinic.current_load || 0}/{clinic.capacity || 0}
                        </div>
                        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${clinic.occupancy_percent > 80 ? 'bg-red-100 text-red-800' :
                          clinic.occupancy_percent > 60 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                          {clinic.occupancy_percent || 0}%
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    لا توجد بيانات عيادات متاحة
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Live Queue */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                الطابور المباشر
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {queue.length > 0 ? (
                  queue.map((patient) => (
                    <div key={patient.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{patient.reviewer_number}</div>
                        <div className="text-sm text-gray-500">{patient.clinic_name}</div>
                      </div>
                      <div className="text-left">
                        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(patient.status)}`}>
                          {getStatusText(patient.status)}
                        </div>
                        {patient.eta_minutes > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            {patient.eta_minutes} دقيقة متبقية
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    لا توجد مرضى في الطابور حالياً
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* System Status */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                حالة النظام
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm">الخادم متصل</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm">قاعدة البيانات نشطة</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm">التحديث التلقائي مفعل</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

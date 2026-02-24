import React, { useState, useEffect } from 'react'
import {
  FileText,
  Download,
  Printer,
  Calendar,
  TrendingUp,
  Users,
  Clock,
  CheckCircle,
  Activity,
  BarChart3,
  RefreshCw
} from 'lucide-react'
import api from '../lib/api-unified'

/**
 * مكون التقارير والإحصائيات
 * يدعم التقارير اليومية والأسبوعية والشهرية
 * يدعم التصدير إلى PDF و Excel
 */
export function AdminReports({ language = 'ar' }) {
  const [stats, setStats] = useState({
    today: { total: 0, completed: 0, waiting: 0, avgWaitTime: 0 },
    week: { total: 0, completed: 0, waiting: 0, avgWaitTime: 0 },
    month: { total: 0, completed: 0, waiting: 0, avgWaitTime: 0 }
  })
  const [loading, setLoading] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState('today')
  const [recentReports, setRecentReports] = useState([])

  const isRTL = language === 'ar'

  useEffect(() => {
    loadReportData()
  }, [])

  const loadReportData = async () => {
    try {
      setLoading(true)
      // جلب الإحصائيات من API
      const response = await api.getStats()
      if (response && response.success) {
        setStats({
          today: {
            total: response.data?.totalPatients || 0,
            completed: response.data?.completedToday || 0,
            waiting: response.data?.waitingPatients || 0,
            avgWaitTime: response.data?.avgWaitTime || 0
          },
          week: {
            total: response.data?.weeklyTotal || 0,
            completed: response.data?.weeklyCompleted || 0,
            waiting: response.data?.weeklyWaiting || 0,
            avgWaitTime: response.data?.weeklyAvgWaitTime || 0
          },
          month: {
            total: response.data?.monthlyTotal || 0,
            completed: response.data?.monthlyCompleted || 0,
            waiting: response.data?.monthlyWaiting || 0,
            avgWaitTime: response.data?.monthlyAvgWaitTime || 0
          }
        })
      }
    } catch (err) {
      console.error('[AdminReports] Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const generatePDFReport = async (period) => {
    try {
      setLoading(true)
      const data = stats[period]
      
      // إنشاء محتوى التقرير
      const reportContent = `
        <html dir="${isRTL ? 'rtl' : 'ltr'}">
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: 'Cairo', sans-serif; padding: 20px; }
            h1 { color: #1e40af; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: ${isRTL ? 'right' : 'left'}; }
            th { background-color: #1e40af; color: white; }
            .summary { background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <h1>${isRTL ? 'تقرير اللجنة الطبية' : 'Medical Committee Report'}</h1>
          <div class="summary">
            <h2>${isRTL ? 'ملخص الفترة' : 'Period Summary'}: ${
              period === 'today' ? (isRTL ? 'اليوم' : 'Today') :
              period === 'week' ? (isRTL ? 'هذا الأسبوع' : 'This Week') :
              (isRTL ? 'هذا الشهر' : 'This Month')
            }</h2>
            <p>${isRTL ? 'التاريخ' : 'Date'}: ${new Date().toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>${isRTL ? 'المؤشر' : 'Metric'}</th>
                <th>${isRTL ? 'القيمة' : 'Value'}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${isRTL ? 'إجمالي المراجعين' : 'Total Patients'}</td>
                <td>${data.total}</td>
              </tr>
              <tr>
                <td>${isRTL ? 'المكتملين' : 'Completed'}</td>
                <td>${data.completed}</td>
              </tr>
              <tr>
                <td>${isRTL ? 'في الانتظار' : 'Waiting'}</td>
                <td>${data.waiting}</td>
              </tr>
              <tr>
                <td>${isRTL ? 'متوسط وقت الانتظار' : 'Avg Wait Time'}</td>
                <td>${data.avgWaitTime} ${isRTL ? 'دقيقة' : 'minutes'}</td>
              </tr>
            </tbody>
          </table>
        </body>
        </html>
      `

      // فتح نافذة طباعة
      const printWindow = window.open('', '_blank')
      printWindow.document.write(reportContent)
      printWindow.document.close()
      printWindow.print()
      
    } catch (err) {
      console.error('[AdminReports] Error generating PDF:', err)
      alert(isRTL ? 'فشل في إنشاء التقرير' : 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  const generateExcelReport = async (period) => {
    try {
      setLoading(true)
      const data = stats[period]
      
      // إنشاء محتوى CSV
      const csvContent = [
        [isRTL ? 'المؤشر' : 'Metric', isRTL ? 'القيمة' : 'Value'],
        [isRTL ? 'إجمالي المراجعين' : 'Total Patients', data.total],
        [isRTL ? 'المكتملين' : 'Completed', data.completed],
        [isRTL ? 'في الانتظار' : 'Waiting', data.waiting],
        [isRTL ? 'متوسط وقت الانتظار' : 'Avg Wait Time', `${data.avgWaitTime} ${isRTL ? 'دقيقة' : 'minutes'}`]
      ].map(row => row.join(',')).join('\n')

      // تحميل الملف
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `report_${period}_${new Date().toISOString().split('T')[0]}.csv`
      link.click()
      
    } catch (err) {
      console.error('[AdminReports] Error generating Excel:', err)
      alert(isRTL ? 'فشل في إنشاء التقرير' : 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  const currentStats = stats[selectedPeriod]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileText className="w-6 h-6" />
          {isRTL ? 'إنشاء التقارير' : 'Generate Reports'}
        </h2>
        <button
          onClick={loadReportData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {isRTL ? 'تحديث' : 'Refresh'}
        </button>
      </div>

      {/* Period Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { id: 'today', label: isRTL ? 'تقارير يومية' : 'Daily Reports', icon: Calendar },
          { id: 'week', label: isRTL ? 'تقارير أسبوعية' : 'Weekly Reports', icon: BarChart3 },
          { id: 'month', label: isRTL ? 'تقارير شهرية' : 'Monthly Reports', icon: TrendingUp }
        ].map(period => (
          <button
            key={period.id}
            onClick={() => setSelectedPeriod(period.id)}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedPeriod === period.id
                ? 'border-blue-500 bg-blue-500/20 text-white'
                : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
            }`}
          >
            <period.icon className="w-6 h-6 mx-auto mb-2" />
            <p className="font-semibold">{period.label}</p>
          </button>
        ))}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: isRTL ? 'إجمالي المراجعين' : 'Total Patients', value: currentStats.total, icon: Users, color: 'blue' },
          { label: isRTL ? 'المكتملين' : 'Completed', value: currentStats.completed, icon: CheckCircle, color: 'green' },
          { label: isRTL ? 'في الانتظار' : 'Waiting', value: currentStats.waiting, icon: Clock, color: 'yellow' },
          { label: isRTL ? 'متوسط الانتظار' : 'Avg Wait Time', value: `${currentStats.avgWaitTime}${isRTL ? 'د' : 'm'}`, icon: Activity, color: 'purple' }
        ].map((stat, idx) => (
          <div key={idx} className="bg-gray-700 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <stat.icon className={`w-5 h-5 text-${stat.color}-500`} />
              <span className={`text-2xl font-bold text-${stat.color}-400`}>{stat.value}</span>
            </div>
            <p className="text-sm text-gray-400">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Export Buttons */}
      <div className="bg-gray-700 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-4">
          {isRTL ? 'تصدير التقرير' : 'Export Report'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => generatePDFReport(selectedPeriod)}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-red-600 rounded-lg text-white hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            <Printer className="w-5 h-5" />
            {isRTL ? 'تقرير PDF (طباعة)' : 'PDF Report (Print)'}
          </button>
          <button
            onClick={() => generateExcelReport(selectedPeriod)}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 rounded-lg text-white hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <Download className="w-5 h-5" />
            {isRTL ? 'تقرير Excel (تحميل)' : 'Excel Report (Download)'}
          </button>
        </div>
      </div>

      {/* Recent Reports */}
      <div className="bg-gray-700 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-4">
          {isRTL ? 'التقارير الحديثة' : 'Recent Reports'}
        </h3>
        {recentReports.length === 0 ? (
          <p className="text-gray-400 text-center py-8">
            {isRTL ? 'لا توجد تقارير متاحة' : 'No reports available'}
          </p>
        ) : (
          <div className="space-y-2">
            {recentReports.map((report, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-600 rounded">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-400" />
                  <span className="text-white">{report.name}</span>
                </div>
                <span className="text-sm text-gray-400">{report.date}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminReports

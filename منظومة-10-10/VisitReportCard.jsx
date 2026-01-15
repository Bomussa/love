/**
 * مكون عرض تقرير الزيارة للمراجع
 * تاريخ: 15 يناير 2026
 * 
 * يعرض معلومات المراجع ونوع الفحص والمدة المستهلكة في كل عيادة
 */

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Clock, CheckCircle, AlertCircle, FileText } from 'lucide-react'
import api from '../lib/api-unified'

export function VisitReportCard({ patientId, language = 'ar' }) {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadReport()
  }, [patientId])

  const loadReport = async () => {
    try {
      setLoading(true)
      const result = await api.getPatientVisitReport(patientId)
      
      if (result.success) {
        setReport(result.report)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (minutes) => {
    if (!minutes) return '-'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return language === 'ar' 
        ? `${hours} ساعة ${mins} دقيقة`
        : `${hours}h ${mins}m`
    }
    return language === 'ar' ? `${mins} دقيقة` : `${mins}m`
  }

  const formatTime = (timestamp) => {
    if (!timestamp) return '-'
    const date = new Date(timestamp)
    return date.toLocaleTimeString(language === 'ar' ? 'ar-QA' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status) => {
    const badges = {
      'in_progress': {
        ar: 'جاري التنفيذ',
        en: 'In Progress',
        color: 'bg-yellow-500/20 text-yellow-400'
      },
      'completed': {
        ar: 'مكتمل',
        en: 'Completed',
        color: 'bg-green-500/20 text-green-400'
      },
      'assigned': {
        ar: 'معين',
        en: 'Assigned',
        color: 'bg-blue-500/20 text-blue-400'
      },
      'active': {
        ar: 'نشط',
        en: 'Active',
        color: 'bg-purple-500/20 text-purple-400'
      }
    }

    const badge = badges[status] || badges['assigned']
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        {language === 'ar' ? badge.ar : badge.en}
      </span>
    )
  }

  if (loading) {
    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-700 rounded w-3/4"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2"></div>
            <div className="h-4 bg-gray-700 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-red-900/20 border-red-500/30">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-red-400">
            <AlertCircle className="w-5 h-5" />
            <p>{language === 'ar' ? 'خطأ في تحميل التقرير' : 'Error loading report'}: {error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!report) {
    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="p-6">
          <p className="text-gray-400 text-center">
            {language === 'ar' ? 'لا توجد بيانات' : 'No data available'}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-gray-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {language === 'ar' ? 'تقرير الزيارة' : 'Visit Report'}
          </CardTitle>
          {getStatusBadge(report.status)}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* معلومات أساسية */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-gray-400 text-sm">
              {language === 'ar' ? 'نوع الفحص' : 'Exam Type'}
            </p>
            <p className="text-white font-semibold">{report.exam_type}</p>
          </div>
          
          <div>
            <p className="text-gray-400 text-sm">
              {language === 'ar' ? 'المدة الإجمالية' : 'Total Duration'}
            </p>
            <p className="text-white font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {formatDuration(report.total_duration_minutes)}
            </p>
          </div>
        </div>

        {/* الأوقات */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-gray-400 text-sm">
              {language === 'ar' ? 'وقت البدء' : 'Start Time'}
            </p>
            <p className="text-white">{formatTime(report.start_time)}</p>
          </div>
          
          {report.end_time && (
            <div>
              <p className="text-gray-400 text-sm">
                {language === 'ar' ? 'وقت الانتهاء' : 'End Time'}
              </p>
              <p className="text-white">{formatTime(report.end_time)}</p>
            </div>
          )}
        </div>

        {/* تفاصيل العيادات */}
        <div>
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            {language === 'ar' ? 'العيادات' : 'Clinics'}
            <span className="text-gray-400 text-sm">
              ({report.clinics?.length || 0})
            </span>
          </h3>
          
          <div className="space-y-3">
            {report.clinics && report.clinics.map((clinic, index) => (
              <Card key={index} className="bg-gray-700/50 border-gray-600">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <span className="text-blue-400 font-bold text-sm">{index + 1}</span>
                      </div>
                      <div>
                        <p className="text-white font-medium">{clinic.clinic_name}</p>
                        {clinic.queue_number && (
                          <p className="text-gray-400 text-sm">
                            {language === 'ar' ? 'رقم الدور' : 'Queue'}: {clinic.queue_number}
                          </p>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(clinic.status)}
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 mt-3 text-sm">
                    <div>
                      <p className="text-gray-400">
                        {language === 'ar' ? 'الدخول' : 'Entry'}
                      </p>
                      <p className="text-white">{formatTime(clinic.entered_at)}</p>
                    </div>
                    
                    {clinic.exited_at && (
                      <>
                        <div>
                          <p className="text-gray-400">
                            {language === 'ar' ? 'الخروج' : 'Exit'}
                          </p>
                          <p className="text-white">{formatTime(clinic.exited_at)}</p>
                        </div>
                        
                        <div>
                          <p className="text-gray-400">
                            {language === 'ar' ? 'المدة' : 'Duration'}
                          </p>
                          <p className="text-green-400 font-semibold">
                            {formatDuration(clinic.duration_minutes)}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* ملخص */}
        {report.status === 'completed' && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-400" />
              <div>
                <p className="text-green-400 font-semibold">
                  {language === 'ar' ? 'تم إكمال الفحص بنجاح' : 'Examination Completed Successfully'}
                </p>
                <p className="text-gray-300 text-sm mt-1">
                  {language === 'ar' 
                    ? `المدة الإجمالية: ${formatDuration(report.total_duration_minutes)}`
                    : `Total Duration: ${formatDuration(report.total_duration_minutes)}`
                  }
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default VisitReportCard

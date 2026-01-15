/**
 * API Service لتتبع زيارات المراجعين
 * تاريخ: 15 يناير 2026
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || 'https://rujwuruuosffcxazymit.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * بدء زيارة جديدة للمراجع
 */
export async function startPatientVisit(patientData, examType, pathway) {
  try {
    const { data, error } = await supabase.rpc('start_patient_visit', {
      p_patient_id: patientData.id,
      p_patient_name: patientData.name || null,
      p_patient_type: patientData.type || 'military',
      p_exam_type: examType,
      p_exam_type_ar: getExamTypeArabic(examType),
      p_pathway: pathway
    })

    if (error) throw error

    return {
      success: true,
      visit_id: data,
      message: 'تم بدء الزيارة بنجاح'
    }
  } catch (error) {
    console.error('Error starting patient visit:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * تسجيل دخول المراجع إلى عيادة
 */
export async function enterClinic(patientId, clinicId, queueNumber) {
  try {
    const { data, error } = await supabase.rpc('enter_clinic', {
      p_patient_id: patientId,
      p_clinic_id: clinicId,
      p_queue_number: queueNumber
    })

    if (error) throw error

    if (!data) {
      return {
        success: false,
        error: 'لم يتم العثور على سجل العيادة'
      }
    }

    return {
      success: true,
      entered_at: new Date().toISOString(),
      message: 'تم تسجيل الدخول بنجاح'
    }
  } catch (error) {
    console.error('Error entering clinic:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * تسجيل خروج المراجع من عيادة
 */
export async function exitClinic(patientId, clinicId, notes = null) {
  try {
    const { data, error } = await supabase.rpc('exit_clinic', {
      p_patient_id: patientId,
      p_clinic_id: clinicId,
      p_notes: notes
    })

    if (error) throw error

    if (!data || data.length === 0) {
      return {
        success: false,
        error: 'لم يتم العثور على سجل دخول نشط'
      }
    }

    const result = data[0]

    return {
      success: true,
      duration_minutes: result.duration_minutes,
      clinic_name: result.clinic_name,
      exited_at: new Date().toISOString(),
      message: `تم الخروج من ${result.clinic_name} - المدة: ${result.duration_minutes} دقيقة`
    }
  } catch (error) {
    console.error('Error exiting clinic:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * إنهاء زيارة المراجع
 */
export async function completePatientVisit(patientId) {
  try {
    const { data, error } = await supabase.rpc('complete_patient_visit', {
      p_patient_id: patientId
    })

    if (error) throw error

    if (!data || data.length === 0) {
      return {
        success: false,
        error: 'لم يتم العثور على زيارة نشطة'
      }
    }

    const result = data[0]

    return {
      success: true,
      visit_id: result.visit_id,
      total_duration: result.total_duration,
      clinics_count: result.clinics_count,
      message: `تم إنهاء الزيارة - المدة الإجمالية: ${result.total_duration} دقيقة - عدد العيادات: ${result.clinics_count}`
    }
  } catch (error) {
    console.error('Error completing patient visit:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * الحصول على تقرير زيارة المراجع
 */
export async function getPatientVisitReport(patientId, date = null) {
  try {
    const visitDate = date || new Date().toISOString().split('T')[0]

    const { data, error } = await supabase.rpc('get_patient_visit_report', {
      p_patient_id: patientId,
      p_date: visitDate
    })

    if (error) throw error

    if (!data || data.length === 0) {
      return {
        success: false,
        error: 'لم يتم العثور على زيارة في هذا التاريخ'
      }
    }

    const report = data[0]

    return {
      success: true,
      report: {
        visit_id: report.visit_id,
        patient_name: report.patient_name,
        exam_type: report.exam_type_ar,
        start_time: report.start_time,
        end_time: report.end_time,
        total_duration_minutes: report.total_duration_minutes,
        status: report.status,
        clinics: report.clinics
      }
    }
  } catch (error) {
    console.error('Error getting patient visit report:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * الحصول على إحصائيات عيادة معينة
 */
export async function getClinicStatistics(clinicId, startDate, endDate) {
  try {
    let query = supabase
      .from('clinic_statistics')
      .select('*')
      .eq('clinic_id', clinicId)

    if (startDate) {
      query = query.gte('date', startDate)
    }

    if (endDate) {
      query = query.lte('date', endDate)
    }

    query = query.order('date', { ascending: false })

    const { data, error } = await query

    if (error) throw error

    return {
      success: true,
      statistics: data || []
    }
  } catch (error) {
    console.error('Error getting clinic statistics:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * الحصول على قائمة الزيارات لفترة معينة
 */
export async function getVisitsList(startDate, endDate, examType = null, status = null) {
  try {
    let query = supabase
      .from('patient_visits_report')
      .select('*')

    if (startDate) {
      query = query.gte('visit_date', startDate)
    }

    if (endDate) {
      query = query.lte('visit_date', endDate)
    }

    if (examType) {
      query = query.eq('exam_type', examType)
    }

    if (status) {
      query = query.eq('visit_status', status)
    }

    query = query.order('visit_date', { ascending: false })

    const { data, error } = await query

    if (error) throw error

    return {
      success: true,
      visits: data || [],
      count: data?.length || 0
    }
  } catch (error) {
    console.error('Error getting visits list:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * الحصول على إحصائيات يومية
 */
export async function getDailyStatistics(date = null) {
  try {
    const targetDate = date || new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('patient_visits')
      .select('exam_type, status')
      .eq('visit_date', targetDate)

    if (error) throw error

    // تجميع الإحصائيات
    const stats = {
      total_visits: data.length,
      in_progress: data.filter(v => v.status === 'in_progress').length,
      completed: data.filter(v => v.status === 'completed').length,
      cancelled: data.filter(v => v.status === 'cancelled').length,
      by_exam_type: {}
    }

    // تجميع حسب نوع الفحص
    data.forEach(visit => {
      if (!stats.by_exam_type[visit.exam_type]) {
        stats.by_exam_type[visit.exam_type] = 0
      }
      stats.by_exam_type[visit.exam_type]++
    })

    return {
      success: true,
      date: targetDate,
      statistics: stats
    }
  } catch (error) {
    console.error('Error getting daily statistics:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * تصدير تقرير إلى ملف
 */
export async function exportVisitsReport(startDate, endDate, format = 'json') {
  try {
    const visitsResult = await getVisitsList(startDate, endDate)

    if (!visitsResult.success) {
      return visitsResult
    }

    const report = {
      generated_at: new Date().toISOString(),
      period: { start: startDate, end: endDate },
      total_visits: visitsResult.count,
      visits: visitsResult.visits
    }

    if (format === 'json') {
      return {
        success: true,
        format: 'json',
        data: JSON.stringify(report, null, 2)
      }
    }

    if (format === 'csv') {
      // تحويل إلى CSV
      const csvRows = []
      csvRows.push('رقم المراجع,الاسم,نوع الفحص,التاريخ,وقت البدء,وقت الانتهاء,المدة الإجمالية,الحالة,عدد العيادات')

      visitsResult.visits.forEach(visit => {
        csvRows.push([
          visit.patient_id,
          visit.patient_name || '',
          visit.exam_type_ar,
          visit.visit_date,
          visit.start_time,
          visit.end_time || '',
          visit.total_duration_minutes || '',
          visit.visit_status,
          visit.total_clinics
        ].join(','))
      })

      return {
        success: true,
        format: 'csv',
        data: csvRows.join('\n')
      }
    }

    return {
      success: false,
      error: 'تنسيق غير مدعوم'
    }
  } catch (error) {
    console.error('Error exporting report:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// دالة مساعدة للحصول على اسم نوع الفحص بالعربية
function getExamTypeArabic(examType) {
  const types = {
    'recruitment': 'فحص التجنيد',
    'transfer': 'فحص التحويل',
    'annual': 'الفحص الطبي السنوي',
    'vital': 'القياسات الحيوية',
    'eye': 'فحص وحنجرة أذن وحنجرة',
    'cardiology': 'تخطيط القلب'
  }
  return types[examType] || examType
}

// تصدير جميع الدوال
export default {
  startPatientVisit,
  enterClinic,
  exitClinic,
  completePatientVisit,
  getPatientVisitReport,
  getClinicStatistics,
  getVisitsList,
  getDailyStatistics,
  exportVisitsReport
}

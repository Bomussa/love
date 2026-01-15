/**
 * API Endpoints للوحة الإدارة
 * تاريخ: 15 يناير 2026
 * 
 * يجب إضافة هذه الـ endpoints إلى /api/v1.js
 */

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

// ========== Admin Authentication ==========

/**
 * تسجيل دخول المدير
 */
export async function adminLogin(username, password) {
  try {
    // Hash the password
    const hashedPassword = crypto
      .createHash('sha256')
      .update(password)
      .digest('hex')

    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .eq('username', username)
      .eq('password', hashedPassword)
      .eq('active', true)
      .single()

    if (error || !data) {
      return {
        success: false,
        error: 'اسم المستخدم أو كلمة المرور غير صحيحة'
      }
    }

    // Update last login
    await supabase
      .from('admins')
      .update({ last_login: new Date().toISOString() })
      .eq('id', data.id)

    return {
      success: true,
      admin: {
        id: data.id,
        username: data.username,
        name: data.name,
        role: data.role
      }
    }
  } catch (error) {
    console.error('Admin login error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// ========== Admin Management ==========

/**
 * الحصول على قائمة المدراء
 */
export async function getAdminsList() {
  try {
    const { data, error } = await supabase
      .from('admins')
      .select('id, username, name, role, created_at, last_login, active')
      .order('created_at', { ascending: false })

    if (error) throw error

    return {
      success: true,
      admins: data || []
    }
  } catch (error) {
    console.error('Error getting admins list:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * إضافة مدير جديد
 */
export async function addAdmin(username, password, name, role = 'admin') {
  try {
    // Check if username exists
    const { data: existing } = await supabase
      .from('admins')
      .select('id')
      .eq('username', username)
      .single()

    if (existing) {
      return {
        success: false,
        error: 'اسم المستخدم موجود بالفعل'
      }
    }

    // Hash password
    const hashedPassword = crypto
      .createHash('sha256')
      .update(password)
      .digest('hex')

    const { data, error } = await supabase
      .from('admins')
      .insert({
        username,
        password: hashedPassword,
        name,
        role,
        active: true
      })
      .select()
      .single()

    if (error) throw error

    return {
      success: true,
      admin: {
        id: data.id,
        username: data.username,
        name: data.name,
        role: data.role
      }
    }
  } catch (error) {
    console.error('Error adding admin:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * حذف مدير
 */
export async function deleteAdmin(adminId) {
  try {
    const { error } = await supabase
      .from('admins')
      .update({ active: false })
      .eq('id', adminId)

    if (error) throw error

    return {
      success: true,
      message: 'تم حذف المدير بنجاح'
    }
  } catch (error) {
    console.error('Error deleting admin:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * تحديث كلمة مرور المدير
 */
export async function updateAdminPassword(adminId, newPassword) {
  try {
    const hashedPassword = crypto
      .createHash('sha256')
      .update(newPassword)
      .digest('hex')

    const { error } = await supabase
      .from('admins')
      .update({ password: hashedPassword })
      .eq('id', adminId)

    if (error) throw error

    return {
      success: true,
      message: 'تم تحديث كلمة المرور بنجاح'
    }
  } catch (error) {
    console.error('Error updating admin password:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// ========== PIN Management ==========

/**
 * تحديث رقم البن لعيادة
 */
export async function updateClinicPin(clinicId, newPin) {
  try {
    const today = new Date().toISOString().split('T')[0]

    const { error } = await supabase
      .from('clinic_pins')
      .upsert({
        clinic_id: clinicId,
        pin: newPin,
        date: today,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'clinic_id,date'
      })

    if (error) throw error

    return {
      success: true,
      message: 'تم تحديث رقم البن بنجاح'
    }
  } catch (error) {
    console.error('Error updating clinic PIN:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * إنشاء رقم بن جديد تلقائياً
 */
export async function generateNewPin(clinicId) {
  try {
    // Generate random 4-digit PIN
    const newPin = Math.floor(1000 + Math.random() * 9000).toString()
    
    return await updateClinicPin(clinicId, newPin)
  } catch (error) {
    console.error('Error generating new PIN:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * الحصول على جميع أرقام البن اليومية
 */
export async function getAllPins() {
  try {
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('clinic_pins')
      .select('*')
      .eq('date', today)

    if (error) throw error

    const pins = {}
    data.forEach(item => {
      pins[item.clinic_id] = {
        pin: item.pin,
        created_at: item.created_at,
        updated_at: item.updated_at
      }
    })

    return {
      success: true,
      pins
    }
  } catch (error) {
    console.error('Error getting all PINs:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// ========== Statistics & Reports ==========

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

    const stats = {
      total_visits: data.length,
      in_progress: data.filter(v => v.status === 'in_progress').length,
      completed: data.filter(v => v.status === 'completed').length,
      cancelled: data.filter(v => v.status === 'cancelled').length,
      by_exam_type: {}
    }

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
 * تصدير تقرير الزيارات
 */
export async function exportVisitsReport(startDate, endDate, format = 'json') {
  try {
    const { data, error } = await supabase
      .from('patient_visits_report')
      .select('*')
      .gte('visit_date', startDate)
      .lte('visit_date', endDate)
      .order('visit_date', { ascending: false })

    if (error) throw error

    if (format === 'json') {
      return {
        success: true,
        format: 'json',
        data: JSON.stringify({
          generated_at: new Date().toISOString(),
          period: { start: startDate, end: endDate },
          total_visits: data.length,
          visits: data
        }, null, 2)
      }
    }

    if (format === 'csv') {
      const csvRows = []
      csvRows.push('رقم المراجع,الاسم,نوع الفحص,التاريخ,وقت البدء,وقت الانتهاء,المدة الإجمالية,الحالة,عدد العيادات')

      data.forEach(visit => {
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

// ========== تصدير جميع الدوال ==========
export default {
  adminLogin,
  getAdminsList,
  addAdmin,
  deleteAdmin,
  updateAdminPassword,
  updateClinicPin,
  generateNewPin,
  getAllPins,
  getDailyStatistics,
  exportVisitsReport
}

// ========== إضافة الـ Endpoints إلى v1.js ==========
/**
 * يجب إضافة هذه الـ routes إلى ملف /api/v1.js:
 * 
 * // Admin Login
 * if (pathname === '/api/v1/admin/login' && method === 'POST') {
 *   const { username, password } = body
 *   const result = await adminLogin(username, password)
 *   return result.success ? sendResponse(result) : sendError(result.error, 401)
 * }
 * 
 * // Get Admins List
 * if (pathname === '/api/v1/admin/list' && method === 'GET') {
 *   const result = await getAdminsList()
 *   return sendResponse(result)
 * }
 * 
 * // Add Admin
 * if (pathname === '/api/v1/admin/add' && method === 'POST') {
 *   const { username, password, name, role } = body
 *   const result = await addAdmin(username, password, name, role)
 *   return result.success ? sendResponse(result) : sendError(result.error, 400)
 * }
 * 
 * // Delete Admin
 * if (pathname === '/api/v1/admin/delete' && method === 'POST') {
 *   const { adminId } = body
 *   const result = await deleteAdmin(adminId)
 *   return sendResponse(result)
 * }
 * 
 * // Update Clinic PIN
 * if (pathname === '/api/v1/admin/pin/update' && method === 'POST') {
 *   const { clinicId, pin } = body
 *   const result = await updateClinicPin(clinicId, pin)
 *   return sendResponse(result)
 * }
 * 
 * // Generate New PIN
 * if (pathname === '/api/v1/admin/pin/generate' && method === 'POST') {
 *   const { clinicId } = body
 *   const result = await generateNewPin(clinicId)
 *   return sendResponse(result)
 * }
 * 
 * // Get All PINs
 * if (pathname === '/api/v1/admin/pins' && method === 'GET') {
 *   const result = await getAllPins()
 *   return sendResponse(result)
 * }
 * 
 * // Get Daily Statistics
 * if (pathname === '/api/v1/admin/statistics/daily' && method === 'GET') {
 *   const date = parsedUrl.searchParams.get('date')
 *   const result = await getDailyStatistics(date)
 *   return sendResponse(result)
 * }
 * 
 * // Export Report
 * if (pathname === '/api/v1/admin/report/export' && method === 'GET') {
 *   const startDate = parsedUrl.searchParams.get('startDate')
 *   const endDate = parsedUrl.searchParams.get('endDate')
 *   const format = parsedUrl.searchParams.get('format') || 'json'
 *   const result = await exportVisitsReport(startDate, endDate, format)
 *   return sendResponse(result)
 * }
 */

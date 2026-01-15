/**
 * API محدث لنظام الدور - يستخدم النظام الجديد من قاعدة البيانات
 * تاريخ: 15 يناير 2026
 * 
 * التغييرات الرئيسية:
 * 1. استخدام get_next_queue_number() للحصول على رقم ثابت
 * 2. استخدام activate_queue_number() عند دخول المراجع فعلياً
 * 3. استخدام get_queue_position() للحصول على الموقع الدقيق
 * 4. استخدام complete_queue_number() عند إكمال الفحص
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || 'https://rujwuruuosffcxazymit.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * الحصول على رقم دور للمراجع (بدون تفعيل)
 * يعطي المراجع رقمه الثابت الذي سيستخدمه عند الدخول
 */
export async function assignQueueNumber(patientId, clinicId, examType) {
  try {
    const { data, error } = await supabase.rpc('get_next_queue_number', {
      p_patient_id: patientId,
      p_clinic_id: clinicId,
      p_exam_type: examType
    })

    if (error) throw error

    return {
      success: true,
      queue_number: data,
      status: 'assigned',
      message: 'تم تخصيص رقم الدور بنجاح'
    }
  } catch (error) {
    console.error('Error assigning queue number:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * تفعيل رقم الدور عند دخول المراجع فعلياً للعيادة
 */
export async function activateQueueNumber(patientId, clinicId, examType) {
  try {
    const { data, error } = await supabase.rpc('activate_queue_number', {
      p_patient_id: patientId,
      p_clinic_id: clinicId,
      p_exam_type: examType
    })

    if (error) throw error

    if (!data) {
      return {
        success: false,
        error: 'لم يتم العثور على رقم دور مخصص'
      }
    }

    // الحصول على الموقع الحالي بعد التفعيل
    const position = await getQueuePosition(patientId, clinicId, examType)

    return {
      success: true,
      status: 'active',
      ...position,
      message: 'تم تفعيل رقم الدور بنجاح'
    }
  } catch (error) {
    console.error('Error activating queue number:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * الحصول على موقع المراجع في الطابور
 */
export async function getQueuePosition(patientId, clinicId, examType) {
  try {
    const { data, error } = await supabase.rpc('get_queue_position', {
      p_patient_id: patientId,
      p_clinic_id: clinicId,
      p_exam_type: examType
    })

    if (error) throw error

    if (!data || data.length === 0) {
      return {
        success: false,
        error: 'لم يتم العثور على رقم دور'
      }
    }

    const position = data[0]

    return {
      success: true,
      queue_number: position.queue_number,
      position: position.position,
      ahead: position.ahead,
      total_waiting: position.total_waiting,
      status: position.status,
      display_number: position.queue_number // للتوافق مع الكود القديم
    }
  } catch (error) {
    console.error('Error getting queue position:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * إكمال الفحص في العيادة
 */
export async function completeQueueNumber(patientId, clinicId, examType) {
  try {
    const { data, error } = await supabase.rpc('complete_queue_number', {
      p_patient_id: patientId,
      p_clinic_id: clinicId,
      p_exam_type: examType
    })

    if (error) throw error

    if (!data) {
      return {
        success: false,
        error: 'لم يتم العثور على رقم دور نشط'
      }
    }

    return {
      success: true,
      status: 'completed',
      message: 'تم إكمال الفحص بنجاح'
    }
  } catch (error) {
    console.error('Error completing queue number:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * الحصول على حالة الطابور لعيادة معينة
 */
export async function getClinicQueueStatus(clinicId, examType) {
  try {
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('queue_status_view')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('exam_type', examType)
      .eq('date', today)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    if (!data) {
      return {
        success: true,
        clinic_id: clinicId,
        exam_type: examType,
        current_number: 0,
        last_assigned: 0,
        assigned_count: 0,
        active_count: 0,
        completed_count: 0
      }
    }

    return {
      success: true,
      ...data
    }
  } catch (error) {
    console.error('Error getting clinic queue status:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * الحصول على قائمة المنتظرين في عيادة معينة
 */
export async function getWaitingList(clinicId, examType) {
  try {
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('patient_queue_numbers')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('exam_type', examType)
      .eq('date', today)
      .in('status', ['assigned', 'active'])
      .order('queue_number', { ascending: true })

    if (error) throw error

    return {
      success: true,
      waiting_list: data || [],
      count: data?.length || 0
    }
  } catch (error) {
    console.error('Error getting waiting list:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * استدعاء المراجع التالي (للعيادات)
 */
export async function callNextPatient(clinicId, examType) {
  try {
    const today = new Date().toISOString().split('T')[0]

    // الحصول على أول مراجع في الانتظار
    const { data: nextPatient, error: fetchError } = await supabase
      .from('patient_queue_numbers')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('exam_type', examType)
      .eq('date', today)
      .eq('status', 'active')
      .order('queue_number', { ascending: true })
      .limit(1)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError

    if (!nextPatient) {
      return {
        success: false,
        error: 'لا يوجد مراجعين في الانتظار'
      }
    }

    // تحديث العداد الحالي
    const { error: updateError } = await supabase
      .from('queue_counters')
      .update({ 
        current_number: nextPatient.queue_number,
        updated_at: new Date().toISOString()
      })
      .eq('clinic_id', clinicId)
      .eq('exam_type', examType)
      .eq('date', today)

    if (updateError) throw updateError

    return {
      success: true,
      patient_id: nextPatient.patient_id,
      queue_number: nextPatient.queue_number,
      message: `تم استدعاء المراجع رقم ${nextPatient.queue_number}`
    }
  } catch (error) {
    console.error('Error calling next patient:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * إلغاء رقم دور
 */
export async function cancelQueueNumber(patientId, clinicId, examType) {
  try {
    const today = new Date().toISOString().split('T')[0]

    const { error } = await supabase
      .from('patient_queue_numbers')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('patient_id', patientId)
      .eq('clinic_id', clinicId)
      .eq('exam_type', examType)
      .eq('date', today)

    if (error) throw error

    return {
      success: true,
      message: 'تم إلغاء رقم الدور بنجاح'
    }
  } catch (error) {
    console.error('Error cancelling queue number:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// تصدير جميع الدوال
export default {
  assignQueueNumber,
  activateQueueNumber,
  getQueuePosition,
  completeQueueNumber,
  getClinicQueueStatus,
  getWaitingList,
  callNextPatient,
  cancelQueueNumber
}

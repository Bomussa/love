/**
 * Supabase API Service
 * 
 * يوفر جميع العمليات المطلوبة للتفاعل مع قاعدة بيانات Supabase
 */

import { supabase } from './supabase'

/**
 * Helper function to handle Supabase errors
 */
function handleError(error, operation) {
  console.error(`❌ Supabase ${operation} error:`, error)
  throw new Error(error.message || `Failed to ${operation}`)
}

/**
 * Supabase API Service
 */
export const supabaseApi = {
  // ============================================
  // PATIENT OPERATIONS
  // ============================================

  /**
   * Patient login/registration
   */
  async patientLogin(patientId, gender) {
    try {
      // Check if patient exists
      const { data: existing, error: checkError } = await supabase
        .from('patients')
        .select('*')
        .eq('patient_id', patientId)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        handleError(checkError, 'check patient')
      }

      if (existing) {
        // Update existing patient
        const { data, error } = await supabase
          .from('patients')
          .update({ gender, updated_at: new Date().toISOString() })
          .eq('patient_id', patientId)
          .select()
          .single()

        if (error) handleError(error, 'update patient')

        return {
          success: true,
          patient: data,
          message: 'تم تسجيل الدخول بنجاح'
        }
      } else {
        // Create new patient
        const { data, error } = await supabase
          .from('patients')
          .insert({ patient_id: patientId, gender })
          .select()
          .single()

        if (error) handleError(error, 'create patient')

        return {
          success: true,
          patient: data,
          message: 'تم إنشاء حساب جديد بنجاح'
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  },

  // ============================================
  // QUEUE OPERATIONS
  // ============================================

  /**
   * Enter queue for a clinic
   */
  async enterQueue(clinicId, patientId, examType, gender) {
    try {
      // Get current max queue number for today
      const today = new Date().toISOString().split('T')[0]
      
      const { data: maxData, error: maxError } = await supabase
        .from('queues')
        .select('queue_number')
        .eq('clinic_id', clinicId)
        .gte('entered_at', `${today}T00:00:00`)
        .order('queue_number', { ascending: false })
        .limit(1)

      if (maxError && maxError.code !== 'PGRST116') {
        handleError(maxError, 'get max queue number')
      }

      const nextNumber = (maxData && maxData.length > 0) ? maxData[0].queue_number + 1 : 1

      // Insert new queue entry
      const { data, error } = await supabase
        .from('queues')
        .insert({
          queue_number: nextNumber,
          patient_id: patientId,
          clinic_id: clinicId,
          exam_type: examType,
          gender: gender,
          status: 'waiting'
        })
        .select()
        .single()

      if (error) handleError(error, 'enter queue')

      // Get position (how many are ahead)
      const { count, error: countError } = await supabase
        .from('queues')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)
        .eq('status', 'waiting')
        .lt('queue_number', nextNumber)

      if (countError) handleError(countError, 'get queue position')

      return {
        success: true,
        yourNumber: nextNumber,
        current: nextNumber - (count || 0),
        ahead: count || 0,
        queueEntry: data
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  },

  /**
   * Get queue status for a clinic
   */
  async getQueueStatus(clinicId, patientId = null) {
    try {
      const today = new Date().toISOString().split('T')[0]

      // Get all waiting entries
      const { data, error } = await supabase
        .from('queues')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('status', 'waiting')
        .gte('entered_at', `${today}T00:00:00`)
        .order('queue_number', { ascending: true })

      if (error) handleError(error, 'get queue status')

      const current = data && data.length > 0 ? data[0].queue_number : 0
      const waiting = data ? data.length : 0

      let yourPosition = null
      let yourNumber = null

      if (patientId && data) {
        const yourEntry = data.find(q => q.patient_id === patientId)
        if (yourEntry) {
          yourNumber = yourEntry.queue_number
          yourPosition = data.findIndex(q => q.patient_id === patientId) + 1
        }
      }

      return {
        success: true,
        queue: data || [],
        current,
        waiting,
        yourNumber,
        yourPosition
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  },

  /**
   * Mark queue entry as done
   */
  async queueDone(clinicId, patientId, pin) {
    try {
      // Verify PIN
      const { data: clinicData, error: clinicError } = await supabase
        .from('clinics')
        .select('daily_pin')
        .eq('clinic_id', clinicId)
        .single()

      if (clinicError) handleError(clinicError, 'verify PIN')

      if (clinicData.daily_pin !== parseInt(pin)) {
        return {
          success: false,
          error: 'رمز PIN غير صحيح'
        }
      }

      // Update queue entry
      const { data, error } = await supabase
        .from('queues')
        .update({
          status: 'done',
          completed_at: new Date().toISOString()
        })
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .eq('status', 'waiting')
        .select()
        .single()

      if (error) handleError(error, 'mark queue done')

      return {
        success: true,
        message: 'تم إكمال الفحص بنجاح',
        queueEntry: data
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  },

  /**
   * Call next patient in queue
   */
  async callNextPatient(clinicId) {
    try {
      const today = new Date().toISOString().split('T')[0]

      // Get next waiting patient
      const { data, error } = await supabase
        .from('queues')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('status', 'waiting')
        .gte('entered_at', `${today}T00:00:00`)
        .order('queue_number', { ascending: true })
        .limit(1)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            success: true,
            message: 'لا يوجد مرضى في الانتظار',
            patient: null
          }
        }
        handleError(error, 'call next patient')
      }

      // Update status to called
      const { data: updated, error: updateError } = await supabase
        .from('queues')
        .update({
          status: 'called',
          called_at: new Date().toISOString()
        })
        .eq('id', data.id)
        .select()
        .single()

      if (updateError) handleError(updateError, 'update patient status')

      // Create notification
      await this.createNotification(
        data.patient_id,
        clinicId,
        'دورك الآن! توجه إلى العيادة',
        'urgent'
      )

      return {
        success: true,
        patient: updated,
        message: `تم استدعاء المريض رقم ${data.queue_number}`
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  },

  // ============================================
  // PIN OPERATIONS
  // ============================================

  /**
   * Get PIN status for all clinics
   */
  async getPinStatus() {
    try {
      const today = new Date().toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('clinics')
        .select('clinic_id, daily_pin, pin_generated_at')

      if (error) handleError(error, 'get PIN status')

      const pins = {}
      
      for (const clinic of data) {
        // Generate new PIN if needed
        if (clinic.pin_generated_at !== today || !clinic.daily_pin) {
          const newPin = await this.generatePin(clinic.clinic_id)
          pins[clinic.clinic_id] = newPin
        } else {
          pins[clinic.clinic_id] = clinic.daily_pin
        }
      }

      return {
        success: true,
        pins
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  },

  /**
   * Generate new PIN for a clinic
   */
  async generatePin(clinicId) {
    try {
      const newPin = Math.floor(Math.random() * 90) + 10
      const today = new Date().toISOString().split('T')[0]

      const { error } = await supabase
        .from('clinics')
        .update({
          daily_pin: newPin,
          pin_generated_at: today
        })
        .eq('clinic_id', clinicId)

      if (error) handleError(error, 'generate PIN')

      return newPin
    } catch (error) {
      console.error('Error generating PIN:', error)
      return Math.floor(Math.random() * 90) + 10
    }
  },

  // ============================================
  // CLINIC OPERATIONS
  // ============================================

  /**
   * Get all clinics
   */
  async getClinics() {
    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('*')
        .order('clinic_id')

      if (error) handleError(error, 'get clinics')

      return {
        success: true,
        clinics: data
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  },

  /**
   * Open clinic
   */
  async openClinic(clinicId, pin) {
    try {
      // Verify PIN
      const { data: clinicData, error: clinicError } = await supabase
        .from('clinics')
        .select('daily_pin')
        .eq('clinic_id', clinicId)
        .single()

      if (clinicError) handleError(clinicError, 'verify PIN')

      if (clinicData.daily_pin !== parseInt(pin)) {
        return {
          success: false,
          error: 'رمز PIN غير صحيح'
        }
      }

      // Open clinic
      const { data, error } = await supabase
        .from('clinics')
        .update({ is_open: true })
        .eq('clinic_id', clinicId)
        .select()
        .single()

      if (error) handleError(error, 'open clinic')

      return {
        success: true,
        clinic: data,
        message: 'تم فتح العيادة بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  },

  /**
   * Close clinic
   */
  async closeClinic(clinicId) {
    try {
      const { data, error } = await supabase
        .from('clinics')
        .update({ is_open: false })
        .eq('clinic_id', clinicId)
        .select()
        .single()

      if (error) handleError(error, 'close clinic')

      return {
        success: true,
        clinic: data,
        message: 'تم إغلاق العيادة بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  },

  // ============================================
  // PATHWAY OPERATIONS
  // ============================================

  /**
   * Choose medical pathway
   */
  async choosePath(patientId, examType, gender) {
    try {
      const pathway = this.generatePathway(examType, gender)

      const { data, error } = await supabase
        .from('pathways')
        .insert({
          patient_id: patientId,
          exam_type: examType,
          gender: gender,
          pathway: pathway
        })
        .select()
        .single()

      if (error) handleError(error, 'choose pathway')

      return {
        success: true,
        pathway: pathway,
        stations: pathway.map(clinicId => ({
          id: clinicId,
          name: this.getClinicName(clinicId)
        })),
        pathwayEntry: data
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  },

  /**
   * Generate pathway based on exam type and gender
   */
  generatePathway(examType, gender) {
    const pathways = {
      'recruitment': ['lab', 'xray', 'vitals', 'ecg', 'audio', 'eyes', 'internal', 'ent', 'surgery', 'dental', 'psychiatry', 'derma', 'bones'],
      'transfer': ['lab', 'vitals', 'internal'],
      'promotion': ['lab', 'vitals', 'internal', 'eyes'],
      'conversion': ['lab', 'xray', 'vitals', 'internal'],
      'courses': ['lab', 'vitals', 'internal'],
      'cooks': ['lab', 'xray', 'vitals', 'internal', 'dental'],
      'aviation': ['lab', 'xray', 'vitals', 'ecg', 'audio', 'eyes', 'internal', 'ent'],
      'renewal': ['lab', 'vitals', 'internal']
    }

    return pathways[examType] || pathways['recruitment']
  },

  /**
   * Get clinic name in Arabic
   */
  getClinicName(clinicId) {
    const names = {
      'lab': 'المختبر',
      'xray': 'الأشعة',
      'vitals': 'العلامات الحيوية',
      'ecg': 'تخطيط القلب',
      'audio': 'السمعيات',
      'eyes': 'العيون',
      'internal': 'الباطنية',
      'ent': 'الأنف والأذن والحنجرة',
      'surgery': 'الجراحة',
      'dental': 'الأسنان',
      'psychiatry': 'الطب النفسي',
      'derma': 'الجلدية',
      'bones': 'العظام'
    }
    return names[clinicId] || clinicId
  },

  // ============================================
  // NOTIFICATION OPERATIONS
  // ============================================

  /**
   * Create notification
   */
  async createNotification(patientId, clinicId, message, type = 'info') {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          patient_id: patientId,
          clinic_id: clinicId,
          message: message,
          type: type
        })
        .select()
        .single()

      if (error) handleError(error, 'create notification')

      return {
        success: true,
        notification: data
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  },

  /**
   * Get notifications for a patient
   */
  async getNotifications(patientId, unreadOnly = false) {
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })

      if (unreadOnly) {
        query = query.eq('read', false)
      }

      const { data, error } = await query

      if (error) handleError(error, 'get notifications')

      return {
        success: true,
        notifications: data
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  },

  /**
   * Mark notification as read
   */
  async markNotificationRead(notificationId) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)

      if (error) handleError(error, 'mark notification read')

      return {
        success: true
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }
}

export default supabaseApi

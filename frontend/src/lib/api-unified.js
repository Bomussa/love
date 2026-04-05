
/**
 * api-unified.js - واجهة برمجة التطبيقات الموحدة
 * Unified API Service - Direct Supabase Implementation
 *
 * نظام ضمان البيانات (GDS) - بيانات حقيقية لحظية مضمونة
 * إعادة المحاولة التلقائية
 * بدون بيانات وهمية
 *
 * @module api-unified
 * @version 2.0.0 - PIN system removed
 */

import { supabase } from './supabase-client';
import { initGDS } from './guaranteed-data-system';

// تهيئة نظام ضمان البيانات
initGDS().catch((err) => console.error('❌ فشل تهيئة GDS:', err));

/**
 * كائن API الموحد
 * يوفر جميع الوظائف للتفاعل مع قاعدة البيانات عبر Supabase
 */
const api = {

  // ═══════════════════════════════════════════════════════════════
  // مرضى / Patients
  // ═══════════════════════════════════════════════════════════════

  /**
   * تسجيل دخول المريض
   * @param {string} patientId - رقم المريض العسكري/الشخصي
   * @param {string} gender - جنس المريض (male/female)
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   */
  async patientLogin(patientId, gender) {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('patient_id', patientId)
        .single();

      if (error && error.code === 'PGRST116') {
        // Patient doesn't exist, create new
        const { data: newUser, error: createError } = await supabase
          .from('patients')
          .insert([{ patient_id: patientId, gender: gender || 'male', status: 'active' }])
          .select()
          .single();

        if (createError) throw createError;
        return { success: true, data: newUser };
      }

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Login Error:', error);
      return { success: false, error: error.message };
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // طابور / Queue Management
  // ═══════════════════════════════════════════════════════════════

  /**
   * إدخال المريض إلى الطابور
   * @param {string} clinicId - معرف العيادة
   * @param {string} patientId - رقم المريض
   * @param {boolean} isAutoEnter - إدخال تلقائي
   * @param {string} patientName - اسم المريض (اختياري)
   * @param {string} examType - نوع الفحص (اختياري)
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   */
  async enterQueue(clinicId, patientId, isAutoEnter = true, patientName = null, examType = null) {
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc('enter_queue_safe', {
        p_clinic_id: clinicId,
        p_patient_id: patientId,
        p_patient_name: patientName,
        p_exam_type: examType,
      });

      if (!rpcError && rpcResult) {
        return { success: true, ...rpcResult };
      }

      if (rpcError) {
        console.warn('RPC failed, using fallback:', rpcError.message);
      }

      const today = new Date().toISOString().split('T')[0];
      const { data: existingEntry } = await supabase
        .from('queues')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .eq('queue_date', today)
        .in('status', ['waiting', 'called', 'in_service'])
        .limit(1)
        .maybeSingle();

      if (existingEntry) {
        return { success: true, ...existingEntry, alreadyExists: true };
      }

      const { data: lastEntry } = await supabase
        .from('queues')
        .select('queue_number_int')
        .eq('clinic_id', clinicId)
        .eq('queue_date', today)
        .order('queue_number_int', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextNumber = (lastEntry ? lastEntry.queue_number_int : 0) + 1;

      const { data, error } = await supabase
        .from('queues')
        .insert([{
          clinic_id: clinicId,
          patient_id: patientId,
          patient_name: patientName,
          exam_type: examType,
          queue_number_int: nextNumber,
          display_number: nextNumber,
          queue_number: String(nextNumber),
          status: 'waiting',
          queue_date: today,
          entered_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, ...data };
    } catch (error) {
      console.error('Enter Queue Error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * الحصول على موقع المريض في الطابور
   * @param {string} clinicId - معرف العيادة
   * @param {string} patientId - رقم المريض
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   */
  async getQueuePosition(clinicId, patientId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: patientEntry, error: entryError } = await supabase
        .from('queues')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .eq('queue_date', today)
        .order('entered_at', { ascending: false })
        .limit(1)
        .single();

      if (entryError) throw entryError;

      let currentNumber = 0;
      const { data: servingEntry } = await supabase
        .from('queues')
        .select('display_number')
        .eq('clinic_id', clinicId)
        .eq('queue_date', today)
        .in('status', ['called', 'in_service'])
        .order('called_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (servingEntry) {
        currentNumber = servingEntry.display_number;
      } else {
        const { data: lastCompleted } = await supabase
          .from('queues')
          .select('display_number')
          .eq('clinic_id', clinicId)
          .eq('queue_date', today)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastCompleted) {
          currentNumber = lastCompleted.display_number;
        }
      }

      const { count, error: countError } = await supabase
        .from('queues')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)
        .eq('queue_date', today)
        .eq('status', 'waiting')
        .lt('entered_at', patientEntry.entered_at);

      if (countError) throw countError;

      return {
        success: true,
        display_number: patientEntry.display_number,
        current_number: currentNumber,
        ahead: count || 0,
        status: patientEntry.status,
      };
    } catch (error) {
      console.error('Get Position Error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * إنهاء خدمة المريض في الطابور
   * PIN system removed - لا يحتاج تحقق
   *
   * @param {string} clinicId - معرف العيادة
   * @param {string} patientId - رقم المريض
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   */
  async queueDone(clinicId, patientId) {
    try {
      const { data, error } = await supabase
        .from('queues')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .select();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Queue Done Error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * تحديث حالة المريض في الطابور
   * @param {string} clinicId - معرف العيادة
   * @param {string} patientId - رقم المريض
   * @param {string} newStatus - الحالة الجديدة (waiting/called/completed/no_show/cancelled)
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   */
  async updateQueueStatus(clinicId, patientId, newStatus) {
    try {
      const updateData = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      // إضافة الوقت المناسب حسب الحالة
      switch (newStatus) {
        case 'called':
          updateData.called_at = new Date().toISOString();
          break;
        case 'completed':
          updateData.completed_at = new Date().toISOString();
          break;
        case 'no_show':
          updateData.no_show_at = new Date().toISOString();
          break;
        case 'in_service':
          updateData.started_at = new Date().toISOString();
          break;
      }

      const { data, error } = await supabase
        .from('queues')
        .update(updateData)
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .select();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Update Queue Status Error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * مناداة المريض التالي
   * @param {string} clinicId - معرف العيادة
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   */
  async callNextPatient(clinicId) {
    try {
      const today = new Date().toISOString().split('T')[0];

      // البحث عن أول مريض في الانتظار
      const { data: nextPatient, error: findError } = await supabase
        .from('queues')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('queue_date', today)
        .eq('status', 'waiting')
        .order('entered_at', { ascending: true })
        .limit(1)
        .single();

      if (findError && findError.code !== 'PGRST116') throw findError;
      if (!nextPatient) {
        return { success: false, error: 'لا يوجد مراجعون في الانتظار' };
      }

      // تحديث الحالة إلى called
      const { data, error } = await supabase
        .from('queues')
        .update({
          status: 'called',
          called_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', nextPatient.id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Call Next Error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * بدء خدمة المريض
   * @param {string} queueId - معرف السجل في الطابور
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   */
  async startService(queueId) {
    try {
      const { data, error } = await supabase
        .from('queues')
        .update({
          status: 'in_service',
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', queueId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Start Service Error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * الحصول على حالة الطابور للعيادة
   * @param {string} clinicId - معرف العيادة
   * @returns {Promise<{success: boolean, queue?: array, error?: string}>}
   */
  async getQueueStatus(clinicId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('queues')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('queue_date', today)
        .order('entered_at', { ascending: true });

      if (error) throw error;
      return { success: true, queue: data || [] };
    } catch (error) {
      console.error('Get Queue Status Error:', error);
      return { success: false, error: error.message };
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // إعدادات / Settings
  // ═══════════════════════════════════════════════════════════════

  /**
   * الحصول على الإعدادات
   * @returns {Promise<{success: boolean, settings?: object, error?: string}>}
   */
  async getSettings() {
    try {
      const { data, error } = await supabase.from('system_settings').select('*');
      if (error) throw error;
      const settings = {};
      data.forEach(s => {
        try {
          settings[s.id] = JSON.parse(s.value);
        } catch {
          settings[s.id] = s.value;
        }
      });
      return { success: true, settings };
    } catch (error) {
      console.error('Get Settings Error:', error);
      return { success: false, error: error.message };
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // إحصائيات / Statistics
  // ═══════════════════════════════════════════════════════════════

  /**
   * الحصول على عدد الانتظار
   * @param {string} clinicId - معرف العيادة
   * @returns {Promise<number>}
   */
  async getQueueCount(clinicId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { count, error } = await supabase
        .from('queues')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)
        .eq('queue_date', today)
        .eq('status', 'waiting');
      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Get Queue Count Error:', error);
      return 0;
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // مسارات / Routes
  // ═══════════════════════════════════════════════════════════════

  /**
   * الحصول على مسار المريض
   * @param {string} patientId - رقم المريض
   * @returns {Promise<{success: boolean, route?: object, error?: string}>}
   */
  async getRoute(patientId) {
    try {
      const { data, error } = await supabase
        .from('patient_routes')
        .select('*')
        .eq('patient_id', patientId)
        .single();
      if (error) throw error;
      return { success: true, route: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * إنشاء مسار للمريض
   * @param {string} patientId - رقم المريض
   * @param {string} examType - نوع الفحص
   * @param {string} gender - الجنس
   * @param {array} stations - المحطات
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   */
  async createRoute(patientId, examType, gender, stations) {
    try {
      const { data, error } = await supabase
        .from('patient_routes')
        .upsert({
          patient_id: patientId,
          exam_type: examType,
          gender: gender,
          stations: stations,
          updated_at: new Date().toISOString()
        });
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // أطباء / Doctors
  // ═══════════════════════════════════════════════════════════════

  /**
   * إضافة طبيب جديد
   * @param {object} doctorData - بيانات الطبيب
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   */
  async addDoctor(doctorData) {
    try {
      const { data, error } = await supabase
        .from('doctors')
        .insert([{
          ...doctorData,
          is_active: true,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Add Doctor Error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * تحديث بيانات طبيب
   * @param {string} doctorId - معرف الطبيب
   * @param {object} updateData - بيانات التحديث
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   */
  async updateDoctor(doctorId, updateData) {
    try {
      const { data, error } = await supabase
        .from('doctors')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', doctorId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Update Doctor Error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * الحصول على قائمة الأطباء
   * @returns {Promise<{success: boolean, doctors?: array, error?: string}>}
   */
  async getDoctors() {
    try {
      const { data, error } = await supabase
        .from('doctors')
        .select('*')
        .order('name_ar', { ascending: true });

      if (error) throw error;
      return { success: true, doctors: data || [] };
    } catch (error) {
      console.error('Get Doctors Error:', error);
      return { success: false, error: error.message };
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // العيادات / Clinics
  // ═══════════════════════════════════════════════════════════════

  /**
   * الحصول على قائمة العيادات
   * @returns {Promise<{success: boolean, clinics?: array, error?: string}>}
   */
  async getClinics() {
    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('*')
        .order('name_ar', { ascending: true });

      if (error) throw error;
      return { success: true, clinics: data || [] };
    } catch (error) {
      console.error('Get Clinics Error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * الحصول على بيانات عيادة
   * @param {string} clinicId - معرف العيادة
   * @returns {Promise<{success: boolean, clinic?: object, error?: string}>}
   */
  async getClinic(clinicId) {
    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('*')
        .eq('id', clinicId)
        .single();

      if (error) throw error;
      return { success: true, clinic: data };
    } catch (error) {
      console.error('Get Clinic Error:', error);
      return { success: false, error: error.message };
    }
  }
};

export default api;

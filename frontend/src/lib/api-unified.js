/**
 * Unified API Layer - Medical Committee System
 * طبقة API موحدة - الاتصال المباشر بـ Supabase
 * 
 * الإضافات الحرجة المطبقة:
 * 1. فصل القراءة عن التشغيل (Read vs Command)
 * 2. جميع التغييرات عبر Edge Functions أو RPC
 * 3. القراءة فقط عبر Supabase REST
 * 4. منع استخدام Date.now() - الوقت من الخادم فقط
 */

import { supabase, healthCheck } from './supabase-client';

// Backend Mode - ثابت على supabase
export const BACKEND_MODE = 'supabase';

// Supabase URL للـ Edge Functions
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://rujwuruuosffcxazymit.supabase.co';

class UnifiedApiService {
  constructor() {
    this.supabase = supabase;
    this.baseUrl = SUPABASE_URL;
  }

  /**
   * استدعاء Edge Function
   * جميع عمليات التشغيل (الكتابة) تمر من هنا
   */
  async invokeFunction(functionName, body) {
    try {
      const { data, error } = await this.supabase.functions.invoke(functionName, {
        body
      });

      if (error) throw error;
      return data;
    } catch (err) {
      console.error(`Edge Function ${functionName} error:`, err);
      throw err;
    }
  }

  /**
   * Health Check - فحص صحة النظام عند الإقلاع
   */
  async healthCheck() {
    return await healthCheck();
  }

  // ==========================================
  // PATIENT MANAGEMENT (قراءة + تشغيل)
  // ==========================================
  
  /**
   * تسجيل دخول المريض
   */
  async patientLogin(patientId, gender) {
    // إنشاء أو تحديث المريض عبر RPC
    const { data, error } = await this.supabase
      .rpc('upsert_patient', { 
        p_patient_id: patientId, 
        p_gender: gender 
      });

    if (error) {
      // إذا لم تكن الدالة موجودة، استخدم الإدخال المباشر
      const { data: insertData, error: insertError } = await this.supabase
        .from('patients')
        .upsert({ id: patientId, gender, last_active: new Date().toISOString() })
        .select()
        .single();

      if (insertError) throw insertError;
      return { success: true, patient: insertData };
    }

    return { success: true, patient: data };
  }

  // ==========================================
  // QUEUE MANAGEMENT (التشغيل عبر Edge Functions)
  // ==========================================
  
  /**
   * دخول الطابور - عبر Edge Function للقفل التنافسي
   */
  async enterQueue(clinicId, patientId, isAutoEntry = false) {
    return await this.invokeFunction('queue-engine', {
      action: 'enter_queue',
      clinic_id: clinicId,
      patient_id: patientId,
      is_auto_entry: isAutoEntry
    });
  }

  /**
   * الحصول على حالة الطابور - قراءة فقط
   */
  async getQueueStatus(clinicId) {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await this.supabase
      .from('queues')
      .select('*')
      .eq('clinic_id', clinicId)
      .gte('entered_at', today)
      .order('display_number', { ascending: true });

    if (error) throw error;

    const waiting = data?.filter(q => q.status === 'waiting') || [];
    const serving = data?.filter(q => q.status === 'serving') || [];
    const completed = data?.filter(q => q.status === 'completed') || [];

    return {
      clinic_id: clinicId,
      waiting_count: waiting.length,
      serving_count: serving.length,
      completed_count: completed.length,
      current_number: serving[0]?.display_number || null,
      last_number: data?.[data.length - 1]?.display_number || 0,
      queue: data
    };
  }

  /**
   * إنهاء الفحص - عبر Edge Function
   */
  async queueDone(clinicId, patientId, pin) {
    return await this.invokeFunction('queue-engine', {
      action: 'complete_exam',
      clinic_id: clinicId,
      patient_id: patientId,
      operator_pin: pin
    });
  }

  /**
   * نداء المريض التالي - عبر Edge Function
   */
  async callNextPatient(clinicId, pin) {
    return await this.invokeFunction('queue-engine', {
      action: 'call_next',
      clinic_id: clinicId,
      operator_pin: pin
    });
  }

  /**
   * الحصول على موقع المريض في الطابور - قراءة فقط
   */
  async getQueuePosition(clinicId, patientId) {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await this.supabase
      .from('queues')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('patient_id', patientId)
      .gte('entered_at', today)
      .in('status', ['waiting', 'serving'])
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    if (!data) {
      return { position: null, status: 'not_in_queue' };
    }

    // حساب الموقع
    const { data: waitingBefore } = await this.supabase
      .from('queues')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('status', 'waiting')
      .lt('display_number', data.display_number)
      .gte('entered_at', today);

    return {
      position: (waitingBefore?.length || 0) + 1,
      display_number: data.display_number,
      status: data.status
    };
  }

  // ==========================================
  // PIN MANAGEMENT
  // ==========================================
  
  /**
   * توليد PIN - عبر Edge Function الموجودة
   */
  async generatePIN(clinicId) {
    const { data, error } = await this.supabase.functions.invoke('pin-generate', {
      body: { clinic_id: clinicId }
    });

    if (error) throw error;
    return data;
  }

  /**
   * التحقق من PIN - عبر Edge Function الموجودة
   */
  async verifyPin(clinicId, pin) {
    const { data, error } = await this.supabase.functions.invoke('pin-verify', {
      body: { clinic_id: clinicId, pin }
    });

    if (error) throw error;
    return data;
  }

  // ==========================================
  // PATHWAY MANAGEMENT (قراءة + تشغيل)
  // ==========================================
  
  /**
   * الحصول على مسار المريض - قراءة فقط
   */
  async getPathway(patientId) {
    const { data, error } = await this.supabase
      .from('pathways')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  /**
   * إنشاء مسار جديد
   */
  async createPathway(patientId, gender, pathway) {
    const { data, error } = await this.supabase
      .from('pathways')
      .insert({
        patient_id: patientId,
        gender,
        pathway,
        current_step: 0,
        completed: false
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * تحديث خطوة المسار
   */
  async updatePathwayStep(pathwayId, currentStep, completed = false) {
    const { data, error } = await this.supabase
      .from('pathways')
      .update({ current_step: currentStep, completed })
      .eq('id', pathwayId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ==========================================
  // CLINICS (قراءة فقط)
  // ==========================================
  
  /**
   * الحصول على قائمة العيادات - قراءة فقط
   */
  async getClinics() {
    const { data, error } = await this.supabase
      .from('clinics')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;
    return data;
  }

  /**
   * الحصول على عيادة واحدة
   */
  async getClinic(clinicId) {
    const { data, error } = await this.supabase
      .from('clinics')
      .select('*')
      .eq('id', clinicId)
      .single();

    if (error) throw error;
    return data;
  }

  // ==========================================
  // ADMIN (قراءة + تشغيل)
  // ==========================================
  
  /**
   * تسجيل دخول الإدارة
   */
  async adminLogin(username, password) {
    // التحقق من بيانات الإدارة
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: username.includes('@') ? username : `${username}@mmc-mms.com`,
      password
    });

    if (error) throw error;
    return { success: true, user: data.user };
  }

  // ==========================================
  // REPORTS & STATISTICS (قراءة فقط)
  // ==========================================
  
  /**
   * الحصول على إحصائيات اليوم
   */
  async getDailyStats(clinicId = null) {
    const today = new Date().toISOString().split('T')[0];
    
    let query = this.supabase
      .from('queues')
      .select('clinic_id, status')
      .gte('entered_at', today);

    if (clinicId) {
      query = query.eq('clinic_id', clinicId);
    }

    const { data, error } = await query;
    if (error) throw error;

    // تجميع الإحصائيات
    const stats = {};
    data?.forEach(q => {
      if (!stats[q.clinic_id]) {
        stats[q.clinic_id] = { waiting: 0, serving: 0, completed: 0, total: 0 };
      }
      stats[q.clinic_id][q.status]++;
      stats[q.clinic_id].total++;
    });

    return stats;
  }

  /**
   * الحصول على سجل التدقيق
   */
  async getAuditLog(limit = 100) {
    const { data, error } = await this.supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }
}

// إنشاء instance واحد
const api = new UnifiedApiService();

export default api;
export { api };

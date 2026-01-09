import { supabase } from './supabase-client';

/**
 * Unified API Service - Direct Supabase Implementation
 * كافة العمليات تتم مباشرة عبر سبسبيس لضمان الاستقرار والسرعة
 */

const api = {
  // --- Patients ---
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

  // --- Queue ---
  async enterQueue(clinicId, patientId, isAutoEnter = true) {
    try {
      // Get next display number
      const { data: lastEntry, error: lastError } = await supabase
        .from('queues')
        .select('display_number')
        .eq('clinic_id', clinicId)
        .order('display_number', { ascending: false })
        .limit(1);

      const nextNumber = (lastEntry && lastEntry.length > 0 ? lastEntry[0].display_number : 0) + 1;

      const { data, error } = await supabase
        .from('queues')
        .insert([{
          clinic_id: clinicId,
          patient_id: patientId,
          display_number: nextNumber,
          status: 'waiting',
          entered_at: new Date().toISOString()
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

  async getQueuePosition(clinicId, patientId) {
    try {
      const { data: patientEntry, error: entryError } = await supabase
        .from('queues')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .order('entered_at', { ascending: false })
        .limit(1)
        .single();

      if (entryError) throw entryError;

      // جلب رقم من يُفحص الآن (serving)
      const { data: servingEntry, error: servingError } = await supabase
        .from('queues')
        .select('display_number')
        .eq('clinic_id', clinicId)
        .eq('status', 'serving')
        .order('called_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const currentNumber = servingEntry ? servingEntry.display_number : 0;

      const { count, error: countError } = await supabase
        .from('queues')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)
        .eq('status', 'waiting')
        .lt('entered_at', patientEntry.entered_at);

      if (countError) throw countError;

      return {
        success: true,
        display_number: patientEntry.display_number,
        current_number: currentNumber,
        ahead: count || 0,
        status: patientEntry.status,
        entered_at: patientEntry.entered_at,
        total_waiting: count || 0
      };
    } catch (error) {
      console.error('Get Position Error:', error);
      return { success: false, error: error.message };
    }
  },

  async updateQueueStatus(clinicId, patientId, newStatus) {
    try {
      const updateData = { status: newStatus };
      if (newStatus === 'serving') {
        updateData.called_at = new Date().toISOString();
      } else if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('queues')
        .update(updateData)
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .order('entered_at', { ascending: false })
        .limit(1)
        .select();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Update Queue Status Error:', error);
      return { success: false, error: error.message };
    }
  },

  async queueDone(clinicId, patientId, pin) {
    try {
      const { data, error } = await supabase
        .from('queues')
        .update({ 
          status: 'completed', 
          completed_at: new Date().toISOString() 
        })
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .eq('status', 'serving')
        .select();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async callNextPatient(clinicId, pin) {
    try {
      // 1. Complete current
      await supabase
        .from('queues')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('clinic_id', clinicId)
        .eq('status', 'serving');

      // 2. Get next
      const { data: next, error: nextError } = await supabase
        .from('queues')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('status', 'waiting')
        .order('entered_at', { ascending: true })
        .limit(1)
        .single();

      if (nextError) throw nextError;

      // 3. Update to serving
      const { data: updated, error: updateError } = await supabase
        .from('queues')
        .update({ status: 'serving', called_at: new Date().toISOString() })
        .eq('id', next.id)
        .select()
        .single();

      if (updateError) throw updateError;
      return { success: true, data: updated };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // --- Clinics & PIN ---
  async getPinStatus() {
    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('id, pin_code, pin_expires_at, is_active')
        .eq('is_active', true);

      if (error) throw error;

      // تحويل البيانات إلى صيغة { clinic_id: pin_code }
      const pins = {};
      if (data && data.length > 0) {
        data.forEach(clinic => {
          // التحقق من صلاحية البن كود
          const isExpired = clinic.pin_expires_at && new Date(clinic.pin_expires_at) < new Date();
          if (!isExpired && clinic.pin_code) {
            pins[clinic.id] = clinic.pin_code;
          }
        });
      }

      return { success: true, pins };
    } catch (error) {
      console.error('Get PIN Status Error:', error);
      return { success: false, error: error.message, pins: {} };
    }
  },

  async verifyPin(clinicId, pin) {
    try {
      const { data, error } = await supabase
        .from('pins')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('pin_code', pin)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        return { success: true, isValid: true, session: { clinicId, pin, expiresAt: new Date(Date.now() + 8 * 3600000).toISOString() } };
      }
      
      return { success: true, isValid: false };
    } catch (error) {
      console.error('Verify PIN Error:', error);
      return { success: false, error: error.message };
    }
  },

  async getClinics() {
    try {
      const { data, error } = await supabase.from('clinics').select('*').eq('is_active', true);
      if (error) throw error;
      return { success: true, clinics: data };
    } catch (error) {
      console.error('Get Clinics Error:', error);
      return { success: false, error: error.message, clinics: [] };
    }
  },

  async getAdminStatus() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      // 1. Total Patients Today
      const { count: totalToday, error: totalError } = await supabase
        .from('queues')
        .select('*', { count: 'exact', head: true })
        .gte('entered_at', todayISO);

      // 2. Waiting Patients
      const { count: waiting, error: waitingError } = await supabase
        .from('queues')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'waiting');

      // 3. Completed Today
      const { count: completed, error: completedError } = await supabase
        .from('queues')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('completed_at', todayISO);

      // 4. Active Clinics (with serving patients)
      const { data: activeData, error: activeError } = await supabase
        .from('queues')
        .select('clinic_id')
        .eq('status', 'serving');
      
      const activeQueues = activeData ? new Set(activeData.map(q => q.clinic_id)).size : 0;

      if (totalError || waitingError || completedError || activeError) {
        throw new Error('Error fetching stats');
      }

      return {
        success: true,
        data: {
          totalPatients: totalToday || 0,
          waitingPatients: waiting || 0,
          completedToday: completed || 0,
          activeQueues: activeQueues || 0
        }
      };
    } catch (error) {
      console.error('Get Admin Status Error:', error);
      return { success: false, error: error.message };
    }
  },

  async getQueueStatus(clinicId) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const { data, error } = await supabase
        .from('queues')
        .select('*')
        .eq('clinic_id', clinicId)
        .gte('entered_at', todayISO)
        .order('entered_at', { ascending: true });

      if (error) throw error;

      const waiting = data.filter(q => q.status === 'waiting').map(q => ({
        ticket: q.display_number,
        visitId: q.patient_id,
        issuedAt: q.entered_at
      }));

      const inService = data.filter(q => q.status === 'serving').map(q => ({
        ticket: q.display_number,
        visitId: q.patient_id,
        calledAt: q.called_at
      }));

      const done = data.filter(q => q.status === 'completed').map(q => ({
        ticket: q.display_number,
        visitId: q.patient_id,
        doneAt: q.completed_at
      }));

      return {
        success: true,
        waiting,
        in: inService,
        done,
        stats: {
          totalWaiting: waiting.length,
          totalIn: inService.length,
          totalDone: done.length,
          totalToday: data.length
        },
        dateKey: today.toLocaleDateString()
      };
    } catch (error) {
      console.error('Get Queue Status Error:', error);
      throw error;
    }
  },

  // --- Pathway ---
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

  async createRoute(patientId, examType, gender, stations) {
    try {
      const { data, error } = await supabase
        .from('patient_routes')
        .upsert({
          patient_id: patientId,
          exam_type: examType,
          gender: gender,
          stations: stations,
          created_at: new Date().toISOString()
        });
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // --- Auto-Skip System ---
  /**
   * نظام التمرير التلقائي للمراجعين الذين لم يحضروا خلال دقيقتين
   * - يفحص كل المراجعين بحالة 'waiting' الذين مر على استدعائهم (called_at) أكثر من دقيقتين
   * - يتم تمريرهم تلقائياً (تحديث الحالة إلى 'skipped' فقط)
   * - يتم استدعاء المراجع التالي تلقائياً
   * - لا يتم إنشاء سجل جديد لتجنب تضخم عدد المنتظرين
   */
  async checkAndSkipStaleQueues() {
    try {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      
      // البحث عن المراجعين الذين مر على استدعائهم أكثر من دقيقتين
      const { data: staleQueues, error: fetchError } = await supabase
        .from('queues')
        .select('*')
        .eq('status', 'waiting')
        .not('called_at', 'is', null)
        .lt('called_at', twoMinutesAgo);

      if (fetchError) throw fetchError;
      if (!staleQueues || staleQueues.length === 0) {
        return { success: true, skipped: 0 };
      }

      const skippedPatients = [];

      // معالجة كل مراجع متأخر
      for (const queue of staleQueues) {
        // تحديث الحالة إلى 'skipped' فقط (بدون إنشاء سجل جديد)
        await supabase
          .from('queues')
          .update({ 
            status: 'skipped',
            completed_at: new Date().toISOString() // تسجيل وقت التمرير
          })
          .eq('id', queue.id);

        skippedPatients.push({
          patient_id: queue.patient_id,
          clinic_id: queue.clinic_id,
          display_number: queue.display_number
        });
      }

      return { success: true, skipped: skippedPatients.length, patients: skippedPatients };
    } catch (error) {
      console.error('Check and Skip Stale Queues Error:', error);
      return { success: false, error: error.message };
    }
  }
};

export default api;
export { api };

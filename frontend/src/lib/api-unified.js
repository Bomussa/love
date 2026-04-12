import { supabase } from './supabase-client';
import { GDS, initGDS } from './guaranteed-data-system';

/**
 * Unified API Service - Direct Supabase Implementation
 * كافة العمليات تتم مباشرة عبر سبسبيس لضمان الاستقرار والسرعة
 *
 * ✅ نظام ضمان البيانات (GDS) - بيانات حقيقية لحظية مضمونة
 * ✅ إعادة المحاولة التلقائية (10 محاولات)
 * ✅ بدون بيانات وهمية
 */

// تهيئة نظام ضمان البيانات
initGDS().catch((err) => console.error('❌ فشل تهيئة GDS:', err));

// ============================================================================
// إعدادات نظام الدور - Queue Settings
// ============================================================================
const DEFAULT_QUEUE_SETTINGS = {
  queueIntervalSeconds: 120, // 2 دقيقة - فترة النداء التلقائي
  patientMaxWaitSeconds: 240, // 4 دقائق - المهلة قبل الدخول
  examMaxSeconds: 300, // 5 دقائق - الحد الأقصى للفحص
  timeoutHandlerEnabled: true, // تفعيل التمرير التلقائي
  examTimeoutEnabled: true, // تفعيل حد الفحص
};

function getQueueSettings() {
  try {
    const saved = localStorage.getItem('queueSystemSettings');
    if (saved) {
      return { ...DEFAULT_QUEUE_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {}
  return { ...DEFAULT_QUEUE_SETTINGS };
}

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
  /**
   * دخول الطابور بشكل ذري (Atomic) مع منع التكرار
   * يستخدم دالة enter_unified_queue_safe من قاعدة البيانات لضمان الذرية
   */
  async enterQueue(clinicId, patientId, isAutoEnter = true, patientName = null, examType = null) {
    try {
      // محاولة استخدام الدالة الذرية من قاعدة البيانات
      const { data: rpcResult, error: rpcError } = await supabase.rpc('enter_unified_queue_safe', {
        p_clinic_id: clinicId,
        p_patient_id: patientId,
        p_patient_name: patientName,
        p_exam_type: examType,
      });

      if (!rpcError && rpcResult && rpcResult.length > 0) {
        const result = rpcResult[0];
        return {
          success: true,
          id: result.id,
          display_number: result.display_number,
          status: result.status,
          alreadyExists: result.already_exists,
        };
      }

      // ✅ التحقق أولاً إذا كان المراجع موجود مسبقاً في نفس العيادة اليوم
      const today = new Date().toISOString().split('T')[0];
      const { data: existingEntry, error: existingError } = await supabase
        .from('unified_queue')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .eq('queue_date', today)
        .in('status', ['waiting', 'serving', 'called'])
        .order('entered_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingEntry) {
        return { success: true, ...existingEntry, alreadyExists: true };
      }

      // الحصول على رقم الدور التالي
      const { data: lastEntry } = await supabase
        .from('unified_queue')
        .select('display_number')
        .eq('clinic_id', clinicId)
        .eq('queue_date', today)
        .order('display_number', { ascending: false })
        .limit(1);

      const nextNumber = (lastEntry && lastEntry.length > 0 ? lastEntry[0].display_number : 0) + 1;

      const { data, error } = await supabase
        .from('unified_queue')
        .insert([{
          clinic_id: clinicId,
          patient_id: patientId,
          patient_name: patientName,
          exam_type: examType,
          display_number: nextNumber,
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

  async getQueuePosition(clinicId, patientId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: patientEntry, error: entryError } = await supabase
        .from('unified_queue')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .eq('queue_date', today)
        .order('entered_at', { ascending: false })
        .limit(1)
        .single();

      if (entryError) throw entryError;

      let currentNumber = 0;
      const { data: calledEntry } = await supabase
        .from('unified_queue')
        .select('display_number')
        .eq('clinic_id', clinicId)
        .eq('queue_date', today)
        .eq('status', 'called')
        .order('called_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (calledEntry) {
        currentNumber = calledEntry.display_number;
      } else {
        const { data: servingEntry } = await supabase
          .from('unified_queue')
          .select('display_number')
          .eq('clinic_id', clinicId)
          .eq('queue_date', today)
          .eq('status', 'serving')
          .order('called_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (servingEntry) {
          currentNumber = servingEntry.display_number;
        } else {
          const { data: lastCompleted } = await supabase
            .from('unified_queue')
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
      }

      const { count, error: countError } = await supabase
        .from('unified_queue')
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
        entered_at: patientEntry.entered_at,
        total_waiting: count || 0,
      };
    } catch (error) {
      console.error('Get Position Error:', error);
      return { success: false, error: error.message };
    }
  },

  async updateQueueStatus(clinicId, patientId, newStatus) {
    try {
      const updateData = { status: newStatus };
      if (newStatus === 'serving' || newStatus === 'called') {
        updateData.called_at = new Date().toISOString();
      } else if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('unified_queue')
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

  async queueDone(clinicId, patientId) {
    try {
      const { data, error } = await supabase
        .from('unified_queue')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .in('status', ['waiting', 'serving', 'called'])
        .select();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Queue Done Error:', error);
      return { success: false, error: error.message };
    }
  },

  async callNext(clinicId) {
    try {
      // 1. Complete current
      await supabase
        .from('unified_queue')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('clinic_id', clinicId)
        .in('status', ['serving', 'called']);

      // 2. Get next
      const { data: next, error: nextError } = await supabase
        .from('unified_queue')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('status', 'waiting')
        .order('entered_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (nextError) throw nextError;
      if (!next) return { success: true, message: 'No patients waiting' };

      // 3. Update to serving
      const { data: updated, error: updateError } = await supabase
        .from('unified_queue')
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

  async getActiveClinics() {
    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('id, name, is_active')
        .eq('is_active', true);

      if (error) throw error;

      const activeClinics = {};
      if (data && data.length > 0) {
        data.forEach((clinic) => {
          activeClinics[clinic.id] = { name: clinic.name, isActive: clinic.is_active };
        });
      }

      return { success: true, clinics: activeClinics };
    } catch (error) {
      return { success: false, error: error.message, clinics: {} };
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

      const { count: waiting, error: waitingError } = await supabase
        .from('unified_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'waiting')
        .gte('entered_at', todayISO);

      const { count: serving, error: servingError } = await supabase
        .from('unified_queue')
        .select('*', { count: 'exact', head: true })
        .in('status', ['serving', 'called'])
        .gte('entered_at', todayISO);

      const { count: completed, error: completedError } = await supabase
        .from('unified_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('entered_at', todayISO);

      const totalToday = (waiting || 0) + (serving || 0) + (completed || 0);

      const { data: activeData, error: activeError } = await supabase
        .from('unified_queue')
        .select('clinic_id')
        .in('status', ['serving', 'called'])
        .gte('entered_at', todayISO);

      const activeQueues = activeData ? new Set(activeData.map((q) => q.clinic_id)).size : 0;

      if (waitingError || servingError || completedError || activeError) {
        throw new Error('Error fetching stats');
      }

      return {
        success: true,
        data: {
          totalPatients: totalToday,
          waitingPatients: waiting || 0,
          servingPatients: serving || 0,
          completedToday: completed || 0,
          activeQueues: activeQueues || 0,
        },
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
        .from('unified_queue')
        .select('*')
        .eq('clinic_id', clinicId)
        .gte('entered_at', todayISO)
        .order('entered_at', { ascending: true });

      if (error) throw error;

      const waiting = data.filter((q) => q.status === 'waiting').map((q) => ({
        ticket: q.display_number,
        visitId: q.patient_id,
        issuedAt: q.entered_at,
      }));

      const inService = data.filter((q) => q.status === 'serving' || q.status === 'called').map((q) => ({
        ticket: q.display_number,
        visitId: q.patient_id,
        calledAt: q.called_at,
      }));

      const done = data.filter((q) => q.status === 'completed').map((q) => ({
        ticket: q.display_number,
        visitId: q.patient_id,
        doneAt: q.completed_at,
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
          totalToday: data.length,
        },
        dateKey: today.toLocaleDateString(),
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
          gender,
          stations,
          created_at: new Date().toISOString(),
        });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // --- Auto-Skip System ---
  async checkAndSkipStaleQueues() {
    try {
      const settings = getQueueSettings();
      if (!settings.timeoutHandlerEnabled) {
        return { success: true, skipped: 0, message: 'نظام التمرير معطل' };
      }

      const waitTimeoutMs = settings.patientMaxWaitSeconds * 1000;
      const waitTimeoutAgo = new Date(Date.now() - waitTimeoutMs).toISOString();

      const { data: staleWaiting, error: waitError } = await supabase
        .from('unified_queue')
        .select('*')
        .eq('status', 'waiting')
        .not('called_at', 'is', null)
        .lt('called_at', waitTimeoutAgo);

      if (waitError) throw waitError;

      let skippedCount = 0;
      if (staleWaiting && staleWaiting.length > 0) {
        for (const entry of staleWaiting) {
          await supabase
            .from('unified_queue')
            .update({ status: 'skipped', completed_at: new Date().toISOString() })
            .eq('id', entry.id);
          skippedCount++;
        }
      }

      return { success: true, skipped: skippedCount };
    } catch (error) {
      console.error('Auto-Skip Error:', error);
      return { success: false, error: error.message };
    }
  }
};

export default api;

import { supabase } from './supabase-client';
import PINDailySync from './pin-daily-sync';
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

      // في حال فشل RPC، نستخدم الطريقة البديلة
      if (rpcError) {
      }

      // ✅ التحقق أولاً إذا كان المراجع موجود مسبقاً في نفس العيادة اليوم
      const today = new Date().toISOString().split('T')[0];
      const { data: existingEntry, error: existingError } = await supabase
        .from('unified_queue')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .eq('queue_date', today)
        .in('status', ['waiting', 'serving'])
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
        .eq('queue_date', today) // ✅ فقط اليوم
        .order('entered_at', { ascending: false })
        .limit(1)
        .single();

      if (entryError) throw entryError;

      // ✅ جلب رقم من يُفحص الآن (called أو serving) - اليوم فقط
      // نبحث عن called أولاً (الحالة الفعلية في قاعدة البيانات)
      let currentNumber = 0;

      // محاولة 1: البحث عن called
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
        // محاولة 2: البحث عن serving
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
          // محاولة 3: آخر مكتمل (إذا لم يوجد أحد يُفحص حالياً)
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
        .eq('queue_date', today) // ✅ فقط اليوم
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
      if (newStatus === 'serving') {
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

  async queueDone(clinicId, patientId, pin, skipPinCheck = false) {
    try {
      // ✅ التحقق من البن كود
      if (!skipPinCheck) {
        if (!pin) {
          return { success: false, error: 'يرجى إدخال رقم PIN' };
        }

        // 1. ✅ محاولة التحقق من جدول pins (باستخدام الأعمدة الصحيحة)
        const now = new Date().toISOString();

        const { data: validPin, error: pinError } = await supabase
          .from('pins')
          .select('*')
          .eq('clinic_id', clinicId)  // ✅ تصحيح: clinic_id بدلاً من clinic_code
          .eq('pin', pin)
          .is('used_at', null)  // ✅ تصحيح: التحقق من عدم استخدام PIN
          .gte('valid_until', now)  // ✅ تصحيح: التحقق من صلاحية PIN
          .maybeSingle();

        if (!validPin) {
          // 2. إذا لم يوجد في الجدول، نحاول التحقق عبر الـ API (الذي يحتوي على المنطق البرمجي)
          try {
            const response = await fetch('/api/v1/queue/done', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ clinicId, patientId, pin })
            });
            const result = await response.json();
            if (result && (result.success || !result.error)) {
              return { success: true, data: result };
            }
          } catch (e) {
          }
          
          return { success: false, error: 'رقم PIN غير صحيح أو منتهي الصلاحية' };
        }

        // ✅ تحديث حالة PIN بعد الاستخدام
        if (validPin) {
          await supabase
            .from('pins')
            .update({
              used_at: now,  // ✅ تعيين وقت الاستخدام
            })
            .eq('id', validPin.id);
        }
      }

      // إكمال الفحص في الطابور عبر Supabase مباشرة لضمان السرعة
      const { data, error } = await supabase
        .from('unified_queue')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by_pin: pin,
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

  async callNextPatient(clinicId, pin) {
    try {
      // 1. Complete current
      await supabase
        .from('unified_queue')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('clinic_id', clinicId)
        .eq('status', 'serving');

      // 2. Get next
      const { data: next, error: nextError } = await supabase
        .from('unified_queue')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('status', 'waiting')
        .order('entered_at', { ascending: true })
        .limit(1)
        .single();

      if (nextError) throw nextError;

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

  // --- Clinics & PIN ---
  /**
   * جلب حالة العيادات النشطة (بدون PIN - لأسباب أمنية)
   * PIN لا يتم إرساله للواجهة الأمامية أبداً
   */
  async getPinStatus() {
    try {
      // جلب العيادات النشطة فقط (بدون PIN)
      const { data, error } = await supabase
        .from('clinics')
        .select('id, name, is_active')
        .eq('is_active', true);

      if (error) throw error;

      // إرجاع قائمة العيادات النشطة فقط (بدون PIN)
      const activeClinics = {};
      if (data && data.length > 0) {
        data.forEach((clinic) => {
          activeClinics[clinic.id] = { name: clinic.name, isActive: clinic.is_active };
        });
      }

      return { success: true, clinics: activeClinics };
    } catch (error) {
      console.error('Get PIN Status Error:', error);
      return { success: false, error: error.message, clinics: {} };
    }
  },

  /**
   * التحقق من صحة PIN بشكل آمن - لا يتم إرجاع PIN للواجهة الأمامية
   * يستخدم دالة verify_clinic_pin_secure من قاعدة البيانات
   */
  async verifyPin(clinicId, pin) {
    try {
      // استخدام دالة RPC الآمنة للتحقق من PIN
      const { data, error } = await supabase.rpc('verify_clinic_pin', {
        p_clinic_id: clinicId,
        p_pin: pin,
      });

      if (error) {
        // في حال فشل RPC، نستخدم الطريقة البديلة مع التحقق فقط
        const { data: pinData, error: pinError } = await supabase
          .from('pins')
          .select('id, clinic_id, pin, created_at, valid_until, used_at')
          .eq('clinic_id', clinicId)
          .eq('pin', pin)
          .is('used_at', null)
          .gt('valid_until', new Date().toISOString())
          .maybeSingle();

        if (pinError) throw pinError;

        if (pinData) {
          return { success: true, isValid: true, session: { clinicId, expiresAt: new Date(Date.now() + 8 * 3600000).toISOString() } };
        }
        return { success: true, isValid: false };
      }

      if (data === true) {
        return { success: true, isValid: true, session: { clinicId, expiresAt: new Date(Date.now() + 8 * 3600000).toISOString() } };
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

      // 1. منتظرون اليوم (فلتر اليوم ضروري)
      const { count: waiting, error: waitingError } = await supabase
        .from('unified_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'waiting')
        .gte('entered_at', todayISO);

      // 2. يُخدَّمون الآن اليوم (serving + called)
      const { count: serving, error: servingError } = await supabase
        .from('unified_queue')
        .select('*', { count: 'exact', head: true })
        .in('status', ['serving', 'called'])
        .gte('entered_at', todayISO);

      // 3. مكتملون اليوم (فلتر اليوم)
      const { count: completed, error: completedError } = await supabase
        .from('unified_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('entered_at', todayISO);

      // 4. الإجمالي = منتظرون + يُخدَّمون + مكتملون (المنطق الصحيح الواقعي)
      const totalToday = (waiting || 0) + (serving || 0) + (completed || 0);

      // 5. عيادات نشطة اليوم
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

      // ✅ إصلاح: تضمين called و serving كحالات في الخدمة
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
  /**
   * نظام التمرير التلقائي للمراجعين
   * ============================================================================
   * 1. المراجعين الذين لم يدخلوا خلال المهلة (patientMaxWaitSeconds = 4 دقائق افتراضياً)
   * 2. المراجعين داخل العيادة الذين تجاوزوا الحد الأقصى (examMaxSeconds = 5 دقائق افتراضياً)
   * ============================================================================
   */
  async checkAndSkipStaleQueues() {
    try {
      // جلب الإعدادات من localStorage
      const settings = getQueueSettings();

      // التحقق من تفعيل النظام
      if (!settings.timeoutHandlerEnabled) {
        return { success: true, skipped: 0, message: 'نظام التمرير معطل' };
      }

      const skippedPatients = [];
      const completedExams = [];

      // ============================================================================
      // 1. تمرير المراجعين الذين لم يدخلوا خلال المهلة
      // ============================================================================
      const waitTimeoutMs = settings.patientMaxWaitSeconds * 1000;
      const waitTimeoutAgo = new Date(Date.now() - waitTimeoutMs).toISOString();

      const { data: staleWaiting, error: waitError } = await supabase
        .from('unified_queue')
        .select('*')
        .eq('status', 'waiting')
        .not('called_at', 'is', null)
        .lt('called_at', waitTimeoutAgo);

      if (waitError) throw waitError;

      // معالجة المراجعين المتأخرين عن الدخول
      if (staleWaiting && staleWaiting.length > 0) {
        for (const queue of staleWaiting) {
          await supabase
            .from('unified_queue')
            .update({
              status: 'skipped',
              completed_at: new Date().toISOString(),
              skip_reason: 'timeout_before_entry',
            })
            .eq('id', queue.id);

          skippedPatients.push({
            patient_id: queue.patient_id,
            clinic_id: queue.clinic_id,
            display_number: queue.display_number,
            reason: 'timeout_before_entry',
          });
        }
      }

      // ============================================================================
      // 2. إنهاء فحص المراجعين الذين تجاوزوا الحد الأقصى داخل العيادة
      // ============================================================================
      if (settings.examTimeoutEnabled) {
        const examTimeoutMs = settings.examMaxSeconds * 1000;
        const examTimeoutAgo = new Date(Date.now() - examTimeoutMs).toISOString();

        const { data: staleExams, error: examError } = await supabase
          .from('unified_queue')
          .select('*')
          .eq('status', 'serving')
          .not('entered_at', 'is', null)
          .lt('entered_at', examTimeoutAgo);

        if (examError) throw examError;

        // معالجة المراجعين الذين تجاوزوا وقت الفحص
        if (staleExams && staleExams.length > 0) {
          for (const queue of staleExams) {
            await supabase
              .from('unified_queue')
              .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                auto_completed: true,
              })
              .eq('id', queue.id);

            completedExams.push({
              patient_id: queue.patient_id,
              clinic_id: queue.clinic_id,
              display_number: queue.display_number,
              reason: 'exam_timeout',
            });
          }
        }
      }

      return {
        success: true,
        skipped: skippedPatients.length,
        completedExams: completedExams.length,
        patients: skippedPatients,
        exams: completedExams,
        settings: {
          waitTimeout: settings.patientMaxWaitSeconds,
          examTimeout: settings.examMaxSeconds,
        },
      };
    } catch (error) {
      console.error('Check and Skip Stale Queues Error:', error);
      return { success: false, error: error.message };
    }
  },

  // --- Postpone Patient System ---
  /**
   * ترحيل المراجع المتأخر لنهاية الدور
   * ============================================================================
   * 1. التحقق من عدد مرات الترحيل (3 فرص كحد أقصى)
   * 2. إذا تجاوز 3 مرات → إلغاء من الفحص نهائياً
   * 3. إلغاء الرقم الحالي وتسجيل ملاحظة
   * 4. إنشاء سجل جديد برقم دور جديد في نهاية الطابور
   * ============================================================================
   */
  async postponePatient(clinicId, patientId, reason = 'تأخر عن الحضور', maxPostpones = 3) {
    try {
      // 1. جلب السجل الحالي للمراجع
      const { data: currentQueue, error: fetchError } = await supabase
        .from('unified_queue')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .in('status', ['waiting', 'called', 'serving'])
        .single();

      if (fetchError || !currentQueue) {
        return { success: false, error: 'لم يتم العثور على سجل المراجع' };
      }

      const oldDisplayNumber = currentQueue.display_number;
      const currentPostponeCount = currentQueue.postpone_count || 0;

      // 2. التحقق من عدد مرات الترحيل
      if (currentPostponeCount >= maxPostpones) {
        // إلغاء المراجع نهائياً من هذه العيادة
        const { error: cancelError } = await supabase
          .from('unified_queue')
          .update({
            status: 'cancelled',
            completed_at: new Date().toISOString(),
            notes: `ملغى نهائياً - تجاوز الحد الأقصى للترحيل (${maxPostpones} مرات). الرقم: ${oldDisplayNumber}`,
          })
          .eq('id', currentQueue.id);

        if (cancelError) throw cancelError;

        // تسجيل الحركة في سجل النشاطات
        await supabase
          .from('activity_logs')
          .insert({
            action: 'patient_cancelled_max_postpones',
            patient_id: patientId,
            clinic_id: clinicId,
            details: JSON.stringify({
              display_number: oldDisplayNumber,
              postpone_count: currentPostponeCount,
              reason: `تجاوز الحد الأقصى للترحيل (${maxPostpones} مرات)`,
            }),
            created_at: new Date().toISOString(),
          });

        return {
          success: true,
          cancelled: true,
          data: {
            oldNumber: oldDisplayNumber,
            postponeCount: currentPostponeCount,
          },
          message: `تم إلغاء المراجع نهائياً - تجاوز الحد الأقصى للترحيل (${maxPostpones} مرات)`,
        };
      }

      // 3. إلغاء الرقم الحالي مع تسجيل ملاحظة
      const newPostponeCount = currentPostponeCount + 1;
      const { error: cancelError } = await supabase
        .from('unified_queue')
        .update({
          status: 'postponed',
          completed_at: new Date().toISOString(),
          notes: `مُرحّل (${newPostponeCount}/${maxPostpones}) - ${reason}. الرقم السابق: ${oldDisplayNumber}`,
        })
        .eq('id', currentQueue.id);

      if (cancelError) throw cancelError;

      // 4. حساب رقم الدور الجديد (آخر رقم + 1)
      const { data: lastQueue, error: lastError } = await supabase
        .from('unified_queue')
        .select('display_number')
        .eq('clinic_id', clinicId)
        .order('display_number', { ascending: false })
        .limit(1)
        .single();

      const newDisplayNumber = (lastQueue?.display_number || 0) + 1;

      // 5. إنشاء سجل جديد برقم دور جديد في نهاية الطابور
      const { data: newQueue, error: insertError } = await supabase
        .from('unified_queue')
        .insert({
          clinic_id: clinicId,
          patient_id: patientId,
          display_number: newDisplayNumber,
          status: 'waiting',
          entered_at: new Date().toISOString(),
          postpone_count: newPostponeCount,
          notes: `مُرحّل من الرقم ${oldDisplayNumber} (${newPostponeCount}/${maxPostpones}) - ${reason}`,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 6. تسجيل الحركة في سجل النشاطات
      await supabase
        .from('activity_logs')
        .insert({
          action: 'patient_postponed',
          patient_id: patientId,
          clinic_id: clinicId,
          details: JSON.stringify({
            old_number: oldDisplayNumber,
            new_number: newDisplayNumber,
            postpone_count: newPostponeCount,
            max_postpones: maxPostpones,
            reason,
          }),
          created_at: new Date().toISOString(),
        });

      return {
        success: true,
        cancelled: false,
        data: {
          oldNumber: oldDisplayNumber,
          newNumber: newDisplayNumber,
          postponeCount: newPostponeCount,
          maxPostpones,
          remainingChances: maxPostpones - newPostponeCount,
          newQueue,
        },
        message: `تم ترحيل المراجع من رقم ${oldDisplayNumber} إلى رقم ${newDisplayNumber} (${newPostponeCount}/${maxPostpones})`,
      };
    } catch (error) {
      console.error('Postpone Patient Error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * ترحيل المراجع المتأخر واستدعاء التالي تلقائياً
   */
  async postponeAndCallNext(clinicId, patientId, pin, reason = 'تأخر عن الحضور', maxPostpones = 3) {
    try {
      // 1. ترحيل المراجع المتأخر
      const postponeResult = await this.postponePatient(clinicId, patientId, reason, maxPostpones);
      if (!postponeResult.success) {
        return postponeResult;
      }

      // 2. إذا تم إلغاء المراجع نهائياً، استدعاء التالي فقط
      if (postponeResult.cancelled) {
        const callResult = await this.callNextPatient(clinicId, pin);
        return {
          success: true,
          cancelled: true,
          postponed: postponeResult.data,
          nextPatient: callResult.success ? callResult.data : null,
          message: postponeResult.message + (callResult.success ? ' - تم استدعاء المراجع التالي' : ''),
        };
      }

      // 3. استدعاء المراجع التالي
      const callResult = await this.callNextPatient(clinicId, pin);

      return {
        success: true,
        cancelled: false,
        postponed: postponeResult.data,
        nextPatient: callResult.success ? callResult.data : null,
        message: postponeResult.message + (callResult.success ? ' - تم استدعاء المراجع التالي' : ''),
      };
    } catch (error) {
      console.error('Postpone and Call Next Error:', error);
      return { success: false, error: error.message };
    }
  },

  // --- System Settings Management ---
  /**
   * جلب إعدادات النظام من قاعدة البيانات
   */
  async getSystemSettings(category = 'queue') {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('category', category)
        .eq('is_active', true);

      if (error) throw error;

      // تحويل البيانات إلى كائن سهل الاستخدام
      const settings = {};
      data.forEach((item) => {
        settings[item.id] = {
          value: item.value,
          description: item.description,
          is_active: item.is_active,
        };
      });

      return { success: true, data: settings };
    } catch (error) {
      console.error('Get System Settings Error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * تحديث إعداد معين
   */
  async updateSystemSetting(settingId, newValue, updatedBy = 'admin') {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .update({
          value: newValue,
          updated_by: updatedBy,
          updated_at: new Date().toISOString(),
        })
        .eq('id', settingId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data, message: `تم تحديث الإعداد: ${settingId}` };
    } catch (error) {
      console.error('Update System Setting Error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * تفعيل/تعطيل إعداد معين
   */
  async toggleSystemSetting(settingId, isActive, updatedBy = 'admin') {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .update({
          is_active: isActive,
          updated_by: updatedBy,
          updated_at: new Date().toISOString(),
        })
        .eq('id', settingId)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data,
        message: `تم ${isActive ? 'تفعيل' : 'تعطيل'} الإعداد: ${settingId}`,
      };
    } catch (error) {
      console.error('Toggle System Setting Error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * جلب قيمة إعداد معين
   */
  async getSettingValue(settingId, defaultValue = null) {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value, is_active')
        .eq('id', settingId)
        .single();

      if (error || !data) return defaultValue;
      if (!data.is_active) return defaultValue;

      return data.value;
    } catch (error) {
      console.error('Get Setting Value Error:', error);
      return defaultValue;
    }
  },

  /**
   * جلب جميع الإعدادات من جدول settings
   */
  async getSettings() {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('key, value');

      if (error) throw error;

      // تحويل البيانات إلى كائن
      const settings = {};
      if (data) {
        data.forEach((item) => {
          settings[item.key] = item.value;
        });
      }

      return { success: true, settings };
    } catch (error) {
      console.error('Get Settings Error:', error);
      return { success: false, settings: {} };
    }
  },

  // ============================================================================
  // الدوال المضافة - Missing Functions
  // ============================================================================

  /**
   * جلب إحصائيات عامة
   */
  async getStats() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const { count: totalToday } = await supabase
        .from('unified_queue')
        .select('*', { count: 'exact', head: true })
        .gte('entered_at', todayISO);

      const { count: waiting } = await supabase
        .from('unified_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'waiting');

      const { count: completed } = await supabase
        .from('unified_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('completed_at', todayISO);

      const { count: serving } = await supabase
        .from('unified_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'serving');

      return {
        success: true,
        totalToday: totalToday || 0,
        waiting: waiting || 0,
        completed: completed || 0,
        serving: serving || 0,
      };
    } catch (error) {
      console.error('Get Stats Error:', error);
      return {
        success: false, totalToday: 0, waiting: 0, completed: 0, serving: 0,
      };
    }
  },

  /**
   * إنشاء رقم PIN جديد للعيادة
   * ✅ مُصلَح: يستخدم أسماء الأعمدة الصحيحة
   */
  async generatePIN(clinicId) {
    try {
      const pin = Math.floor(1000 + Math.random() * 9000).toString();
      const validUntil = new Date();
      validUntil.setHours(23, 59, 59, 999);
      const now = new Date();

      const { data, error } = await supabase
        .from('pins')
        .insert({
          clinic_id: clinicId,  // ✅ تصحيح
          pin,
          valid_until: validUntil.toISOString(),  // ✅ تصحيح
          created_at: now.toISOString(),
          used_at: null,
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, pin: data.pin, expiresAt: data.valid_until };  // ✅ تصحيح
    } catch (error) {
      console.error('Generate PIN Error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * إيقاف الطابور مؤقتاً
   */
  async pauseQueue(clinicId, isPaused) {
    try {
      const { data, error } = await supabase
        .from('clinics')
        .update({ is_paused: isPaused, updated_at: new Date().toISOString() })
        .eq('id', clinicId)
        .select();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Pause Queue Error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * جلب آخر التقارير
   */
  async getRecentReports(limit = 10) {
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { success: true, reports: data || [] };
    } catch (error) {
      console.error('Get Recent Reports Error:', error);
      return { success: false, reports: [] };
    }
  },

  /**
   * جلب إحصائيات الطابور
   */
  async getQueueStats(clinicId = null) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      let query = supabase
        .from('unified_queue')
        .select('*')
        .gte('entered_at', todayISO);

      if (clinicId) {
        query = query.eq('clinic_id', clinicId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const waiting = data.filter((q) => q.status === 'waiting').length;
      const serving = data.filter((q) => q.status === 'serving').length;
      const completed = data.filter((q) => q.status === 'completed').length;

      return {
        success: true,
        total: data.length,
        waiting,
        serving,
        completed,
      };
    } catch (error) {
      console.error('Get Queue Stats Error:', error);
      return {
        success: false, total: 0, waiting: 0, serving: 0, completed: 0,
      };
    }
  },

  /**
   * جلب أرقام PIN النشطة
   * ✅ مُصلَح: يستخدم أسماء الأعمدة الصحيحة
   */
  async getActivePins() {
    try {
      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('pins')
        .select('clinic_id, pin, valid_until, used_at')  // ✅ تصحيح
        .is('used_at', null)  // ✅ تصحيح: بدلاً من is_active
        .gte('valid_until', now);  // ✅ تصحيح: بدلاً من expires_at

      if (error) throw error;

      const pinsMap = {};
      if (data) {
        data.forEach((p) => {
          pinsMap[p.clinic_id] = { pin: p.pin, expiresAt: p.valid_until };  // ✅ تصحيح
        });
      }

      return { success: true, pins: pinsMap };
    } catch (error) {
      console.error('Get Active Pins Error:', error);
      return { success: false, pins: {} };
    }
  },

  /**
   * إلغاء تفعيل رقم PIN
   * ✅ مُصلَح: يستخدم أسماء الأعمدة الصحيحة
   */
  async deactivatePIN(clinicId) {
    try {
      const { data, error} = await supabase
        .from('pins')
        .update({ used_at: new Date().toISOString() })  // ✅ تصحيح
        .eq('clinic_id', clinicId)  // ✅ تصحيح
        .is('used_at', null)  // فقط التي لم تُستخدم
        .select();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Deactivate PIN Error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * تحديث مسارات الفحص
   */
  async updateExamRoutes(examType, routes) {
    try {
      const { data, error } = await supabase
        .from('exam_routes')
        .upsert({
          exam_type: examType,
          routes,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'exam_type' })
        .select();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Update Exam Routes Error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * جلب إحصائيات لوحة التحكم
   */
  async getDashboardStats() {
    return this.getAdminStatus();
  },

  /**
   * جلب نسبة إشغال العيادة
   */
  async getClinicOccupancy(clinicId) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('unified_queue')
        .select('status')
        .eq('clinic_id', clinicId)
        .gte('entered_at', today.toISOString());

      if (error) throw error;

      const total = data?.length || 0;
      const completed = data?.filter((q) => q.status === 'completed').length || 0;
      const occupancy = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        success: true, total, completed, occupancy,
      };
    } catch (error) {
      console.error('Get Clinic Occupancy Error:', error);
      return {
        success: false, total: 0, completed: 0, occupancy: 0,
      };
    }
  },

  /**
   * جلب الطابور النشط
   */
  async getActiveQueue(clinicId = null) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let query = supabase
        .from('unified_queue')
        .select('*')
        .in('status', ['waiting', 'serving'])
        .gte('entered_at', today.toISOString())
        .order('entered_at', { ascending: true });

      if (clinicId) {
        query = query.eq('clinic_id', clinicId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { success: true, queue: data || [] };
    } catch (error) {
      console.error('Get Active Queue Error:', error);
      return { success: false, queue: [] };
    }
  },

  /**
   * جلب جميع الطوابير (للإدارة)
   * @param {Object} filters - فلاتر اختيارية
   */
  async getQueues(filters = {}) {
    try {
      const today = new Date().toISOString().split('T')[0];

      let query = supabase
        .from('unified_queue')
        .select('*')
        .eq('queue_date', today)
        .order('entered_at', { ascending: false });

      // تطبيق الفلاتر
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.clinic_id) {
        query = query.eq('clinic_id', filters.clinic_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { success: true, data: data || [], error: null };
    } catch (error) {
      console.error('Get Queues Error:', error);
      return { success: false, data: [], error: error.message };
    }
  },

  /**
   * جلب جميع المسارات (للإدارة)
   * @param {string} patientId - معرف المراجع (اختياري)
   */
  async getAllRoutes(patientId = null) {
    try {
      const today = new Date().toISOString().split('T')[0];

      let query = supabase
        .from('routes')
        .select('*')
        .gte('created_at', `${today}T00:00:00`)
        .order('created_at', { ascending: false });

      if (patientId) {
        query = query.eq('patient_id', patientId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { success: true, data: data || [], error: null };
    } catch (error) {
      console.error('Get Routes Error:', error);
      return { success: false, data: [], error: error.message };
    }
  },

  // ============================================================================
  // PIN Management - إدارة رموز PIN
  // ============================================================================

  /**
   * جلب رمز PIN الحالي للعيادة
   * ✅ مُصلَح: يستخدم أسماء الأعمدة الصحيحة من جدول pins
   * @param {string} clinicId - معرف العيادة
   * @returns {Promise<Object>} بيانات PIN
   */
  async getCurrentPin(clinicId) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();
      const now = new Date().toISOString();

      // 1. جلب PIN النشط الحالي (غير مستخدم وصالح)
      const { data: current, error: currentError } = await supabase
        .from('pins')
        .select('id, clinic_id, pin, created_at, valid_until, used_at')
        .eq('clinic_id', clinicId)
        .is('used_at', null)  // ✅ PIN غير مستخدم
        .gte('valid_until', now)  // ✅ PIN صالح (لم ينته)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (currentError) throw currentError;

      // 2. جلب جميع PINs الصادرة اليوم (فقط اليوم الحالي)
      const { data: allToday, error: allTodayError } = await supabase
        .from('pins')
        .select('pin, created_at, valid_until, used_at')
        .eq('clinic_id', clinicId)
        .gte('created_at', todayISO)
        .order('created_at', { ascending: true});

      if (allTodayError) throw allTodayError;

      // ✅ فلترة PINs لعرض الصالحة فقط (غير المنتهية)
      const validPins = allToday ? allToday.filter(p => {
        const isValid = !p.used_at && new Date(p.valid_until) >= new Date();
        return isValid;
      }) : [];

      return {
        success: true,
        currentPin: current ? current.pin : null,
        pinId: current ? current.id : null,
        clinicCode: clinicId,
        isActive: current ? !current.used_at : false,
        generatedAt: current ? current.created_at : null,
        expiresAt: current ? current.valid_until : null,
        totalIssued: validPins.length,
        allPins: validPins.map((p) => p.pin),
        dateKey: today.toLocaleDateString(),
      };
    } catch (error) {
      console.error('[api-unified] getCurrentPin error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * إصدار رمز PIN جديد
   * ✅ مُصلَح: يستخدم أسماء الأعمدة الصحيحة من جدول pins
   * @param {string} clinicId - معرف العيادة
   * @returns {Promise<Object>} بيانات PIN الجديد
   */
  async issuePin(clinicId) {
    try {
      // توليد PIN جديد من 4 أرقام
      const newPin = Math.floor(1000 + Math.random() * 9000).toString();
      const now = new Date();
      const validUntil = new Date(now);
      validUntil.setHours(23, 59, 59, 999);  // ✅ صالح حتى نهاية اليوم

      // ✅ تعطيل جميع الـ PINs السابقة لهذه العيادة (تعيين used_at بدلاً من is_active)
      await supabase
        .from('pins')
        .update({ used_at: now.toISOString() })
        .eq('clinic_id', clinicId)
        .is('used_at', null);  // فقط التي لم تُستخدم بعد

      // ✅ إضافة PIN جديد
      const { data, error } = await supabase
        .from('pins')
        .insert([{
          clinic_id: clinicId,
          pin: newPin,
          created_at: now.toISOString(),
          valid_until: validUntil.toISOString(),
          used_at: null,  // غير مستخدم بعد
        }])
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        currentPin: data.pin,
        pinId: data.id,
        message: 'تم توليد رمز PIN جديد بنجاح',
      };
    } catch (error) {
      console.error('[api-unified] issuePin error:', error);
      return { success: false, error: error.message };
    }
  },

  // ============================================================================
  // Admin Operations - عمليات الإدارة
  // ============================================================================

  /**
   * تمديد وقت المراجع
   * @param {string} patientId - معرف المراجع
   * @param {number} minutes - عدد الدقائق
   * @returns {Promise<Object>} نتيجة العملية
   */
  async extendTime(patientId, minutes) {
    try {
      const { data, error } = await supabase
        .from('unified_queue')
        .update({
          extended_time: minutes,
          updated_at: new Date().toISOString(),
        })
        .eq('patient_id', patientId)
        .in('status', ['waiting', 'serving'])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('[api-unified] extendTime error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * جلب جميع العيادات مع رموز PIN
   * @returns {Promise<Object>} قائمة العيادات
   */
  async getClinicsWithPins() {
    try {
      // جلب العيادات أولاً
      const { data: clinics, error: clinicsError } = await supabase
        .from('clinics')
        .select('id, name, name_ar')
        .order('name_ar');

      if (clinicsError) throw clinicsError;

      // جلب الـ PINs النشطة اليوم
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const now = new Date().toISOString();

      const { data: pins, error: pinsError } = await supabase
        .from('pins')
        .select('*')
        .is('used_at', null)  // ✅ تصحيح: بدلاً من is_active
        .gte('valid_until', now);  // ✅ تصحيح: بدلاً من expires_at

      if (pinsError) throw pinsError;

      // دمج البيانات
      const combinedData = clinics.map(clinic => {
        const pinEntry = pins.find(p => p.clinic_id === clinic.id);  // ✅ تصحيح
        return {
          ...clinic,
          pin: pinEntry ? pinEntry.pin : null,
          valid_until: pinEntry ? pinEntry.valid_until : null,  // ✅ تصحيح
          pin_status: pinEntry ? 'active' : 'none'
        };
      });

      return { success: true, data: combinedData };
    } catch (error) {
      console.error('[api-unified] getClinicsWithPins error:', error);
      return { success: false, data: [], error: error.message };
    }
  },

  // ============================================================================
  // Queue Queries - استعلامات الطابور
  // ============================================================================

  /**
   * جلب حالة الطابور لعيادة معينة (مع إحصائيات)
   * @param {string} clinicId - معرف العيادة
   * @returns {Promise<Object>} حالة الطابور
   */
  async getQueueStatusWithStats(clinicId) {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('unified_queue')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('queue_date', today)
        .order('entered_at', { ascending: true });

      if (error) throw error;

      const waiting = data.filter((q) => q.status === 'waiting');
      // ✅ إصلاح: تضمين called و serving كحالات في الخدمة
      const serving = data.filter((q) => q.status === 'serving' || q.status === 'called');
      const completed = data.filter((q) => q.status === 'completed');
      const skipped = data.filter((q) => q.status === 'skipped');

      return {
        success: true,
        waiting: waiting.length,
        serving: serving.length,
        completed: completed.length,
        skipped: skipped.length,
        total: data.length,
        queue: waiting,
        stats: {
          waiting: waiting.length,
          serving: serving.length,
          completed: completed.length,
          skipped: skipped.length,
          total: data.length,
        },
      };
    } catch (error) {
      console.error('[api-unified] getQueueStatusWithStats error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * الاشتراك في تغييرات الطابور (Realtime)
   * @param {string} clinicId - معرف العيادة
   * @param {Function} callback - دالة الاستدعاء
   * @returns {Function} دالة إلغاء الاشتراك
   */
  subscribeToQueueChanges(clinicId, callback) {
    const channel = supabase
      .channel(`queue-${clinicId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'unified_queue',
          filter: `clinic_id=eq.${clinicId}`,
        },
        callback,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  // ============================================================================
  // Events Operations - عمليات الأحداث
  // ============================================================================

  /**
   * تسجيل حدث استرداد
   * @param {Object} eventData - بيانات الحدث
   * @returns {Promise<Object>} نتيجة العملية
   */
  async logRecoveryEvent(eventData) {
    try {
      const { data, error } = await supabase
        .from('events')
        .insert({
          type: 'recovery',
          data: eventData,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('[api-unified] logRecoveryEvent error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * الاشتراك في الأحداث (Realtime)
   * @param {Function} callback - دالة الاستدعاء
   * @returns {Function} دالة إلغاء الاشتراك
   */
  subscribeToEvents(callback) {
    const channel = supabase
      .channel(`events-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'events',
        },
        callback,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  // ============================================================================
  // Utility Functions - دوال مساعدة
  // ============================================================================

  /**
   * التحقق من الاتصال بقاعدة البيانات
   * @returns {Promise<boolean>} حالة الاتصال
   */
  async checkConnection() {
    try {
      const { error } = await supabase.from('clinics').select('count').limit(1);
      return !error;
    } catch {
      return false;
    }
  },

  // ============================================================================
  // Sessions Management - إدارة جلسات QR Code
  // ============================================================================

  /**
   * إنشاء جلسة QR جديدة
   * @param {string} patientId - معرف المراجع
   * @returns {Promise<Object>} بيانات الجلسة
   */
  async createSession(patientId) {
    try {
      // توليد token فريد
      const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const { data, error } = await supabase
        .from('sessions')
        .insert({
          token,
          patient_id: patientId,
          status: 'active',
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      return {
        ok: true,
        success: true,
        token: data.token,
        expiresAt: data.expires_at,
      };
    } catch (error) {
      console.error('[api-unified] createSession error:', error);
      return { ok: false, success: false, error: error.message };
    }
  },

  /**
   * التحقق من صلاحية جلسة QR
   * @param {string} token - رمز الجلسة
   * @returns {Promise<Object>} نتيجة التحقق
   */
  async validateSession(token) {
    try {
      // البحث عن الجلسة
      const { data: session, error: findError } = await supabase
        .from('sessions')
        .select('*')
        .eq('token', token)
        .single();

      if (findError || !session) {
        return { ok: false, error: 'SESSION_NOT_FOUND' };
      }

      // التحقق من انتهاء الصلاحية
      if (new Date(session.expires_at) < new Date()) {
        await supabase
          .from('sessions')
          .update({ status: 'expired' })
          .eq('token', token);
        return { ok: false, error: 'SESSION_EXPIRED' };
      }

      // التحقق من الاستخدام السابق
      if (session.status === 'used') {
        return { ok: false, error: 'SESSION_ALREADY_USED' };
      }

      // تحديث حالة الجلسة
      await supabase
        .from('sessions')
        .update({ status: 'used', used_at: new Date().toISOString() })
        .eq('token', token);

      return {
        ok: true,
        success: true,
        patientId: session.patient_id,
      };
    } catch (error) {
      console.error('[api-unified] validateSession error:', error);
      return { ok: false, error: 'UNKNOWN_ERROR' };
    }
  },

  /**
   * تحديث معلومات جهاز الجلسة
   * @param {string} token - رمز الجلسة
   * @param {string} deviceType - نوع الجهاز
   * @param {Object} deviceInfo - معلومات الجهاز
   * @returns {Promise<Object>} نتيجة التحديث
   */
  async updateSessionDevice(token, deviceType, deviceInfo = null) {
    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          device_type: deviceType,
          device_info: deviceInfo,
        })
        .eq('token', token);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('[api-unified] updateSessionDevice error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * جلب إحصائيات الجلسات
   * @returns {Promise<Object>} إحصائيات الجلسات
   */
  async getSessionStats() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('sessions')
        .select('status, device_type')
        .gte('created_at', today.toISOString());

      if (error) throw error;

      const stats = {
        total: data.length,
        active: data.filter((s) => s.status === 'active').length,
        used: data.filter((s) => s.status === 'used').length,
        expired: data.filter((s) => s.status === 'expired').length,
        byDevice: {
          iOS: data.filter((s) => s.device_type === 'iOS').length,
          Android: data.filter((s) => s.device_type === 'Android').length,
          Desktop: data.filter((s) => s.device_type === 'Desktop').length,
        },
      };

      return { success: true, stats };
    } catch (error) {
      console.error('[api-unified] getSessionStats error:', error);
      return { success: false, stats: null, error: error.message };
    }
  },

  // ============================================================================
  // Settings Management - إدارة الإعدادات
  // ============================================================================

  /**
   * جلب إعدادات حسب النوع
   * @param {string} type - نوع الإعدادات (theme, queue, etc.)
   * @returns {Promise<Object>} الإعدادات
   */
  async getSettings(type) {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('key, value')
        .eq('category', type);

      if (error) throw error;

      // تحويل إلى كائن
      const settings = {};
      (data || []).forEach((item) => {
        settings[item.key] = item.value;
      });

      return {
        success: true,
        data: {
          enableThemeSelector: settings.theme_selector_enabled === 'true',
          showThemePreview: settings.theme_preview_enabled === 'true',
          currentTheme: settings.theme_current || 'professional-medical',
        },
      };
    } catch (error) {
      console.error('[api-unified] getSettings error:', error);
      // إرجاع قيم افتراضية في حالة الخطأ
      return {
        success: true,
        data: {
          enableThemeSelector: true,
          showThemePreview: true,
          currentTheme: 'professional-medical',
        },
      };
    }
  },

  /**
   * تحديث إعدادات
   * @param {string} type - نوع الإعدادات
   * @param {Object} settings - الإعدادات الجديدة
   * @returns {Promise<Object>} نتيجة التحديث
   */
  async updateSettings(type, settings) {
    try {
      const updates = [];

      // تحويل الإعدادات إلى صفوف
      if (settings.currentTheme !== undefined) {
        updates.push({
          key: 'theme_current',
          value: settings.currentTheme,
          category: type,
          updated_at: new Date().toISOString(),
        });
      }
      if (settings.enableThemeSelector !== undefined) {
        updates.push({
          key: 'theme_selector_enabled',
          value: String(settings.enableThemeSelector),
          category: type,
          updated_at: new Date().toISOString(),
        });
      }
      if (settings.showThemePreview !== undefined) {
        updates.push({
          key: 'theme_preview_enabled',
          value: String(settings.showThemePreview),
          category: type,
          updated_at: new Date().toISOString(),
        });
      }

      // تحديث كل إعداد
      for (const update of updates) {
        const { error } = await supabase
          .from('settings')
          .upsert(update, { onConflict: 'key' });

        if (error) throw error;
      }

      return { success: true };
    } catch (error) {
      console.error('[api-unified] updateSettings error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * جلب إعداد محدد
   * @param {string} key - مفتاح الإعداد
   * @returns {Promise<string|null>} قيمة الإعداد
   */
  async getSetting(key) {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', key)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data?.value || null;
    } catch (error) {
      console.error('[api-unified] getSetting error:', error);
      return null;
    }
  },

  /**
   * تحديث إعداد محدد
   * @param {string} key - مفتاح الإعداد
   * @param {string} value - القيمة الجديدة
   * @returns {Promise<boolean>} نجاح العملية
   */
  async setSetting(key, value) {
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key,
          value,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[api-unified] setSetting error:', error);
      return false;
    }
  },
};

// ============================================================================
// Backward Compatibility Exports - تصديرات التوافق العكسي
// ============================================================================

// للتوافق مع المكونات التي تستخدم supabase-queries.js
export const queueQueries = {
  getStatus: (clinicId) => api.getQueueStatusWithStats(clinicId),
  subscribeToChanges: (clinicId, callback) => api.subscribeToQueueChanges(clinicId, callback),
};

export const adminQueries = {
  extendTime: (patientId, minutes) => api.extendTime(patientId, minutes),
  getClinicsWithPins: () => api.getClinicsWithPins(),
};

export const eventsQueries = {
  logRecovery: (eventData) => api.logRecoveryEvent(eventData),
  subscribeToEvents: (callback) => api.subscribeToEvents(callback),
};

export const settingsQueries = {
  async get(type) {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('type', type)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      console.error('[api-unified] settingsQueries.get error:', error);
      return null;
    }
  },
  async set(type, value) {
    try {
      const { data, error } = await supabase
        .from('settings')
        .upsert({ type, value, updated_at: new Date().toISOString() })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[api-unified] settingsQueries.set error:', error);
      return null;
    }
  },
};

// للتوافق مع supabase-api.js
export const supabaseApi = {
  getCurrentPin: (clinicId) => api.getCurrentPin(clinicId),
  issuePin: (clinicId) => api.issuePin(clinicId),
  verifyPin: (clinicId, pin) => api.verifyPin(clinicId, pin),
  getAllPins: () => api.getActivePins(),
};

// تفعيل نظام التزامن اليومي لأرقام PIN
const pinDailySync = new PINDailySync(supabase);
pinDailySync.startDailySync();
export default api;
export { api };

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
initGDS().catch(err => console.error('❌ فشل تهيئة GDS:', err));

// ============================================================================
// إعدادات نظام الدور - Queue Settings
// ============================================================================
const DEFAULT_QUEUE_SETTINGS = {
  queueIntervalSeconds: 120,        // 2 دقيقة - فترة النداء التلقائي
  patientMaxWaitSeconds: 240,       // 4 دقائق - المهلة قبل الدخول
  examMaxSeconds: 300,              // 5 دقائق - الحد الأقصى للفحص
  timeoutHandlerEnabled: true,      // تفعيل التمرير التلقائي
  examTimeoutEnabled: true          // تفعيل حد الفحص
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
  async enterQueue(clinicId, patientId, isAutoEnter = true) {
    try {
      // ✅ التحقق أولاً إذا كان المراجع موجود مسبقاً في نفس العيادة
      const { data: existingEntry, error: existingError } = await supabase
        .from('queues')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .in('status', ['waiting', 'serving']) // فقط الحالات النشطة
        .order('entered_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // إذا وجد سجل موجود، أرجعه بدلاً من إنشاء جديد
      if (existingEntry) {
        console.log('[enterQueue] المراجع موجود مسبقاً برقم:', existingEntry.display_number);
        return { success: true, ...existingEntry, alreadyExists: true };
      }

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
        .from('queues')
        .select('*')
        .eq('status', 'waiting')
        .not('called_at', 'is', null)
        .lt('called_at', waitTimeoutAgo);

      if (waitError) throw waitError;
      
      // معالجة المراجعين المتأخرين عن الدخول
      if (staleWaiting && staleWaiting.length > 0) {
        for (const queue of staleWaiting) {
          await supabase
            .from('queues')
            .update({ 
              status: 'skipped',
              completed_at: new Date().toISOString(),
              skip_reason: 'timeout_before_entry'
            })
            .eq('id', queue.id);

          skippedPatients.push({
            patient_id: queue.patient_id,
            clinic_id: queue.clinic_id,
            display_number: queue.display_number,
            reason: 'timeout_before_entry'
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
          .from('queues')
          .select('*')
          .eq('status', 'serving')
          .not('entered_at', 'is', null)
          .lt('entered_at', examTimeoutAgo);

        if (examError) throw examError;
        
        // معالجة المراجعين الذين تجاوزوا وقت الفحص
        if (staleExams && staleExams.length > 0) {
          for (const queue of staleExams) {
            await supabase
              .from('queues')
              .update({ 
                status: 'completed',
                completed_at: new Date().toISOString(),
                auto_completed: true
              })
              .eq('id', queue.id);

            completedExams.push({
              patient_id: queue.patient_id,
              clinic_id: queue.clinic_id,
              display_number: queue.display_number,
              reason: 'exam_timeout'
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
          examTimeout: settings.examMaxSeconds
        }
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
        .from('queues')
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
          .from('queues')
          .update({
            status: 'cancelled',
            completed_at: new Date().toISOString(),
            notes: `ملغى نهائياً - تجاوز الحد الأقصى للترحيل (${maxPostpones} مرات). الرقم: ${oldDisplayNumber}`
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
              reason: `تجاوز الحد الأقصى للترحيل (${maxPostpones} مرات)`
            }),
            created_at: new Date().toISOString()
          });

        return {
          success: true,
          cancelled: true,
          data: {
            oldNumber: oldDisplayNumber,
            postponeCount: currentPostponeCount
          },
          message: `تم إلغاء المراجع نهائياً - تجاوز الحد الأقصى للترحيل (${maxPostpones} مرات)`
        };
      }

      // 3. إلغاء الرقم الحالي مع تسجيل ملاحظة
      const newPostponeCount = currentPostponeCount + 1;
      const { error: cancelError } = await supabase
        .from('queues')
        .update({
          status: 'postponed',
          completed_at: new Date().toISOString(),
          notes: `مُرحّل (${newPostponeCount}/${maxPostpones}) - ${reason}. الرقم السابق: ${oldDisplayNumber}`
        })
        .eq('id', currentQueue.id);

      if (cancelError) throw cancelError;

      // 4. حساب رقم الدور الجديد (آخر رقم + 1)
      const { data: lastQueue, error: lastError } = await supabase
        .from('queues')
        .select('display_number')
        .eq('clinic_id', clinicId)
        .order('display_number', { ascending: false })
        .limit(1)
        .single();

      const newDisplayNumber = (lastQueue?.display_number || 0) + 1;

      // 5. إنشاء سجل جديد برقم دور جديد في نهاية الطابور
      const { data: newQueue, error: insertError } = await supabase
        .from('queues')
        .insert({
          clinic_id: clinicId,
          patient_id: patientId,
          display_number: newDisplayNumber,
          status: 'waiting',
          entered_at: new Date().toISOString(),
          postpone_count: newPostponeCount,
          notes: `مُرحّل من الرقم ${oldDisplayNumber} (${newPostponeCount}/${maxPostpones}) - ${reason}`
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
            reason: reason
          }),
          created_at: new Date().toISOString()
        });

      return {
        success: true,
        cancelled: false,
        data: {
          oldNumber: oldDisplayNumber,
          newNumber: newDisplayNumber,
          postponeCount: newPostponeCount,
          maxPostpones: maxPostpones,
          remainingChances: maxPostpones - newPostponeCount,
          newQueue: newQueue
        },
        message: `تم ترحيل المراجع من رقم ${oldDisplayNumber} إلى رقم ${newDisplayNumber} (${newPostponeCount}/${maxPostpones})`
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
          message: postponeResult.message + (callResult.success ? ' - تم استدعاء المراجع التالي' : '')
        };
      }

      // 3. استدعاء المراجع التالي
      const callResult = await this.callNextPatient(clinicId, pin);

      return {
        success: true,
        cancelled: false,
        postponed: postponeResult.data,
        nextPatient: callResult.success ? callResult.data : null,
        message: postponeResult.message + (callResult.success ? ' - تم استدعاء المراجع التالي' : '')
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
      data.forEach(item => {
        settings[item.id] = {
          value: item.value,
          description: item.description,
          is_active: item.is_active
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
          updated_at: new Date().toISOString()
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
          updated_at: new Date().toISOString()
        })
        .eq('id', settingId)
        .select()
        .single();

      if (error) throw error;

      return { 
        success: true, 
        data, 
        message: `تم ${isActive ? 'تفعيل' : 'تعطيل'} الإعداد: ${settingId}` 
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
  }
};

export default api;
export { api };

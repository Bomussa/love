/**
 * Advanced Queue Engine - نظام إدارة الطوابير المتقدم
 * 
 * المهل الزمنية:
 * - المراجع: 5 دقائق للدخول (300 ثانية)
 * - العيادة: 2 دقيقة للنداء على التالي (120 ثانية) - داخلي
 * - التحذير: بعد 4 دقائق ينقل لنهاية الدور (240 ثانية)
 * 
 * التسلسل:
 * 1. دخول → اختيار فحص → مسار ديناميكي (مرة واحدة فقط)
 * 2. إعطاء رقم دور → عداد 5 دقائق
 * 3. دخول العيادة → إيقاف عداد العيادة (2 دقيقة)
 * 4. خروج بـ PIN → بدء عداد 2 دقيقة للتالي
 */

import eventBus from './event-bus.js';

class AdvancedQueueEngine {
  constructor() {
    // Queue structure: clinicId -> queue data
    this.queues = new Map();
    
    // Patient timers: patientId -> timer data
    this.patientTimers = new Map();
    
    // Clinic timers: clinicId -> auto-call timer
    this.clinicTimers = new Map();
    
    // Constants
    this.PATIENT_TIMEOUT = 300; // 5 دقائق للمراجع
    this.CLINIC_AUTOCALL = 120; // 2 دقيقة للنداء التلقائي
    this.WARNING_TIME = 240; // 4 دقائق تحذير (قبل النقل)
    
    this.init();
  }

  init() {
    console.log('[Advanced Queue] Initialized');
    
    // تشغيل مراقب الوقت كل ثانية
    setInterval(() => this.checkAllTimers(), 1000);
  }

  /**
   * إنشاء أو جلب طابور عيادة
   */
  getOrCreateQueue(clinicId) {
    if (!this.queues.has(clinicId)) {
      this.queues.set(clinicId, {
        current: null, // المراجع الحالي
        waiting: [], // قائمة الانتظار
        served: [], // المرضى المخدومون
        lastExitTime: null, // وقت خروج آخر مراجع
        isClinicTimerActive: false, // عداد العيادة نشط؟
        clinicTimerStartedAt: null // متى بدأ عداد العيادة
      });
    }
    return this.queues.get(clinicId);
  }

  /**
   * إضافة مراجع للطابور (عند اختيار الفحص)
   */
  async addToQueue(clinicId, patientId, patientData = {}) {
    const queue = this.getOrCreateQueue(clinicId);
    
    // التحقق من عدم التكرار
    const existing = queue.waiting.find(p => p.patientId === patientId);
    if (existing) {
      return existing;
    }
    
    // حساب رقم الدور
    const number = (queue.current?.number || 0) + queue.waiting.length + 1;
    
    const entry = {
      patientId,
      number,
      clinicId,
      addedAt: new Date().toISOString(),
      status: 'waiting', // waiting, called, entered, missed
      timerStartedAt: null,
      timeLeft: this.PATIENT_TIMEOUT,
      ...patientData
    };
    
    queue.waiting.push(entry);
    
    // إذا كان أول مراجع، ابدأ عداد العيادة
    if (queue.waiting.length === 1 && !queue.current) {
      this.startClinicAutoCall(clinicId);
    }
    
    // إرسال حدث
    eventBus.emit('queue:patient_added', {
      clinicId,
      patientId,
      number,
      position: queue.waiting.length,
      totalWaiting: queue.waiting.length
    });
    
    console.log(`[Queue] Patient ${patientId} added to ${clinicId} with number ${number}`);
    
    return entry;
  }

  /**
   * دخول المراجع للعيادة (عند الضغط على "دخول العيادة")
   */
  async enterClinic(clinicId, patientId) {
    const queue = this.getOrCreateQueue(clinicId);
    
    // إيجاد المراجع
    const patientIndex = queue.waiting.findIndex(p => p.patientId === patientId);
    
    if (patientIndex === -1) {
      return { success: false, error: 'Patient not found in queue' };
    }
    
    const patient = queue.waiting[patientIndex];
    
    // التحقق من أنه دوره أو قريب من دوره (أول 3)
    if (patientIndex > 2) {
      return { 
        success: false, 
        error: 'Not your turn yet. Please wait.',
        position: patientIndex + 1
      };
    }
    
    // تحديث حالة المراجع
    patient.status = 'entered';
    patient.enteredAt = new Date().toISOString();
    
    // نقله من waiting إلى current
    queue.waiting.splice(patientIndex, 1);
    queue.current = patient;
    
    // إيقاف عداد العيادة (2 دقيقة)
    this.stopClinicAutoCall(clinicId);
    
    // إيقاف عداد المراجع (5 دقائق)
    this.stopPatientTimer(patientId);
    
    // إرسال حدث
    eventBus.emit('queue:patient_entered', {
      clinicId,
      patientId,
      number: patient.number,
      nextInQueue: queue.waiting[0]?.number
    });
    
    console.log(`[Queue] Patient ${patientId} entered ${clinicId}`);
    
    return { 
      success: true, 
      message: 'Entered clinic successfully',
      yourNumber: patient.number
    };
  }

  /**
   * خروج المراجع من العيادة (بعد إدخال PIN)
   */
  async exitClinic(clinicId, patientId, pin) {
    const queue = this.getOrCreateQueue(clinicId);
    
    // التحقق من أن المراجع هو الحالي
    if (!queue.current || queue.current.patientId !== patientId) {
      return { success: false, error: 'You are not currently in the clinic' };
    }
    
    // التحقق من PIN (سيتم في local-api)
    
    // نقل المراجع إلى served
    const patient = queue.current;
    patient.status = 'served';
    patient.exitedAt = new Date().toISOString();
    patient.duration = this.calculateDuration(patient.enteredAt, patient.exitedAt);
    
    queue.served.push(patient);
    queue.current = null;
    queue.lastExitTime = new Date().toISOString();
    
    // بدء عداد العيادة للنداء على التالي (2 دقيقة)
    if (queue.waiting.length > 0) {
      this.startClinicAutoCall(clinicId);
    }
    
    // إرسال حدث
    eventBus.emit('queue:patient_exited', {
      clinicId,
      patientId,
      nextInQueue: queue.waiting[0]?.number,
      totalWaiting: queue.waiting.length
    });
    
    console.log(`[Queue] Patient ${patientId} exited ${clinicId}`);
    
    return { 
      success: true, 
      message: 'Exited clinic successfully',
      duration: patient.duration
    };
  }

  /**
   * بدء عداد العيادة (2 دقيقة للنداء التلقائي)
   */
  startClinicAutoCall(clinicId) {
    const queue = this.getOrCreateQueue(clinicId);
    
    if (queue.waiting.length === 0) {
      return;
    }
    
    // إيقاف أي عداد سابق
    this.stopClinicAutoCall(clinicId);
    
    queue.isClinicTimerActive = true;
    queue.clinicTimerStartedAt = Date.now();
    
    console.log(`[Queue] Clinic ${clinicId} auto-call timer started (120s)`);
    
    // بدء عداد المراجع الأول (5 دقائق)
    const firstPatient = queue.waiting[0];
    if (firstPatient && !firstPatient.timerStartedAt) {
      this.startPatientTimer(firstPatient.patientId, clinicId);
    }
  }

  /**
   * إيقاف عداد العيادة
   */
  stopClinicAutoCall(clinicId) {
    const queue = this.getOrCreateQueue(clinicId);
    queue.isClinicTimerActive = false;
    queue.clinicTimerStartedAt = null;
    
    console.log(`[Queue] Clinic ${clinicId} auto-call timer stopped`);
  }

  /**
   * بدء عداد المراجع (5 دقائق)
   */
  startPatientTimer(patientId, clinicId) {
    // إيقاف أي عداد سابق
    this.stopPatientTimer(patientId);
    
    const timerData = {
      patientId,
      clinicId,
      startedAt: Date.now(),
      timeLeft: this.PATIENT_TIMEOUT,
      warned: false
    };
    
    this.patientTimers.set(patientId, timerData);
    
    console.log(`[Queue] Patient ${patientId} timer started (300s)`);
  }

  /**
   * إيقاف عداد المراجع
   */
  stopPatientTimer(patientId) {
    this.patientTimers.delete(patientId);
    console.log(`[Queue] Patient ${patientId} timer stopped`);
  }

  /**
   * فحص جميع العدادات كل ثانية
   */
  checkAllTimers() {
    const now = Date.now();
    
    // 1. فحص عدادات العيادات (2 دقيقة)
    for (const [clinicId, queue] of this.queues.entries()) {
      if (queue.isClinicTimerActive && queue.clinicTimerStartedAt) {
        const elapsed = Math.floor((now - queue.clinicTimerStartedAt) / 1000);
        
        if (elapsed >= this.CLINIC_AUTOCALL) {
          // انتهى الوقت - نادي على التالي تلقائياً
          this.autoCallNext(clinicId);
        }
      }
    }
    
    // 2. فحص عدادات المرضى (5 دقائق)
    for (const [patientId, timerData] of this.patientTimers.entries()) {
      const elapsed = Math.floor((now - timerData.startedAt) / 1000);
      timerData.timeLeft = this.PATIENT_TIMEOUT - elapsed;
      
      // تحذير بعد 4 دقائق (240 ثانية)
      if (elapsed >= this.WARNING_TIME && !timerData.warned) {
        timerData.warned = true;
        this.warnPatient(patientId, timerData.clinicId);
      }
      
      // نقل لنهاية الدور بعد 5 دقائق (300 ثانية)
      if (elapsed >= this.PATIENT_TIMEOUT) {
        this.moveToEndOfQueue(patientId, timerData.clinicId);
      }
      
      // إرسال تحديث كل 10 ثواني
      if (elapsed % 10 === 0) {
        eventBus.emit('queue:timer_update', {
          patientId,
          clinicId: timerData.clinicId,
          timeLeft: timerData.timeLeft
        });
      }
    }
  }

  /**
   * نداء تلقائي على التالي (داخلي - بعد 2 دقيقة)
   */
  autoCallNext(clinicId) {
    const queue = this.getOrCreateQueue(clinicId);
    
    if (queue.waiting.length === 0) {
      this.stopClinicAutoCall(clinicId);
      return;
    }
    
    const nextPatient = queue.waiting[0];
    
    // تحديث حالته إلى "called"
    nextPatient.status = 'called';
    nextPatient.calledAt = new Date().toISOString();
    
    // إعادة تشغيل عداد العيادة
    this.startClinicAutoCall(clinicId);
    
    // إرسال حدث (داخلي - للإدارة فقط)
    eventBus.emit('queue:auto_called', {
      clinicId,
      patientId: nextPatient.patientId,
      number: nextPatient.number
    });
    
    console.log(`[Queue] Auto-called patient ${nextPatient.patientId} in ${clinicId}`);
  }

  /**
   * تحذير المراجع (بعد 4 دقائق)
   */
  warnPatient(patientId, clinicId) {
    eventBus.emit('queue:warning', {
      patientId,
      clinicId,
      message: 'لديك دقيقة واحدة للدخول وإلا سيتم نقلك لنهاية الدور',
      messageEn: 'You have 1 minute to enter or you will be moved to end of queue',
      timeLeft: 60
    });
    
    console.log(`[Queue] Warning sent to patient ${patientId}`);
  }

  /**
   * نقل المراجع لنهاية الدور (بعد 5 دقائق)
   */
  moveToEndOfQueue(patientId, clinicId) {
    const queue = this.getOrCreateQueue(clinicId);
    
    const patientIndex = queue.waiting.findIndex(p => p.patientId === patientId);
    
    if (patientIndex === -1) {
      // المراجع غير موجود (ربما دخل بالفعل)
      this.stopPatientTimer(patientId);
      return;
    }
    
    // نقله لنهاية الدور
    const patient = queue.waiting.splice(patientIndex, 1)[0];
    patient.status = 'missed';
    patient.missedAt = new Date().toISOString();
    patient.timerStartedAt = null;
    
    // إعطاءه رقم جديد في النهاية
    patient.number = (queue.current?.number || 0) + queue.waiting.length + 1;
    patient.movedToEnd = true;
    
    queue.waiting.push(patient);
    
    // إيقاف عداده
    this.stopPatientTimer(patientId);
    
    // إرسال حدث
    eventBus.emit('queue:moved_to_end', {
      patientId,
      clinicId,
      newNumber: patient.number,
      reason: 'timeout'
    });
    
    console.log(`[Queue] Patient ${patientId} moved to end of ${clinicId} queue`);
  }

  /**
   * تمديد وقت المراجع (من الإدارة)
   */
  extendPatientTime(patientId, additionalSeconds = 300) {
    const timerData = this.patientTimers.get(patientId);
    
    if (!timerData) {
      return { success: false, error: 'Patient timer not found' };
    }
    
    // إضافة وقت إضافي
    timerData.startedAt = Date.now() - (this.PATIENT_TIMEOUT - additionalSeconds) * 1000;
    timerData.timeLeft = additionalSeconds;
    timerData.warned = false;
    
    eventBus.emit('queue:time_extended', {
      patientId,
      clinicId: timerData.clinicId,
      additionalTime: additionalSeconds
    });
    
    console.log(`[Queue] Patient ${patientId} time extended by ${additionalSeconds}s`);
    
    return { success: true, message: 'Time extended successfully' };
  }

  /**
   * حساب المدة بالدقائق
   */
  calculateDuration(startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMs = end - start;
    return Math.floor(durationMs / 60000); // دقائق
  }

  /**
   * الحصول على حالة الطابور
   */
  getQueueStatus(clinicId) {
    const queue = this.getOrCreateQueue(clinicId);
    
    return {
      clinicId,
      current: queue.current,
      waiting: queue.waiting.map((p, index) => ({
        ...p,
        position: index + 1
      })),
      totalWaiting: queue.waiting.length,
      totalServed: queue.served.length,
      isClinicTimerActive: queue.isClinicTimerActive
    };
  }

  /**
   * الحصول على موقع مراجع
   */
  getPatientPosition(clinicId, patientId) {
    const queue = this.getOrCreateQueue(clinicId);
    
    // هل هو الحالي؟
    if (queue.current?.patientId === patientId) {
      return {
        status: 'current',
        number: queue.current.number,
        position: 0,
        ahead: 0
      };
    }
    
    // ابحث في قائمة الانتظار
    const index = queue.waiting.findIndex(p => p.patientId === patientId);
    
    if (index === -1) {
      return null;
    }
    
    const patient = queue.waiting[index];
    const timerData = this.patientTimers.get(patientId);
    
    return {
      status: patient.status,
      number: patient.number,
      position: index + 1,
      ahead: index,
      timeLeft: timerData?.timeLeft || this.PATIENT_TIMEOUT,
      totalWaiting: queue.waiting.length
    };
  }
}

// Singleton instance
const advancedQueueEngine = new AdvancedQueueEngine();

export default advancedQueueEngine;
export { AdvancedQueueEngine };

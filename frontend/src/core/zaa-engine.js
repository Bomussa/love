/**
 * 🚀 ZAA Engine: Zero-Action Automation
 * ابتكار المهندس المالك - المحرك الشامل للأتمتة الذكية في MMC-MMS
 * يضمن عمل كافة العمليات (تمرير الدور، الإشعارات، الـ PIN، والمسارات) تلقائياً بنسبة 100%
 */
import { supabase } from '../lib/supabase-client';
import api from '../lib/api-unified';

class ZAAEngine {
  constructor() {
    this.interval = 10000; // فحص شامل كل 10 ثوانٍ
    this.timer = null;
    this.isProcessing = false;
    this.today = new Date().toISOString().split('T')[0];
  }

  /**
   * تشغيل محرك الأتمتة الشامل
   */
  start() {
    if (this.timer) return;
    console.log('🚀 ZAA Engine: Active & Monitoring All Systems');
    this.timer = setInterval(() => this.runAutomationCycle(), this.interval);
    this.runAutomationCycle();
  }

  /**
   * إيقاف المحرك
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * دورة الأتمتة الشاملة
   */
  async runAutomationCycle() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    
    try {
      // 1. أتمتة تمرير الدور (Auto-Advance)
      await this.automateQueueAdvance();
      
      // 2. أتمتة المسارات الطبية (Auto-Transition)
      await this.automatePathTransitions();
      
      // 3. أتمتة الـ PIN اليومي (Daily PIN Sync)
      await this.automateDailyPINS();
      
      // 4. أتمتة الإشعارات (Auto-Notifications)
      await this.automateNotifications();

    } catch (error) {
      console.error('❌ ZAA Engine Cycle Error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * ⏱️ أتمتة تمرير الدور بناءً على الوقت
   */
  async automateQueueAdvance() {
    const { data: activeSessions } = await supabase
      .from('unified_queue')
      .select('*, clinics(exam_duration)')
      .eq('queue_date', this.today)
      .in('status', ['called', 'serving']);

    if (!activeSessions) return;

    const now = new Date();
    for (const session of activeSessions) {
      const startTime = new Date(session.called_at || session.entered_at);
      const duration = session.clinics?.exam_duration || 5;
      const elapsed = (now - startTime) / 60000;

      if (elapsed >= duration) {
        console.log(`⏱️ ZAA: Auto-advancing patient ${session.patient_id} in clinic ${session.clinic_id}`);
        await supabase
          .from('unified_queue')
          .update({ 
            status: 'completed', 
            completed_at: new Date().toISOString(),
            metadata: { ...session.metadata, auto_completed: true, reason: 'timeout' }
          })
          .eq('id', session.id);
        
        // استدعاء المراجع التالي تلقائياً
        await this.callNextPatient(session.clinic_id);
      }
    }
  }

  /**
   * 🔄 أتمتة المسارات الطبية (الانتقال للعيادة التالية)
   */
  async automatePathTransitions() {
    // جلب المراجعين الذين أكملوا عيادة ولديهم مسار طبي متبقي
    const { data: completedPatients } = await supabase
      .from('unified_queue')
      .select('*')
      .eq('queue_date', this.today)
      .eq('status', 'completed')
      .not('medical_path', 'is', null);

    if (!completedPatients) return;

    for (const patient of completedPatients) {
      const path = patient.medical_path; // مصفوفة من معرفات العيادات
      const currentIndex = path.indexOf(patient.clinic_id);
      
      if (currentIndex !== -1 && currentIndex < path.length - 1) {
        const nextClinicId = path[currentIndex + 1];
        
        // التحقق مما إذا كان المراجع موجوداً بالفعل في طابور العيادة التالية
        const { data: existing } = await supabase
          .from('unified_queue')
          .select('id')
          .eq('queue_date', this.today)
          .eq('patient_id', patient.patient_id)
          .eq('clinic_id', nextClinicId)
          .single();

        if (!existing) {
          console.log(`🔄 ZAA: Auto-transitioning patient ${patient.patient_id} to clinic ${nextClinicId}`);
          await supabase.from('unified_queue').insert([{
            patient_id: patient.patient_id,
            clinic_id: nextClinicId,
            queue_date: this.today,
            status: 'waiting',
            medical_path: path,
            display_number: await this.getNextDisplayNumber(nextClinicId)
          }]);
        }
      }
    }
  }

  /**
   * 🔑 أتمتة الـ PIN اليومي (توليد وتحديث تلقائي)
   */
  async automateDailyPINS() {
    const { data: clinics } = await supabase.from('clinics').select('id');
    if (!clinics) return;

    for (const clinic of clinics) {
      const { data: currentPin } = await supabase
        .from('clinic_pins')
        .select('*')
        .eq('clinic_id', clinic.id)
        .eq('pin_date', this.today)
        .single();

      if (!currentPin) {
        const newPin = Math.floor(1000 + Math.random() * 9000).toString();
        console.log(`🔑 ZAA: Auto-generating PIN ${newPin} for clinic ${clinic.id}`);
        await supabase.from('clinic_pins').insert([{
          clinic_id: clinic.id,
          pin_code: newPin,
          pin_date: this.today,
          status: 'active'
        }]);
      }
    }
  }

  /**
   * 🔔 أتمتة الإشعارات (إرسال تنبيهات الانتقال والاستدعاء)
   */
  async automateNotifications() {
    // جلب آخر الحركات غير المبلغ عنها
    const { data: unnotified } = await supabase
      .from('unified_queue')
      .select('*')
      .eq('queue_date', this.today)
      .eq('status', 'called')
      .is('notified_at', null);

    if (!unnotified) return;

    for (const item of unnotified) {
      console.log(`🔔 ZAA: Sending auto-notification for patient ${item.patient_id}`);
      // محاكاة إرسال إشعار (يمكن ربطه بـ WhatsApp API أو Push Notifications)
      await supabase.from('activity_logs').insert([{
        type: 'notification_sent',
        patient_id: item.patient_id,
        message: `يرجى التوجه إلى العيادة رقم ${item.clinic_id}، دورك الآن.`
      }]);

      await supabase
        .from('unified_queue')
        .update({ notified_at: new Date().toISOString() })
        .eq('id', item.id);
    }
  }

  /**
   * دوال مساعدة
   */
  async callNextPatient(clinicId) {
    const { data: nextInLine } = await supabase
      .from('unified_queue')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('status', 'waiting')
      .order('display_number', { ascending: true })
      .limit(1)
      .single();

    if (nextInLine) {
      await supabase
        .from('unified_queue')
        .update({ status: 'called', called_at: new Date().toISOString() })
        .eq('id', nextInLine.id);
    }
  }

  async getNextDisplayNumber(clinicId) {
    const { data } = await supabase
      .from('unified_queue')
      .select('display_number')
      .eq('clinic_id', clinicId)
      .eq('queue_date', this.today)
      .order('display_number', { ascending: false })
      .limit(1)
      .single();
    return (data?.display_number || 0) + 1;
  }
}

export const zaa = new ZAAEngine();
export default zaa;

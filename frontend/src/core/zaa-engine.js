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
      // ملاحظة: تم نقل automateQueueAdvance و automateDailyPINS و automateNotifications إلى Backend
      // الواجهة الأمامية تعتمد الآن على API calls فقط
      
      // 1. أتمتة المسارات الطبية (Auto-Transition)
      await this.automatePathTransitions();

    } catch (error) {
      console.error('❌ ZAA Engine Cycle Error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * ⏱️ أتمتة تمرير الدور - تم نقلها إلى Backend
   * DEPRECATED: هذه الدالة تم تعطيلها. استخدم API /api/v1/queue/call-next بدلاً منها
   */
  async automateQueueAdvance() {
    console.warn('⚠️ automateQueueAdvance() is deprecated. Use backend API instead.');
    return;
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
   * 🔑 أتمتة الـ PIN اليومي - تم نقلها إلى Backend
   * DEPRECATED: هذه الدالة تم تعطيلها. استخدم pin-daily-sync.js بدلاً منها
   */
  async automateDailyPINS() {
    console.warn('⚠️ automateDailyPINS() is deprecated. Use pin-daily-sync.js instead.');
    return;
  }

  /**
   * 🔔 أتمتة الإشعارات - تم نقلها إلى Backend
   * DEPRECATED: هذه الدالة تم تعطيلها. استخدم notification-engine.js بدلاً منها
   */
  async automateNotifications() {
    console.warn('⚠️ automateNotifications() is deprecated. Use notification-engine.js instead.');
    return;
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

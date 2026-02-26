/**
 * ⏱️ Auto-Advance Engine (AAE) - محرك التمرير التلقائي الذكي
 * ابتكار المهندس المالك لضمان انسيابية الدور في MMC-MMS
 * يقوم بمراقبة أوقات الفحص وتمرير الدور آلياً في حال تجاوز المراجع للوقت المحدد
 */

import { supabase } from '../lib/supabase-client';
import api from '../lib/api-unified';

class AutoAdvanceEngine {
  constructor() {
    this.checkInterval = 15000; // فحص كل 15 ثانية
    this.timer = null;
    this.isProcessing = false;
  }

  /**
   * بدء مراقبة الطوابير
   */
  start() {
    if (this.timer) return;
    console.log('⏱️ Auto-Advance Engine: Active & Monitoring');
    this.timer = setInterval(() => this.checkQueues(), this.checkInterval);
    this.checkQueues(); // فحص فوري عند البدء
  }

  /**
   * إيقاف المراقبة
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * فحص كافة العيادات النشطة وتمرير الدور إذا لزم الأمر
   */
  async checkQueues() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const today = new Date().toISOString().split('T')[0];
      
      // 1. جلب كافة العيادات التي لديها مراجعين قيد الفحص (serving/called)
      const { data: activeSessions, error } = await supabase
        .from('unified_queue')
        .select('*, clinics(exam_duration)')
        .eq('queue_date', today)
        .in('status', ['called', 'serving']);

      if (error) throw error;

      const now = new Date();

      for (const session of activeSessions) {
        const startTime = new Date(session.called_at || session.entered_at);
        const durationMinutes = session.clinics?.exam_duration || 5; // الافتراضي 5 دقائق
        const elapsedMinutes = (now - startTime) / 60000;

        // 2. إذا تجاوز المراجع الوقت المحدد، يتم تمرير الدور
        if (elapsedMinutes >= durationMinutes) {
          console.log(`🚀 AAE: Advancing Queue for Clinic [${session.clinic_id}] - Patient [${session.patient_id}] timed out.`);
          await this.advance(session);
        }
      }
    } catch (err) {
      console.error('❌ AAE Error:', err);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * تنفيذ عملية التمرير الفعلي
   */
  async advance(session) {
    try {
      // أ. وضع المراجع الحالي في حالة "مكتمل تلقائياً" أو "متأخر"
      const { error: updateError } = await supabase
        .from('unified_queue')
        .update({ 
          status: 'completed', 
          completed_at: new Date().toISOString(),
          metadata: { ...session.metadata, auto_advanced: true, reason: 'timeout' }
        })
        .eq('id', session.id);

      if (updateError) throw updateError;

      // ب. إرسال إشعار لحظي عبر Real-time لتبليغ الواجهات
      await supabase.from('activity_logs').insert([{
        type: 'auto_advance',
        clinic_id: session.clinic_id,
        patient_id: session.patient_id,
        message: `تم تمرير الدور تلقائياً لتجاوز الوقت المحدد (${session.clinics?.exam_duration} دقيقة)`
      }]);

      // ج. استدعاء المراجع التالي (اختياري - يعتمد على رغبة الطبيب، لكننا نضمن تحديث الحالة)
      // النظام سيعرض للمراجع التالي أنه "دوره الآن" في المرة القادمة التي يتم فيها تحديث الحالة
    } catch (err) {
      console.error('❌ AAE Advance Error:', err);
    }
  }
}

export const aae = new AutoAdvanceEngine();
export default aae;

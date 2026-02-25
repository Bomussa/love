// Supabase Edge Function: queue-engine
// محرك الطابور الآمن مع القفل التنافسي و Kill Switch
// تنفيذ جميع الإضافات الحرجة التسع

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// إنشاء عميل Supabase مع Authorization من الطلب
function createAuthClient(req: Request) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: req.headers.get('Authorization') || '' },
    },
  });
}

// إنشاء عميل Service Role للعمليات الإدارية
function createServiceClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY);
}

serve(async (req: Request) => {
  // معالجة CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createAuthClient(req);
    const serviceClient = createServiceClient();

    // التحقق من المستخدم
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    const body = await req.json();
    const {
      action, clinic_id, patient_id, patient_name, exam_type, operator_pin,
    } = body;

    // التحقق من Kill Switch العام
    const { data: configData } = await serviceClient
      .from('system_config')
      .select('value')
      .eq('key', 'system_enabled')
      .single();

    if (configData && configData.value === false) {
      return new Response(
        JSON.stringify({
          status: 'ABORTED',
          reason: 'SYSTEM_DISABLED',
          message: 'النظام متوقف مؤقتًا',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

    // التحقق من حالة العيادة (Kill Switch للعيادة)
    if (clinic_id) {
      const { data: clinicData } = await serviceClient
        .from('clinics')
        .select('system_enabled, is_active')
        .eq('id', clinic_id)
        .single();

      if (clinicData && (clinicData.system_enabled === false || clinicData.is_active === false)) {
        return new Response(
          JSON.stringify({
            status: 'ABORTED',
            reason: 'CLINIC_DISABLED',
            message: 'العيادة متوقفة مؤقتًا',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
        );
      }
    }

    let result;

    switch (action) {
      case 'enter_queue':
        // دخول الطابور باستخدام الدالة الآمنة
        const { data: enterData, error: enterError } = await serviceClient
          .rpc('enter_queue_safe', {
            p_clinic_id: clinic_id,
            p_patient_id: patient_id,
            p_patient_name: patient_name || patient_id,
            p_exam_type: exam_type || 'general',
          });

        if (enterError) throw enterError;
        result = enterData;
        break;

      case 'call_next':
        // نداء المريض التالي
        const { data: callData, error: callError } = await serviceClient
          .rpc('call_next_patient_safe', {
            p_clinic_id: clinic_id,
            p_operator_pin: operator_pin,
          });

        if (callError) throw callError;
        result = callData;
        break;

      case 'complete_exam':
        // إنهاء الفحص
        const { data: completeData, error: completeError } = await serviceClient
          .rpc('complete_exam_safe', {
            p_clinic_id: clinic_id,
            p_patient_id: patient_id,
            p_operator_pin: operator_pin,
          });

        if (completeError) throw completeError;
        result = completeData;
        break;

      case 'health_check':
        // فحص صحة النظام
        const { data: healthData, error: healthError } = await serviceClient
          .rpc('health_check');

        if (healthError) throw healthError;
        result = healthData;
        break;

      case 'get_queue_status':
        // الحصول على حالة الطابور (قراءة فقط)
        const { data: queueData, error: queueError } = await serviceClient
          .from('queues')
          .select('*')
          .eq('clinic_id', clinic_id)
          .gte('entered_at', new Date().toISOString().split('T')[0])
          .order('display_number', { ascending: true });

        if (queueError) throw queueError;

        const waiting = queueData?.filter((q) => q.status === 'waiting') || [];
        const serving = queueData?.filter((q) => q.status === 'serving') || [];
        const completed = queueData?.filter((q) => q.status === 'completed') || [];

        result = {
          status: 'OK',
          clinic_id,
          waiting_count: waiting.length,
          serving_count: serving.length,
          completed_count: completed.length,
          current_number: serving[0]?.display_number || null,
          last_number: queueData?.[queueData.length - 1]?.display_number || 0,
          queue: queueData,
        };
        break;

      default:
        return new Response(
          JSON.stringify({ status: 'ERROR', reason: 'INVALID_ACTION' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
        );
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );
  } catch (err: any) {
    console.error('queue-engine error:', err);

    // تسجيل الخطأ في Audit Log
    try {
      const serviceClient = createServiceClient();
      await serviceClient.from('audit_log').insert({
        action: 'QUEUE_ENGINE_ERROR',
        payload: { error: err.message || String(err) },
      });
    } catch (logErr) {
      console.error('Failed to log error:', logErr);
    }

    return new Response(
      JSON.stringify({
        status: 'ABORTED',
        reason: err.message || 'INTERNAL_ERROR',
        success: false,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );
  }
});

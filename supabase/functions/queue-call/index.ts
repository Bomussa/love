// Supabase Edge Function: queue-call
// نداء المريض التالي مع القفل التنافسي والإضافات الحرجة
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json();

    const clinic_id = body.clinic_id || body.clinic;
    const operator_pin = body.pin || body.operator_pin;
    const action = body.action || 'call_next';

    if (!clinic_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'clinic_id required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

    // التحقق من Kill Switch العام
    const { data: configData } = await db
      .from('system_config')
      .select('value')
      .eq('key', 'system_enabled')
      .maybeSingle();

    if (configData && configData.value === false) {
      return new Response(
        JSON.stringify({
          success: false,
          status: 'ABORTED',
          error: 'SYSTEM_DISABLED',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

    // محاولة استخدام الدالة الآمنة أولاً
    const { data: safeResult, error: safeError } = await db
      .rpc('call_next_patient_safe', {
        p_clinic_id: clinic_id,
        p_operator_pin: operator_pin,
      });

    if (!safeError && safeResult) {
      // تسجيل في Audit Log
      await db.from('audit_log').insert({
        action: 'PATIENT_CALLED',
        payload: { clinic_id, operator_pin, result: safeResult },
      }).catch(() => {});

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            called: safeResult.status === 'OK',
            display_number: safeResult.number,
            patient_id: safeResult.patient,
            message: safeResult.message,
          },
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

    // Fallback إلى الطريقة القديمة
    const today = new Date().toISOString().split('T')[0];

    // إنهاء أي مريض يتم خدمته حاليًا
    await db
      .from('queues')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by_pin: operator_pin,
      })
      .eq('clinic_id', clinic_id)
      .eq('status', 'serving');

    // الحصول على المريض التالي
    const { data: nextPatient, error: e1 } = await db
      .from('queues')
      .select('id, display_number, patient_id')
      .eq('clinic_id', clinic_id)
      .eq('status', 'waiting')
      .gte('entered_at', today)
      .order('display_number', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (e1) throw e1;

    if (!nextPatient) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            called: false,
            message: 'لا يوجد مرضى في الانتظار',
          },
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

    // تحديث حالة المريض
    const { data: updated, error: e2 } = await db
      .from('queues')
      .update({
        status: 'serving',
        called_at: new Date().toISOString(),
      })
      .eq('id', nextPatient.id)
      .select()
      .single();

    if (e2) throw e2;

    // إنشاء إشعار
    await db.from('notifications').insert({
      patient_id: nextPatient.patient_id,
      message: `دورك الآن في العيادة. الرقم: ${nextPatient.display_number}`,
      type: 'info',
    }).catch(() => {});

    // تسجيل في Audit Log
    await db.from('audit_log').insert({
      action: 'PATIENT_CALLED',
      payload: {
        clinic_id,
        operator_pin,
        patient_id: nextPatient.patient_id,
        display_number: nextPatient.display_number,
      },
    }).catch(() => {});

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          called: true,
          queue_id: updated.id,
          display_number: updated.display_number,
          patient_id: updated.patient_id,
        },
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );
  } catch (err) {
    console.error('queue-call error:', err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );
  }
});

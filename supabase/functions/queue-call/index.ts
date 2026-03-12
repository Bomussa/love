// Supabase Edge Function: queue-call
// نداء المريض التالي مع القفل التنافسي والإضافات الحرجة
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleOptions, getCorsHeaders, corsErrorResponse } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

function toStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === 'string');
  if (typeof value === 'string') return [value];
  return [];
}

serve(async (req: Request) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== 'POST') {
    return corsErrorResponse('method_not_allowed', 405, req);
  }

  try {
    const authHeader = req.headers.get('authorization');
    const db = createClient(SUPABASE_URL, SERVICE_KEY);

    let authUser: any = null;
    let role = 'operator';

    if (authHeader?.startsWith('Bearer ')) {
      const authClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: authData, error: authError } = await authClient.auth.getUser();
      if (authError || !authData.user) {
        return corsErrorResponse('unauthorized', 401, req);
      }

      authUser = authData.user;

      const { data: userRole, error: roleError } = await db
        .from('roles')
        .select('role')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (roleError) {
        console.error('queue-call role lookup failed', { user_id: authUser.id, message: roleError.message });
        return corsErrorResponse('internal_error', 500, req);
      }

      role = userRole?.role ?? 'patient';
      const allowedRoles = new Set(['admin', 'operator']);
      if (!allowedRoles.has(role)) {
        return corsErrorResponse('forbidden', 403, req);
      }
    }

    const body = await req.json();

    const clinic_id = body.clinic_id || body.clinic;
    const operator_pin = body.pin || body.operator_pin;

    if (!clinic_id) {
      return corsErrorResponse('clinic_id_required', 400, req);
    }

    if (!authUser && !operator_pin) {
      return corsErrorResponse('operator_pin_required', 400, req);
    }

    if (authUser && role === 'operator') {
      const allowedClinicIds = new Set<string>([
        ...toStringArray(authUser.app_metadata?.clinic_ids),
        ...toStringArray(authUser.user_metadata?.clinic_ids),
        ...toStringArray(authUser.app_metadata?.clinic_id),
        ...toStringArray(authUser.user_metadata?.clinic_id),
      ]);

      // deny-by-default for operator role when clinic scope is missing or mismatched.
      if (allowedClinicIds.size === 0 || !allowedClinicIds.has(clinic_id)) {
        return corsErrorResponse('forbidden', 403, req);
      }
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
          data: null,
        }),
        { status: 403, headers: getCorsHeaders(req) },
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
        payload: { clinic_id, user_id: authUser?.id || null, result: safeResult },
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
        { headers: getCorsHeaders(req) },
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
        { headers: getCorsHeaders(req) },
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
        user_id: authUser?.id || null,
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
      { headers: getCorsHeaders(req) },
    );
  } catch (err) {
    console.error('queue-call error:', err);
    return new Response(
      JSON.stringify({ success: false, error: String(err), data: null }),
      { status: 500, headers: getCorsHeaders(req) },
    );
  }
});

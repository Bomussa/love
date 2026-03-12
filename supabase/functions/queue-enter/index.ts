// Supabase Edge Function: queue-enter
// دخول الطابور مع القفل التنافسي والإضافات الحرجة
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
    let role = 'patient';

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
        console.error('queue-enter role lookup failed', { user_id: authUser.id, message: roleError.message });
        return corsErrorResponse('internal_error', 500, req);
      }

      role = userRole?.role ?? 'patient';
    }

    const body = await req.json();

    // Support both naming conventions
    const clinic_id = body.clinic_id || body.clinic;
    const patient_id = body.patient_id || body.user;
    const patient_name = body.patient_name || body.name || patient_id;
    const exam_type = body.exam_type || body.examType || 'general';

    if (!clinic_id || !patient_id) {
      return corsErrorResponse('clinic_and_user_required', 400, req);
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
      .single();

    if (configData && configData.value === false) {
      return new Response(
        JSON.stringify({
          success: false,
          status: 'ABORTED',
          error: 'SYSTEM_DISABLED',
          data: null,
          message: 'النظام متوقف مؤقتًا',
        }),
        { status: 403, headers: getCorsHeaders(req) },
      );
    }

    // التحقق من حالة العيادة
    const { data: clinicData } = await db
      .from('clinics')
      .select('system_enabled, is_active')
      .eq('id', clinic_id)
      .single();

    if (clinicData && (clinicData.system_enabled === false || clinicData.is_active === false)) {
      return new Response(
        JSON.stringify({
          success: false,
          status: 'ABORTED',
          error: 'CLINIC_DISABLED',
          data: null,
          message: 'العيادة متوقفة مؤقتًا',
        }),
        { status: 403, headers: getCorsHeaders(req) },
      );
    }

    // استخدام الدالة الآمنة مع القفل التنافسي
    const { data: result, error: rpcError } = await db
      .rpc('enter_queue_safe', {
        p_clinic_id: clinic_id,
        p_patient_id: patient_id,
        p_patient_name: patient_name,
        p_exam_type: exam_type,
      });

    if (rpcError) {
      // إذا لم تكن الدالة موجودة، استخدم enter_queue_v2
      const { data: fallbackResult, error: fallbackError } = await db
        .rpc('enter_queue_v2', {
          p_clinic_id: clinic_id,
          p_patient_id: patient_id,
          p_patient_name: patient_name,
          p_exam_type: exam_type,
        });

      if (fallbackError) throw fallbackError;

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            clinic_id: fallbackResult.clinic,
            patient_id: fallbackResult.user,
            position: fallbackResult.number,
            status: fallbackResult.status,
            message: fallbackResult.message || 'Entered queue successfully',
          },
        }),
        { headers: getCorsHeaders(req) },
      );
    }

    // التحقق من نتيجة الدالة الآمنة
    if (result.status === 'ABORTED') {
      return new Response(
        JSON.stringify({
          success: false,
          status: result.status,
          error: result.reason,
          data: null,
          message: result.reason,
        }),
        { status: 400, headers: getCorsHeaders(req) },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          clinic_id: result.clinic,
          patient_id: result.user,
          position: result.number,
          status: result.status,
          message: result.message || 'Entered queue successfully',
        },
      }),
      { headers: getCorsHeaders(req) },
    );
  } catch (err: any) {
    const errorMessage = err?.message || err?.error?.message || JSON.stringify(err) || String(err);
    console.error('queue-enter error:', errorMessage, err);

    return new Response(
      JSON.stringify({
        success: false,
        status: 'ABORTED',
        error: errorMessage,
        data: null,
      }),
      { status: 500, headers: getCorsHeaders(req) },
    );
  }
});

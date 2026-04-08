// Supabase Edge Function: queue-engine
// محرك الطابور الآمن مع القفل التنافسي و Kill Switch

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_KEY) {
  throw new Error('Missing required Supabase environment variables for queue-engine');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function createAuthClient(req: Request) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: req.headers.get('Authorization') || '' },
    },
  });
}

function createServiceClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY);
}

async function getSystemEnabled(serviceClient: ReturnType<typeof createServiceClient>) {
  const settingsResult = await serviceClient
    .from('system_settings')
    .select('value')
    .eq('key', 'system_enabled')
    .maybeSingle();

  if (!settingsResult.error && settingsResult.data) {
    return settingsResult.data.value !== false;
  }

  // Backward-compatible fallback (older schema name)
  const legacyResult = await serviceClient
    .from('system_config')
    .select('value')
    .eq('key', 'system_enabled')
    .maybeSingle();

  if (!legacyResult.error && legacyResult.data) {
    return legacyResult.data.value !== false;
  }

  return true;
}

function validateRequired(action: string, clinic_id?: string, patient_id?: string) {
  if (!action) return 'action is required';
  const actionsNeedClinic = new Set(['enter_queue', 'call_next', 'complete_exam', 'get_queue_status']);
  if (actionsNeedClinic.has(action) && !clinic_id) return 'clinic_id is required';
  if ((action === 'enter_queue' || action === 'complete_exam') && !patient_id) return 'patient_id is required';
  return null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createAuthClient(req);
    const serviceClient = createServiceClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError && req.headers.get('Authorization')) {
      return new Response(JSON.stringify({ success: false, reason: 'UNAUTHORIZED', details: authError.message }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const body = await req.json();
    const {
      action, clinic_id, patient_id, patient_name, exam_type, operator_pin,
    } = body || {};

    const validationError = validateRequired(action, clinic_id, patient_id);
    if (validationError) {
      return new Response(JSON.stringify({ success: false, reason: 'INVALID_INPUT', message: validationError }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const isSystemEnabled = await getSystemEnabled(serviceClient);
    if (!isSystemEnabled) {
      return new Response(
        JSON.stringify({
          status: 'ABORTED',
          reason: 'SYSTEM_DISABLED',
          message: 'النظام متوقف مؤقتًا',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

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
      case 'enter_queue': {
        const { data: enterData, error: enterError } = await serviceClient.rpc('enter_queue_safe', {
          p_clinic_id: clinic_id,
          p_patient_id: patient_id,
          p_patient_name: patient_name || patient_id,
          p_exam_type: exam_type || 'general',
        });
        if (enterError) throw enterError;
        result = enterData;
        break;
      }
      case 'call_next': {
        const { data: callData, error: callError } = await serviceClient.rpc('call_next_patient_safe', {
          p_clinic_id: clinic_id,
          p_operator_pin: operator_pin,
          p_operator_user: user?.id || null,
        });
        if (callError) throw callError;
        result = callData;
        break;
      }
      case 'complete_exam': {
        const { data: completeData, error: completeError } = await serviceClient.rpc('complete_exam_safe', {
          p_clinic_id: clinic_id,
          p_patient_id: patient_id,
          p_operator_pin: operator_pin,
          p_operator_user: user?.id || null,
        });
        if (completeError) throw completeError;
        result = completeData;
        break;
      }
      case 'health_check': {
        const { data: healthData, error: healthError } = await serviceClient.rpc('health_check');
        if (healthError) throw healthError;
        result = healthData;
        break;
      }
      case 'get_queue_status': {
        const { data: queueData, error: queueError } = await serviceClient
          .from('queues')
          .select('*')
          .eq('clinic_id', clinic_id)
          .gte('entered_at', new Date().toISOString().split('T')[0])
          .order('display_number', { ascending: true });

        if (queueError) throw queueError;

        const waiting = queueData?.filter((q) => q.status === 'WAITING') || [];
        const serving = queueData?.filter((q) => q.status === 'CALLED' || q.status === 'IN_PROGRESS') || [];
        const completed = queueData?.filter((q) => q.status === 'DONE') || [];

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
      }
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
      JSON.stringify({ status: 'ABORTED', reason: err.message || 'INTERNAL_ERROR', success: false }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );
  }
});

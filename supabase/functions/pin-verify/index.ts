// Supabase Edge Function: pin-verify
// Verify PIN and mark as used (role-protected clinic/admin endpoints)
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authErrorResponse, requireAuthGuard } from '../_shared/auth.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'access-control-allow-origin': 'https://mmc-mms.com',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const path = new URL(req.url).pathname.replace(/\/+$/, '');
    const isAdminEndpoint = path.endsWith('/admin');
    const isClinicEndpoint = path.endsWith('/clinic');

    if (!isAdminEndpoint && !isClinicEndpoint) {
      return new Response(
        JSON.stringify({ success: false, error: 'Use /pin-verify/clinic or /pin-verify/admin' }),
        { status: 404, headers: { 'content-type': 'application/json', ...corsHeaders } },
      );
    }

    const guard = await requireAuthGuard(req, {
      allowedRoles: isAdminEndpoint ? ['admin'] : ['clinic', 'admin'],
      corsHeaders,
    });

    if ('response' in guard) {
      return guard.response;
    }

    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json();
    const requestedClinicId = typeof body?.clinic_id === 'string' ? body.clinic_id : null;
    const pin = typeof body?.pin === 'string' ? body.pin : null;

    const clinic_id = guard.auth.role === 'clinic'
      ? (guard.auth.clinicId || requestedClinicId)
      : requestedClinicId;

    if (!clinic_id || !pin) {
      return new Response(
        JSON.stringify({ success: false, error: 'clinic_id and pin required' }),
        { status: 400, headers: { 'content-type': 'application/json', ...corsHeaders } },
      );
    }

    if (guard.auth.role === 'clinic' && guard.auth.clinicId && guard.auth.clinicId !== clinic_id) {
      return authErrorResponse(403, corsHeaders);
    }

    const now = new Date().toISOString();

    const { data: pinRecord, error: e1 } = await db
      .from('pins')
      .select('*')
      .eq('clinic_id', clinic_id)
      .eq('pin', pin)
      .is('used_at', null)
      .gt('valid_until', now)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (e1) throw e1;

    const valid = !!pinRecord;
    let remaining_seconds = 0;

    if (valid && pinRecord) {
      await db
        .from('pins')
        .update({ used_at: now })
        .eq('id', pinRecord.id);

      remaining_seconds = Math.max(
        0,
        Math.floor((new Date(pinRecord.valid_until).getTime() - Date.now()) / 1000),
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          valid,
          remaining_seconds,
          message: valid ? 'PIN verified successfully' : 'Invalid or expired PIN',
        },
      }),
      { headers: { 'content-type': 'application/json', ...corsHeaders } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 400, headers: { 'content-type': 'application/json', ...corsHeaders } },
    );
  }
});

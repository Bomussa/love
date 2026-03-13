import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  corsErrorResponse,
  corsJsonResponse,
  getCorsHeaders,
  handleOptions,
} from '../_shared/cors.ts';
import { requireAuthGuard } from '../_shared/auth.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req: Request) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    const path = new URL(req.url).pathname.replace(/\/+$/, '');
    const isAdminEndpoint = path.endsWith('/admin');
    const isClinicEndpoint = path.endsWith('/clinic');

    if (!isAdminEndpoint && !isClinicEndpoint) {
      return corsErrorResponse('Use /pin-verify/clinic or /pin-verify/admin', 404, req);
    }

    const guard = await requireAuthGuard(req, {
      allowedRoles: isAdminEndpoint ? ['admin'] : ['clinic', 'admin'],
      corsHeaders: getCorsHeaders(req),
    });

    if ('response' in guard) {
      return guard.response;
    }

    const { auth } = guard;
    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const { clinic_id, pin } = await req.json();
    if (!clinic_id || !pin) return corsErrorResponse('clinic_id and pin required', 400, req);

    if (auth.role === 'clinic' && auth.clinicId && auth.clinicId !== clinic_id) {
      return corsErrorResponse('forbidden_clinic_scope', 403, req);
    }

    const now = new Date().toISOString();

    const { data, error } = await db
      .from('pins')
      .select('*')
      .eq('clinic_id', clinic_id)
      .eq('pin', pin)
      .is('used_at', null)
      .gt('valid_until', now)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;

    if (data) {
      const { error: updateError } = await db
        .from('pins')
        .update({ used_at: now })
        .eq('id', data.id);
      if (updateError) throw updateError;
    }

    const valid = !!data;
    return corsJsonResponse({
      data: {
        valid,
        message: valid ? 'PIN verified successfully' : 'Invalid or expired PIN',
        pin_id: data?.id ?? null,
        valid_until: data?.valid_until ?? null,
      },
    }, 200, req);
  } catch (err) {
    return corsErrorResponse(String(err), 400, req);
  }
});

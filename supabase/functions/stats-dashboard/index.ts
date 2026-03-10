// Supabase Edge Function: stats-dashboard
// Dashboard statistics split into clinic/admin endpoints with role guard
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleOptions, corsJsonResponse, corsErrorResponse, getCorsHeaders } from '../_shared/cors.ts';
import { requireAuthGuard, authErrorResponse } from '../_shared/auth.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req: Request) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '');
    const isAdminEndpoint = path.endsWith('/admin');
    const isClinicEndpoint = path.endsWith('/clinic');

    if (!isAdminEndpoint && !isClinicEndpoint) {
      return new Response(
        JSON.stringify({ success: false, error: 'Use /stats-dashboard/clinic or /stats-dashboard/admin' }),
        { status: 404, headers: getCorsHeaders(req) },
      );
    }

    const guard = await requireAuthGuard(req, {
      allowedRoles: isAdminEndpoint ? ['admin'] : ['clinic', 'admin'],
      corsHeaders: getCorsHeaders(req),
    });

    if ('response' in guard) {
      return guard.response;
    }

    const db = createClient(SUPABASE_URL, SERVICE_KEY);

    if (isAdminEndpoint) {
      const { data: todayStats, error: e1 } = await db
        .from('vw_today_now')
        .select('*')
        .single();

      if (e1) throw e1;

      const { data: clinicPerf, error: e2 } = await db
        .from('vw_clinic_performance')
        .select('*');

      if (e2) throw e2;

      return corsJsonResponse({
        data: {
          scope: 'admin',
          overview: {
            in_queue_now: todayStats?.in_queue_now || 0,
            visits_today: todayStats?.visits_today || 0,
            completed_today: todayStats?.completed_today || 0,
            unique_patients_today: todayStats?.unique_patients_today || 0,
            completion_rate:
              todayStats?.visits_today > 0
                ? Math.round((todayStats.completed_today / todayStats.visits_today) * 100)
                : 0,
          },
          clinics: clinicPerf || [],
          timestamp: new Date().toISOString(),
        },
      }, 200, req);
    }

    const clinicFromQuery = url.searchParams.get('clinic_id');
    if (guard.auth.role === 'clinic' && !guard.auth.clinicId) {
      return authErrorResponse(403, getCorsHeaders(req));
    }

    const clinicId = guard.auth.role === 'admin' ? clinicFromQuery : guard.auth.clinicId;

    if (!clinicId) {
      return new Response(
        JSON.stringify({ success: false, error: 'clinic_id is required for clinic dashboard' }),
        { status: 400, headers: getCorsHeaders(req) },
      );
    }

    if (guard.auth.role === 'clinic' && guard.auth.clinicId && guard.auth.clinicId !== clinicId) {
      return authErrorResponse(403, getCorsHeaders(req));
    }

    const { data: clinicStats, error } = await db
      .from('vw_clinic_performance')
      .select('*')
      .eq('clinic_id', clinicId)
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return corsJsonResponse({
      data: {
        scope: 'clinic',
        clinic_id: clinicId,
        clinic: clinicStats || null,
        timestamp: new Date().toISOString(),
      },
    }, 200, req);
  } catch (err) {
    return corsErrorResponse(String(err), 400, req);
  }
});

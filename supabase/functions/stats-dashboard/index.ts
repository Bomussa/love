// Supabase Edge Function: stats-dashboard
// Dashboard statistics split into clinic/admin endpoints with role guard
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
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '');
    const isAdminEndpoint = path.endsWith('/admin');
    const isClinicEndpoint = path.endsWith('/clinic');

    if (!isAdminEndpoint && !isClinicEndpoint) {
      return new Response(
        JSON.stringify({ success: false, error: 'Use /stats-dashboard/clinic or /stats-dashboard/admin' }),
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

      return new Response(
        JSON.stringify({
          success: true,
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
        }),
        { headers: { 'content-type': 'application/json', ...corsHeaders } },
      );
    }

    const clinicFromQuery = url.searchParams.get('clinic_id');
    if (guard.auth.role === 'clinic' && !guard.auth.clinicId) {
      return authErrorResponse(403, corsHeaders);
    }

    const clinicId = guard.auth.role === 'admin' ? clinicFromQuery : guard.auth.clinicId;

    if (!clinicId) {
      return new Response(
        JSON.stringify({ success: false, error: 'clinic_id is required for clinic dashboard' }),
        { status: 400, headers: { 'content-type': 'application/json', ...corsHeaders } },
      );
    }

    if (guard.auth.role === 'clinic' && guard.auth.clinicId && guard.auth.clinicId !== clinicId) {
      return authErrorResponse(403, corsHeaders);
    }

    const { data: clinicStats, error } = await db
      .from('vw_clinic_performance')
      .select('*')
      .eq('clinic_id', clinicId)
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          scope: 'clinic',
          clinic_id: clinicId,
          stats: clinicStats || {},
          timestamp: new Date().toISOString(),
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

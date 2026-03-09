// Supabase Edge Function: stats-dashboard
// Get real-time dashboard statistics
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleOptions, corsJsonResponse, corsErrorResponse } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req: Request) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    const db = createClient(SUPABASE_URL, SERVICE_KEY);

    // Get today's stats from view
    const { data: todayStats, error: e1 } = await db
      .from('vw_today_now')
      .select('*')
      .single();

    if (e1) throw e1;

    // Get clinic performance
    const { data: clinicPerf, error: e2 } = await db
      .from('vw_clinic_performance')
      .select('*');

    if (e2) throw e2;

    return corsJsonResponse({
      data: {
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
  } catch (err) {
    return corsErrorResponse(String(err), 400, req);
  }
});

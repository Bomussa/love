// Supabase Edge Function: stats-dashboard
// Get real-time dashboard statistics
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "access-control-allow-origin": "https://mmc-mms.com",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const db = createClient(SUPABASE_URL, SERVICE_KEY);

    // Get today's stats from view
    const { data: todayStats, error: e1 } = await db
      .from("vw_today_now")
      .select("*")
      .single();

    if (e1) throw e1;

    // Get clinic performance
    const { data: clinicPerf, error: e2 } = await db
      .from("vw_clinic_performance")
      .select("*");

    if (e2) throw e2;

    return new Response(
      JSON.stringify({
        success: true,
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
      }),
      { headers: { "content-type": "application/json", ...corsHeaders } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 400, headers: { "content-type": "application/json", ...corsHeaders } }
    );
  }
});

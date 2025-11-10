// Supabase Edge Function: queue-status
// Get current queue status for a clinic
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
    const { searchParams } = new URL(req.url);
    const clinic_id = searchParams.get("clinic_id") || searchParams.get("clinicId");

    if (!clinic_id) {
      return new Response(
        JSON.stringify({ success: false, error: "clinic_id parameter required" }),
        { status: 400, headers: { "content-type": "application/json", ...corsHeaders } }
      );
    }

    // Get queue list
    const { data: queueList, error: e1 } = await db
      .from("queues")
      .select("id,display_number,status,entered_at,called_at,patient_id")
      .eq("clinic_id", clinic_id)
      .in("status", ["waiting", "serving"])
      .order("display_number", { ascending: true });

    if (e1) throw e1;

    // Get current serving
    const serving = queueList?.filter((q) => q.status === "serving")[0];
    const waiting = queueList?.filter((q) => q.status === "waiting");

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          clinic_id,
          queueLength: waiting?.length || 0,
          totalInQueue: queueList?.length || 0,
          currentServing: serving?.display_number || null,
          next3: waiting?.slice(0, 3).map((q) => ({
            display_number: q.display_number,
            waiting_since: q.entered_at,
          })) || [],
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

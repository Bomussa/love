// Supabase Edge Function: queue-enter
// Allows patient to enter a clinic queue
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
    const { clinic_id, patient_id } = await req.json();

    if (!clinic_id || !patient_id) {
      return new Response(
        JSON.stringify({ success: false, error: "clinic_id and patient_id required" }),
        { status: 400, headers: { "content-type": "application/json", ...corsHeaders } }
      );
    }

    // Get next display number
    const { data: nextNum, error: e1 } = await db.rpc("get_next_display_number", {
      p_clinic_id: clinic_id,
    });

    if (e1) throw e1;

    // Insert into queue
    const { data: inserted, error: e2 } = await db
      .from("queues")
      .insert({
        clinic_id,
        patient_id,
        display_number: nextNum,
        status: "waiting",
        entered_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (e2) throw e2;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          queue_id: inserted.id,
          display_number: inserted.display_number,
          clinic_id: inserted.clinic_id,
          status: inserted.status,
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

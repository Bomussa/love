// Supabase Edge Function: queue-call
// Call next patient in queue
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
    const { clinic_id } = await req.json();

    if (!clinic_id) {
      return new Response(
        JSON.stringify({ success: false, error: "clinic_id required" }),
        { status: 400, headers: { "content-type": "application/json", ...corsHeaders } }
      );
    }

    // Get next waiting patient
    const { data: nextPatient, error: e1 } = await db
      .from("queues")
      .select("id,display_number,patient_id")
      .eq("clinic_id", clinic_id)
      .eq("status", "waiting")
      .order("display_number", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (e1) throw e1;

    if (!nextPatient) {
      return new Response(
        JSON.stringify({ success: true, data: { called: false, message: "No patients waiting" } }),
        { headers: { "content-type": "application/json", ...corsHeaders } }
      );
    }

    // Update status to serving
    const { data: updated, error: e2 } = await db
      .from("queues")
      .update({ status: "serving", called_at: new Date().toISOString() })
      .eq("id", nextPatient.id)
      .select()
      .single();

    if (e2) throw e2;

    // Create notification
    await db.from("notifications").insert({
      patient_id: nextPatient.patient_id,
      message: `Your turn at the clinic. Display number: ${nextPatient.display_number}`,
      type: "info",
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          called: true,
          queue_id: updated.id,
          display_number: updated.display_number,
          patient_id: updated.patient_id,
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

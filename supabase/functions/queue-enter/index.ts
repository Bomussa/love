// Supabase Edge Function: queue-enter
// Allows patient to enter a clinic queue
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json();
    
    // Support both naming conventions
    const clinic_id = body.clinic_id || body.clinic;
    const patient_id = body.patient_id || body.user;
    const patient_name = body.patient_name || body.name || patient_id;
    const exam_type = body.exam_type || body.examType || "general";

    if (!clinic_id || !patient_id) {
      return new Response(
        JSON.stringify({ success: false, error: "clinic and user are required" }),
        { status: 400, headers: { "content-type": "application/json", ...corsHeaders } }
      );
    }

    // Use the enter_queue_v2 function which handles all the logic
    const { data: result, error: rpcError } = await db
      .rpc('enter_queue_v2', {
        p_clinic_id: clinic_id,
        p_patient_id: patient_id,
        p_patient_name: patient_name,
        p_exam_type: exam_type
      });

    if (rpcError) throw rpcError;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          clinic_id: result.clinic,
          patient_id: result.user,
          position: result.number,
          status: result.status,
          message: result.message || 'Entered queue successfully'
        },
      }),
      { headers: { "content-type": "application/json", ...corsHeaders } }
    );
  } catch (err: any) {
    const errorMessage = err?.message || err?.error?.message || JSON.stringify(err) || String(err);
    console.error("queue-enter error:", errorMessage, err);
    return new Response(
      JSON.stringify({ success: false, error: "An unexpected error occurred" }),
      { status: 400, headers: { "content-type": "application/json", ...corsHeaders } }
    );
  }
});

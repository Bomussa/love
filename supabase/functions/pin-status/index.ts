// Supabase Edge Function: pin-status
// Get active PIN count for a clinic
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

    const now = new Date().toISOString();

    // Count active PINs
    const { data, error } = await db
      .from("pins")
      .select("id", { count: "exact", head: false })
      .eq("clinic_id", clinic_id)
      .is("used_at", null)
      .gt("valid_until", now);

    if (error) throw error;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          clinic_id,
          active_pins: data?.length || 0,
          checked_at: now,
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

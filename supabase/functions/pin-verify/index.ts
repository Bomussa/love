// Supabase Edge Function: pin-verify
// Verify PIN and mark as used
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
    const { clinic_id, pin } = await req.json();

    if (!clinic_id || !pin) {
      return new Response(
        JSON.stringify({ success: false, error: "clinic_id and pin required" }),
        { status: 400, headers: { "content-type": "application/json", ...corsHeaders } }
      );
    }

    const now = new Date().toISOString();

    // Find valid PIN
    const { data: pinRecord, error: e1 } = await db
      .from("pins")
      .select("*")
      .eq("clinic_id", clinic_id)
      .eq("pin", pin)
      .is("used_at", null)
      .gt("valid_until", now)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (e1) throw e1;

    const valid = !!pinRecord;
    let remaining_seconds = 0;

    if (valid && pinRecord) {
      // Mark as used
      await db
        .from("pins")
        .update({ used_at: now })
        .eq("id", pinRecord.id);

      remaining_seconds = Math.max(
        0,
        Math.floor((new Date(pinRecord.valid_until).getTime() - Date.now()) / 1000)
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          valid,
          remaining_seconds,
          message: valid ? "PIN verified successfully" : "Invalid or expired PIN",
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

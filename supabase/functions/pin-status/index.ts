// Supabase Edge Function: pin-status
// Get active daily PIN for a clinic (Updated 2025-11-18)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
};

const getTodayDateString = () => {
  const now = new Date();
  return now.toISOString().split('T')[0]; // YYYY-MM-DD
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
    const today = getTodayDateString();

    // Get today's active PIN
    const { data: pins, error } = await db
      .from("pins")
      .select("*")
      .eq("clinic_id", clinic_id)
      .gt("valid_until", now)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) throw error;

    // Filter for today's PIN
    const todayPins = (pins || []).filter(pin => {
      const pinDate = new Date(pin.created_at).toISOString().split('T')[0];
      return pinDate === today;
    });

    const activePin = todayPins[0] || null;

    if (activePin) {
      const expiresIn = Math.floor((new Date(activePin.valid_until).getTime() - Date.now()) / 1000);
      
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            clinic_id,
            has_active_pin: true,
            pin: activePin.pin,
            pin_id: activePin.id,
            valid_until: activePin.valid_until,
            expires_in_seconds: expiresIn,
            is_used: activePin.used_at !== null,
            checked_at: now,
          },
        }),
        { headers: { "content-type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          clinic_id,
          has_active_pin: false,
          pin: null,
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

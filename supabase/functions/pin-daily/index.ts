// Supabase Edge Function: pin-daily
// Manages daily PIN codes for clinics (one PIN per clinic per day)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Generate a 2-digit PIN (01-99)
 */
const generateDailyPIN = (): string => {
  const pin = Math.floor(Math.random() * 99) + 1;
  return String(pin).padStart(2, '0');
};

/**
 * Get today's date key (YYYY-MM-DD)
 */
const getTodayKey = (): string => {
  const now = new Date();
  return now.toISOString().split('T')[0];
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const { searchParams } = new URL(req.url);
  const method = req.method;

  try {
    // GET: Get current PIN for a clinic (or all clinics)
    if (method === "GET") {
      const clinic_id = searchParams.get("clinic_id") || searchParams.get("clinicId");
      const dateKey = searchParams.get("date") || getTodayKey();

      // If no clinic_id, return all PINs for today
      if (!clinic_id) {
        const { data: allPins, error } = await db
          .from("clinics")
          .select("id, name_ar, name_en, pin")
          .eq("is_active", true)
          .order("display_order");

        if (error) throw error;

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              dateKey,
              pins: allPins || [],
              timestamp: new Date().toISOString(),
            },
          }),
          { headers: { "content-type": "application/json", ...corsHeaders } }
        );
      }

      // Get PIN for specific clinic
      const { data: clinic, error } = await db
        .from("clinics")
        .select("id, name_ar, name_en, pin, updated_at")
        .eq("id", clinic_id)
        .single();

      if (error) throw error;

      if (!clinic) {
        return new Response(
          JSON.stringify({ success: false, error: "Clinic not found" }),
          { status: 404, headers: { "content-type": "application/json", ...corsHeaders } }
        );
      }

      // Check if PIN was updated today
      const updatedDate = new Date(clinic.updated_at).toISOString().split('T')[0];
      const isToday = updatedDate === dateKey;

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            clinic_id: clinic.id,
            clinic_name_ar: clinic.name_ar,
            clinic_name_en: clinic.name_en,
            currentPin: clinic.pin,
            dateKey,
            isToday,
            lastUpdated: clinic.updated_at,
            timestamp: new Date().toISOString(),
          },
        }),
        { headers: { "content-type": "application/json", ...corsHeaders } }
      );
    }

    // POST: Issue new PIN for a clinic
    if (method === "POST") {
      const body = await req.json();
      const clinic_id = body.clinic_id || body.clinicId;

      if (!clinic_id) {
        return new Response(
          JSON.stringify({ success: false, error: "clinic_id required" }),
          { status: 400, headers: { "content-type": "application/json", ...corsHeaders } }
        );
      }

      // Generate new PIN
      const newPin = generateDailyPIN();
      const dateKey = getTodayKey();

      // Update clinic with new PIN
      const { data: updatedClinic, error: updateError } = await db
        .from("clinics")
        .update({ 
          pin: newPin,
          updated_at: new Date().toISOString()
        })
        .eq("id", clinic_id)
        .select("id, name_ar, name_en, pin, updated_at")
        .single();

      if (updateError) throw updateError;

      if (!updatedClinic) {
        return new Response(
          JSON.stringify({ success: false, error: "Failed to update PIN" }),
          { status: 500, headers: { "content-type": "application/json", ...corsHeaders } }
        );
      }

      // Log PIN generation in pins table (for history)
      try {
        await db.from("pins").insert({
          clinic_id,
          pin: newPin,
          valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Valid for 24 hours
          created_at: new Date().toISOString()
        });
      } catch (err) {
        // Log error but don't fail the request
        console.error("Failed to log PIN in history:", err);
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            clinic_id: updatedClinic.id,
            clinic_name_ar: updatedClinic.name_ar,
            clinic_name_en: updatedClinic.name_en,
            currentPin: updatedClinic.pin,
            dateKey,
            issuedAt: updatedClinic.updated_at,
            timestamp: new Date().toISOString(),
          },
        }),
        { headers: { "content-type": "application/json", ...corsHeaders } }
      );
    }

    // Method not allowed
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { "content-type": "application/json", ...corsHeaders } }
    );
  } catch (err) {
    console.error("Error in pin-daily function:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { "content-type": "application/json", ...corsHeaders } }
    );
  }
});

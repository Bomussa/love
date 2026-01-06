// Supabase Edge Function: pin-generate
// Generate daily PIN for clinic entry (Updated 2025-11-18)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
};

const generatePIN = () => String(Math.floor(100000 + Math.random() * 900000));

const getTodayDateString = () => {
  const now = new Date();
  return now.toISOString().split('T')[0]; // YYYY-MM-DD
};

const getEndOfDay = () => {
  const now = new Date();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return endOfDay.toISOString();
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

    const today = getTodayDateString();
    const endOfDay = getEndOfDay();

    // Check if PIN already exists for today
    const { data: existingPin, error: checkError } = await db
      .from("pins")
      .select("*")
      .eq("clinic_id", clinic_id)
      .gte("valid_until", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    // If valid PIN exists for today, return it
    if (existingPin) {
      const createdDate = new Date(existingPin.created_at).toISOString().split('T')[0];
      if (createdDate === today) {
        const expiresIn = Math.floor((new Date(existingPin.valid_until).getTime() - Date.now()) / 1000);
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              pin_id: existingPin.id,
              pin: existingPin.pin,
              valid_until: existingPin.valid_until,
              expires_in_seconds: expiresIn,
              is_existing: true,
            },
          }),
          { headers: { "content-type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Generate new daily PIN
    const pin = generatePIN();

    const { data, error } = await db
      .from("pins")
      .insert({ 
        clinic_id, 
        pin, 
        valid_until: endOfDay,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    const expiresIn = Math.floor((new Date(data.valid_until).getTime() - Date.now()) / 1000);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          pin_id: data.id,
          pin: data.pin,
          valid_until: data.valid_until,
          expires_in_seconds: expiresIn,
          is_existing: false,
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

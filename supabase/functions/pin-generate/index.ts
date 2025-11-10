// Supabase Edge Function: pin-generate
// Generate temporary PIN for clinic entry
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "access-control-allow-origin": "https://mmc-mms.com",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
};

const generatePIN = () => String(Math.floor(100000 + Math.random() * 900000));

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

    const pin = generatePIN();
    const valid_until = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { data, error } = await db
      .from("pins")
      .insert({ clinic_id, pin, valid_until })
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          pin_id: data.id,
          pin: data.pin,
          valid_until: data.valid_until,
          expires_in_seconds: 300,
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

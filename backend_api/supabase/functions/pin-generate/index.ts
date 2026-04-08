// Supabase Edge Function: pin-generate
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateDailyPin } from '../_shared/pin-service.js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const { clinic_id } = await req.json();
    const normalizedClinicId = typeof clinic_id === 'string' ? clinic_id.trim() : '';

    if (!normalizedClinicId) {
      return new Response(
        JSON.stringify({ success: false, error: 'clinic_id required' }),
        { status: 400, headers: { 'content-type': 'application/json', ...corsHeaders } },
      );
    }

    const { pinRecord, isExisting } = await generateDailyPin(db, normalizedClinicId);
    const expiresIn = Math.floor((new Date(pinRecord.valid_until).getTime() - Date.now()) / 1000);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          pin_id: pinRecord.id,
          clinic_id: pinRecord.clinic_id,
          pin: pinRecord.pin,
          valid_until: pinRecord.valid_until,
          expires_in_seconds: expiresIn,
          is_existing: isExisting,
        },
      }),
      { headers: { 'content-type': 'application/json', ...corsHeaders } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 400, headers: { 'content-type': 'application/json', ...corsHeaders } },
    );
  }
});

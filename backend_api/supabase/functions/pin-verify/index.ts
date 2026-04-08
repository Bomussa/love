// Supabase Edge Function: pin-verify
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyPin } from '../_shared/pin-service.js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'access-control-allow-origin': 'https://mmc-mms.com',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const { clinic_id, pin } = await req.json();
    const normalizedClinicId = typeof clinic_id === 'string' ? clinic_id.trim() : '';
    const normalizedPin = typeof pin === 'string' ? pin.trim() : '';

    if (!normalizedClinicId || !normalizedPin) {
      return new Response(
        JSON.stringify({ success: false, error: 'clinic_id and pin required' }),
        { status: 400, headers: { 'content-type': 'application/json', ...corsHeaders } },
      );
    }

    const { valid, pinRecord } = await verifyPin(db, normalizedClinicId, normalizedPin);
    const remaining_seconds = pinRecord
      ? Math.max(0, Math.floor((new Date(pinRecord.valid_until).getTime() - Date.now()) / 1000))
      : 0;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          clinic_id: normalizedClinicId,
          valid,
          remaining_seconds,
          message: valid ? 'PIN verified successfully' : 'Invalid or expired PIN',
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

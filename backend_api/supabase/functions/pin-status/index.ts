// Supabase Edge Function: pin-status
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getPinStatus } from '../_shared/pin-service.js';

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
    const { searchParams } = new URL(req.url);
    const clinic_id = searchParams.get('clinic_id') || searchParams.get('clinicId');
    const normalizedClinicId = clinic_id?.trim() ?? '';

    if (!normalizedClinicId) {
      return new Response(
        JSON.stringify({ success: false, error: 'clinic_id parameter required' }),
        { status: 400, headers: { 'content-type': 'application/json', ...corsHeaders } },
      );
    }

    const now = new Date().toISOString();
    const { hasActivePin, pinRecord } = await getPinStatus(db, normalizedClinicId);

    if (hasActivePin && pinRecord) {
      const expiresIn = Math.floor((new Date(pinRecord.valid_until).getTime() - Date.now()) / 1000);
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            clinic_id: normalizedClinicId,
            has_active_pin: true,
            pin: pinRecord.pin,
            pin_id: pinRecord.id,
            valid_until: pinRecord.valid_until,
            expires_in_seconds: expiresIn,
            is_used: pinRecord.used_at !== null,
            checked_at: now,
          },
        }),
        { headers: { 'content-type': 'application/json', ...corsHeaders } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          clinic_id: normalizedClinicId,
          has_active_pin: false,
          pin: null,
          checked_at: now,
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

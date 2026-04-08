import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateDailyPin } from '../_shared/pin-service.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { clinic_id } = await req.json();
    const normalizedClinicId = typeof clinic_id === 'string' ? clinic_id.trim() : '';

    if (!normalizedClinicId) {
      throw new Error('Missing clinic_id');
    }

    const { pinRecord, isExisting } = await generateDailyPin(supabaseClient, normalizedClinicId);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: pinRecord.id,
          clinic_id: pinRecord.clinic_id,
          pin: pinRecord.pin,
          valid_until: pinRecord.valid_until,
          used_at: pinRecord.used_at,
          created_at: pinRecord.created_at,
        },
        message: isExisting ? 'PIN already active for today' : 'PIN issued successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

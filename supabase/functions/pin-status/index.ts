import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleOptions, corsJsonResponse, corsErrorResponse } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const getTodayDateString = () => new Date().toISOString().split('T')[0];

serve(async (req: Request) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const { searchParams } = new URL(req.url);
    const clinic_id = searchParams.get('clinic_id') || searchParams.get('clinicId');
    if (!clinic_id) return corsErrorResponse('clinic_id parameter required', 400);

    const { data: pins, error } = await db.from('pins').select('*').eq('clinic_id', clinic_id)
      .gt('valid_until', new Date().toISOString()).order('created_at', { ascending: false }).limit(10);
    if (error) throw error;

    const today = getTodayDateString();
    const activePin = (pins || []).find((pin) => new Date(pin.created_at).toISOString().startsWith(today));

    if (!activePin) {
      return corsJsonResponse({ data: { clinic_id, has_active_pin: false, pin: null } });
    }

    return corsJsonResponse({
      data: {
        clinic_id,
        has_active_pin: true,
        pin: activePin.pin,
        pin_id: activePin.id,
        valid_until: activePin.valid_until,
        expires_in_seconds: Math.floor((new Date(activePin.valid_until).getTime() - Date.now()) / 1000),
      },
    });
  } catch (err) {
    return corsErrorResponse(String(err), 400);
  }
});

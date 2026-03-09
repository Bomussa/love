import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleOptions, corsJsonResponse, corsErrorResponse } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req: Request) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const { clinic_id, pin } = await req.json();
    if (!clinic_id || !pin) return corsErrorResponse('clinic_id and pin required', 400);

    const { data, error } = await db.from('pins').select('*').eq('clinic_id', clinic_id).eq('pin', pin)
      .gt('valid_until', new Date().toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;

    const valid = !!data;
    return corsJsonResponse({
      data: {
        valid,
        message: valid ? 'PIN verified successfully' : 'Invalid or expired PIN',
        pin_id: data?.id ?? null,
        valid_until: data?.valid_until ?? null,
      },
    });
  } catch (err) {
    return corsErrorResponse(String(err), 400);
  }
});

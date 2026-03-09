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
    const clinic_id = new URL(req.url).searchParams.get('clinic_id');
    if (!clinic_id) return corsErrorResponse('clinic_id parameter required', 400);

    const { data, error } = await db.from('queues').select('*').eq('clinic_id', clinic_id)
      .order('created_at', { ascending: true });
    if (error) throw error;

    return corsJsonResponse({
      data: {
        clinic_id,
        queue: data || [],
      },
    });
  } catch (err) {
    return corsErrorResponse(String(err), 400);
  }
});

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleOptions, corsJsonResponse, corsErrorResponse } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const generatePIN = () => String(Math.floor(100000 + Math.random() * 900000));
const getTodayDateString = () => new Date().toISOString().split('T')[0];
const getEndOfDay = () => new Date(new Date().setHours(23, 59, 59, 999)).toISOString();

serve(async (req: Request) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const { clinic_id } = await req.json();

    if (!clinic_id) return corsErrorResponse('clinic_id required', 400);

    const today = getTodayDateString();
    const { data: existingPin, error: checkError } = await db
      .from('pins')
      .select('*')
      .eq('clinic_id', clinic_id)
      .gte('valid_until', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') throw checkError;

    if (existingPin) {
      const createdDate = new Date(existingPin.created_at).toISOString().split('T')[0];
      if (createdDate === today) {
        const expiresIn = Math.floor((new Date(existingPin.valid_until).getTime() - Date.now()) / 1000);
        return corsJsonResponse({
          data: {
            pin_id: existingPin.id,
            pin: existingPin.pin,
            valid_until: existingPin.valid_until,
            expires_in_seconds: expiresIn,
            is_existing: true,
          },
        });
      }
    }

    const { data, error } = await db.from('pins').insert({
      clinic_id,
      pin: generatePIN(),
      valid_until: getEndOfDay(),
      created_at: new Date().toISOString(),
    }).select().single();

    if (error) throw error;

    return corsJsonResponse({
      data: {
        pin_id: data.id,
        pin: data.pin,
        valid_until: data.valid_until,
        expires_in_seconds: Math.floor((new Date(data.valid_until).getTime() - Date.now()) / 1000),
        is_existing: false,
      },
    });
  } catch (err) {
    return corsErrorResponse(String(err), 400);
  }
});

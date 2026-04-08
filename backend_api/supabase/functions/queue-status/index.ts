// Supabase Edge Function: queue-status
// Get current queue status for a clinic from canonical public.queues only
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    if (!clinic_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'clinic_id parameter required' }),
        { status: 400, headers: { 'content-type': 'application/json', ...corsHeaders } },
      );
    }

    const { data: queueRows, error } = await db
      .from('queues')
      .select('id, queue_number_int, display_number, status, entered_at, called_at, patient_id')
      .eq('clinic_id', clinic_id)
      .in('status', ['waiting', 'called', 'in_service'])
      .order('queue_number_int', { ascending: true, nullsFirst: false });

    if (error) throw error;

    const normalized = (queueRows ?? []).map((row: any) => ({
      id: row.id,
      status: row.status,
      entered_at: row.entered_at,
      called_at: row.called_at,
      patient_id: row.patient_id,
      position: row.queue_number_int ?? row.display_number ?? null,
    }));

    const serving = normalized.find((q) => q.status === 'in_service' || q.status === 'called');
    const waiting = normalized.filter((q) => q.status === 'waiting');

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          clinic_id,
          queueLength: waiting.length,
          totalInQueue: normalized.length,
          currentServing: serving?.position ?? null,
          next3: waiting.slice(0, 3).map((q) => ({
            position: q.position,
            waiting_since: q.entered_at,
          })),
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

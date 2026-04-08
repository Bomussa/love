import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { assertPinValidForQueueAction } from '../_shared/pin-service.js';

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

    const { clinic_id, pin } = await req.json();
    const normalizedClinicId = typeof clinic_id === 'string' ? clinic_id.trim() : '';
    const normalizedPin = typeof pin === 'string' ? pin.trim() : '';

    if (!normalizedClinicId || !normalizedPin) {
      throw new Error('Missing clinic_id or pin');
    }

    const isPinValid = await assertPinValidForQueueAction(supabaseClient, normalizedClinicId, normalizedPin);
    if (!isPinValid) {
      throw new Error('Invalid or expired PIN');
    }


    await supabaseClient
      .from('queues')
      .update({
        status: 'in_service',
      })
      .eq('clinic_id', clinic_id)
      .eq('queue_date', new Date().toISOString().slice(0, 10))
      .eq('status', 'called');

    const { data: nextPatient, error: queueError } = await supabaseClient
      .from('queues')
      .select('id, clinic_id, patient_id, queue_number_int, display_number, queue_number, status')
      .eq('clinic_id', normalizedClinicId)
      .eq('status', 'waiting')
      .eq('queue_date', new Date().toISOString().slice(0, 10))
      .order('queue_number_int', { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (queueError) throw queueError;

    if (!nextPatient) {
      return new Response(
        JSON.stringify({ success: false, message: 'No patients waiting' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: updatedQueue, error: updateError } = await supabaseClient
      .from('queues')
      .update({
        status: 'called',
        called_at: new Date().toISOString(),
      })
      .eq('id', nextPatient.id)
      .eq('status', 'waiting')
      .select('*')
      .single();

    if (updateError) throw updateError;

    const ticket = nextPatient.display_number ?? nextPatient.queue_number_int ?? nextPatient.queue_number ?? null;
    await supabaseClient.from('events').insert({
      event_type: 'YOUR_TURN',
      clinic_id: normalizedClinicId,
      patient_id: nextPatient.patient_id,
      payload: { ticket, clinic: normalizedClinicId },
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: updatedQueue,
        message: ticket ? `Calling ticket ${ticket}` : 'Calling next patient',
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

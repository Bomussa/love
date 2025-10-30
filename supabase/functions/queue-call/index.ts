import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { clinic } = await req.json()

    if (!clinic) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing clinic parameter'
        }),
        { status: 400, headers }
      )
    }

    // Get next patient in queue
    const { data: nextPatient, error: fetchError } = await supabase
      .from('queue')
      .select('*')
      .eq('clinic_id', clinic)
      .eq('status', 'waiting')
      .order('position', { ascending: true })
      .limit(1)
      .single()

    if (fetchError || !nextPatient) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No patients in queue'
        }),
        { status: 200, headers }
      )
    }

    // Update patient status to called
    const { data: updatedPatient, error: updateError } = await supabase
      .from('queue')
      .update({ 
        status: 'called',
        called_at: new Date().toISOString()
      })
      .eq('id', nextPatient.id)
      .select()
      .single()

    if (updateError) {
      console.error('Update error:', updateError)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to call patient'
        }),
        { status: 500, headers }
      )
    }

    // Get remaining queue count
    const { count } = await supabase
      .from('queue')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinic)
      .eq('status', 'waiting')

    return new Response(
      JSON.stringify({
        success: true,
        calledPatient: updatedPatient,
        remainingInQueue: count || 0
      }),
      { status: 200, headers }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { status: 500, headers }
    )
  }
})

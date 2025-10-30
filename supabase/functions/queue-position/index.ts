import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

    const url = new URL(req.url)
    const patientId = url.searchParams.get('patientId')
    const clinic = url.searchParams.get('clinic')

    if (!patientId || !clinic) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required parameters'
        }),
        { status: 400, headers }
      )
    }

    // Get patient's queue entry
    const { data: patient, error } = await supabase
      .from('queue')
      .select('*')
      .eq('patient_id', patientId)
      .eq('clinic_id', clinic)
      .eq('status', 'waiting')
      .single()

    if (error || !patient) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Patient not found in queue'
        }),
        { status: 404, headers }
      )
    }

    // Count patients ahead
    const { count } = await supabase
      .from('queue')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinic)
      .eq('status', 'waiting')
      .lt('position', patient.position)

    return new Response(
      JSON.stringify({
        success: true,
        position: patient.position,
        patientsAhead: count || 0,
        estimatedWait: (count || 0) * 5
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

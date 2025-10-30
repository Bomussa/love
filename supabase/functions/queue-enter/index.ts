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

    const { patientId, clinic, examType } = await req.json()

    if (!patientId || !clinic) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: patientId and clinic'
        }),
        { status: 400, headers }
      )
    }

    // Get current queue count for this clinic
    const { count } = await supabase
      .from('queue')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinic)
      .eq('status', 'waiting')

    const position = (count || 0) + 1

    // Insert into queue
    const queueData = {
      patient_id: patientId,
      clinic_id: clinic,
      exam_type: examType || 'general',
      position: position,
      status: 'waiting',
      entered_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('queue')
      .insert([queueData])
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to enter queue'
        }),
        { status: 500, headers }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        position: position,
        queueLength: position,
        estimatedWait: position * 5,
        data: data
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

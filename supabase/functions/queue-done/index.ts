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

    const { patientId, clinic } = await req.json()

    if (!patientId || !clinic) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields'
        }),
        { status: 400, headers }
      )
    }

    // Update patient status to done
    const { data, error } = await supabase
      .from('queue')
      .update({ 
        status: 'done',
        completed_at: new Date().toISOString()
      })
      .eq('patient_id', patientId)
      .eq('clinic_id', clinic)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to mark patient as done'
        }),
        { status: 500, headers }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Patient marked as done',
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

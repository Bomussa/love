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

    const { patientId, gender } = await req.json()

    if (!patientId || !gender) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: patientId and gender'
        }),
        { status: 400, headers }
      )
    }

    // Validate gender
    if (!['male', 'female'].includes(gender)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid gender. Must be male or female'
        }),
        { status: 400, headers }
      )
    }

    const sessionId = `${Date.now()}-${crypto.randomUUID()}`
    const patientData = {
      id: sessionId,
      patient_id: patientId,
      gender,
      login_time: new Date().toISOString(),
      status: 'logged_in'
    }

    // Store in database
    const { data, error } = await supabase
      .from('patients')
      .insert([patientData])
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to create patient session'
        }),
        { status: 500, headers }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: data,
        message: 'Login successful'
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

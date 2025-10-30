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

    if (!patientId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing patientId parameter'
        }),
        { status: 400, headers }
      )
    }

    const { data: route, error } = await supabase
      .from('routes')
      .select('*')
      .eq('patient_id', patientId)
      .eq('status', 'active')
      .single()

    if (error || !route) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Route not found'
        }),
        { status: 404, headers }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        route: route
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

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
    const clinic = url.searchParams.get('clinic')

    if (!clinic) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing clinic parameter'
        }),
        { status: 400, headers }
      )
    }

    // Get all waiting patients in queue
    const { data: patients, error } = await supabase
      .from('queue')
      .select('*')
      .eq('clinic_id', clinic)
      .eq('status', 'waiting')
      .order('position', { ascending: true })

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to get queue status'
        }),
        { status: 500, headers }
      )
    }

    // Get current number (last called)
    const { data: current } = await supabase
      .from('queue')
      .select('position')
      .eq('clinic_id', clinic)
      .eq('status', 'called')
      .order('called_at', { ascending: false })
      .limit(1)
      .single()

    return new Response(
      JSON.stringify({
        success: true,
        clinic,
        queueLength: patients?.length || 0,
        currentNumber: current?.position || 0,
        patients: patients || []
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

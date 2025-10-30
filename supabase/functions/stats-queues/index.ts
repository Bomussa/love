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

    // Get all clinics
    const { data: clinics, error: clinicsError } = await supabase
      .from('clinics')
      .select('*')
      .eq('active', true)

    if (clinicsError) {
      console.error('Clinics error:', clinicsError)
    }

    const queues = []

    if (clinics) {
      for (const clinic of clinics) {
        // Get queue stats for each clinic
        const { count: waiting } = await supabase
          .from('queue')
          .select('*', { count: 'exact', head: true })
          .eq('clinic_id', clinic.id)
          .eq('status', 'waiting')

        const { data: current } = await supabase
          .from('queue')
          .select('position')
          .eq('clinic_id', clinic.id)
          .eq('status', 'called')
          .order('called_at', { ascending: false })
          .limit(1)
          .single()

        queues.push({
          clinicId: clinic.id,
          clinicName: clinic.name,
          waiting: waiting || 0,
          currentNumber: current?.position || 0
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        queues: queues,
        timestamp: new Date().toISOString()
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

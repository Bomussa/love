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

    const today = new Date().toISOString().split('T')[0]

    // Get total patients today
    const { count: totalPatients } = await supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .gte('login_time', `${today}T00:00:00`)

    // Get active queues
    const { count: activeQueues } = await supabase
      .from('queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'waiting')

    // Get completed today
    const { count: completedToday } = await supabase
      .from('queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'done')
      .gte('completed_at', `${today}T00:00:00`)

    // Calculate average wait time (simplified)
    const { data: donePatients } = await supabase
      .from('queue')
      .select('entered_at, called_at')
      .eq('status', 'done')
      .gte('completed_at', `${today}T00:00:00`)
      .not('called_at', 'is', null)

    let averageWaitTime = 0
    if (donePatients && donePatients.length > 0) {
      const totalWait = donePatients.reduce((sum, patient) => {
        const wait = new Date(patient.called_at).getTime() - new Date(patient.entered_at).getTime()
        return sum + wait
      }, 0)
      averageWaitTime = Math.round(totalWait / donePatients.length / 60000) // minutes
    }

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          totalPatients: totalPatients || 0,
          activeQueues: activeQueues || 0,
          completedToday: completedToday || 0,
          averageWaitTime: averageWaitTime
        },
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

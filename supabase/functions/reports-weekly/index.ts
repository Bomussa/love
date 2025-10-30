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
    const weekStart = url.searchParams.get('weekStart') || 
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    const weekEnd = new Date(new Date(weekStart).getTime() + 7 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0]

    // Get weekly statistics
    const { count: totalPatients } = await supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .gte('login_time', `${weekStart}T00:00:00`)
      .lt('login_time', `${weekEnd}T23:59:59`)

    const { count: completedExams } = await supabase
      .from('queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'done')
      .gte('completed_at', `${weekStart}T00:00:00`)
      .lt('completed_at', `${weekEnd}T23:59:59`)

    return new Response(
      JSON.stringify({
        success: true,
        report: {
          weekStart,
          weekEnd,
          totalPatients: totalPatients || 0,
          completedExams: completedExams || 0
        }
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

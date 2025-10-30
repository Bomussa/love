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
    const year = url.searchParams.get('year') || new Date().getFullYear().toString()

    // Get annual statistics
    const { count: totalPatients } = await supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .gte('login_time', `${year}-01-01T00:00:00`)
      .lt('login_time', `${year}-12-31T23:59:59`)

    const { count: completedExams } = await supabase
      .from('queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'done')
      .gte('completed_at', `${year}-01-01T00:00:00`)
      .lt('completed_at', `${year}-12-31T23:59:59`)

    // Get monthly breakdown
    const monthlyData = []
    for (let month = 1; month <= 12; month++) {
      const monthStr = month.toString().padStart(2, '0')
      const { count } = await supabase
        .from('queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'done')
        .gte('completed_at', `${year}-${monthStr}-01T00:00:00`)
        .lt('completed_at', `${year}-${monthStr}-31T23:59:59`)
      
      monthlyData.push({ month: monthStr, count: count || 0 })
    }

    return new Response(
      JSON.stringify({
        success: true,
        report: {
          year,
          totalPatients: totalPatients || 0,
          completedExams: completedExams || 0,
          monthlyData
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

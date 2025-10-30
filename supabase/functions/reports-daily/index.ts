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
    const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0]

    // Get daily statistics
    const { count: totalPatients } = await supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .gte('login_time', `${date}T00:00:00`)
      .lt('login_time', `${date}T23:59:59`)

    const { count: completedExams } = await supabase
      .from('queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'done')
      .gte('completed_at', `${date}T00:00:00`)
      .lt('completed_at', `${date}T23:59:59`)

    const { count: cancelledExams } = await supabase
      .from('queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'cancelled')
      .gte('cancelled_at', `${date}T00:00:00`)
      .lt('cancelled_at', `${date}T23:59:59`)

    // Get clinic breakdown
    const { data: clinicStats } = await supabase
      .from('queue')
      .select('clinic_id, status')
      .gte('entered_at', `${date}T00:00:00`)
      .lt('entered_at', `${date}T23:59:59`)

    const clinicBreakdown: Record<string, any> = {}
    if (clinicStats) {
      clinicStats.forEach(stat => {
        if (!clinicBreakdown[stat.clinic_id]) {
          clinicBreakdown[stat.clinic_id] = { total: 0, done: 0, cancelled: 0 }
        }
        clinicBreakdown[stat.clinic_id].total++
        if (stat.status === 'done') clinicBreakdown[stat.clinic_id].done++
        if (stat.status === 'cancelled') clinicBreakdown[stat.clinic_id].cancelled++
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        report: {
          date,
          totalPatients: totalPatients || 0,
          completedExams: completedExams || 0,
          cancelledExams: cancelledExams || 0,
          clinicBreakdown
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

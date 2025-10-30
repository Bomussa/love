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

    const { clinic, count = 1 } = await req.json()

    if (!clinic) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing clinic parameter'
        }),
        { status: 400, headers }
      )
    }

    // Generate PINs
    const pins = []
    const dateKey = new Date().toISOString().split('T')[0]

    for (let i = 0; i < count; i++) {
      const pin = Math.floor(10000 + Math.random() * 90000).toString()
      
      const pinData = {
        pin,
        clinic_id: clinic,
        date_key: dateKey,
        status: 'active',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes
      }

      const { data, error } = await supabase
        .from('pins')
        .insert([pinData])
        .select()
        .single()

      if (error) {
        console.error('Database error:', error)
        continue
      }

      pins.push(data)
    }

    return new Response(
      JSON.stringify({
        success: true,
        pins: pins,
        count: pins.length,
        dateKey
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

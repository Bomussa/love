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

    const { pin, clinic, dateKey } = await req.json()

    if (!pin || !clinic) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: pin and clinic'
        }),
        { status: 400, headers }
      )
    }

    const useDateKey = dateKey || new Date().toISOString().split('T')[0]

    // Verify PIN
    const { data: pinData, error } = await supabase
      .from('pins')
      .select('*')
      .eq('pin', pin)
      .eq('clinic_id', clinic)
      .eq('date_key', useDateKey)
      .eq('status', 'active')
      .single()

    if (error || !pinData) {
      return new Response(
        JSON.stringify({
          success: false,
          valid: false,
          error: 'PIN not found or expired'
        }),
        { status: 404, headers }
      )
    }

    // Check if expired
    const expiresAt = new Date(pinData.expires_at)
    if (expiresAt < new Date()) {
      // Mark as expired
      await supabase
        .from('pins')
        .update({ status: 'expired' })
        .eq('id', pinData.id)

      return new Response(
        JSON.stringify({
          success: false,
          valid: false,
          error: 'PIN expired'
        }),
        { status: 400, headers }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        valid: true,
        clinic: pinData.clinic_id,
        pin: pinData.pin
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

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

    const { username, password, clinicId } = await req.json()

    if (!username || !password) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: username and password'
        }),
        { status: 400, headers }
      )
    }

    // Verify admin credentials
    const { data: admin, error } = await supabase
      .from('admins')
      .select('*')
      .eq('username', username)
      .eq('password', password) // In production, use hashed passwords
      .single()

    if (error || !admin) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid credentials'
        }),
        { status: 401, headers }
      )
    }

    // If clinicId provided, verify access
    if (clinicId && admin.clinic_id !== clinicId && admin.role !== 'super_admin') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Access denied to this clinic'
        }),
        { status: 403, headers }
      )
    }

    // Create session
    const sessionId = crypto.randomUUID()
    const sessionData = {
      session_id: sessionId,
      admin_id: admin.id,
      username: admin.username,
      role: admin.role,
      clinic_id: admin.clinic_id,
      login_time: new Date().toISOString(),
      expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() // 8 hours
    }

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert([sessionData])
      .select()
      .single()

    if (sessionError) {
      console.error('Session error:', sessionError)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to create session'
        }),
        { status: 500, headers }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        admin: {
          id: admin.id,
          username: admin.username,
          role: admin.role,
          clinicId: admin.clinic_id
        },
        session: {
          sessionId: session.session_id,
          expiresAt: session.expires_at
        },
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

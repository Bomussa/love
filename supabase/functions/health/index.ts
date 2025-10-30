import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  }

  // Handle OPTIONS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }

  try {
    return new Response(
      JSON.stringify({
        success: true,
        status: 'healthy',
        mode: 'online',
        backend: 'up',
        platform: 'supabase',
        timestamp: new Date().toISOString(),
        version: '3.0.0'
      }),
      { status: 200, headers }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { status: 500, headers }
    )
  }
})

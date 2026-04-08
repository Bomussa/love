// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // Initialize Supabase Client
    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    try {
        const url = new URL(req.url)
        // Extract the path from the URL, handling both direct calls and rewrites
        // Example: /api/v1/queue/enter -> queue/enter
        let path = url.pathname.replace(/^\/api\/v1\//, '').replace(/^\/api-router\//, '')
        
        // Handle query param override (e.g. ?path=queue/enter)
        const queryPath = url.searchParams.get('path')
        if (queryPath) path = queryPath

        console.log(`[api-router] Request path: ${path}, Method: ${req.method}`)

        // ==========================================
        // ROUTING LOGIC
        // ==========================================

        // 1. Queue Enter
        if (path === 'queue/enter' && req.method === 'POST') {
             return await forwardToFunction('queue-enter', req)
        }

        // 2. Patient Login
        if (path === 'patient/login' && req.method === 'POST') {
             return await forwardToFunction('patient-login', req)
        }
        
        // 3. Call Next Patient
        if (path === 'queue/call' && req.method === 'POST') {
             return await forwardToFunction('call-next-patient', req)
        }

        // 4. Issue PIN
        if (path === 'pin/generate' && req.method === 'POST') {
             return await forwardToFunction('issue-pin', req)
        }

        // 5. Queue Status (Read-only, can be handled here or forwarded)
        if (path === 'queue/status' && req.method === 'GET') {
            // Forward to queue-status function to keep logic isolated
             return await forwardToFunction('queue-status', req)
        }
        
        // 6. Events Stream (SSE)
        if (path === 'events/stream' && req.method === 'GET') {
             return await forwardToFunction('events-stream', req)
        }
        
        // 7. Admin Status
        if (path === 'admin/status' && req.method === 'GET') {
             return await forwardToFunction('api-v1-status', req)
        }
        
        // 8. Pin Status
         if (path === 'pin/status' && req.method === 'GET') {
             return await forwardToFunction('pin-status', req)
        }
        
        // 9. Admin Login
        if (path === 'admin/login' && req.method === 'POST') {
             return await forwardToFunction('admin-login', req)
        }
        
        // 10. Admin Session Verify
        if (path === 'admin/session/verify' && req.method === 'POST') {
             return await forwardToFunction('admin-session-verify', req)
        }

        // Fallback: Return 404
        return new Response(
            JSON.stringify({ success: false, error: `Route not found: ${path}` }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error(`[api-router] Error:`, error)
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

// Helper to forward request to another Edge Function
async function forwardToFunction(functionName: string, req: Request): Promise<Response> {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    const targetUrl = `${supabaseUrl}/functions/v1/${functionName}`
    
    console.log(`[api-router] Forwarding to: ${targetUrl}`)

    try {
        // Clone headers but remove host/connection specific ones
        const headers = new Headers(req.headers)
        headers.set('Authorization', `Bearer ${serviceKey}`) // Use service key for internal calls? Or pass through?
        // Better to pass through user token if present, else service key?
        // For 'patient-login', it's public. For 'queue-enter', it needs token.
        // Let's rely on the function's own auth check.
        // But functions run with 'service_role' by default if invoked via admin API.
        // If we fetch directly, we need to pass Auth.
        
        // However, we are proxying.
        const body = req.method === 'POST' || req.method === 'PUT' ? await req.text() : undefined
        
        const response = await fetch(targetUrl, {
            method: req.method,
            headers: headers,
            body: body
        })
        
        // Stream the response back
        return new Response(response.body, {
            status: response.status,
            headers: response.headers
        })
    } catch (e) {
        throw new Error(`Failed to invoke ${functionName}: ${e.message}`)
    }
}

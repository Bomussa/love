/**
 * Supabase Edge Function: login
 * 
 * Purpose: Handle user login/authentication requests
 * Validates credentials and returns auth tokens
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCorsPrelight, corsResponse } from '../_shared/cors.ts';
import { validateLoginRequest, sanitizeError } from '../_shared/validate.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPrelight(req);
  if (preflightResponse) {
    return preflightResponse;
  }

  const origin = req.headers.get('origin') || undefined;

  // Only allow POST requests
  if (req.method !== 'POST') {
    return corsResponse(
      JSON.stringify({ 
        error: 'Method Not Allowed',
        allowed: ['POST', 'OPTIONS'] 
      }),
      { status: 405, origin }
    );
  }

  try {
    // Parse request body
    const body = await req.json();
    
    // Validate request
    const validation = validateLoginRequest(body);
    if (!validation.valid) {
      return corsResponse(
        JSON.stringify({ 
          error: 'Validation Error',
          message: validation.error 
        }),
        { status: 400, origin }
      );
    }

    const { email, password } = validation.data!;

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase configuration');
      return corsResponse(
        JSON.stringify({ 
          error: 'Configuration Error',
          message: 'Server configuration error' 
        }),
        { status: 500, origin }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Attempt login
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Return appropriate error status
      const status = error.message.includes('Invalid') ? 401 : 400;
      return corsResponse(
        JSON.stringify({ 
          error: 'Authentication Error',
          message: error.message 
        }),
        { status, origin }
      );
    }

    // Successful login
    return corsResponse(
      JSON.stringify({ 
        success: true,
        user: {
          id: data.user?.id,
          email: data.user?.email,
        },
        session: {
          access_token: data.session?.access_token,
          refresh_token: data.session?.refresh_token,
          expires_at: data.session?.expires_at,
        },
      }),
      { status: 200, origin }
    );
  } catch (error) {
    console.error('Login error:', error);
    
    return corsResponse(
      JSON.stringify({ 
        error: 'Internal Error',
        message: sanitizeError(error) 
      }),
      { status: 500, origin }
    );
  }
});

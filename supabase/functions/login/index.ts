/**
 * Supabase Edge Function: login
 * 
 * Handles user authentication via Supabase Auth
 * Validates credentials and returns session tokens
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders, handleCorsRequest } from '../_shared/cors.ts';
import { validateLoginRequest } from '../_shared/validate.ts';

// Get Supabase client from environment
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') || undefined;

  // Handle CORS preflight
  const corsResponse = handleCorsRequest(req);
  if (corsResponse) {
    return corsResponse;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method Not Allowed', allowed: ['POST', 'OPTIONS'] }),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(origin),
        },
      }
    );
  }

  try {
    // Parse and validate request body
    const body = await req.json();
    const validation = validateLoginRequest(body);

    if (!validation.valid) {
      return new Response(
        JSON.stringify({ 
          error: 'Validation failed', 
          details: validation.errors 
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(origin),
          },
        }
      );
    }

    const { email, password } = validation.data!;

    // Create Supabase client for authentication
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Attempt to sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Return appropriate status based on error properties
      // Supabase Auth errors for invalid credentials typically have status 400
      // Map common authentication errors to 401 Unauthorized
      let status = 500; // Default to server error
      
      // Check for authentication/credential errors (case-insensitive)
      const errorMsg = error.message?.toLowerCase() || '';
      const isAuthError = errorMsg.includes('invalid') || 
                         errorMsg.includes('credentials') || 
                         errorMsg.includes('password') ||
                         errorMsg.includes('email not');
      
      if (isAuthError || error.status === 400) {
        status = 401; // Unauthorized
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Authentication failed', 
          message: error.message 
        }),
        {
          status,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders(origin),
          },
        }
      );
    }

    // Log successful login (for audit purposes)
    if (data.user) {
      console.log(`Login successful for user: ${data.user.id}`);
    }

    // Return session data
    return new Response(
      JSON.stringify({
        success: true,
        session: data.session,
        user: data.user,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(origin),
        },
      }
    );
  } catch (error) {
    // Log full error details server-side for debugging
    console.error('Login error:', error);
    
    // Never expose internal error details to clients for security
    return new Response(
      JSON.stringify({ 
        error: 'Internal Server Error', 
        message: 'An unexpected error occurred. Please try again later.' 
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(origin),
        },
      }
    );
  }
});

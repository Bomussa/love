/**
 * Supabase Edge Function: /api/v1/login
 * 
 * Purpose: Handle user login/authentication
 * Validates credentials and returns auth tokens
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { handleOptions, corsJsonResponse, corsErrorResponse } from '../_shared/cors.ts';
import { parseJsonBody, validateLoginCredentials } from '../_shared/validate.ts';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');

  // Handle CORS preflight
  const optionsResponse = handleOptions(req);
  if (optionsResponse) {
    return optionsResponse;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return corsErrorResponse('Method Not Allowed', 405, origin);
  }

  // Parse and validate request body
  const body = await parseJsonBody(req);
  if (!body) {
    return corsErrorResponse('Invalid JSON body', 400, origin);
  }

  const validation = validateLoginCredentials(body);
  if (!validation.valid) {
    return corsErrorResponse(validation.error || 'Invalid credentials', 400, origin);
  }

  const { email, password } = validation.credentials!;

  try {
    // Create Supabase client for auth
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Attempt to sign in with email and password
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Login error:', error);
      
      // Return appropriate status codes
      if (error.message.includes('Invalid') || error.message.includes('credentials')) {
        return corsErrorResponse('Invalid email or password', 401, origin);
      }
      
      return corsErrorResponse(error.message, 400, origin);
    }

    // Log successful login attempt (for audit)
    // Note: Email is not logged to protect user privacy
    console.log('Login successful:', { timestamp: new Date().toISOString() });

    // Return success with session data
    return corsJsonResponse(
      {
        success: true,
        session: data.session,
        user: data.user,
      },
      200,
      origin
    );
  } catch (error) {
    console.error('Unexpected login error:', error);
    return corsErrorResponse('Internal server error', 500, origin);
  }
});

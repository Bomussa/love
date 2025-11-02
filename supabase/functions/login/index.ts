/**
 * Supabase Edge Function: login
 * 
 * Purpose: Handles user authentication via Supabase Auth
 * Validates credentials and returns session tokens
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { handleOptions, corsJsonResponse, corsErrorResponse } from '../_shared/cors.ts';
import { validateLoginRequest, checkRateLimit } from '../_shared/validate.ts';

interface LoginResponse {
  success: boolean;
  session?: {
    access_token: string;
    refresh_token: string;
    user: {
      id: string;
      email: string;
    };
  };
  error?: string;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return corsErrorResponse(
      'Method Not Allowed',
      'Only POST and OPTIONS methods are allowed',
      405,
      origin
    );
  }

  try {
    // Parse request body
    const body = await req.json();

    // Validate request
    const validation = validateLoginRequest(body);
    if (!validation.valid) {
      return corsErrorResponse(
        'Validation Error',
        validation.errors.join(', '),
        400,
        origin
      );
    }

    const { email, password } = body;

    // Rate limiting: 5 attempts per minute per IP
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(clientIp, 5, 60000)) {
      return corsErrorResponse(
        'Too Many Requests',
        'Rate limit exceeded. Please try again later.',
        429,
        origin
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials');
      return corsErrorResponse(
        'Configuration Error',
        'Service is not properly configured',
        500,
        origin
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Log failed attempt (in production, save to audit table)
      // Mask email for privacy: show first 2 chars and domain
      const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
      console.error('Login failed:', { email: maskedEmail, error: error.message });

      return corsErrorResponse(
        'Authentication Failed',
        error.message,
        401,
        origin
      );
    }

    if (!data.session) {
      return corsErrorResponse(
        'Authentication Failed',
        'No session created',
        401,
        origin
      );
    }

    // Log successful login (in production, save to audit table)
    // Only log user ID for privacy compliance (GDPR, etc.)
    console.log('Login successful:', { userId: data.user?.id });

    // Return success response
    const response: LoginResponse = {
      success: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: {
          id: data.user?.id || '',
          email: data.user?.email || '',
        },
      },
    };

    return corsJsonResponse(response, 200, origin);
  } catch (error) {
    console.error('Login error:', error);

    return corsErrorResponse(
      'Internal Server Error',
      'An unexpected error occurred',
      500,
      origin
    );
  }
});

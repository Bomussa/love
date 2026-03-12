/**
 * Supabase Edge Function: login
 * Admin authentication using bcrypt hash stored in admins.password_hash
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { compare } from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';
import { handleOptions, corsJsonResponse, corsErrorResponse } from '../_shared/cors.ts';
import { parseJsonBody } from '../_shared/validate.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

interface AdminLoginBody {
  username?: string;
  password?: string;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== 'POST') {
    return corsErrorResponse('Method Not Allowed', 405, origin);
  }

  const body = await parseJsonBody<AdminLoginBody>(req);
  if (!body || typeof body.username !== 'string' || typeof body.password !== 'string') {
    return corsErrorResponse('Username and password are required', 400, origin);
  }

  const username = body.username.trim();
  const password = body.password;

  if (username.length < 3 || password.length < 8) {
    return corsErrorResponse('Invalid username or password', 401, origin);
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: adminUser, error: userError } = await supabase
      .from('admins')
      .select('id, username, role, name, is_active, password_hash')
      .eq('username', username)
      .maybeSingle();

    if (userError || !adminUser || !adminUser.is_active || !adminUser.password_hash) {
      return corsErrorResponse('Invalid username or password', 401, origin);
    }

    const isPasswordValid = await compare(password, adminUser.password_hash);
    if (!isPasswordValid) {
      return corsErrorResponse('Invalid username or password', 401, origin);
    }

    await supabase
      .from('admins')
      .update({ last_login: new Date().toISOString() })
      .eq('id', adminUser.id);
    return corsJsonResponse(
      {
        data: {
          user: {
            id: adminUser.id,
            username: adminUser.username,
            role: adminUser.role,
            name: adminUser.name,
          },
        },
      },
      200,
      origin,
    );
  } catch (error) {
    console.error('Unexpected admin login error:', error);
    return corsErrorResponse('Internal server error', 500, origin);
  }
});

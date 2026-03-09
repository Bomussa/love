import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { handleOptions, corsJsonResponse, corsErrorResponse } from '../_shared/cors.ts';
import { parseJsonBody } from '../_shared/validate.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');

  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== 'POST') {
    return corsErrorResponse('Method Not Allowed', 405, origin);
  }

  const body = await parseJsonBody<Record<string, unknown>>(req);
  const username = typeof body?.username === 'string' ? body.username.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!username || !password) {
    return corsErrorResponse('Invalid credentials', 401, origin);
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

    const { data, error } = await supabase.rpc('admin_auth_login', {
      p_username: username,
      p_password: password,
      p_ip_address: forwardedFor,
    });

    if (error || !Array.isArray(data) || data.length === 0) {
      return corsErrorResponse('Invalid credentials', 401, origin);
    }

    const result = data[0];
    if (!result?.success) {
      const hasLockout = Number(result?.lockout_seconds || 0) > 0;
      return corsErrorResponse('Invalid credentials', hasLockout ? 429 : 401, origin);
    }

    return corsJsonResponse(
      {
        success: true,
        user: {
          id: result.user_id,
          username: result.username,
          role: result.role,
        },
      },
      200,
      origin,
    );
  } catch (error) {
    console.error('admin-login unexpected error', error);
    return corsErrorResponse('Invalid credentials', 401, origin);
  }
});

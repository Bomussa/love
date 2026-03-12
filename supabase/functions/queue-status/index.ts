import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleOptions, corsJsonResponse, corsErrorResponse } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: Request): string {
  const xForwardedFor = req.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0]?.trim() || 'unknown';
  }

  return req.headers.get('x-real-ip') || 'unknown';
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const current = rateLimitStore.get(key);

  if (!current || now > current.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  current.count += 1;
  return false;
}

function toStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === 'string');
  if (typeof value === 'string') return [value];
  return [];
}

serve(async (req: Request) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== 'GET') {
    return corsErrorResponse('method_not_allowed', 405, req);
  }

  const ip = getClientIp(req);
  if (isRateLimited(`queue-status:${ip}`)) {
    return corsErrorResponse('too_many_requests', 429, req);
  }

  try {
    const url = new URL(req.url);
    const clinic_id = url.searchParams.get('clinic_id');
    if (!clinic_id) return corsErrorResponse('clinic_id_required', 400, req);

    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return corsErrorResponse('unauthorized', 401, req);
    }

    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) {
      return corsErrorResponse('unauthorized', 401, req);
    }

    const user = authData.user;
    const db = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: userRole, error: roleError } = await db
      .from('roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (roleError) {
      console.error('queue-status role lookup failed', { user_id: user.id, message: roleError.message });
      return corsErrorResponse('internal_error', 500, req);
    }

    const role = userRole?.role ?? 'patient';
    const limitedRoles = new Set(['patient', 'operator']);

    if (limitedRoles.has(role)) {
      const allowedClinicIds = new Set<string>([
        ...toStringArray(user.app_metadata?.clinic_ids),
        ...toStringArray(user.user_metadata?.clinic_ids),
        ...toStringArray(user.app_metadata?.clinic_id),
        ...toStringArray(user.user_metadata?.clinic_id),
      ]);

      // deny-by-default: missing clinic scope must never imply global access.
      if (allowedClinicIds.size === 0 || !allowedClinicIds.has(clinic_id)) {
        return corsErrorResponse('forbidden_clinic_scope', 403, req);
      }
    }

    const { data, error } = await db
      .from('queues')
      .select('number,status,created_at,entered_at,left_at')
      .eq('clinic_id', clinic_id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('queue-status query failed', { clinic_id, message: error.message });
      return corsErrorResponse('internal_error', 500, req);
    }

    return corsJsonResponse(
      {
        data: {
          clinic_id,
          queue: data || [],
        },
      },
      200,
      req,
    );
  } catch (err) {
    console.error('queue-status unexpected error', err);
    return corsErrorResponse('internal_error', 500, req);
  }
});

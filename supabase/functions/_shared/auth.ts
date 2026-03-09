import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type AppRole = 'admin' | 'clinic';

export interface AuthContext {
  userId: string;
  role: AppRole;
  clinicId: string | null;
  token: string;
}

interface GuardOptions {
  allowedRoles: AppRole[];
  corsHeaders: Record<string, string>;
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim() || null;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;

  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (payload.length % 4)) % 4;
    const padded = payload + '='.repeat(padLength);
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function getRole(payload: Record<string, unknown> | null, user: any): AppRole | null {
  const candidates = [
    payload?.role,
    (payload?.app_metadata as Record<string, unknown> | undefined)?.role,
    user?.app_metadata?.role,
  ];

  for (const candidate of candidates) {
    const role = String(candidate || '').toLowerCase();
    if (role === 'admin' || role === 'clinic') return role;
  }

  return null;
}

function getClinicId(payload: Record<string, unknown> | null, user: any): string | null {
  const candidates = [
    payload?.clinic_id,
    (payload?.app_metadata as Record<string, unknown> | undefined)?.clinic_id,
    user?.app_metadata?.clinic_id,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
  }

  return null;
}

export function authErrorResponse(status: 401 | 403, corsHeaders: Record<string, string>) {
  const message = status === 401 ? 'Unauthorized access' : 'Forbidden access';
  const code = status === 401 ? 'unauthorized' : 'forbidden';

  return new Response(
    JSON.stringify({ success: false, error: { code, message } }),
    { status, headers: { 'content-type': 'application/json', ...corsHeaders } },
  );
}

export async function requireAuthGuard(
  req: Request,
  { allowedRoles, corsHeaders }: GuardOptions,
): Promise<{ auth: AuthContext } | { response: Response }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !anonKey) {
    return {
      response: new Response(
        JSON.stringify({ success: false, error: { code: 'server_error', message: 'Server auth is not configured' } }),
        { status: 500, headers: { 'content-type': 'application/json', ...corsHeaders } },
      ),
    };
  }

  const token = getBearerToken(req);
  if (!token) return { response: authErrorResponse(401, corsHeaders) };

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user?.id) return { response: authErrorResponse(401, corsHeaders) };

  const payload = decodeJwtPayload(token);
  const role = getRole(payload, data.user);

  if (!role || !allowedRoles.includes(role)) {
    return { response: authErrorResponse(403, corsHeaders) };
  }

  return {
    auth: {
      userId: data.user.id,
      role,
      clinicId: getClinicId(payload, data.user),
      token,
    },
  };
}

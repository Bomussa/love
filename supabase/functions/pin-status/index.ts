import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleOptions, corsJsonResponse, corsErrorResponse } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const getTodayDateString = () => new Date().toISOString().split('T')[0];

const PUBLIC_ALLOWED_ROLES = new Set(['authenticated', 'admin', 'clinic_admin', 'manager']);
const ADMIN_ALLOWED_ROLES = new Set(['admin', 'service_role']);

function extractRole(user: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> }): string {
  const appRole = user.app_metadata?.role;
  if (typeof appRole === 'string' && appRole.length > 0) return appRole;

  const userRole = user.user_metadata?.role;
  if (typeof userRole === 'string' && userRole.length > 0) return userRole;

  return 'authenticated';
}

serve(async (req: Request) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    if (!token) return corsErrorResponse('Missing bearer token', 401);

    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: authData, error: authError } = await db.auth.getUser(token);
    if (authError || !authData.user) return corsErrorResponse('Invalid or expired token', 401);

    const { searchParams } = new URL(req.url);
    const isAdminRoute = new URL(req.url).pathname.endsWith('/admin');

    const role = extractRole(authData.user);
    const roleAllowed = isAdminRoute ? ADMIN_ALLOWED_ROLES.has(role) : PUBLIC_ALLOWED_ROLES.has(role);
    if (!roleAllowed) return corsErrorResponse('Insufficient permissions', 403);

    const clinic_id = searchParams.get('clinic_id') || searchParams.get('clinicId');
    if (!clinic_id) return corsErrorResponse('clinic_id parameter required', 400);

    const selectColumns = isAdminRoute
      ? 'id, clinic_id, pin, valid_until, created_at'
      : 'id, clinic_id, valid_until, created_at';

    const { data: pins, error } = await db.from('pins').select(selectColumns).eq('clinic_id', clinic_id)
      .gt('valid_until', new Date().toISOString()).order('created_at', { ascending: false }).limit(10);
    if (error) throw error;

    const today = getTodayDateString();
    const activePin = (pins || []).find((pin) => new Date(pin.created_at).toISOString().startsWith(today));

    if (!activePin) {
      return corsJsonResponse({ data: { clinic_id, has_active_pin: false, valid_until: null, expires_in_seconds: null } });
    }

    const expiresInSeconds = Math.max(0, Math.floor((new Date(activePin.valid_until).getTime() - Date.now()) / 1000));

    if (isAdminRoute) {
      console.info('AUDIT:pin-status-admin-read', {
        at: new Date().toISOString(),
        actor_user_id: authData.user.id,
        actor_role: role,
        clinic_id,
        pin_id: activePin.id,
      });

      return corsJsonResponse({
        data: {
          clinic_id,
          has_active_pin: true,
          pin_id: activePin.id,
          pin: (activePin as { pin?: string }).pin ?? null,
          valid_until: activePin.valid_until,
          expires_in_seconds: expiresInSeconds,
        },
      });
    }

    return corsJsonResponse({
      data: {
        clinic_id,
        has_active_pin: true,
        valid_until: activePin.valid_until,
        expires_in_seconds: expiresInSeconds,
      },
    });
  } catch (err) {
    return corsErrorResponse(String(err), 400);
  }
});

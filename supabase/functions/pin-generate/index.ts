// Supabase Edge Function: pin-generate
// Generate daily PIN for clinic entry (hardened)
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, type User } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleOptions, corsJsonResponse, corsErrorResponse } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MAX_REQUESTS_PER_MINUTE_PER_CLINIC = Number(Deno.env.get('PIN_RATE_LIMIT_PER_CLINIC_PER_MINUTE') ?? '12');
const MAX_REQUESTS_PER_MINUTE_PER_ACTOR = Number(Deno.env.get('PIN_RATE_LIMIT_PER_USER_OR_IP_PER_MINUTE') ?? '8');

const GENERIC_ERROR_MESSAGE = 'Unable to process request';

const generatePIN = () => String(Math.floor(100000 + Math.random() * 900000));

const getTodayDateString = () => new Date().toISOString().split('T')[0];

const getEndOfDay = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
};

const getBearerToken = (req: Request) => {
  const auth = req.headers.get('authorization') ?? '';
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
};

const getActorIp = (req: Request) => {
  const forwarded = req.headers.get('x-forwarded-for') ?? '';
  return forwarded.split(',')[0]?.trim() || null;
};

const toArray = (input: unknown): string[] => {
  if (!Array.isArray(input)) return [];
  return input.filter((item): item is string => typeof item === 'string');
};

const hasClinicClaimPermission = (user: User, clinicId: string): boolean => {
  const appMeta = user.app_metadata ?? {};
  const userMeta = user.user_metadata ?? {};

  const allowedClinics = [
    ...toArray(appMeta.allowed_clinics),
    ...toArray(appMeta.clinic_ids),
    ...toArray(userMeta.allowed_clinics),
    ...toArray(userMeta.clinic_ids),
  ];

  const scopedPermissions = [
    ...toArray(appMeta.pin_generate_clinics),
    ...toArray(userMeta.pin_generate_clinics),
  ];

  return [...allowedClinics, ...scopedPermissions].includes(clinicId);
};

const isAdmin = (user: User): boolean => {
  const role = String(
    user.role ?? user.app_metadata?.role ?? '',
  ).toLowerCase();

  return ['admin', 'super_admin', 'service_role'].includes(role);
};

const audit = async (
  db: ReturnType<typeof createClient>,
  action: string,
  payload: Record<string, unknown>,
  userId?: string,
) => {
  await db.from('audit_log').insert({
    user_id: userId,
    action,
    payload,
  }).catch(() => {});
};

const checkRateLimit = async (
  db: ReturnType<typeof createClient>,
  clinicId: string,
  actorKey: string,
) => {
  const since = new Date(Date.now() - 60_000).toISOString();

  const [{ count: clinicCount, error: clinicError }, { count: actorCount, error: actorError }] = await Promise.all([
    db.from('audit_log')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'PIN_GENERATE_ATTEMPT')
      .gte('created_at', since)
      .contains('payload', { clinic_id: clinicId }),
    db.from('audit_log')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'PIN_GENERATE_ATTEMPT')
      .gte('created_at', since)
      .contains('payload', { actor_key: actorKey }),
  ]);

  if (clinicError || actorError) {
    return { allowed: false, reason: 'RATE_LIMIT_CHECK_FAILED' as const };
  }

  if ((clinicCount ?? 0) >= MAX_REQUESTS_PER_MINUTE_PER_CLINIC) {
    return { allowed: false, reason: 'CLINIC_RATE_LIMITED' as const };
  }

  if ((actorCount ?? 0) >= MAX_REQUESTS_PER_MINUTE_PER_ACTOR) {
    return { allowed: false, reason: 'ACTOR_RATE_LIMITED' as const };
  }

  return { allowed: true as const };
};

serve(async (req: Request) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (req.method !== 'POST') {
    return corsErrorResponse(GENERIC_ERROR_MESSAGE, 405);
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const token = getBearerToken(req);
    if (!token) {
      return corsErrorResponse(GENERIC_ERROR_MESSAGE, 401);
    }

    const { data: userData, error: authError } = await db.auth.getUser(token);
    if (authError || !userData.user) {
      return corsErrorResponse(GENERIC_ERROR_MESSAGE, 401);
    }

    const body = await req.json();
    const clinicId = typeof body?.clinic_id === 'string' ? body.clinic_id : null;
    const includePin = body?.include_pin === true;

    if (!clinicId) {
      await audit(db, 'PIN_GENERATE_REJECTED', { reason: 'MISSING_CLINIC_ID' }, userData.user.id);
      return corsErrorResponse(GENERIC_ERROR_MESSAGE, 400);
    }

    const hasPermission = isAdmin(userData.user) || hasClinicClaimPermission(userData.user, clinicId);
    if (!hasPermission) {
      await audit(db, 'PIN_GENERATE_REJECTED', { reason: 'FORBIDDEN', clinic_id: clinicId }, userData.user.id);
      return corsErrorResponse(GENERIC_ERROR_MESSAGE, 403);
    }

    const actorIp = getActorIp(req);
    const actorKey = userData.user.id || actorIp || 'unknown';

    await audit(db, 'PIN_GENERATE_ATTEMPT', {
      clinic_id: clinicId,
      actor_key: actorKey,
      actor_ip: actorIp,
      include_pin: includePin,
    }, userData.user.id);

    const limitResult = await checkRateLimit(db, clinicId, actorKey);
    if (!limitResult.allowed) {
      await audit(db, 'PIN_GENERATE_REJECTED', {
        reason: limitResult.reason,
        clinic_id: clinicId,
        actor_key: actorKey,
      }, userData.user.id);

      return corsErrorResponse(GENERIC_ERROR_MESSAGE, 429);
    }

    const today = getTodayDateString();
    const endOfDay = getEndOfDay();

    const { data: existingPin, error: checkError } = await db
      .from('pins')
      .select('*')
      .eq('clinic_id', clinicId)
      .gte('valid_until', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      throw new Error('PIN_LOOKUP_FAILED');
    }

    if (existingPin) {
      const createdDate = new Date(existingPin.created_at).toISOString().split('T')[0];
      if (createdDate === today) {
        const expiresIn = Math.floor((new Date(existingPin.valid_until).getTime() - Date.now()) / 1000);
        const shouldReturnPin = includePin && isAdmin(userData.user);

        await audit(db, 'PIN_GENERATE_SUCCESS', {
          clinic_id: clinicId,
          pin_id: existingPin.id,
          is_existing: true,
          pin_returned: shouldReturnPin,
        }, userData.user.id);

        return corsJsonResponse({
          success: true,
          data: {
            pin_id: existingPin.id,
            valid_until: existingPin.valid_until,
            expires_in_seconds: expiresIn,
            is_existing: true,
            ...(shouldReturnPin ? { pin: existingPin.pin } : {}),
          },
        });
      }
    }

    const pin = generatePIN();

    const { data, error } = await db
      .from('pins')
      .insert({
        clinic_id: clinicId,
        pin,
        valid_until: endOfDay,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error('PIN_INSERT_FAILED');

    const expiresIn = Math.floor((new Date(data.valid_until).getTime() - Date.now()) / 1000);
    const shouldReturnPin = includePin && isAdmin(userData.user);

    await audit(db, 'PIN_GENERATE_SUCCESS', {
      clinic_id: clinicId,
      pin_id: data.id,
      is_existing: false,
      pin_returned: shouldReturnPin,
    }, userData.user.id);

    return corsJsonResponse({
      success: true,
      data: {
        pin_id: data.id,
        valid_until: data.valid_until,
        expires_in_seconds: expiresIn,
        is_existing: false,
        ...(shouldReturnPin ? { pin: data.pin } : {}),
      },
    });
  } catch (_err) {
    return corsErrorResponse(GENERIC_ERROR_MESSAGE, 500);
  }
});

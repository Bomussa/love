const CLINIC_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

function asDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function sanitizeClinicSession(rawSession, nowMs = Date.now()) {
  if (!rawSession || typeof rawSession !== 'object') {
    return null;
  }

  const clinicId = String(rawSession.clinicId || '').trim();
  if (!clinicId) {
    return null;
  }

  const expiresAtDate = asDate(rawSession.expiresAt);
  if (expiresAtDate && expiresAtDate.getTime() <= nowMs) {
    return null;
  }

  if (!expiresAtDate) {
    const loginTimeDate = asDate(rawSession.loginTime);
    if (!loginTimeDate || nowMs - loginTimeDate.getTime() > CLINIC_SESSION_MAX_AGE_MS) {
      return null;
    }
  }

  const normalized = {
    ...rawSession,
    clinicId,
    expiresAt: expiresAtDate ? expiresAtDate.toISOString() : new Date(nowMs + CLINIC_SESSION_MAX_AGE_MS).toISOString(),
  };

  if (rawSession.pin != null) {
    normalized.pin = String(rawSession.pin);
  }

  return normalized;
}

export function loadAndValidateSession(storage, key, sanitize, nowMs = Date.now()) {
  if (!storage || typeof storage.getItem !== 'function') {
    return null;
  }

  try {
    const raw = storage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const normalized = sanitize(parsed, nowMs);

    if (!normalized) {
      storage.removeItem(key);
      return null;
    }

    if (JSON.stringify(normalized) !== raw) {
      storage.setItem(key, JSON.stringify(normalized));
    }

    return normalized;
  } catch {
    try {
      storage.removeItem(key);
    } catch {}
    return null;
  }
}

export function sanitizeAdminSession(rawSession, nowMs = Date.now()) {
  if (!rawSession || typeof rawSession !== 'object') return null;
  const expiresAtDate = asDate(rawSession.expiresAt);
  if (!expiresAtDate || expiresAtDate.getTime() <= nowMs) {
    return null;
  }
  return rawSession;
}

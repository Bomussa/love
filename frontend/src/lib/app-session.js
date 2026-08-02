const SESSION_STORAGE_KEYS = [
  'mmc_admin_session',
  'mmc_doctor_session',
  'mmc_clinic_session',
  'patientData',
];

function safeParse(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isExpired(session) {
  if (!session?.expiresAt) return false;
  const timestamp = new Date(session.expiresAt).getTime();
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

export function getStoredAppSession() {
  if (typeof window === 'undefined' || !window.localStorage) return null;

  for (const key of SESSION_STORAGE_KEYS) {
    const session = safeParse(window.localStorage.getItem(key));
    if (!session?.token || isExpired(session)) continue;
    return { ...session, storageKey: key };
  }

  return null;
}

export function getStoredAppSessionToken() {
  return String(getStoredAppSession()?.token || '').trim();
}

export function clearExpiredAppSessions() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  for (const key of SESSION_STORAGE_KEYS) {
    const session = safeParse(window.localStorage.getItem(key));
    if (session && isExpired(session)) {
      window.localStorage.removeItem(key);
    }
  }
}

export async function sessionAwareFetch(input, init = {}) {
  const headers = new Headers(init.headers || {});
  const token = getStoredAppSessionToken();
  if (token) {
    headers.set('X-Session-Token', token);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}

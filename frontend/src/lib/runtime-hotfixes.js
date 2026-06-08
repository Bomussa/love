import api from './api-unified';

const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';

function isDoctorPath(pathname = '') {
  return /^\/doctor(?:\/|$)/.test(String(pathname || ''));
}

function safeJsonParse(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeDoctorResponse(raw, username) {
  const payload = raw && typeof raw === 'object' ? raw : {};
  const baseData = payload.data || payload.user || payload.session || payload || {};

  const data = {
    ...baseData,
    id: baseData.id || baseData.username || username,
    username: baseData.username || username,
    name: baseData.name || baseData.username || username,
    clinic_id: baseData.clinic_id || null,
    clinic_name: baseData.clinic_name || null,
    role: 'DOCTOR',
  };

  return {
    ...payload,
    success: payload.success !== false,
    role: 'DOCTOR',
    data,
    user: data,
  };
}

function installLocalStorageGuard() {
  const originalGetItem = localStorage.getItem.bind(localStorage);

  localStorage.getItem = function patchedGetItem(key) {
    if (key === 'patientData' && isDoctorPath(window.location.pathname)) {
      return null;
    }
    return originalGetItem(key);
  };
}

function installDoctorLoginPatch() {
  api.doctorLogin = async (username, password) => {
    try {
      const response = await fetch('/api/v1/doctor/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Version': 'v1',
        },
        body: JSON.stringify({ username, password }),
      });

      const text = await response.text();
      const raw = safeJsonParse(text) || {};

      if (!response.ok || raw?.success === false) {
        return {
          success: false,
          error: raw?.error || raw?.message || `HTTP ${response.status}`,
          status: response.status,
          data: raw?.data || null,
        };
      }

      return normalizeDoctorResponse(raw, username);
    } catch (error) {
      return {
        success: false,
        error: error?.message || 'Server unreachable',
      };
    }
  };
}

function boot() {
  if (!isBrowser || window.__mmcRuntimeHotfixesInstalled) return;
  window.__mmcRuntimeHotfixesInstalled = true;

  installLocalStorageGuard();
  installDoctorLoginPatch();

  window.addEventListener('popstate', () => {
    // The localStorage getter guard is path-based, so no extra action is required.
    // This listener keeps the hotfix explicitly active across route changes.
  });
}

boot();

export default null;

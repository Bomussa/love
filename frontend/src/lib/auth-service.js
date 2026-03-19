/**
 * Auth Service - Authentication System
 * يعتمد على endpoint موحد من backend مع fallback طارئ مضبوط
 */

import api from './api-unified';
import { requestJson } from './resilient-request';

function resolveApiV1Base() {
  const raw = String(import.meta?.env?.VITE_API_BASE_URL || '').trim();
  if (!raw) return '/api/v1';
  const normalized = raw.replace(/\/+$/, '');
  return normalized.endsWith('/api/v1') ? normalized : `${normalized}/api/v1`;
}

function applyCanonicalCallNextPatch() {
  if (!api || typeof api.callNextPatient !== 'function' || api.__callNextCanonicalPatched) {
    return;
  }

  const originalCallNextPatient = api.callNextPatient.bind(api);

  api.callNextPatient = async (clinicId, pin) => {
    const normalizedClinicId = String(clinicId || '').trim();
    const normalizedPin = String(pin || '').trim();

    if (!normalizedClinicId) {
      return { success: false, error: 'بيانات استدعاء الدور غير مكتملة' };
    }

    try {
      const { response, payload } = await requestJson(
        `${resolveApiV1Base()}/queue/call`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clinicId: normalizedClinicId,
            pin: normalizedPin,
          }),
        },
        { timeoutMs: 8000, retries: 1 },
      );

      if (response.ok && (payload?.success || payload?.data || !payload?.error)) {
        return {
          success: true,
          data: payload?.data ?? payload,
        };
      }

      if ([400, 401, 404].includes(response.status)) {
        return {
          success: false,
          error:
            payload?.error?.message
            || payload?.error?.message
            || payload?.error
            || payload?.message
            || 'تعذر استدعاء المراجع التالي',
        };
      }
    } catch (canonicalError) {
      console.warn('[AuthService] callNextPatient canonical fallback:', canonicalError?.message || canonicalError);
    }

    return originalCallNextPatient(normalizedClinicId, normalizedPin);
  };

  api.__callNextCanonicalPatched = true;
}

applyCanonicalCallNextPatch();

// ✅ إصلاح: تعريف الأدوار والصلاحيات
export const USER_ROLES = {
  SUPER_ADMIN: {
    id: 'SUPER_ADMIN',
    name: 'مدير النظام',
    nameEn: 'System Administrator',
    permissions: ['*'],
  },
  ADMIN: {
    id: 'ADMIN',
    name: 'مدير',
    nameEn: 'Administrator',
    permissions: [
      'dashboard',
      'queue_management',
      'pin_management',
      'reports',
      'clinic_configuration',
      'settings',
      'user_management',
      'activity_logs',
    ],
  },
  DOCTOR: {
    id: 'DOCTOR',
    name: 'طبيب',
    nameEn: 'Doctor',
    permissions: [
      'dashboard',
      'queue_management',
      'clinic_only',
      'patient_view',
    ],
  },
  RECEPTIONIST: {
    id: 'RECEPTIONIST',
    name: 'موظف استقبال',
    nameEn: 'Receptionist',
    permissions: [
      'dashboard',
      'patient_registration',
      'queue_view',
      'reports_view',
    ],
  },
  VIEWER: {
    id: 'VIEWER',
    name: 'مشاهد',
    nameEn: 'Viewer',
    permissions: [
      'dashboard_view',
      'queue_view',
      'reports_view',
    ],
  },
};

export class AuthService {
  constructor({ apiClient = api, env = import.meta?.env ?? {}, now = () => Date.now() } = {}) {
    this.api = apiClient;
    this.env = env;
    this.now = now;
    this.storageKey = 'mmc_admin_session';
    this.maxAttempts = 5;
    this.lockoutDuration = 5 * 60 * 1000;
    this.sessionTimeout = 60 * 60 * 1000;
    this.failedAttempts = new Map();
  }

  normalizeRole(role) {
    const normalized = String(role || '').toUpperCase();
    return USER_ROLES[normalized] ? normalized : 'ADMIN';
  }

  normalizeUsername(username) {
    return String(username || '').trim();
  }

  getNormalizedApiErrorText(response) {
    return String(response?.message || response?.error || '').trim().toLowerCase();
  }

  isProtectedHtmlFailure(response) {
    const status = Number(response?.status || 0);
    const errorText = this.getNormalizedApiErrorText(response);

    if (![401, 403, 502, 503].includes(status)) {
      return false;
    }

    return errorText.includes('html')
      || errorText.includes('json')
      || errorText.includes('صفحة')
      || errorText.includes('غير json')
      || errorText.includes('استجابة غير');
  }

  getStorage() {
    if (typeof localStorage === 'undefined' || !localStorage) {
      return null;
    }
    return localStorage;
  }

  isLocalRuntime() {
    if (typeof window === 'undefined') return false;
    const host = String(window.location.hostname || '').toLowerCase();
    return host === 'localhost' || host === '127.0.0.1';
  }

  isBreakGlassEnabled() {
    const enabled = String(this.env.VITE_BREAK_GLASS_ENABLED || '').toLowerCase() === 'true';
    // Security hardening:
    // Break-glass must always be explicitly enabled, even in development/local.
    // This prevents accidental emergency-login activation due to runtime only.
    return enabled;
  }

  getBreakGlassWindowMs() {
    const value = Number(this.env.VITE_BREAK_GLASS_MAX_AGE_MS);
    return Number.isFinite(value) && value > 0 ? value : 10 * 60 * 1000;
  }

  getBreakGlassCredentials() {
    // Security hardening: never allow implicit/default credentials.
    // Break-glass access must always be explicitly configured via env vars.
    const configuredUsername = String(this.env.VITE_BREAK_GLASS_USERNAME || '').trim().toLowerCase();
    const configuredPassword = String(this.env.VITE_BREAK_GLASS_PASSWORD || '');

    return {
      username: configuredUsername,
      password: configuredPassword,
      role: this.normalizeRole(this.env.VITE_BREAK_GLASS_ROLE || 'SUPER_ADMIN'),
    };
  }

  canUseBreakGlass() {
    const isEnabled = this.isBreakGlassEnabled();
    const mode = String(this.env.MODE || '').toLowerCase();
    const activatedAt = Number(this.env.VITE_BREAK_GLASS_ACTIVATED_AT || 0);

    if (!isEnabled) {
      return false;
    }

    // في بيئة التطوير: السماح بوضع الطوارئ عند تفعيله بدون نافذة زمنية إلزامية
    if (mode === 'development' || this.isLocalRuntime()) {
      return true;
    }

    // في الإنتاج/المعاينة: نافذة زمنية إلزامية لتقليل المخاطر
    if (!Number.isFinite(activatedAt) || activatedAt <= 0) {
      return false;
    }

    const elapsedMs = this.now() - activatedAt;
    if (elapsedMs < 0) {
      // Reject future activation timestamps to prevent unintended bypasses.
      return false;
    }

    return elapsedMs <= this.getBreakGlassWindowMs();
  }

  tryBreakGlass(username, password) {
    if (!this.canUseBreakGlass()) {
      return null;
    }

    const creds = this.getBreakGlassCredentials();
    if (!creds.username || !creds.password) {
      return null;
    }

    const normalizedUsername = this.normalizeUsername(username);
    const matches = normalizedUsername.toLowerCase() === creds.username
      && String(password || '') === creds.password;

    if (!matches) {
      return null;
    }

    const session = this.createSession(normalizedUsername, creds.role);
    return {
      success: true,
      session,
      isFallback: true,
      source: 'break_glass',
      message: 'تم تسجيل الدخول عبر وضع الطوارئ المؤقت',
    };
  }

  async login(username, password) {
    const normalizedUsername = this.normalizeUsername(username);
    const normalizedPassword = String(password || '');

    if (!normalizedUsername || !normalizedPassword) {
      return {
        success: false,
        error: 'اسم المستخدم أو كلمة المرور غير صحيحة',
      };
    }

    try {
      const response = await this.api.adminLogin(normalizedUsername, normalizedPassword);
      if (response?.success) {
        const role = this.normalizeRole(response?.session?.role || response?.role);
        const session = this.createSession(
          response?.session?.username || normalizedUsername,
          role,
          response?.session,
        );
        return { success: true, session, source: 'api' };
      }

      const status = Number(response?.status || 0);
      const protectedHtmlFailure = this.isProtectedHtmlFailure(response);
      const shouldUseFallback = status === 0 || status >= 500 || protectedHtmlFailure;

      if (shouldUseFallback) {
        const fallbackResult = this.tryBreakGlass(normalizedUsername, normalizedPassword);
        if (fallbackResult) {
          return fallbackResult;
        }
      }

      if (protectedHtmlFailure) {
        return {
          success: false,
          error: 'تعذر الوصول إلى خدمة تسجيل الدخول الإدارية حالياً. الخادم أعاد صفحة حماية أو استجابة غير متوقعة.',
        };
      }

      return {
        success: false,
        error: response?.message || response?.error || 'اسم المستخدم أو كلمة المرور غير صحيحة',
      };
    } catch (apiError) {
      console.warn('[AuthService] API unavailable:', apiError?.message || apiError);
      const fallbackResult = this.tryBreakGlass(normalizedUsername, normalizedPassword);
      if (fallbackResult) {
        return fallbackResult;
      }
      return { success: false, error: 'تعذر الاتصال بالخادم. حاول لاحقًا.' };
    }
  }

  createSession(username, role, overrides = {}) {
    const normalizedUsername = this.normalizeUsername(overrides.username || username);
    const session = {
      id: overrides.id || `sess_${this.now()}`,
      username: normalizedUsername,
      role,
      name: overrides.name || String(normalizedUsername || '').toUpperCase(),
      loginTime: overrides.loginTime || new Date(this.now()).toISOString(),
      expiresAt: overrides.expiresAt || new Date(this.now() + this.sessionTimeout).toISOString(),
    };
    this.saveSession(session);
    return session;
  }

  logout() {
    const storage = this.getStorage();
    storage?.removeItem(this.storageKey);
  }

  getSession() {
    try {
      const storage = this.getStorage();
      if (!storage) return null;
      const data = storage.getItem(this.storageKey);
      if (!data) return null;
      const session = JSON.parse(data);
      if (new Date(session.expiresAt) < new Date()) {
        this.logout();
        return null;
      }
      return session;
    } catch (e) {
      return null;
    }
  }

  saveSession(session) {
    const storage = this.getStorage();
    storage?.setItem(this.storageKey, JSON.stringify(session));
  }

  hasPermission(permission) {
    const session = this.getSession();
    if (!session) return false;

    const role = USER_ROLES[session.role];
    if (!role) return false;

    if (role.permissions.includes('*')) return true;

    return role.permissions.includes(permission);
  }

  hasAnyPermission(permissions) {
    return permissions.some((p) => this.hasPermission(p));
  }

  hasAllPermissions(permissions) {
    return permissions.every((p) => this.hasPermission(p));
  }

  getCurrentPermissions() {
    const session = this.getSession();
    if (!session) return [];

    const role = USER_ROLES[session.role];
    return role ? role.permissions : [];
  }

  isDoctor() {
    const session = this.getSession();
    return session && session.role === 'DOCTOR';
  }

  canAccessClinicOnly() {
    return this.hasPermission('clinic_only');
  }
}

const authService = new AuthService();
export default authService;

/**
 * Auth Service - Authentication System
 * يعتمد على endpoint موحد من backend مع fallback طارئ مضبوط
 */

import api from './api-unified';

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

  isBreakGlassEnabled() {
    const mode = String(this.env.MODE || '').toLowerCase();
    const enabled = String(this.env.VITE_BREAK_GLASS_ENABLED || '').toLowerCase() === 'true';
    return enabled || mode === 'development';
  }

  getBreakGlassWindowMs() {
    const value = Number(this.env.VITE_BREAK_GLASS_MAX_AGE_MS);
    return Number.isFinite(value) && value > 0 ? value : 10 * 60 * 1000;
  }

  getBreakGlassCredentials() {
    return {
      username: String(this.env.VITE_BREAK_GLASS_USERNAME || '').trim().toLowerCase(),
      password: String(this.env.VITE_BREAK_GLASS_PASSWORD || ''),
      role: this.normalizeRole(this.env.VITE_BREAK_GLASS_ROLE || 'SUPER_ADMIN'),
    };
  }

  canUseBreakGlass() {
    const isEnabled = this.isBreakGlassEnabled();
    const activatedAt = Number(this.env.VITE_BREAK_GLASS_ACTIVATED_AT || 0);

    if (!isEnabled || !Number.isFinite(activatedAt) || activatedAt <= 0) {
      return false;
    }

    return this.now() - activatedAt <= this.getBreakGlassWindowMs();
  }

  tryBreakGlass(username, password) {
    if (!this.canUseBreakGlass()) {
      return null;
    }

    const creds = this.getBreakGlassCredentials();
    if (!creds.username || !creds.password) {
      return null;
    }

    const matches = String(username || '').trim().toLowerCase() === creds.username
      && String(password || '') === creds.password;

    if (!matches) {
      return null;
    }

    const session = this.createSession(username, creds.role);
    return {
      success: true,
      session,
      isFallback: true,
      source: 'break_glass',
      message: 'تم تسجيل الدخول عبر وضع الطوارئ المؤقت',
    };
  }

  async login(username, password) {
    console.log('[AuthService] Login attempt:', { username, passwordLength: password?.length });

    try {
      const response = await this.api.adminLogin(username, password);
      if (response?.success) {
        const role = this.normalizeRole(response?.session?.role || response?.role);
        const session = this.createSession(
          response?.session?.username || username,
          role,
          response?.session,
        );
        return { success: true, session, source: 'api' };
      }

      return {
        success: false,
        error: response?.message || response?.error || 'اسم المستخدم أو كلمة المرور غير صحيحة',
      };
    } catch (apiError) {
      console.warn('[AuthService] API unavailable:', apiError?.message || apiError);
      const fallbackResult = this.tryBreakGlass(username, password);
      if (fallbackResult) {
        return fallbackResult;
      }
      return { success: false, error: 'تعذر الاتصال بالخادم. حاول لاحقًا.' };
    }
  }

  createSession(username, role, overrides = {}) {
    const session = {
      id: overrides.id || `sess_${this.now()}`,
      username,
      role,
      name: overrides.name || String(username || '').toUpperCase(),
      loginTime: overrides.loginTime || new Date(this.now()).toISOString(),
      expiresAt: overrides.expiresAt || new Date(this.now() + this.sessionTimeout).toISOString(),
    };
    this.saveSession(session);
    return session;
  }

  logout() {
    localStorage.removeItem(this.storageKey);
  }

  getSession() {
    try {
      const data = localStorage.getItem(this.storageKey);
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
    localStorage.setItem(this.storageKey, JSON.stringify(session));
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

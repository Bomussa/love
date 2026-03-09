/**
 * Auth Service - Authentication System
 * يعتمد على مصادقة الخادم (Supabase Edge Function)
 */

import api from './api-unified';

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
    permissions: ['dashboard', 'queue_management', 'clinic_only', 'patient_view'],
  },
  RECEPTIONIST: {
    id: 'RECEPTIONIST',
    name: 'موظف استقبال',
    nameEn: 'Receptionist',
    permissions: ['dashboard', 'patient_registration', 'queue_view', 'reports_view'],
  },
  VIEWER: {
    id: 'VIEWER',
    name: 'مشاهد',
    nameEn: 'Viewer',
    permissions: ['dashboard_view', 'queue_view', 'reports_view'],
  },
};

class AuthService {
  constructor() {
    this.storageKey = 'mmc_admin_session';
    this.sessionTimeout = 60 * 60 * 1000;
  }

  async login(username, password) {
    console.log('[AuthService] Login attempt:', { username, passwordLength: password?.length });

    try {
      const response = await api.adminLogin(username, password);
      if (!response?.success) {
        return { success: false, error: response?.error || response?.message || 'Invalid credentials' };
      }

      const session = this.createSession({
        username: response.user?.username || username,
        role: response.user?.role || 'ADMIN',
        accessToken: response.session?.access_token,
        refreshToken: response.session?.refresh_token,
        expiresAt: response.session?.expires_at
          ? new Date(response.session.expires_at * 1000).toISOString()
          : undefined,
      });

      return { success: true, session };
    } catch (error) {
      console.error('[AuthService] Login error:', error);
      return { success: false, error: 'فشل الاتصال - يرجى المحاولة مرة أخرى' };
    }
  }

  createSession({ username, role, accessToken, refreshToken, expiresAt }) {
    const session = {
      id: `sess_${Date.now()}`,
      username,
      role,
      name: username.toUpperCase(),
      loginTime: new Date().toISOString(),
      expiresAt: expiresAt || new Date(Date.now() + this.sessionTimeout).toISOString(),
      accessToken: accessToken || null,
      refreshToken: refreshToken || null,
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

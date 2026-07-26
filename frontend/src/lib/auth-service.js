/**
 * Auth Service - Authentication System
 * Canonical API-based authentication with no synthetic fallback data.
 */

import api from './api-unified';

export const USER_ROLES = {
  SUPER_ADMIN: {
    id: 'SUPER_ADMIN',
    name: 'مدير النظام',
    nameEn: 'System Administrator',
    permissions: ['*']
  },
  ADMIN: {
    id: 'ADMIN',
    name: 'مدير',
    nameEn: 'Administrator',
    permissions: ['dashboard', 'queue_management', 'reports', 'clinic_configuration', 'settings', 'user_management', 'activity_logs']
  },
  DOCTOR: {
    id: 'DOCTOR',
    name: 'طبيب',
    nameEn: 'Doctor',
    permissions: ['dashboard', 'queue_management', 'clinic_only', 'patient_view']
  },
  RECEPTIONIST: {
    id: 'RECEPTIONIST',
    name: 'موظف استقبال',
    nameEn: 'Receptionist',
    permissions: ['dashboard', 'patient_registration', 'queue_view', 'reports_view']
  },
  VIEWER: {
    id: 'VIEWER',
    name: 'مشاهد',
    nameEn: 'Viewer',
    permissions: ['dashboard_view', 'queue_view', 'reports_view']
  }
};

class AuthService {
  constructor() {
    this.storageKey = 'mmc_admin_session';
    this.maxAttempts = 5;
    this.lockoutDuration = 5 * 60 * 1000;
    this.sessionTimeout = 60 * 60 * 1000;
    this.failedAttempts = new Map();
  }

  async login(username, password) {
    try {
      const response = await api.adminLogin(username, password);
      if (!response?.success || !response?.data?.token) {
        throw new Error(response?.error || 'اسم المستخدم أو كلمة المرور غير صحيحة');
      }

      const session = this.createSession(
        response.data.username || response.data.name || username,
        response.data.role || 'ADMIN',
        response.data,
      );

      return { success: true, session };
    } catch (error) {
      console.error('[AuthService] Login error:', error);
      throw new Error(error.message || 'اسم المستخدم أو كلمة المرور غير صحيحة');
    }
  }

  async doctorLogin(username, password) {
    try {
      const response = await api.doctorLogin(username, password);
      if (!response?.success || !response?.data?.token) {
        throw new Error(response?.error || 'اسم المستخدم أو كلمة المرور غير صحيحة');
      }
      const session = this.createSession(
        response.data.username || response.data.name || username,
        'DOCTOR',
        response.data,
      );
      return { success: true, session };
    } catch (error) {
      console.error('[AuthService] Doctor login error:', error);
      throw new Error(error.message || 'اسم المستخدم أو كلمة المرور غير صحيحة');
    }
  }

  createSession(username, role, details = {}) {
    const token = String(details.token || '').trim();
    if (!token) throw new Error('لم يتم إصدار جلسة صالحة من الخادم');

    const session = {
      ...details,
      id: details.id || details.username || username,
      username,
      role: String(role || details.role || '').toUpperCase(),
      name: details.name || details.full_name || username,
      token,
      loginTime: new Date().toISOString(),
      expiresAt: details.expiresAt || new Date(Date.now() + this.sessionTimeout).toISOString(),
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
      if (!session.token || new Date(session.expiresAt) < new Date()) {
        this.logout();
        return null;
      }
      return session;
    } catch {
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
    return permissions.some(p => this.hasPermission(p));
  }

  hasAllPermissions(permissions) {
    return permissions.every(p => this.hasPermission(p));
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

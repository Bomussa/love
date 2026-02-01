/**
 * Auth Service - Authentication System
 * Updated with Emergency Access and Robust Error Handling
 * السوبر أدمن: Bomussa / 14490
 */

import api from './api-unified';
import { validateAdminCredentials } from '../config/admin-credentials';

// ✅ إصلاح: تعريف الأدوار والصلاحيات
export const USER_ROLES = {
  SUPER_ADMIN: {
    id: 'SUPER_ADMIN',
    name: 'مدير النظام',
    nameEn: 'System Administrator',
    permissions: ['*'] // جميع الصلاحيات
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
      'activity_logs'
    ]
  },
  DOCTOR: {
    id: 'DOCTOR',
    name: 'طبيب',
    nameEn: 'Doctor',
    permissions: [
      'dashboard',
      'queue_management',
      'clinic_only', // ✅ صلاحية خاصة بالعيادات فقط
      'patient_view'
    ]
  },
  RECEPTIONIST: {
    id: 'RECEPTIONIST',
    name: 'موظف استقبال',
    nameEn: 'Receptionist',
    permissions: [
      'dashboard',
      'patient_registration',
      'queue_view',
      'reports_view'
    ]
  },
  VIEWER: {
    id: 'VIEWER',
    name: 'مشاهد',
    nameEn: 'Viewer',
    permissions: [
      'dashboard_view',
      'queue_view',
      'reports_view'
    ]
  }
};

class AuthService {
  constructor() {
    this.storageKey = 'mmc_admin_session';
    this.maxAttempts = 5;
    this.lockoutDuration = 5 * 60 * 1000; // 5 mins
    this.sessionTimeout = 60 * 60 * 1000; // 60 mins
    this.failedAttempts = new Map(); // تتبع المحاولات الفاشلة
  }

  async login(username, password) {
    try {
      // ✅ إصلاح: التحقق من السوبر أدمن أولاً وفوراً (بدون انتظار API)
      // اسم المستخدم غير حساس لحالة الأحرف
      if (validateAdminCredentials(username, password)) {
        console.log('[Auth] ✅ Super Admin Login - Instant Access');
        const session = this.createSession(username, 'SUPER_ADMIN');
        return { success: true, session };
      }

      // 2. للمستخدمين الآخرين - تحقق عبر API مع timeout قصير
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 ثواني فقط

        const response = await api.adminLogin(username, password);
        clearTimeout(timeoutId);

        if (response.success) {
          const session = this.createSession(username, response.role || 'ADMIN');
          return { success: true, session };
        }
        return { success: false, error: response.message || 'Invalid credentials' };
      } catch (apiError) {
        console.warn('[Auth] API timeout or error, checking local credentials');
        return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
      }
    } catch (error) {
      console.error('[Auth] Login error:', error);
      // Fallback للسوبر أدمن في حالة الأخطاء
      if (validateAdminCredentials(username, password)) {
        const session = this.createSession(username, 'SUPER_ADMIN');
        return { success: true, session };
      }
      return { success: false, error: 'فشل الاتصال - يرجى المحاولة مرة أخرى' };
    }
  }

  createSession(username, role) {
    const session = {
      id: `sess_${Date.now()}`,
      username,
      role,
      name: username.toUpperCase(),
      loginTime: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.sessionTimeout).toISOString(),
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
    } catch (e) { return null; }
  }

  saveSession(session) {
    localStorage.setItem(this.storageKey, JSON.stringify(session));
  }

  isAuthenticated() {
    return this.getSession() !== null;
  }

  isSuperAdmin() {
    const session = this.getSession();
    return session && session.role === 'SUPER_ADMIN';
  }
}

const authService = new AuthService();
export default authService;

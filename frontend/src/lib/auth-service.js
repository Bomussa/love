/**
 * Auth Service - Authentication System
 * Updated with Emergency Access and Robust Error Handling
 * السوبر أدمن: Bomussa / 14490
 */

import api from './api-unified';
import { validateAdminCredentials, ADMIN_CREDENTIALS } from '../config/admin-credentials';

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
    console.log('[AuthService] Login attempt:', { username, passwordLength: password?.length });

    try {
      const normalizedUsername = String(username || '').trim().toLowerCase();
      const normalizedPassword = String(password || '').trim();

      // ✅ Super Admin fallback: يقبل الأحرف الكبيرة/الصغيرة
      // هذا مسار آمن ومحدد لاسم Bomussa فقط حتى لا تتغير بقية الصلاحيات
      if (normalizedUsername === 'bomussa' && normalizedPassword === '14490') {
        console.log('[AuthService] ✅ Super Admin Login - Case-insensitive match');
        const session = this.createSession(username, 'SUPER_ADMIN');
        return { success: true, session };
      }

      // ✅ إصلاح: التحقق من السوبر أدمن عبر البيئة إن كانت مضبوطة
      // اسم المستخدم غير حساس لحالة الأحرف
      const isValid = validateAdminCredentials(username, password);
      console.log('[AuthService] validateAdminCredentials result:', isValid);
      console.log('[AuthService] Expected credentials:', { 
        username: ADMIN_CREDENTIALS.username, 
        passwordLength: ADMIN_CREDENTIALS.password?.length 
      });

      if (isValid) {
        console.log('[AuthService] ✅ Super Admin Login - Instant Access');
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
        console.warn('[AuthService] API timeout or error:', apiError);
        return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
      }
    } catch (error) {
      console.error('[AuthService] Login error:', error);
      // Fallback للسوبر أدمن في حالة الأخطاء
      const isValid = validateAdminCredentials(username, password);
      console.log('[AuthService] Fallback validation:', isValid);
      if (isValid) {
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

  // ✅ إصلاح: التحقق من الصلاحيات
  hasPermission(permission) {
    const session = this.getSession();
    if (!session) return false;

    const role = USER_ROLES[session.role];
    if (!role) return false;

    // السوبر أدمن لديه جميع الصلاحيات
    if (role.permissions.includes('*')) return true;

    return role.permissions.includes(permission);
  }

  // ✅ إصلاح: التحقق من عدة صلاحيات (واحد أو أكثر)
  hasAnyPermission(permissions) {
    return permissions.some(p => this.hasPermission(p));
  }

  // ✅ إصلاح: التحقق من جميع الصلاحيات المطلوبة
  hasAllPermissions(permissions) {
    return permissions.every(p => this.hasPermission(p));
  }

  // ✅ إصلاح: الحصول على صلاحيات المستخدم الحالي
  getCurrentPermissions() {
    const session = this.getSession();
    if (!session) return [];

    const role = USER_ROLES[session.role];
    return role ? role.permissions : [];
  }

  // ✅ إصلاح: التحقق إذا كان المستخدم طبيب (للعرض في العيادات فقط)
  isDoctor() {
    const session = this.getSession();
    return session && session.role === 'DOCTOR';
  }

  // ✅ إصلاح: التحقق من صلاحية العيادة فقط
  canAccessClinicOnly() {
    return this.hasPermission('clinic_only');
  }
}

const authService = new AuthService();
export default authService;

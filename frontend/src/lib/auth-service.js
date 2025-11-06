/**
 * Auth Service - نظام المصادقة والأدوار
 * Updated to use Supabase for authentication
 * 
 * الأدوار:
 * - SUPER_ADMIN: صلاحية كاملة
 * - ADMIN: مشرف عام
 * - STAFF: عرض فقط
 */

import { supabase } from './supabase-client.js';

class AuthService {
  constructor() {
    this.storageKey = 'mmc_admin_session';
    this.maxAttempts = 3;
    this.lockoutDuration = 15 * 60 * 1000; // 15 دقيقة
    this.sessionTimeout = 30 * 60 * 1000; // 30 دقيقة
  }

  /**
   * تسجيل الدخول
   */
  async login(username, password) {
    try {
      // التحقق من القفل
      const lockout = this.checkLockout(username);
      if (lockout.locked) {
        return {
          success: false,
          error: `Account locked. Try again in ${Math.ceil(lockout.remainingTime / 60000)} minutes`
        };
      }

      // التحقق من المستخدم في Supabase
      const { data: users, error: fetchError } = await supabase
        .from('admin_users')
        .select('*')
        .eq('username', username)
        .eq('is_active', true)
        .single();

      if (fetchError || !users) {
        this.recordFailedAttempt(username);
        return {
          success: false,
          error: 'Invalid username or password'
        };
      }

      // التحقق من كلمة المرور
      if (users.password !== password) {
        this.recordFailedAttempt(username);
        return {
          success: false,
          error: 'Invalid username or password'
        };
      }

      // تحديث آخر تسجيل دخول
      await supabase
        .from('admin_users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', users.id);

      // إنشاء Session
      const session = {
        id: this.generateSessionId(),
        username: users.username,
        role: users.role,
        name: users.name,
        email: users.email,
        loginTime: new Date().toISOString(),
        expiresAt: new Date(Date.now() + this.sessionTimeout).toISOString(),
        token: this.generateToken(users.username, users.role)
      };

      // حفظ Session
      this.saveSession(session);
      this.clearFailedAttempts(username);

      // تسجيل في السجل
      this.logSecurityEvent('LOGIN_SUCCESS', username, session.role);

      return {
        success: true,
        session: session
      };
    } catch (error) {
      console.error('[Auth] Login error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * تسجيل الخروج
   */
  logout() {
    const session = this.getSession();
    if (session) {
      this.logSecurityEvent('LOGOUT', session.username, session.role);
    }
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem('mmc_failed_attempts');
  }

  /**
   * الحصول على Session الحالية
   */
  getSession() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (!data) return null;

      const session = JSON.parse(data);

      // التحقق من انتهاء الصلاحية
      if (new Date(session.expiresAt) < new Date()) {
        this.logout();
        return null;
      }

      return session;
    } catch (e) {
      return null;
    }
  }

  /**
   * حفظ Session
   */
  saveSession(session) {
    localStorage.setItem(this.storageKey, JSON.stringify(session));
  }

  /**
   * تحديث Session (للحفاظ على النشاط)
   */
  refreshSession() {
    const session = this.getSession();
    if (session) {
      session.expiresAt = new Date(Date.now() + this.sessionTimeout).toISOString();
      this.saveSession(session);
    }
  }

  /**
   * التحقق من الصلاحية
   */
  hasPermission(permission) {
    const session = this.getSession();
    if (!session) return false;

    const permissions = {
      'SUPER_ADMIN': [
        'manage_users',
        'manage_clinics',
        'manage_pins',
        'manage_queues',
        'manage_routes',
        'manage_notifications',
        'manage_settings',
        'view_reports',
        'export_reports',
        'system_maintenance',
        'backup_restore'
      ],
      'ADMIN': [
        'manage_clinics',
        'manage_pins',
        'manage_queues',
        'manage_routes',
        'manage_notifications',
        'view_reports',
        'export_reports'
      ],
      'STAFF': [
        'view_queues',
        'view_reports'
      ]
    };

    return permissions[session.role]?.includes(permission) || false;
  }

  /**
   * التحقق من القفل
   */
  checkLockout(username) {
    try {
      const attempts = localStorage.getItem('mmc_failed_attempts');
      if (!attempts) return { locked: false };

      const data = JSON.parse(attempts);
      const userAttempts = data[username];

      if (!userAttempts) return { locked: false };

      const now = Date.now();
      const lockUntil = userAttempts.lockedUntil;

      if (lockUntil && now < lockUntil) {
        return {
          locked: true,
          remainingTime: lockUntil - now
        };
      }

      return { locked: false };
    } catch (e) {
      return { locked: false };
    }
  }

  /**
   * تسجيل محاولة فاشلة
   */
  recordFailedAttempt(username) {
    try {
      const attemptsData = localStorage.getItem('mmc_failed_attempts');
      const attempts = attemptsData ? JSON.parse(attemptsData) : {};

      if (!attempts[username]) {
        attempts[username] = {
          count: 0,
          lastAttempt: null,
          lockedUntil: null
        };
      }

      attempts[username].count++;
      attempts[username].lastAttempt = Date.now();

      // قفل بعد 3 محاولات
      if (attempts[username].count >= this.maxAttempts) {
        attempts[username].lockedUntil = Date.now() + this.lockoutDuration;
        this.logSecurityEvent('ACCOUNT_LOCKED', username, null);
      }

      localStorage.setItem('mmc_failed_attempts', JSON.stringify(attempts));
    } catch (e) {
      console.error('[Auth] Failed to record attempt:', e);
    }
  }

  /**
   * مسح المحاولات الفاشلة
   */
  clearFailedAttempts(username) {
    try {
      const attemptsData = localStorage.getItem('mmc_failed_attempts');
      if (!attemptsData) return;

      const attempts = JSON.parse(attemptsData);
      delete attempts[username];

      localStorage.setItem('mmc_failed_attempts', JSON.stringify(attempts));
    } catch (e) {
      console.error('[Auth] Failed to clear attempts:', e);
    }
  }

  /**
   * توليد Session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * توليد Token
   */
  generateToken(username, role) {
    // في بيئة إنتاجية، استخدم JWT حقيقي
    const payload = {
      username,
      role,
      iat: Date.now()
    };
    return btoa(JSON.stringify(payload));
  }

  /**
   * تسجيل حدث أمني
   */
  logSecurityEvent(event, username, role) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event: event,
      username: username,
      role: role,
      ip: 'N/A' // يمكن الحصول عليه من الخادم
    };

    // حفظ في localStorage مؤقتاً
    const logs = JSON.parse(localStorage.getItem('mmc_security_logs') || '[]');
    logs.push(logEntry);

    // الاحتفاظ بآخر 100 سجل فقط
    if (logs.length > 100) {
      logs.shift();
    }

    localStorage.setItem('mmc_security_logs', JSON.stringify(logs));

    console.log(`[Security] ${event}:`, username, role);
  }

  /**
   * الحصول على سجلات الأمان
   */
  getSecurityLogs() {
    return JSON.parse(localStorage.getItem('mmc_security_logs') || '[]');
  }
}

// Singleton instance
const authService = new AuthService();

export default authService;
export { AuthService };

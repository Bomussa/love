/**
 * Auth Service - Authentication System
 * Secure backend-only authentication and session verification.
 */

export const USER_ROLES = {
  SUPER_ADMIN: {
    id: 'SUPER_ADMIN',
    name: 'مدير النظام',
    nameEn: 'System Administrator'
  },
  ADMIN: {
    id: 'ADMIN',
    name: 'مدير',
    nameEn: 'Administrator'
  },
  DOCTOR: {
    id: 'DOCTOR',
    name: 'طبيب',
    nameEn: 'Doctor'
  },
  RECEPTIONIST: {
    id: 'RECEPTIONIST',
    name: 'موظف استقبال',
    nameEn: 'Receptionist'
  },
  VIEWER: {
    id: 'VIEWER',
    name: 'مشاهد',
    nameEn: 'Viewer'
  }
};

class AuthService {
  constructor() {
    this.storageKey = 'mmc_admin_session';
    this.sessionTimeout = 60 * 60 * 1000;
    this.authEndpoint = '/api/v1/admin/login';
    this.verifyEndpoint = '/api/v1/admin/session/verify';
    this.verifiedSession = null;
  }

  async login(username, password) {
    console.log('[AuthService] Secure login attempt:', { username, passwordLength: password?.length });

    try {
      const response = await fetch(this.authEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
      }

      const payload = await response.json();

      if (!payload?.success || !(payload?.sessionToken || payload?.session?.id) || !payload?.role) {
        return { success: false, error: 'استجابة مصادقة غير صالحة من الخادم' };
      }

      const session = this.createSessionFromServer(payload, username);
      const verified = await this.verifySessionWithBackend(session.sessionToken);

      if (!verified.success) {
        this.logout();
        return { success: false, error: 'فشل التحقق من الجلسة' };
      }

      const trustedSession = this.applyVerifiedSession(session, verified);
      return { success: true, session: trustedSession };
    } catch (error) {
      console.error('[AuthService] Login error:', error);
      return { success: false, error: 'فشل الاتصال - يرجى المحاولة مرة أخرى' };
    }
  }

  createSessionFromServer(payload, username) {
    return {
      id: payload.sessionId || payload.session?.id || `sess_${Date.now()}`,
      username: payload.username || username,
      role: payload.role,
      permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
      sessionToken: payload.sessionToken || payload.session?.id,
      loginTime: payload.loginTime || new Date().toISOString(),
      expiresAt: payload.expiresAt || new Date(Date.now() + this.sessionTimeout).toISOString(),
    };
  }

  async verifySessionWithBackend(sessionToken) {
    if (!sessionToken) {
      return { success: false, error: 'missing_token' };
    }

    try {
      const response = await fetch(this.verifyEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionToken })
      });

      if (!response.ok) {
        return { success: false, error: 'verification_failed' };
      }

      const payload = await response.json();
      if (!payload?.success || !payload?.role || !Array.isArray(payload?.permissions)) {
        return { success: false, error: 'invalid_verification_payload' };
      }

      return {
        success: true,
        role: payload.role,
        permissions: payload.permissions,
        username: payload.username,
        expiresAt: payload.expiresAt,
      };
    } catch (error) {
      console.error('[AuthService] Session verification error:', error);
      return { success: false, error: 'verification_exception' };
    }
  }

  applyVerifiedSession(session, verifiedPayload) {
    const trustedSession = {
      ...session,
      role: verifiedPayload.role,
      permissions: verifiedPayload.permissions,
      username: verifiedPayload.username || session.username,
      expiresAt: verifiedPayload.expiresAt || session.expiresAt,
      verifiedAt: new Date().toISOString()
    };

    this.verifiedSession = trustedSession;
    this.saveSession(trustedSession);
    return trustedSession;
  }

  async restoreSession() {
    const stored = this.readStoredSession();
    if (!stored || new Date(stored.expiresAt) < new Date()) {
      this.logout();
      return null;
    }

    const verified = await this.verifySessionWithBackend(stored.sessionToken);
    if (!verified.success) {
      this.logout();
      return null;
    }

    return this.applyVerifiedSession(stored, verified);
  }

  logout() {
    this.verifiedSession = null;
    localStorage.removeItem(this.storageKey);
  }

  getSession() {
    if (!this.verifiedSession) return null;

    if (new Date(this.verifiedSession.expiresAt) < new Date()) {
      this.logout();
      return null;
    }

    return this.verifiedSession;
  }

  readStoredSession() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : null;
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

    if (session.permissions.includes('*')) return true;
    return session.permissions.includes(permission);
  }

  hasAnyPermission(permissions) {
    return permissions.some((p) => this.hasPermission(p));
  }

  hasAllPermissions(permissions) {
    return permissions.every((p) => this.hasPermission(p));
  }

  getCurrentPermissions() {
    const session = this.getSession();
    return session?.permissions || [];
  }

  isDoctor() {
    const session = this.getSession();
    return session?.role === 'DOCTOR';
  }

  canAccessClinicOnly() {
    return this.hasPermission('clinic_only');
  }
}

const authService = new AuthService();
export default authService;

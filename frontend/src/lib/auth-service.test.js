import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./api-unified', () => ({
  default: {
    adminLogin: vi.fn(),
  },
}));

function createStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

describe('AuthService login', () => {
  beforeEach(() => {
    global.localStorage = createStorage();
  });

  it('ينجح دخول الإدارة عبر API', async () => {
    const { AuthService } = await import('./auth-service');
    const service = new AuthService({
      apiClient: {
        adminLogin: async () => ({ success: true, session: { username: 'admin', role: 'SUPER_ADMIN' } }),
      },
    });

    const result = await service.login('admin', 'secret');

    expect(result.success).toBe(true);
    expect(result.session.role).toBe('SUPER_ADMIN');
  });

  it('يفشل عند بيانات خاطئة من API', async () => {
    const { AuthService } = await import('./auth-service');
    const service = new AuthService({
      apiClient: {
        adminLogin: async () => ({ success: false, message: 'Invalid credentials' }),
      },
    });

    const result = await service.login('admin', 'bad');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid credentials');
  });

  it('يفشل عند انقطاع API بدون fallback', async () => {
    const { AuthService } = await import('./auth-service');
    const service = new AuthService({
      apiClient: {
        adminLogin: async () => {
          throw new Error('network down');
        },
      },
      env: {
        MODE: 'production',
        VITE_BREAK_GLASS_ENABLED: 'false',
      },
    });

    const result = await service.login('admin', 'secret');

    expect(result.success).toBe(false);
    expect(result.error).toContain('تعذر الاتصال بالخادم');
  });

  it('يستخدم fallback الطارئ عند توفر ENV ضمن مدة صالحة', async () => {
    const { AuthService } = await import('./auth-service');
    const now = Date.now();
    const service = new AuthService({
      apiClient: {
        adminLogin: async () => {
          throw new Error('network down');
        },
      },
      env: {
        MODE: 'production',
        VITE_BREAK_GLASS_ENABLED: 'true',
        VITE_BREAK_GLASS_ACTIVATED_AT: String(now - 5000),
        VITE_BREAK_GLASS_MAX_AGE_MS: '60000',
        VITE_BREAK_GLASS_USERNAME: 'Emergency',
        VITE_BREAK_GLASS_PASSWORD: 'safe-pass',
        VITE_BREAK_GLASS_ROLE: 'SUPER_ADMIN',
      },
      now: () => now,
    });

    const result = await service.login('emergency', 'safe-pass');

    expect(result.success).toBe(true);
    expect(result.isFallback).toBe(true);
    expect(result.session.role).toBe('SUPER_ADMIN');
  });

  it('لا يستخدم fallback عند انتهاء المدة أو نقص ENV', async () => {
    const { AuthService } = await import('./auth-service');
    const now = Date.now();
    const service = new AuthService({
      apiClient: {
        adminLogin: async () => {
          throw new Error('network down');
        },
      },
      env: {
        MODE: 'production',
        VITE_BREAK_GLASS_ENABLED: 'true',
        VITE_BREAK_GLASS_ACTIVATED_AT: String(now - 3600000),
        VITE_BREAK_GLASS_MAX_AGE_MS: '60000',
        VITE_BREAK_GLASS_USERNAME: 'Emergency',
      },
      now: () => now,
    });

    const result = await service.login('emergency', 'safe-pass');

    expect(result.success).toBe(false);
  });

  it('لا يقبل بيانات break-glass الافتراضية غير المصرح بها', async () => {
    const { AuthService } = await import('./auth-service');
    const now = Date.now();
    const service = new AuthService({
      apiClient: {
        adminLogin: async () => {
          throw new Error('network down');
        },
      },
      env: {
        MODE: 'development',
        VITE_BREAK_GLASS_ENABLED: 'true',
        VITE_BREAK_GLASS_ACTIVATED_AT: String(now),
      },
      now: () => now,
    });

    const result = await service.login('admin', 'admin1234');

    expect(result.success).toBe(false);
  });

  it('لا يفعل break-glass في التطوير بدون علم التفعيل الصريح', async () => {
    const { AuthService } = await import('./auth-service');
    const now = Date.now();
    const service = new AuthService({
      apiClient: {
        adminLogin: async () => {
          throw new Error('network down');
        },
      },
      env: {
        MODE: 'development',
        VITE_BREAK_GLASS_USERNAME: 'Emergency',
        VITE_BREAK_GLASS_PASSWORD: 'safe-pass',
      },
      now: () => now,
    });

    const result = await service.login('emergency', 'safe-pass');

    expect(result.success).toBe(false);
  });

  it('يسمح بـ break-glass في التطوير عند التفعيل الصريح مع بيانات صحيحة', async () => {
    const { AuthService } = await import('./auth-service');
    const now = Date.now();
    const service = new AuthService({
      apiClient: {
        adminLogin: async () => {
          throw new Error('network down');
        },
      },
      env: {
        MODE: 'development',
        VITE_BREAK_GLASS_ENABLED: 'true',
        VITE_BREAK_GLASS_USERNAME: 'Emergency',
        VITE_BREAK_GLASS_PASSWORD: 'safe-pass',
        VITE_BREAK_GLASS_ROLE: 'SUPER_ADMIN',
      },
      now: () => now,
    });

    const result = await service.login('emergency', 'safe-pass');

    expect(result.success).toBe(true);
    expect(result.isFallback).toBe(true);
    expect(result.session.role).toBe('SUPER_ADMIN');
  });

  it('يرفض break-glass إذا كان وقت التفعيل في المستقبل (إنتاج)', async () => {
    const { AuthService } = await import('./auth-service');
    const now = Date.now();
    const service = new AuthService({
      apiClient: {
        adminLogin: async () => ({ success: false, status: 503 }),
      },
      env: {
        MODE: 'production',
        VITE_BREAK_GLASS_ENABLED: 'true',
        VITE_BREAK_GLASS_ACTIVATED_AT: String(now + 60000),
        VITE_BREAK_GLASS_MAX_AGE_MS: '600000',
        VITE_BREAK_GLASS_USERNAME: 'Emergency',
        VITE_BREAK_GLASS_PASSWORD: 'safe-pass',
      },
      now: () => now,
    });

    const result = await service.login('emergency', 'safe-pass');

    expect(result.success).toBe(false);
  });

  it('ينظف اسم المستخدم قبل الإرسال للـ API وإنشاء الجلسة', async () => {
    const { AuthService } = await import('./auth-service');
    let capturedUsername = null;

    const service = new AuthService({
      apiClient: {
        adminLogin: async (username) => {
          capturedUsername = username;
          return { success: true, role: 'ADMIN' };
        },
      },
    });

    const result = await service.login('  admin-user  ', 'secret');

    expect(result.success).toBe(true);
    expect(capturedUsername).toBe('admin-user');
    expect(result.session.username).toBe('admin-user');
  });

  it('يرفض القيم الفارغة دون استدعاء API', async () => {
    const { AuthService } = await import('./auth-service');
    const adminLogin = vi.fn();

    const service = new AuthService({
      apiClient: { adminLogin },
    });

    const result = await service.login('   ', '');

    expect(result.success).toBe(false);
    expect(result.error).toContain('غير صحيحة');
    expect(adminLogin).not.toHaveBeenCalled();
  });

  it('لا يرمي أخطاء عند غياب localStorage', async () => {
    const { AuthService } = await import('./auth-service');
    const originalStorage = global.localStorage;

    // @ts-ignore - محاكاة بيئة SSR/اختبار بدون localStorage
    delete global.localStorage;

    const service = new AuthService({
      apiClient: { adminLogin: async () => ({ success: true, role: 'ADMIN' }) },
    });

    const result = await service.login('admin', 'secret');

    expect(result.success).toBe(true);
    expect(() => service.getSession()).not.toThrow();
    expect(service.getSession()).toBe(null);

    global.localStorage = originalStorage;
  });
});

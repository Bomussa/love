import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthService } from './auth-service';

function createStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

describe('AuthService.login', () => {
  beforeEach(() => {
    global.localStorage = createStorage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ينجح دخول الإدارة عبر API', async () => {
    const service = new AuthService({
      apiClient: {
        adminLogin: async () => ({ success: true, session: { username: 'admin', role: 'SUPER_ADMIN' } }),
      },
      now: () => 1700000000000,
    });

    const result = await service.login('admin', 'secret');

    expect(result.success).toBe(true);
    expect(result.session.role).toBe('SUPER_ADMIN');
  });

  it('يفشل عند بيانات خاطئة من API', async () => {
    const service = new AuthService({
      apiClient: {
        adminLogin: async () => ({ success: false, message: 'Invalid credentials' }),
      },
      now: () => 1700000000000,
    });

    const result = await service.login('admin', 'bad');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid credentials');
  });

  it('يفشل عند انقطاع API بدون fallback', async () => {
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
      now: () => 1700000000000,
    });

    const result = await service.login('admin', 'secret');

    expect(result.success).toBe(false);
    expect(result.error).toContain('تعذر الاتصال بالخادم');
  });

  it('returns a clear infrastructure/protection error for HTML gateway failures', async () => {
    const service = new AuthService({
      apiClient: {
        adminLogin: async () => ({
          success: false,
          status: 401,
          error: 'الخادم أعاد صفحة HTML بدل JSON متوقع',
        }),
      },
      env: {},
      now: () => 1700000000000,
    });

    const result = await service.login('bomussa', '14490');

    expect(result.success).toBe(false);
    expect(result.error).toContain('خدمة تسجيل الدخول الإدارية');
    expect(result.error).toContain('صفحة حماية');
  });

  it('يستخدم fallback الطارئ عند توفر ENV ضمن مدة صالحة', async () => {
    const now = 1700000000000;
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

  it('uses break-glass only when explicitly enabled and credentials match', async () => {
    const service = new AuthService({
      apiClient: {
        adminLogin: async () => ({
          success: false,
          status: 503,
          error: 'Service unavailable',
        }),
      },
      env: {
        MODE: 'development',
        VITE_BREAK_GLASS_ENABLED: 'true',
        VITE_BREAK_GLASS_USERNAME: 'bomussa',
        VITE_BREAK_GLASS_PASSWORD: '14490',
        VITE_BREAK_GLASS_ROLE: 'SUPER_ADMIN',
      },
      now: () => 1700000000000,
    });

    const result = await service.login('bomussa', '14490');

    expect(result.success).toBe(true);
    expect(result.isFallback).toBe(true);
    expect(result.source).toBe('break_glass');
    expect(result.session.role).toBe('SUPER_ADMIN');
  });

  it('لا يستخدم fallback عند انتهاء المدة أو نقص ENV', async () => {
    const now = 1700000000000;
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
    const now = 1700000000000;
    const service = new AuthService({
      apiClient: {
        adminLogin: async () => {
          throw new Error('network down');
        },
      },
      env: {
        MODE: 'production',
        VITE_BREAK_GLASS_ENABLED: 'true',
        VITE_BREAK_GLASS_ACTIVATED_AT: String(now),
      },
      now: () => now,
    });

    const result = await service.login('admin', 'admin1234');

    expect(result.success).toBe(false);
  });

  it('لا يفعل break-glass في التطوير بدون علم التفعيل الصريح', async () => {
    const now = 1700000000000;
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
    const now = 1700000000000;
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
    const now = 1700000000000;
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
    let capturedUsername = null;

    const service = new AuthService({
      apiClient: {
        adminLogin: async (username) => {
          capturedUsername = username;
          return { success: true, role: 'ADMIN' };
        },
      },
      now: () => 1700000000000,
    });

    const result = await service.login('  admin-user  ', 'secret');

    expect(result.success).toBe(true);
    expect(capturedUsername).toBe('admin-user');
    expect(result.session.username).toBe('admin-user');
  });

  it('يرفض القيم الفارغة دون استدعاء API', async () => {
    const adminLogin = vi.fn();

    const service = new AuthService({
      apiClient: { adminLogin },
      now: () => 1700000000000,
    });

    const result = await service.login('   ', '');

    expect(result.success).toBe(false);
    expect(result.error).toContain('غير صحيحة');
    expect(adminLogin).not.toHaveBeenCalled();
  });

  it('لا يرمي أخطاء عند غياب localStorage', async () => {
    const originalStorage = global.localStorage;

    // @ts-ignore
    delete global.localStorage;

    const service = new AuthService({
      apiClient: { adminLogin: async () => ({ success: true, role: 'ADMIN' }) },
      now: () => 1700000000000,
    });

    const result = await service.login('admin', 'secret');

    expect(result.success).toBe(true);
    expect(() => service.getSession()).not.toThrow();
    expect(service.getSession()).toBe(null);

    global.localStorage = originalStorage;
  });
});

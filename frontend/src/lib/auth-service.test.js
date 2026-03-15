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
});

import { describe, it, expect } from 'vitest';
import { AuthService } from './auth-service';

describe('AuthService.login', () => {
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
});

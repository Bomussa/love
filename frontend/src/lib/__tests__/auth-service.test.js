import { beforeEach, describe, expect, it, vi } from 'vitest';

function createStorageMock() {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => { store[key] = String(value); }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
}

describe('auth-service secure login', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();

    const localStorageMock = createStorageMock();
    vi.stubGlobal('localStorage', localStorageMock);
  });

  it('rejects login when backend response is not valid', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, role: 'SUPER_ADMIN' })
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { default: authService } = await import('../auth-service.js');

    const result = await authService.login('admin', '1234');

    expect(result.success).toBe(false);
    expect(result.error).toContain('استجابة مصادقة غير صالحة');
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it('supports login + verify contract using /api/v1/admin endpoints', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url === '/api/v1/admin/login') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            role: 'ADMIN',
            username: 'admin',
            session: { id: 'sess_123' },
            permissions: ['admin:read']
          })
        };
      }

      if (url === '/api/v1/admin/session/verify') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            role: 'ADMIN',
            permissions: ['admin:read', 'queue:manage'],
            username: 'admin',
            expiresAt: '2099-01-01T00:00:00.000Z'
          })
        };
      }

      return { ok: false, json: async () => ({}) };
    });

    vi.stubGlobal('fetch', fetchMock);

    const { default: authService } = await import('../auth-service.js');
    const result = await authService.login('admin', '1234');

    expect(result.success).toBe(true);
    expect(result.session.sessionToken).toBe('sess_123');
    expect(result.session.role).toBe('ADMIN');
    expect(result.session.permissions).toEqual(['admin:read', 'queue:manage']);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/admin/login',
      expect.objectContaining({ method: 'POST' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/admin/session/verify',
      expect.objectContaining({ method: 'POST' })
    );
  });
});

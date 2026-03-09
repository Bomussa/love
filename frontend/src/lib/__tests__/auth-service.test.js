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

  it('restores stored session only after successful verify on reload', async () => {
    const validSession = {
      id: 'sess_1',
      username: 'admin',
      role: 'ADMIN',
      permissions: ['*'],
      sessionToken: 'token_1',
      loginTime: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };

    localStorage.setItem('mmc_admin_session', JSON.stringify(validSession));

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        role: 'SUPER_ADMIN',
        permissions: ['users.read'],
        username: 'trusted-admin',
        expiresAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
      })
    }));

    vi.stubGlobal('fetch', fetchMock);

    const { default: authService } = await import('../auth-service.js');

    const restored = await authService.restoreSession();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/admin/session/verify',
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(restored).toBeTruthy();
    expect(restored.role).toBe('SUPER_ADMIN');
    expect(restored.permissions).toEqual(['users.read']);
    expect(restored.username).toBe('trusted-admin');
    expect(localStorage.setItem).toHaveBeenCalled();
  });
});

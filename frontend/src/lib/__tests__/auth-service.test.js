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

  it('succeeds on valid login payload and verified session', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          sessionToken: 'token-1',
          role: 'SUPER_ADMIN',
          permissions: ['*'],
          username: 'admin',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          role: 'SUPER_ADMIN',
          permissions: ['*'],
          username: 'admin',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      });

    vi.stubGlobal('fetch', fetchMock);
    const { default: authService } = await import('../auth-service.js');

    const result = await authService.login('admin', 'securePassword');

    expect(result.success).toBe(true);
    expect(result.session?.role).toBe('SUPER_ADMIN');
    expect(localStorage.setItem).toHaveBeenCalled();
  });

  it('returns unified error message on invalid credentials', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401 })));
    const { default: authService } = await import('../auth-service.js');

    const result = await authService.login('admin', 'wrong');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid credentials');
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it('returns unified error for lockout/brute-force response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429 })));
    const { default: authService } = await import('../auth-service.js');

    const attempts = await Promise.all(
      Array.from({ length: 6 }, () => authService.login('admin', 'wrong')),
    );

    expect(attempts.every((attempt) => attempt.error === 'Invalid credentials')).toBe(true);
  });
});

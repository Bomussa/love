import { beforeEach, describe, expect, it, vi } from 'vitest';

function storageMock() {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => { store[key] = String(value); }),
    removeItem: vi.fn((key) => { delete store[key]; }),
  };
}

describe('auth-service login flow integration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.stubGlobal('localStorage', storageMock());
  });

  it('simulates brute-force progression then successful login', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, sessionToken: 'fresh-token', role: 'ADMIN', permissions: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, role: 'ADMIN', permissions: [] }),
      });

    vi.stubGlobal('fetch', fetchMock);
    const { default: authService } = await import('../auth-service.js');

    const a1 = await authService.login('admin', 'wrong');
    const a2 = await authService.login('admin', 'wrong');
    const a3 = await authService.login('admin', 'wrong');
    const a4 = await authService.login('admin', 'wrong');
    const a5 = await authService.login('admin', 'correct-after-lockout');

    expect([a1, a2, a3, a4].every((a) => !a.success && a.error === 'Invalid credentials')).toBe(true);
    expect(a5.success).toBe(true);
  });
});

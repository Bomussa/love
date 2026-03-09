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
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/guards/noSupabaseInClient', () => ({
  assertNoSupabaseInClient: vi.fn()
}));

import { apiClient } from '../api/client';

function mockJsonResponse(body, status = 200, headers = { 'content-type': 'application/json' }) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { get: (name) => headers[name.toLowerCase()] || null },
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body))
  });
}

describe('apiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('deduplicates inflight GET requests for the same key/params', async () => {
    fetch.mockImplementation(() => mockJsonResponse({ data: [{ id: 1 }] }));

    const p1 = apiClient.get('clinics', { active: true });
    const p2 = apiClient.get('clinics', { active: true });

    const [r1, r2] = await Promise.all([p1, p2]);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(r1).toEqual([{ id: 1 }]);
    expect(r2).toEqual([{ id: 1 }]);
  });

  it('trims pin payload before sending pin verification requests', async () => {
    fetch.mockImplementation(() => mockJsonResponse({ verified: true }));

    await apiClient.post('pinValidate', { clinicId: 1, pin: '  1234  ' });

    const [, options] = fetch.mock.calls[0];
    expect(JSON.parse(options.body).pin).toBe('1234');
  });

  it('returns fallback object when response body is invalid JSON', async () => {
    fetch.mockImplementation(() => mockJsonResponse('not-json', 200));

    const data = await apiClient.get('settings');

    expect(data).toEqual({});
  });
});

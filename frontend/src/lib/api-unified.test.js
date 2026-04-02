import { describe, it, expect, vi, beforeEach } from 'vitest';
import api, { API_VERSION } from './api-unified';

function mockResponse({ ok = true, status = 200, body = {}, version = API_VERSION }) {
  return {
    ok,
    status,
    headers: { get: (name) => (name.toLowerCase() === 'x-api-version' ? version : null) },
    json: async () => body,
  };
}

describe('api-unified', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls only whitelisted endpoint with v1 header', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      mockResponse({ body: { queued: true } }),
    );

    const result = await api.createQueue({ clinic_id: 'c1', patient_id: 'p1' });

    expect(result.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/queue/create',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-API-Version': 'v1' }),
      }),
    );
  });

  it('returns API error without retry', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      mockResponse({ ok: false, status: 500, body: { error: 'boom' } }),
    );

    const result = await api.advanceQueue({ clinic_id: 'c1' });
    expect(result).toMatchObject({ success: false, error: 'boom', status: 500 });
  });
});

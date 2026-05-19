import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionApiClient } from './session-api-client';

describe('sessionApiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls validate endpoint under /api/v1/session/* contract', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });

    const result = await sessionApiClient.validateToken('token-123');

    expect(result).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/session/validate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-API-Version': 'v1',
        }),
        body: JSON.stringify({ token: 'token-123' }),
      }),
    );
  });

  it('throws normalized error when backend returns failure', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'SESSION_NOT_FOUND' }),
    });

    await expect(sessionApiClient.registerDevice('token-123', 'Android')).rejects.toMatchObject({
      message: 'SESSION_NOT_FOUND',
      response: {
        status: 404,
        data: { error: 'SESSION_NOT_FOUND' },
      },
    });
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { requestJson } from './resilient-request';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('requestJson', () => {
  it('parses JSON responses normally', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      headers: { get: () => 'application/json; charset=utf-8' },
      json: async () => ({ ok: true, value: 1 }),
      text: async () => JSON.stringify({ ok: true, value: 1 }),
    }));

    const { payload, isJson, contentType } = await requestJson('/api/test');

    expect(isJson).toBe(true);
    expect(contentType).toContain('application/json');
    expect(payload).toEqual({ ok: true, value: 1 });
  });

  it('returns structured error payload for HTML protection pages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 401,
      headers: { get: () => 'text/html; charset=utf-8' },
      json: async () => { throw new Error('not json'); },
      text: async () => '<!doctype html><html><body>Authentication Required</body></html>',
    }));

    const { payload, isJson, response, rawText } = await requestJson('/api/protected');

    expect(isJson).toBe(false);
    expect(response.status).toBe(401);
    expect(rawText).toContain('Authentication Required');
    expect(payload.error.code).toBe('NON_JSON_HTML_RESPONSE');
    expect(payload.error.message).toContain('HTML');
    expect(payload.error.status).toBe(401);
  });
});

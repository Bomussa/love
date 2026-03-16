import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { EventEmitter } from 'node:events';

const originalEnv = { ...process.env };

function createReq({ headers = {}, url = '/api/v1/admin/export-secrets', method = 'POST', body = '' } = {}) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = {
    host: 'localhost',
    ...headers,
  };
  req.connection = { remoteAddress: '127.0.0.1' };

  process.nextTick(() => {
    if (body) {
      req.emit('data', Buffer.from(body));
    }
    req.emit('end');
  });

  return req;
}

function createRes() {
  return {
    statusCode: 200,
    headers: {},
    payload: null,
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
    end() {
      return this;
    },
    write() {
      return this;
    },
  };
}

describe('admin export secrets hardening', () => {
  let handler;
  let securityInternals;

  beforeAll(async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';

    const module = await import('../../lib/api-handlers.js');
    handler = module.default;
    securityInternals = module.__securityInternals;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('blocks when EXPORT_TOKEN is missing', async () => {
    delete process.env.EXPORT_TOKEN;
    securityInternals.setAdminSessionResolver(async () => ({ role: 'admin', expiresAt: '2999-01-01T00:00:00.000Z' }));

    const req = createReq({ headers: { 'x-admin-session-id': 'session-ok', 'x-export-token': 'any' } });
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(503);
    expect(res.payload?.code).toBe('EXPORT_TOKEN_MISSING');
  });

  it('returns 401 on wrong token', async () => {
    process.env.EXPORT_TOKEN = 'correct-token';
    securityInternals.setAdminSessionResolver(async () => ({ role: 'admin', expiresAt: '2999-01-01T00:00:00.000Z' }));

    const req = createReq({ headers: { 'x-admin-session-id': 'session-ok', 'x-export-token': 'wrong-token' } });
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.payload?.code).toBe('UNAUTHORIZED');
  });

  it('does not expose secret substrings in response', async () => {
    process.env.EXPORT_TOKEN = 'correct-token';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'super-secret-role-key-value';
    process.env.SUPABASE_ANON_KEY = 'anon-secret-value';
    securityInternals.setAdminSessionResolver(async () => ({ role: 'admin', expiresAt: '2999-01-01T00:00:00.000Z' }));

    const req = createReq({ headers: { 'x-admin-session-id': 'session-ok', 'x-export-token': 'correct-token' } });
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);

    const serialized = JSON.stringify(res.payload);
    expect(serialized).not.toContain('super-secret-role-key-value');
    expect(serialized).not.toContain('anon-secret-value');
    expect(serialized).not.toContain('preview');

    const items = res.payload?.items;
    expect(Array.isArray(items)).toBe(true);
    expect(items.every((item) => Object.hasOwn(item, 'present'))).toBe(true);
    expect(items.every((item) => !Object.hasOwn(item, 'preview'))).toBe(true);
  });
});

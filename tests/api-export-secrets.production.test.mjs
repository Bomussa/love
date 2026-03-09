import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
process.env.VERCEL_ENV = 'production';

const { default: handler } = await import('../lib/api-handlers.js');

class MockRequest extends EventEmitter {
  constructor({ method = 'GET', url = '/', headers = {}, body = null }) {
    super();
    this.method = method;
    this.url = url;
    this.headers = headers;
    this.connection = {};
    this.socket = {};
    this._body = body;
  }

  pushBody() {
    if (this._body !== null) {
      this.emit('data', Buffer.from(JSON.stringify(this._body)));
    }
    this.emit('end');
  }
}

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {},
    payload: undefined,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.payload = data;
      return this;
    },
    end() {
      return this;
    },
  };
}

test('POST /api/v1/admin/export-secrets is unavailable in production', async () => {
  const req = new MockRequest({
    method: 'POST',
    url: '/api/v1/admin/export-secrets',
    headers: { host: 'localhost', 'content-type': 'application/json' },
    body: {},
  });
  const res = createMockResponse();

  const handlerPromise = handler(req, res);
  req.pushBody();
  await handlerPromise;

  assert.equal(res.statusCode, 404);
  assert.equal(res.payload?.success, false);
  assert.equal(res.payload?.code, 'NOT_FOUND');
});

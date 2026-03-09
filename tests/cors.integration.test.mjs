import test from 'node:test';
import assert from 'node:assert/strict';
import { setCorsHeaders } from '../lib/helpers-enhanced.js';

function createMockRes() {
  const headers = new Map();
  return {
    headers,
    setHeader(name, value) {
      headers.set(name, value);
    },
    getHeader(name) {
      return headers.get(name);
    },
  };
}

test('CORS allows production origin with credentials and reflected origin', () => {
  const req = { headers: { origin: 'https://mmc-mms.com' } };
  const res = createMockRes();

  const result = setCorsHeaders(res, req);

  assert.equal(result.allowed, true);
  assert.equal(res.getHeader('Access-Control-Allow-Origin'), 'https://mmc-mms.com');
  assert.equal(res.getHeader('Access-Control-Allow-Credentials'), 'true');
  assert.notEqual(res.getHeader('Access-Control-Allow-Origin'), '*');
});

test('CORS rejects non-allowlisted origin explicitly', () => {
  const req = { headers: { origin: 'https://evil.example.com' } };
  const res = createMockRes();

  const result = setCorsHeaders(res, req);

  assert.equal(result.allowed, false);
  assert.equal(result.origin, 'https://evil.example.com');
  assert.equal(res.getHeader('Access-Control-Allow-Origin'), undefined);
});

test('CORS supports requests without origin using primary production origin', () => {
  const req = { headers: {} };
  const res = createMockRes();

  const result = setCorsHeaders(res, req);

  assert.equal(result.allowed, true);
  assert.equal(res.getHeader('Access-Control-Allow-Origin'), 'https://mmc-mms.com');
});

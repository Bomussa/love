import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createAdminToken, verifyAdminBearerToken, hasValidAdminSecret, verifyPasswordHash, resolveAdminLoginStatus } from '../lib/admin-auth.js';

const secret = 'x'.repeat(32);

test('hasValidAdminSecret enforces minimum length', () => {
  assert.equal(hasValidAdminSecret(undefined), false);
  assert.equal(hasValidAdminSecret('short-secret'), false);
  assert.equal(hasValidAdminSecret(secret), true);
});

test('createAdminToken creates verifiable bearer token', () => {
  const now = Date.UTC(2026, 0, 1, 0, 0, 0);
  const token = createAdminToken({ id: 'admin-1', username: 'root', role: 'admin' }, secret, now);
  const isValid = verifyAdminBearerToken(`Bearer ${token}`, secret, now + 10_000);
  assert.equal(isValid, true);
});

test('verifyAdminBearerToken rejects expired tokens', () => {
  const now = Date.UTC(2026, 0, 1, 0, 0, 0);
  const token = createAdminToken({ id: 'admin-1', username: 'root', role: 'admin' }, secret, now);
  const afterExpiry = now + (24 * 60 * 60 * 1000) + 1;
  const isValid = verifyAdminBearerToken(`Bearer ${token}`, secret, afterExpiry);
  assert.equal(isValid, false);
});

test('verifyAdminBearerToken rejects mismatched secret', () => {
  const now = Date.UTC(2026, 0, 1, 0, 0, 0);
  const token = createAdminToken({ id: 'admin-1', username: 'root', role: 'admin' }, secret, now);
  const isValid = verifyAdminBearerToken(`Bearer ${token}`, 'y'.repeat(32), now + 1_000);
  assert.equal(isValid, false);
});

test('verifyAdminBearerToken rejects tokens with non-HS256 JWT header', () => {
  const now = Date.UTC(2026, 0, 1, 0, 0, 0);
  const token = createAdminToken({ id: 'admin-1', username: 'root', role: 'admin' }, secret, now);
  const [header, payload, signature] = token.split('.');
  const modifiedHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const tampered = `${modifiedHeader}.${payload}.${signature}`;
  const isValid = verifyAdminBearerToken(`Bearer ${tampered}`, secret, now + 1_000);
  assert.equal(isValid, false);
  assert.notEqual(header, modifiedHeader);
});

test('verifyAdminBearerToken accepts lowercase bearer scheme', () => {
  const now = Date.UTC(2026, 0, 1, 0, 0, 0);
  const token = createAdminToken({ id: 'admin-1', username: 'root', role: 'admin' }, secret, now);
  const isValid = verifyAdminBearerToken(`bearer ${token}`, secret, now + 1_000);
  assert.equal(isValid, true);
});

test('verifyAdminBearerToken rejects malformed authorization values', () => {
  const now = Date.UTC(2026, 0, 1, 0, 0, 0);
  const token = createAdminToken({ id: 'admin-1', username: 'root', role: 'admin' }, secret, now);
  assert.equal(verifyAdminBearerToken(token, secret, now + 1_000), false);
  assert.equal(verifyAdminBearerToken(`Bearer`, secret, now + 1_000), false);
  assert.equal(verifyAdminBearerToken(`Bearer   `, secret, now + 1_000), false);
});

test('verifyPasswordHash validates scrypt hashes and rejects invalid inputs', () => {
  const password = 'StrongPassword!123';
  const salt = 'abc123def456';
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  const passwordHash = `${salt}:${hash}`;

  assert.equal(verifyPasswordHash(password, passwordHash), true);
  assert.equal(verifyPasswordHash('wrong-password', passwordHash), false);
  assert.equal(verifyPasswordHash(password, 'invalid-format'), false);
});

test('admin login returns 200 for correct password', () => {
  const salt = crypto.randomBytes(16).toString('hex');
  const password = 'StrongPass123!';
  const password_hash = `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;

  const status = resolveAdminLoginStatus({
    username: 'root',
    password,
    admin: { username: 'root', password_hash },
  });

  assert.equal(status, 200);
});

test('admin login returns 401 for incorrect password', () => {
  const salt = crypto.randomBytes(16).toString('hex');
  const password_hash = `${salt}:${crypto.scryptSync('CorrectPass123!', salt, 64).toString('hex')}`;

  const status = resolveAdminLoginStatus({
    username: 'root',
    password: 'WrongPass123!',
    admin: { username: 'root', password_hash },
  });

  assert.equal(status, 401);
});

test('admin login returns 401 for non-existent user', () => {
  const status = resolveAdminLoginStatus({
    username: 'ghost-user',
    password: 'AnyPass123!',
    admin: null,
  });

  assert.equal(status, 401);
});


test('admin login rejects removed legacy static credentials when account does not exist', () => {
  const status = resolveAdminLoginStatus({
    username: 'bomussa',
    password: '14490',
    admin: null,
  });

  assert.equal(status, 401);
});

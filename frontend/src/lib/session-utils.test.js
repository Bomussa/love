import { describe, it, expect } from 'vitest';
import { sanitizeAdminSession, loadAndValidateSession } from './session-utils';

describe('sanitizeAdminSession', () => {
  it('normalizes valid admin session fields', () => {
    const now = Date.parse('2026-03-19T05:00:00.000Z');
    const result = sanitizeAdminSession({
      username: '  bomussa  ',
      role: 'admin',
      expiresAt: '2026-03-19T06:00:00.000Z',
      loginTime: '2026-03-19T04:00:00.000Z',
      name: '  Bomussa  ',
    }, now);

    expect(result.username).toBe('bomussa');
    expect(result.role).toBe('ADMIN');
    expect(result.name).toBe('Bomussa');
    expect(result.expiresAt).toBe('2026-03-19T06:00:00.000Z');
  });

  it('rejects admin session without username or role', () => {
    const now = Date.parse('2026-03-19T05:00:00.000Z');
    expect(sanitizeAdminSession({ role: 'ADMIN', expiresAt: '2026-03-19T06:00:00.000Z' }, now)).toBe(null);
    expect(sanitizeAdminSession({ username: 'bomussa', expiresAt: '2026-03-19T06:00:00.000Z' }, now)).toBe(null);
  });

  it('rejects expired admin session', () => {
    const now = Date.parse('2026-03-19T05:00:00.000Z');
    expect(sanitizeAdminSession({ username: 'bomussa', role: 'ADMIN', expiresAt: '2026-03-19T04:59:59.000Z' }, now)).toBe(null);
  });

  it('falls back to loginTime window when expiresAt is missing', () => {
    const now = Date.parse('2026-03-19T05:00:00.000Z');
    const valid = sanitizeAdminSession({
      username: 'bomussa',
      role: 'ADMIN',
      loginTime: '2026-03-19T04:30:00.000Z',
    }, now);

    expect(valid).not.toBe(null);
    expect(valid.expiresAt).toBeTruthy();

    const invalid = sanitizeAdminSession({
      username: 'bomussa',
      role: 'ADMIN',
      loginTime: '2026-03-18T20:00:00.000Z',
    }, now);

    expect(invalid).toBe(null);
  });
});

describe('loadAndValidateSession', () => {
  it('rewrites normalized sessions back into storage', () => {
    const store = new Map();
    const storage = {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, value),
      removeItem: (key) => store.delete(key),
    };

    store.set('mmc_admin_session', JSON.stringify({
      username: '  bomussa  ',
      role: 'admin',
      expiresAt: '2026-03-19T06:00:00.000Z',
    }));

    const result = loadAndValidateSession(
      storage,
      'mmc_admin_session',
      sanitizeAdminSession,
      Date.parse('2026-03-19T05:00:00.000Z'),
    );

    expect(result.username).toBe('bomussa');
    expect(result.role).toBe('ADMIN');
    expect(storage.getItem('mmc_admin_session')).toContain('ADMIN');
  });
});

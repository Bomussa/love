import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPasswordHash,
  validatePassword,
  createAdminToken,
  verifyAdminBearerToken,
} from './admin-auth.js';

describe('admin-auth password lifecycle', () => {
  it('hashes and verifies a valid password', () => {
    const hash = hashPassword('StrongPass123');
    expect(hash).toContain(':');
    expect(verifyPasswordHash('StrongPass123', hash)).toBe(true);
    expect(verifyPasswordHash('WrongPass123', hash)).toBe(false);
  });

  it('rejects weak passwords', () => {
    expect(validatePassword('123')).toEqual({
      valid: false,
      reason: 'Password must be at least 8 characters',
    });
  });

  it('creates and verifies signed bearer tokens', () => {
    const secret = 'a'.repeat(32);
    const token = createAdminToken({ id: '1', username: 'admin', role: 'admin' }, secret, Date.now());
    const ok = verifyAdminBearerToken(`Bearer ${token}`, secret);
    expect(ok).toBe(true);
  });
});

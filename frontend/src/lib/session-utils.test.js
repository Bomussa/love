import { describe, it, expect } from 'vitest'
import { loadAndValidateSession, sanitizeAdminSession, sanitizeClinicSession } from './session-utils'

function createStorage(seed = {}) {
  const state = new Map(Object.entries(seed))
  return {
    getItem: (key) => (state.has(key) ? state.get(key) : null),
    setItem: (key, value) => state.set(key, value),
    removeItem: (key) => state.delete(key),
    has: (key) => state.has(key),
  }
}

describe('sanitizeClinicSession', () => {
  it('accepts valid clinic sessions and normalizes clinicId', () => {
    const now = Date.parse('2026-03-18T00:00:00.000Z')
    const result = sanitizeClinicSession({ clinicId: ' lab ', expiresAt: '2026-03-18T08:00:00.000Z' }, now)
    expect(result).toMatchObject({ clinicId: 'lab' })
  })

  it('rejects stale clinic sessions by expiresAt', () => {
    const now = Date.parse('2026-03-18T10:00:00.000Z')
    const result = sanitizeClinicSession({ clinicId: 'lab', expiresAt: '2026-03-18T08:00:00.000Z' }, now)
    expect(result).toBeNull()
  })

  it('rejects legacy clinic sessions older than 8 hours when expiresAt is missing', () => {
    const now = Date.parse('2026-03-18T10:00:00.000Z')
    const result = sanitizeClinicSession({ clinicId: 'lab', loginTime: '2026-03-17T20:59:59.000Z' }, now)
    expect(result).toBeNull()
  })
})

describe('loadAndValidateSession', () => {
  it('removes stale session records from storage', () => {
    const storage = createStorage({ mmc_clinic_session: JSON.stringify({ clinicId: 'lab', expiresAt: '2026-03-18T08:00:00.000Z' }) })
    const now = Date.parse('2026-03-18T10:00:00.000Z')

    const result = loadAndValidateSession(storage, 'mmc_clinic_session', sanitizeClinicSession, now)

    expect(result).toBeNull()
    expect(storage.has('mmc_clinic_session')).toBe(false)
  })

  it('removes malformed session records from storage', () => {
    const storage = createStorage({ mmc_admin_session: '{bad-json}' })

    const result = loadAndValidateSession(storage, 'mmc_admin_session', sanitizeAdminSession)

    expect(result).toBeNull()
    expect(storage.has('mmc_admin_session')).toBe(false)
  })
})

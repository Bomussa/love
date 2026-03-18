import { describe, it, expect } from 'vitest'
import {
  selectCurrentClinicTicket,
  getTicketDisplayNumber,
  getTicketPatientId,
} from './clinic-dashboard-utils'

describe('selectCurrentClinicTicket', () => {
  it('reads the current ticket from raw queue payloads', () => {
    const result = selectCurrentClinicTicket({
      success: true,
      queue: [
        { status: 'waiting', display_number: 10, patient_id: 'P-1' },
        { status: 'serving', display_number: 11, patient_id: 'P-2' },
      ],
    })

    expect(result).toMatchObject({
      ticket_number: 11,
      patient_id: 'P-2',
    })
  })

  it('falls back to the current api-unified in-service shape', () => {
    const result = selectCurrentClinicTicket({
      success: true,
      in: [
        { ticket: 22, visitId: 'P-22', calledAt: '2026-03-18T17:00:00.000Z' },
      ],
    })

    expect(result).toMatchObject({
      ticket_number: 22,
      patient_id: 'P-22',
    })
  })

  it('returns null when there is no active current ticket', () => {
    const result = selectCurrentClinicTicket({
      success: true,
      waiting: [{ ticket: 30, visitId: 'P-30' }],
      in: [],
      done: [],
    })

    expect(result).toBeNull()
  })
})

describe('ticket field helpers', () => {
  it('reads ticket number and patient id across legacy and normalized shapes', () => {
    expect(getTicketDisplayNumber({ display_number: 9 })).toBe(9)
    expect(getTicketDisplayNumber({ ticket: 7 })).toBe(7)
    expect(getTicketPatientId({ patient_id: 'A1' })).toBe('A1')
    expect(getTicketPatientId({ visitId: 'B2' })).toBe('B2')
  })
})

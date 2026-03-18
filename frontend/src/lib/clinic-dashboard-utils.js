const ACTIVE_QUEUE_STATUSES = new Set(['called', 'serving', 'in_service'])

function normalizeTicketShape(ticket) {
  if (!ticket) return null

  return {
    ...ticket,
    ticket_number:
      ticket.ticket_number ??
      ticket.display_number ??
      ticket.ticket ??
      null,
    patient_id:
      ticket.patient_id ??
      ticket.visitId ??
      null,
  }
}

export function selectCurrentClinicTicket(statusPayload) {
  if (!statusPayload?.success) return null

  if (Array.isArray(statusPayload.queue) && statusPayload.queue.length > 0) {
    const current = statusPayload.queue.find((item) =>
      ACTIVE_QUEUE_STATUSES.has(item.status),
    )
    if (current) return normalizeTicketShape(current)
  }

  if (Array.isArray(statusPayload.in) && statusPayload.in.length > 0) {
    return normalizeTicketShape(statusPayload.in[0])
  }

  return null
}

export function getTicketDisplayNumber(ticket) {
  return (
    ticket?.ticket_number ??
    ticket?.display_number ??
    ticket?.ticket ??
    null
  )
}

export function getTicketPatientId(ticket) {
  return ticket?.patient_id ?? ticket?.visitId ?? null
}

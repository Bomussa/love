const originalFetch = globalThis.fetch?.bind(globalThis)

function readPatientData() {
  try {
    return JSON.parse(localStorage.getItem('patientData') || 'null')
  } catch {
    return null
  }
}

function getActualPatientId(fallback = '') {
  const p = readPatientData()
  return String(p?.patient_id || p?.personal_id || fallback || '').trim()
}

function getSessionId(fallback = '') {
  const p = readPatientData()
  return String(p?.sessionId || p?.session_id || fallback || '').trim()
}

function rewriteUrl(url) {
  const current = new URL(url, window.location.origin)
  const actualPatientId = getActualPatientId(current.searchParams.get('patientId') || current.searchParams.get('user') || '')

  if (current.pathname.endsWith('/queue/position')) {
    const clinic = current.searchParams.get('clinicId') || current.searchParams.get('clinic') || ''
    if (clinic && actualPatientId) {
      current.searchParams.set('clinicId', clinic)
      current.searchParams.set('clinic', clinic)
      current.searchParams.set('patientId', actualPatientId)
      current.searchParams.set('patient_id', actualPatientId)
      current.searchParams.set('user', actualPatientId)
    }
  }

  if (current.pathname.endsWith('/route/get')) {
    const patient = actualPatientId || current.searchParams.get('patientId') || current.searchParams.get('user') || ''
    if (patient) {
      current.searchParams.set('patientId', patient)
      current.searchParams.set('patient_id', patient)
      current.searchParams.set('user', patient)
    }
  }

  return current.toString()
}

function rewriteBody(url, init = {}) {
  if (!init || typeof init.body !== 'string') return init
  const current = new URL(url, window.location.origin)
  if (!current.pathname.includes('/api/v1/queue/enter') && !current.pathname.includes('/api/v1/route/create') && !current.pathname.includes('/api/v1/queue/done')) {
    return init
  }

  try {
    const payload = JSON.parse(init.body)
    const sessionId = getSessionId(payload.sessionId || payload.session_id || payload.user || payload.patientId || '')
    const actualPatientId = getActualPatientId(payload.patientId || payload.personalId || payload.personal_id || payload.user || '')

    if (sessionId) {
      payload.sessionId = sessionId
      payload.session_id = sessionId
    }
    if (actualPatientId) {
      payload.patientId = actualPatientId
      payload.patient_id = actualPatientId
      payload.personalId = actualPatientId
      payload.personal_id = actualPatientId
      payload.user = actualPatientId
    }

    return { ...init, body: JSON.stringify(payload) }
  } catch {
    return init
  }
}

if (typeof originalFetch === 'function' && typeof window !== 'undefined') {
  globalThis.fetch = async (input, init = {}) => {
    try {
      if (typeof input === 'string' || input instanceof URL) {
        const url = rewriteUrl(String(input))
        const nextInit = rewriteBody(url, init)
        return originalFetch(url, nextInit)
      }
    } catch {
      // fall through
    }
    return originalFetch(input, init)
  }
}

export {}

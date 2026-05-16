import api from './api-unified'

const WARNED_KEYS = new Set()
const QUEUE_CACHE_PREFIX = 'mmc_patient_queue_cache:'
const ROUTE_CACHE_PREFIX = 'mmc_patient_route_cache:'

function cacheQueue(clinicId, patientId, payload) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(`${QUEUE_CACHE_PREFIX}${clinicId}:${patientId}`, JSON.stringify({
      ...payload,
      cachedAt: Date.now(),
    }))
  } catch {}
}

function readQueueCache(clinicId, patientId) {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(`${QUEUE_CACHE_PREFIX}${clinicId}:${patientId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed) return null
    return parsed
  } catch {
    return null
  }
}

function cacheRoute(patientId, route) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(`${ROUTE_CACHE_PREFIX}${patientId}`, JSON.stringify({
      route,
      cachedAt: Date.now(),
    }))
  } catch {}
}

function readRouteCache(patientId) {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(`${ROUTE_CACHE_PREFIX}${patientId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.route || null
  } catch {
    return null
  }
}

function normalizeMessage(text) {
  const lower = String(text || '').toLowerCase()

  if (lower.includes('active_clinic_id') || lower.includes('another clinic') || lower.includes('other clinic') || lower.includes('lab')) {
    return 'لا يمكن الدخول لأنك مسجل بالفعل في عيادة أخرى اليوم'
  }

  if (lower.includes('already in queue') || lower.includes('already queued') || lower.includes('الطابور')) {
    return 'أنت مسجل بالفعل في الطابور'
  }

  if (lower.includes('connection') || lower.includes('network') || lower.includes('timeout') || lower.includes('fetch')) {
    return 'خطأ في الاتصال. يرجى المحاولة مرة أخرى'
  }

  if (lower.includes('no clinics') || lower.includes('no route') || lower.includes('route') || lower.includes('pathway')) {
    return 'تعذر تحميل مسارك الطبي حالياً'
  }

  if (lower.includes('invalid') || lower.includes('wrong') || lower.includes('incorrect') || lower.includes('password') || lower.includes('credential') || lower.includes('login')) {
    return 'تعذر تنفيذ العملية الحالية'
  }

  return 'حدث خطأ غير متوقع'
}

function notifyPatient(message, dedupeKey = null) {
  if (typeof window === 'undefined') return

  const text = normalizeMessage(message)
  const key = dedupeKey || text
  if (WARNED_KEYS.has(key)) return
  WARNED_KEYS.add(key)

  try {
    if (typeof window.__mmcPatientNotify === 'function') {
      window.__mmcPatientNotify({ type: 'error', title: 'تنبيه', message: text, dedupeKey: key })
    } else {
      console.warn('[PatientRelay]', text)
    }
  } finally {
    setTimeout(() => WARNED_KEYS.delete(key), 1500)
  }
}

function patchApiMethod(methodName, handler) {
  if (typeof api[methodName] !== 'function' || api[methodName].__mmcPatientPatched) return
  const original = api[methodName].bind(api)
  const patched = async (...args) => handler(original, ...args)
  patched.__mmcPatientPatched = true
  api[methodName] = patched
}

patchApiMethod('enterQueue', async (original, ...args) => {
  const [clinicId, patientId] = args
  const result = await original(...args)
  if (result?.success) {
    cacheQueue(clinicId, patientId, {
      success: true,
      display_number: result.display_number ?? result.number ?? result.ticket ?? null,
      current_number: result.current_number ?? null,
      ahead: result.ahead ?? null,
      total_waiting: result.total_waiting ?? null,
      status: result.status ?? 'waiting',
      entered_at: result.entered_at ?? new Date().toISOString(),
    })
    if (Array.isArray(result.path) || Array.isArray(result.route?.stations)) {
      cacheRoute(patientId, result.path || result.route)
    }
    return result
  }

  const cached = readQueueCache(clinicId, patientId)
  if (cached?.display_number != null) {
    return {
      success: true,
      alreadyExists: true,
      status: cached.status || 'ALREADY_IN_QUEUE',
      display_number: cached.display_number,
      current_number: cached.current_number ?? 0,
      ahead: cached.ahead ?? 0,
      total_waiting: cached.total_waiting ?? 0,
      entered_at: cached.entered_at,
      cached: true,
    }
  }

  notifyPatient(result?.error || result?.message || 'Failed to enter queue', `enterQueue:${String(clinicId || '')}:${String(patientId || '')}`)
  return result
})

patchApiMethod('getQueuePosition', async (original, ...args) => {
  const [clinicId, patientId] = args
  const result = await original(...args)
  if (result?.success) {
    cacheQueue(clinicId, patientId, {
      success: true,
      display_number: result.display_number ?? null,
      current_number: result.current_number ?? null,
      ahead: result.ahead ?? null,
      total_waiting: result.total_waiting ?? null,
      status: result.status ?? 'waiting',
      entered_at: result.entered_at ?? new Date().toISOString(),
    })
    return result
  }

  const cached = readQueueCache(clinicId, patientId)
  if (cached?.display_number != null) {
    return {
      success: true,
      display_number: cached.display_number,
      current_number: cached.current_number ?? 0,
      ahead: cached.ahead ?? 0,
      total_waiting: cached.total_waiting ?? 0,
      status: cached.status || 'waiting',
      entered_at: cached.entered_at,
      cached: true,
    }
  }

  notifyPatient(result?.error || result?.message || 'Unable to read queue position', `getQueuePosition:${String(clinicId || '')}:${String(patientId || '')}`)
  return result
})

patchApiMethod('getRoute', async (original, ...args) => {
  const [patientId] = args
  const result = await original(...args)
  if (result?.success && result.route) {
    cacheRoute(patientId, result.route)
    return result
  }

  const cachedRoute = readRouteCache(patientId)
  if (cachedRoute) {
    return { success: true, route: cachedRoute, cached: true }
  }

  notifyPatient(result?.error || result?.message || 'Unable to load pathway', `getRoute:${String(patientId || '')}`)
  return result
})

patchApiMethod('createRoute', async (original, ...args) => {
  const [patientId, examType, gender, stations] = args
  const result = await original(...args)
  if (result?.success) {
    if (Array.isArray(stations)) {
      cacheRoute(patientId, { stations, examType, gender })
    }
    return result
  }
  notifyPatient(result?.error || result?.message || 'Unable to save pathway', `createRoute:${String(patientId || '')}`)
  return result
})

export default null
import api from './api-unified'

const WARNED_KEYS = new Set()

function isPatientJourneyPath() {
  if (typeof window === 'undefined') return false
  const path = String(window.location.pathname || '')
  return path === '/' || path === '' || path.startsWith('/patient') || path.startsWith('/clinic/')
}

function normalizeMessage(text) {
  const lower = String(text || '').toLowerCase()

  if (
    lower.includes('active_clinic_id') ||
    lower.includes('another clinic') ||
    lower.includes('other clinic') ||
    lower.includes('clinic conflict')
  ) {
    return 'أنت مسجل بالفعل في عيادة أخرى اليوم'
  }
  if (lower.includes('already in queue') || lower.includes('already queued') || lower.includes('queue conflict') || lower.includes('duplicate queue') || lower.includes('الطابور')) {
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
  const result = await original(...args)
  if (!result?.success) {
    notifyPatient(result?.error || result?.message || 'Failed to enter queue', `enterQueue:${String(args[0] || '')}:${String(args[1] || '')}`)
  }
  return result
})

patchApiMethod('getQueuePosition', async (original, ...args) => {
  const result = await original(...args)
  if (!result?.success) {
    notifyPatient(result?.error || result?.message || 'Unable to read queue position', `getQueuePosition:${String(args[0] || '')}:${String(args[1] || '')}`)
  }
  return result
})

patchApiMethod('getRoute', async (original, ...args) => {
  const result = await original(...args)
  if (!result?.success || !result.route) {
    notifyPatient(result?.error || result?.message || 'Unable to load pathway', `getRoute:${String(args[0] || '')}`)
  }
  return result
})

patchApiMethod('createRoute', async (original, ...args) => {
  const result = await original(...args)
  if (!result?.success) {
    notifyPatient(result?.error || result?.message || 'Unable to save pathway', `createRoute:${String(args[0] || '')}`)
  }
  return result
})

export default null
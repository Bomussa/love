import api from './api-unified'
import './doctor-login-fallback.js'

function extractText(...values) {
  return values
    .flatMap((value) => {
      if (value == null) return []
      if (typeof value === 'string') return [value]
      if (value instanceof Error) return [value.message, value.name]
      if (typeof value === 'object') {
        return [value.message, value.error, value.code, JSON.stringify(value)]
      }
      return [String(value)]
    })
    .filter(Boolean)
    .join(' ')
    .trim()
}

function isRelevantMessage(text) {
  const lower = String(text || '').toLowerCase()
  return [
    'invalid', 'wrong', 'incorrect', 'password', 'credential',
    'device blocked', 'same device', 'already logged', 'different number',
    'clinic not found', 'another clinic', 'other clinic', 'lab',
    'active_clinic_id', 'queue failed', 'login failed', 'connection error'
  ].some((term) => lower.includes(term))
}

function normalizeMessage(text) {
  const lower = String(text || '').toLowerCase()

  if (lower.includes('device blocked') || lower.includes('same device') || lower.includes('already logged') || lower.includes('different number')) {
    return 'هذا الجهاز مستخدم برقم آخر اليوم'
  }

  if (lower.includes('another clinic') || lower.includes('other clinic') || lower.includes('lab') || lower.includes('active_clinic_id')) {
    return 'لا يمكن الدخول لأن الحساب مرتبط بعيادة أخرى'
  }

  if (lower.includes('connection error') || lower.includes('network') || lower.includes('timeout') || lower.includes('fetch')) {
    return 'خطأ في الاتصال'
  }

  if (lower.includes('invalid') || lower.includes('wrong') || lower.includes('incorrect') || lower.includes('password') || lower.includes('credential') || lower.includes('login failed')) {
    return 'بيانات الدخول غير صحيحة'
  }

  if (lower.includes('queue failed')) {
    return 'تعذر إدخالك إلى الطابور الحالي'
  }

  return 'حدث خطأ غير متوقع'
}

function notify(message) {
  if (typeof window === 'undefined') return
  const text = normalizeMessage(message)
  if (!window.__mmcLastAuthError || window.__mmcLastAuthError !== text) {
    window.__mmcLastAuthError = text
    window.alert?.(text)
    clearTimeout(window.__mmcLastAuthErrorTimer)
    window.__mmcLastAuthErrorTimer = setTimeout(() => {
      window.__mmcLastAuthError = null
    }, 1200)
  }
}

function patchConsoleMethod(methodName) {
  if (typeof console === 'undefined') return
  const original = console[methodName]
  if (typeof original !== 'function' || original.__mmcPatched) return

  const patched = (...args) => {
    try {
      const text = extractText(...args)
      if (isRelevantMessage(text)) {
        notify(text)
      }
    } catch {
      // Ignore relay failures and preserve original logging.
    }
    return original.apply(console, args)
  }

  patched.__mmcPatched = true
  console[methodName] = patched
}

function patchDoctorLogin() {
  if (typeof api.doctorLogin !== 'function' || api.doctorLogin.__mmcPatched) return

  const original = api.doctorLogin.bind(api)
  const patched = async (...args) => {
    const result = await original(...args)
    if (result && result.success) return result
    const message = normalizeMessage(result?.error || result?.message || 'Invalid credentials')
    throw new Error(message)
  }

  patched.__mmcPatched = true
  api.doctorLogin = patched
}

function patchAdminLogin() {
  if (typeof api.adminLogin !== 'function' || api.adminLogin.__mmcPatched) return

  const original = api.adminLogin.bind(api)
  const patched = async (...args) => {
    const result = await original(...args)
    if (result && result.success === false) {
      const message = normalizeMessage(result.error || result.message || 'Invalid credentials')
      notify(message)
      throw new Error(message)
    }
    return result
  }

  patched.__mmcPatched = true
  api.adminLogin = patched
}

patchConsoleMethod('log')
patchConsoleMethod('error')
patchConsoleMethod('warn')
patchDoctorLogin()
patchAdminLogin()

export default null

import './runtime-hotfixes.js'
import api from './api-unified'

const ALLOWED_ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN'])

function normalizeMessage(text) {
  const lower = String(text || '').toLowerCase()

  if (lower.includes('access denied: non-admin role')) {
    return 'لا تملك صلاحية الدخول إلى لوحة الإدارة'
  }

  if (lower.includes('device blocked') || lower.includes('same device') || lower.includes('already logged') || lower.includes('different number')) {
    return 'هذا الجهاز مستخدم برقم آخر اليوم'
  }

  if (lower.includes('another clinic') || lower.includes('other clinic') || lower.includes('clinic conflict') || lower.includes('wrong clinic pin') || lower.includes('wrong_clinic_pin') || lower.includes('active_clinic_id')) {
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
    if (typeof window.__mmcAuthNotify === 'function') {
      window.__mmcAuthNotify(text)
    } else {
      console.warn('[AuthRelay]', text)
    }
    clearTimeout(window.__mmcLastAuthErrorTimer)
    window.__mmcLastAuthErrorTimer = setTimeout(() => {
      window.__mmcLastAuthError = null
    }, 1200)
  }
}

function sanitizeStoredSessions() {
  if (typeof window === 'undefined') return

  try {
    const adminRaw = localStorage.getItem('mmc_admin_session')
    if (adminRaw) {
      const adminSession = JSON.parse(adminRaw)
      const role = String(adminSession?.role || '').toUpperCase()
      if (!ALLOWED_ADMIN_ROLES.has(role)) {
        localStorage.removeItem('mmc_admin_session')
      }
    }
  } catch {
    localStorage.removeItem('mmc_admin_session')
  }

  try {
    const doctorRaw = localStorage.getItem('mmc_doctor_session')
    if (doctorRaw) {
      const doctorSession = JSON.parse(doctorRaw)
      const role = String(doctorSession?.role || '').toUpperCase()
      if (role && role !== 'DOCTOR') {
        localStorage.removeItem('mmc_doctor_session')
      }
    }
  } catch {
    localStorage.removeItem('mmc_doctor_session')
  }
}

function patchAdminLogin() {
  if (typeof api.adminLogin !== 'function' || api.adminLogin.__mmcPatched) return

  const original = api.adminLogin.bind(api)
  const patched = async (...args) => {
    const result = await original(...args)

    if (result && result.success) {
      const role = String(result.role || result.data?.role || 'ADMIN').toUpperCase()

      if (!ALLOWED_ADMIN_ROLES.has(role)) {
        const errorMessage = 'Access denied: non-admin role cannot enter admin dashboard'
        notify(errorMessage)
        return { success: false, error: errorMessage }
      }

      return result
    }

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

sanitizeStoredSessions()
patchAdminLogin()

export default null
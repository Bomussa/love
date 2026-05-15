import api from './api-unified'

function isClinicRestrictionMessage(message) {
  const text = String(message || '').toLowerCase()
  return text.includes('another clinic') || text.includes('other clinic') || text.includes('active_clinic_id') || text.includes('lab')
}

function normalizeError(message) {
  const text = String(message || '').toLowerCase()
  if (isClinicRestrictionMessage(text)) {
    return 'لا يمكن الدخول لأن الحساب مرتبط بعيادة أخرى'
  }
  if (text.includes('invalid') || text.includes('wrong') || text.includes('incorrect') || text.includes('password') || text.includes('credential')) {
    return 'بيانات الدخول غير صحيحة'
  }
  return message || 'حدث خطأ غير متوقع'
}

function patchDoctorLogin() {
  if (typeof api.doctorLogin !== 'function' || api.doctorLogin.__mmcFallbackPatched) return

  const original = api.doctorLogin.bind(api)
  const patched = async (username, password) => {
    const result = await original(username, password)

    if (result?.success && result?.data) {
      return result
    }

    const fallback = await api.adminLogin(username, password).catch(() => null)
    if (fallback?.success && fallback?.data) {
      return {
        success: true,
        role: fallback.role || fallback.data.role || 'DOCTOR',
        data: fallback.data,
      }
    }

    const normalized = normalizeError(result?.error || result?.message || fallback?.error || fallback?.message)
    throw new Error(normalized)
  }

  patched.__mmcFallbackPatched = true
  api.doctorLogin = patched
}

patchDoctorLogin()

export default null

import api from './api-unified'

function normalizeAuthMessage(message, fallback) {
  const text = String(message || '').trim()
  if (!text) return fallback
  return text.includes('401') ? text : `401 ${text}`
}

function patchDoctorLogin() {
  if (typeof api.doctorLogin !== 'function' || api.doctorLogin.__mmcPatched) return

  const original = api.doctorLogin.bind(api)
  const patched = async (...args) => {
    const result = await original(...args)
    if (result && result.success === false) {
      const message = normalizeAuthMessage(result.error || result.message || 'Invalid credentials', '401 Invalid credentials')
      console.error(message)
      throw new Error(message)
    }
    return result
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
      const message = normalizeAuthMessage(result.error || result.message || 'Invalid credentials', '401 Invalid credentials')
      console.error(message)
      throw new Error(message)
    }
    return result
  }

  patched.__mmcPatched = true
  api.adminLogin = patched
}

patchDoctorLogin()
patchAdminLogin()

export default null

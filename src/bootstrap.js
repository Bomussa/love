import api from '../frontend/src/lib/api-unified.js'
import { supabase } from '../frontend/src/lib/supabase-client.js'

async function sha256(text) {
  const bytes = new TextEncoder().encode(String(text || '').trim())
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

const originalDoctorLogin = typeof api.doctorLogin === 'function' ? api.doctorLogin.bind(api) : null
api.doctorLogin = async (username, password) => {
  const u = String(username || '').trim().toLowerCase()
  const p = String(password || '').trim()
  try {
    if (originalDoctorLogin) {
      const result = await originalDoctorLogin(u, p)
      if (result?.success && result?.data) return result
    }
  } catch {}

  const { data: doctor } = await supabase.from('doctors').select('*').eq('username', u).eq('is_active', true).maybeSingle()
  if (!doctor) return { success: false, error: 'Invalid doctor credentials' }

  let ok = false
  if (doctor.password_hash) ok = doctor.password_hash === p || doctor.password_hash === await sha256(p)
  else if (typeof doctor.password === 'string') ok = doctor.password === p

  if (!ok) return { success: false, error: 'Invalid doctor credentials' }
  return { success: true, role: doctor.role || 'DOCTOR', data: doctor }
}

if (typeof window !== 'undefined' && window.location.hostname === 'www.mmc-mms.com') {
  window.location.replace(`https://mmc-mms.com${window.location.pathname}${window.location.search}${window.location.hash}`)
}

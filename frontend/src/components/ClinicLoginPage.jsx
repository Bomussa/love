import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
import { Shield, ArrowRight, Stethoscope, User, Lock } from 'lucide-react'
import api from '../lib/api-unified'

const connectionFailure = (message) => {
  const value = String(message || '').toLowerCase()
  return value.includes('server unreachable')
    || value.includes('failed to fetch')
    || value.includes('network')
    || value.includes('timeout')
    || value.includes('abort')
}

export function ClinicLoginPage({ onLogin, language, toggleLanguage }) {
  const [clinics, setClinics] = useState([])
  const [selectedClinic, setSelectedClinic] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    void loadClinics()
  }, [])

  const loadClinics = async () => {
    try {
      const response = await api.getClinics()
      if (response?.success) {
        const items = Array.isArray(response.data)
          ? response.data
          : Array.isArray(response.clinics)
            ? response.clinics
            : []
        setClinics(items.filter((clinic) => clinic?.is_active !== false))
        setError(null)
      } else {
        setError(language === 'ar' ? 'تعذر تحميل قائمة العيادات' : 'Unable to load clinics')
      }
    } catch (err) {
      console.error('[ClinicLoginPage] Failed to load clinics:', err)
      setError(language === 'ar' ? 'خطأ في الاتصال' : 'Connection error')
    }
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    if (!selectedClinic || !username.trim() || !password) return

    setLoading(true)
    setError(null)

    try {
      const response = await api.doctorLogin(username.trim(), password)
      if (!response?.success || !response?.data?.token) {
        const message = response?.error || response?.message || ''
        setError(
          connectionFailure(message)
            ? (language === 'ar' ? 'خطأ في الاتصال' : 'Connection error')
            : (language === 'ar' ? 'اسم المستخدم أو كلمة المرور غير صحيحة' : 'Invalid username or password'),
        )
        return
      }

      const doctor = response.data
      const assignedClinicIds = new Set([
        doctor.clinic_id,
        doctor.clinicId,
        ...(Array.isArray(doctor.clinic_ids) ? doctor.clinic_ids : []),
        ...(Array.isArray(doctor.assigned_clinics) ? doctor.assigned_clinics : []),
      ].filter(Boolean).map(String))

      if (!assignedClinicIds.has(String(selectedClinic))) {
        setError(language === 'ar' ? 'هذا الحساب غير مرتبط بالعيادة المختارة' : 'This account is not assigned to the selected clinic')
        return
      }

      const clinic = clinics.find((item) => String(item.id) === String(selectedClinic))
      onLogin({
        ...doctor,
        role: 'DOCTOR',
        clinic_id: selectedClinic,
        clinicId: selectedClinic,
        clinic_name: clinic?.name_ar || clinic?.name_en || clinic?.name || selectedClinic,
        clinicName: clinic?.name_ar || clinic?.name_en || clinic?.name || selectedClinic,
      })
    } catch (err) {
      console.error('[ClinicLoginPage] Login failed:', err)
      setError(
        connectionFailure(err?.message)
          ? (language === 'ar' ? 'خطأ في الاتصال' : 'Connection error')
          : (language === 'ar' ? 'تعذر تسجيل الدخول' : 'Unable to sign in'),
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0b0b0f]" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <Card className="w-full max-w-md bg-[#12121a] border-white/10">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <img src="/mms-logo.png" alt="قيادة الخدمات الطبية" className="w-16 h-16 object-contain" />
          </div>
          <CardTitle className="flex items-center gap-2 text-white justify-center">
            <Shield className="w-6 h-6 text-[#C9A54C]" />
            {language === 'ar' ? 'دخول لوحة العيادة' : 'Clinic Dashboard Login'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Stethoscope className="inline w-4 h-4 ml-1 text-[#C9A54C]" />
                {language === 'ar' ? 'اختر العيادة' : 'Select Clinic'}
              </label>
              <select
                value={selectedClinic}
                onChange={(event) => setSelectedClinic(event.target.value)}
                className="w-full bg-[#1a1a2e] border border-white/10 text-white rounded-xl p-3 focus:outline-none focus:border-[#C9A54C]/50"
                required
              >
                <option value="">{language === 'ar' ? 'اختر العيادة...' : 'Select Clinic...'}</option>
                {clinics.map((clinic) => (
                  <option key={clinic.id} value={clinic.id}>
                    {language === 'ar'
                      ? (clinic.name_ar || clinic.name_en || clinic.name || clinic.id)
                      : (clinic.name_en || clinic.name_ar || clinic.name || clinic.id)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <User className="inline w-4 h-4 ml-1 text-[#C9A54C]" />
                {language === 'ar' ? 'اسم المستخدم' : 'Username'}
              </label>
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                className="w-full bg-[#1a1a2e] border border-white/10 text-white rounded-xl p-3 focus:outline-none focus:border-[#C9A54C]/50"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Lock className="inline w-4 h-4 ml-1 text-[#C9A54C]" />
                {language === 'ar' ? 'كلمة المرور' : 'Password'}
              </label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                className="w-full bg-[#1a1a2e] border border-white/10 text-white rounded-xl p-3 focus:outline-none focus:border-[#C9A54C]/50"
                required
              />
            </div>

            {error && (
              <div className="text-red-400 text-sm bg-red-900/20 p-3 rounded-xl border border-red-500/20">
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="gradient"
              className="w-full h-12 text-base font-semibold"
              disabled={loading || !selectedClinic || !username.trim() || !password}
            >
              {loading ? (
                <span className="animate-pulse">{language === 'ar' ? 'جارٍ الدخول...' : 'Logging in...'}</span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  {language === 'ar' ? 'دخول' : 'Login'}
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default ClinicLoginPage

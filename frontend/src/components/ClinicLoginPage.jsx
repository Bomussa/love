import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
import { Shield, ArrowRight, Stethoscope } from 'lucide-react'
import api from '../lib/api-unified'

export function ClinicLoginPage({ onLogin, language, toggleLanguage }) {
  const [clinics, setClinics] = useState([])
  const [selectedClinic, setSelectedClinic] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadClinics()
  }, [])

  const loadClinics = async () => {
    try {
      const response = await api.getClinics()
      if (response.success) {
        setClinics(response.clinics)
      }
    } catch (err) {
      console.error('Failed to load clinics', err)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!selectedClinic) return

    setLoading(true)
    setError(null)

    try {
      const response = await api.verifyClinicAccess(selectedClinic)
      if (response.success && response.isValid) {
        onLogin(response.session)
      } else {
        setError(language === 'ar' ? 'العيادة غير موجودة' : 'Clinic not found')
      }
    } catch (err) {
      setError(language === 'ar' ? 'خطأ في الاتصال' : 'Connection error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0b0b0f]">
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
                <Stethoscope className="inline w-4 h-4 mr-1 text-[#C9A54C]" />
                {language === 'ar' ? 'اختر العيادة' : 'Select Clinic'}
              </label>
              <select
                value={selectedClinic}
                onChange={(e) => setSelectedClinic(e.target.value)}
                className="w-full bg-[#1a1a2e] border border-white/10 text-white rounded-xl p-3 focus:outline-none focus:border-[#C9A54C]/50"
                required
              >
                <option value="">{language === 'ar' ? 'اختر العيادة...' : 'Select Clinic...'}</option>
                {clinics.map(c => (
                  <option key={c.id} value={c.id}>
                    {language === 'ar' ? (c.name_ar || c.name_en) : (c.name_en || c.name_ar)}
                  </option>
                ))}
              </select>
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
              disabled={loading || !selectedClinic}
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

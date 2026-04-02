
import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
import { Input } from './Input'
import { Shield, ArrowRight } from 'lucide-react'
import { t } from '../lib/i18n'
import api from '../lib/api-unified'
import { enhancedMedicalThemes } from '../lib/enhanced-themes'

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
      // PIN system removed - login directly with clinic selection
      // Return a session object with clinic info
      const clinic = clinics.find(c => c.id === selectedClinic)
      if (clinic) {
        onLogin({
          clinic_id: selectedClinic,
          clinic_name: language === 'ar' ? clinic.name_ar : clinic.name_en
        })
      } else {
        setError(language === 'ar' ? 'فشل الدخول للعيادة' : 'Failed to login to clinic')
      }
    } catch (err) {
      setError(language === 'ar' ? 'خطأ في الاتصال' : 'Connection error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Shield className="w-6 h-6 text-blue-500" />
            {language === 'ar' ? 'دخول العيادة' : 'Clinic Login'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                {language === 'ar' ? 'العيادة' : 'Clinic'}
              </label>
              <select
                value={selectedClinic}
                onChange={(e) => setSelectedClinic(e.target.value)}
                className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-2"
                required
              >
                <option value="">{language === 'ar' ? 'اختر العيادة...' : 'Select Clinic...'}</option>
                {clinics.map(c => (
                  <option key={c.id} value={c.id}>
                    {language === 'ar' ? c.name_ar : c.name_en}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="text-red-400 text-sm bg-red-900/20 p-2 rounded">
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="gradient"
              className="w-full"
              disabled={loading || !selectedClinic}
            >
              {loading ? (
                <span className="animate-pulse">...</span>
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

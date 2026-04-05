import React, { useState } from 'react'
import { Card, CardContent } from './Card'
import { Button } from './Button'
import { Input } from './Input'
import { User, Globe, Shield, QrCode, BarChart3, AlertCircle } from 'lucide-react'
import { enhancedMedicalThemes } from '../lib/enhanced-themes'
import { t } from '../lib/i18n'
import { logPatientRegistered, logAdminLogin } from '../lib/activityLogger'
import { QRScanner } from './QRScanner'
import featuresConfig from '../../config/features.json'
import LiveStatisticsPanel from './LiveStatisticsPanel'
import { normalizeNumerals, validateMilitaryId, validateAdminData, sanitizeInput } from '../lib/validation'

export function LoginPage({ onLogin, onAdminLogin, currentTheme, onThemeChange, language, toggleLanguage }) {
  const [patientId, setPatientId] = useState('')
  const [gender, setGender] = useState('male')
  const [loading, setLoading] = useState(false)
  const [isAdminMode, setIsAdminMode] = useState(false)
  const [adminUsername, setAdminUsername] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [showQRScanner, setShowQRScanner] = useState(false)
  const [showStatistics, setShowStatistics] = useState(false)
  const [validationError, setValidationError] = useState('')

  const handlePatientIdChange = (e) => {
    const normalized = normalizeNumerals(e.target.value)
    setPatientId(normalized);
  }

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    setValidationError('')
    const sanitizedId = sanitizeInput(patientId)
    const validation = validateMilitaryId(sanitizedId)
    if (!validation.isValid) {
      setValidationError(validation.error)
      return
    }
    setLoading(true)
    try {
      logPatientRegistered({ militaryId: sanitizedId, gender })
      await onLogin({ patientId: sanitizedId, gender })
    } catch (error) {
      setValidationError(language === 'ar' ? 'حدث خطأ في تسجيل الدخول' : 'Login error')
    } finally {
      setLoading(false)
    }
  }

  const handleAdminSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    setValidationError('')
    const validation = validateAdminData({
      username: sanitizeInput(adminUsername),
      password: adminPassword
    })
    if (!validation.isValid) {
      setValidationError(validation.errors[0])
      return
    }
    setLoading(true)
    try {
      const sanitizedUsername = sanitizeInput(adminUsername)
      logAdminLogin(sanitizedUsername)
      // إرسال البيانات فوراً لضمان الدخول من المرة الأولى
      await onAdminLogin(`${sanitizedUsername}:${adminPassword.trim()}`)
    } catch (error) {
      setValidationError(language === 'ar' ? 'خطأ في البيانات' : 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden w-full max-w-full">
      <div className="w-full max-w-md mx-auto space-y-8">
        <div className="absolute top-4 left-4 z-50 flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-300 hover:text-white"
            onClick={() => setShowStatistics(true)}
          >
            <BarChart3 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-300 hover:text-white"
            onClick={toggleLanguage}
          >
            <Globe className="w-4 h-4 mr-2" />
            {language === 'ar' ? 'English 🇺🇸' : 'العربية 🇶🇦'}
          </Button>
        </div>
        
        {onAdminLogin && (
          <div className="absolute top-4 right-4 z-50">
            <Button
              variant="ghost"
              size="sm"
              className="text-yellow-400 hover:text-yellow-300 border border-yellow-600/50"
              onClick={() => setIsAdminMode(!isAdminMode)}
            >
              <Shield className="w-4 h-4 mr-2" />
              {language === 'ar' ? 'الإدارة' : 'Admin'}
            </Button>
          </div>
        )}

        <div className="text-center space-y-2">
          <img src="/mms-logo.png" alt="Logo" className="mx-auto w-24 h-24 object-contain" />
          <div>
            <h1 className="text-xl font-bold text-white">
              {language === 'ar' ? 'اللجنة الطبية العسكرية' : 'Military Medical Committee'}
            </h1>
            <p className="text-sm text-[#C9A54C] font-semibold mt-1">
              {language === 'ar' ? 'قيادة الخدمات الطبية العسكرية' : 'Military Medical Services Command'}
            </p>
          </div>
        </div>

        <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm">
          <CardContent className="p-8">
            <div className="mb-6">
              <div className="flex flex-wrap justify-center gap-2">
                {enhancedMedicalThemes.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => onThemeChange(theme.id)}
                    className={`px-2 py-1.5 rounded-full text-xs font-medium transition-all border ${currentTheme === theme.id ? 'bg-theme-primary text-white' : 'bg-gray-800/60 text-gray-300 border-gray-700'}`}
                  >
                    {language === 'ar' ? theme.nameAr : theme.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-center mb-6">
              {isAdminMode ? <Shield className="mx-auto w-12 h-12 text-yellow-400 mb-4" /> : <User className="mx-auto w-12 h-12 text-gray-400 mb-4" />}
              <h2 className="text-xl font-semibold text-white">
                {isAdminMode ? (language === 'ar' ? 'دخول الإدارة' : 'Admin Access') : t('welcome', language)}
              </h2>
            </div>

            {!isAdminMode ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-300">{t('personalNumber', language)}</label>
                    {featuresConfig?.features?.qr_enabled && (
                      <button type="button" onClick={() => setShowQRScanner(true)} className="flex items-center gap-1 text-xs text-blue-400">
                        <QrCode className="w-4 h-4" />
                        {language === 'ar' ? 'مسح الباركود' : 'Scan QR'}
                      </button>
                    )}
                  </div>
                  <Input
                    type="text"
                    placeholder={t('enterPersonalNumber', language)}
                    value={patientId}
                    onChange={handlePatientIdChange}
                    className="bg-gray-700/50 border-gray-600 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">{t('gender', language)}</label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button type="button" variant={gender === 'male' ? 'gradient' : 'outline'} className="h-12" onClick={() => setGender('male')}>
                      👨 {t('male', language)}
                    </Button>
                    <Button type="button" variant={gender === 'female' ? 'gradient' : 'outline'} className="h-12" onClick={() => setGender('female')}>
                      👩 {t('female', language)}
                    </Button>
                  </div>
                </div>
                {validationError && <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" />{validationError}</div>}
                <Button type="submit" variant="gradientPrimary" className="w-full h-12 text-lg font-bold" disabled={loading}>
                  {loading ? t('loading', language) : (language === 'ar' ? 'تأكيد ←' : 'Confirm →')}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleAdminSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">{language === 'ar' ? 'اسم المستخدم' : 'Username'}</label>
                  <Input
                    type="text"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    className="bg-gray-700/50 border-gray-600 text-white"
                    placeholder="bomussa"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">{language === 'ar' ? 'كلمة المرور' : 'Password'}</label>
                  <Input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="bg-gray-700/50 border-gray-600 text-white"
                    placeholder="••••••••"
                    required
                  />
                </div>
                {validationError && <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" />{validationError}</div>}
                <Button type="submit" variant="gradientSecondary" className="w-full h-12 text-lg font-bold" disabled={loading}>
                  {loading ? t('loading', language) : (language === 'ar' ? 'دخول الإدارة' : 'Admin Login')}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      {showQRScanner && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
          <div className="p-4 flex justify-between items-center bg-gray-900 border-b border-gray-800">
            <h3 className="text-white font-bold">{language === 'ar' ? 'مسح الباركود' : 'Scan QR Code'}</h3>
            <Button variant="ghost" className="text-white" onClick={() => setShowQRScanner(false)}>✕</Button>
          </div>
          <div className="flex-1 relative">
            <QRScanner
              onResult={(result) => {
                setPatientId(normalizeNumerals(result))
                setShowQRScanner(false)
              }}
              onError={(err) => console.error(err)}
            />
          </div>
        </div>
      )}

      {showStatistics && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md p-4 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">{language === 'ar' ? 'إحصائيات النظام الحية' : 'Live System Statistics'}</h2>
              <Button variant="outline" className="text-white border-white/30" onClick={() => setShowStatistics(false)}>✕</Button>
            </div>
            <LiveStatisticsPanel language={language} />
          </div>
        </div>
      )}
    </div>
  )
}

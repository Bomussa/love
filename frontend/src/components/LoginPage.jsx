import React, { useState } from 'react'
import { Card, CardContent } from './Card'
import { Button } from './Button'
import { Input } from './Input'
import { User, Globe, Shield, Stethoscope, AlertCircle } from 'lucide-react'
import { t } from '../lib/i18n'
import { logPatientRegistered, logAdminLogin } from '../lib/activityLogger'
import { normalizeNumerals, sanitizeInput, validateMilitaryId, validateAdminData } from '../lib/validation'

export function LoginPage({ onLogin, onAdminLogin, onDoctorLogin, language, toggleLanguage }) {
  const [patientId, setPatientId] = useState('')
  const [gender, setGender] = useState('male')
  const [loading, setLoading] = useState(false)
  const [isAdminMode, setIsAdminMode] = useState(false)
  const [isDoctorMode, setIsDoctorMode] = useState(false)
  const [adminUsername, setAdminUsername] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [validationError, setValidationError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setValidationError('')
    const sanitizedId = sanitizeInput(normalizeNumerals(patientId))
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
      setValidationError(language === 'ar' ? 'حدث خطأ في تسجيل الدخول' : 'Login error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleAdminSubmit = async (e) => {
    e.preventDefault()
    setValidationError('')
    const validation = validateAdminData({ username: sanitizeInput(adminUsername), password: adminPassword })
    
    if (!validation.isValid) {
      setValidationError(validation.errors[0])
      return
    }

    setLoading(true)
    try {
      logAdminLogin(sanitizeInput(adminUsername))
      await onAdminLogin(`${sanitizeInput(adminUsername)}:${adminPassword.trim()}`)
    } catch (error) {
      setValidationError(language === 'ar' ? 'خطأ في اسم المستخدم أو كلمة المرور' : 'Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-start pt-12 px-4 relative" 
         style={{ background: 'linear-gradient(180deg, #8A1538 0%, #C9A54C 100%)' }}>
      
      {/* Top Navigation */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-8">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="border-white/20 text-white bg-white/10" onClick={toggleLanguage}>
            <Globe className="w-4 h-4 mr-2" />
            {language === 'ar' ? 'English 🇺🇸' : 'العربية 🇶🇦'}
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="border-white/20 text-white bg-white/10" onClick={() => { setIsDoctorMode(true); setIsAdminMode(false); }}>
            <Stethoscope className="w-4 h-4 mr-2" />
            {language === 'ar' ? 'الطبيب' : 'Doctor'}
          </Button>
          <Button variant="outline" size="sm" className="border-white/20 text-white bg-white/10" onClick={() => { setIsAdminMode(true); setIsDoctorMode(false); }}>
            <Shield className="w-4 h-4 mr-2" />
            {language === 'ar' ? 'الإدارة' : 'Admin'}
          </Button>
        </div>
      </div>

      {/* Logo and Title */}
      <div className="text-center mb-8">
        <img src="/mms-logo.png" alt="Logo" className="mx-auto w-32 h-32 object-contain mb-4" />
        <h1 className="text-3xl font-bold text-white mb-2">
          {language === 'ar' ? 'اللجنة الطبية العسكرية' : 'Military Medical Committee'}
        </h1>
        <p className="text-xl text-[#C9A54C] font-semibold">
          {language === 'ar' ? 'قيادة الخدمات الطبية العسكرية' : 'Military Medical Services Command'}
        </p>
        <p className="text-white/80 text-sm mt-1">
          {language === 'ar' ? 'المركز الطبي التخصصي العسكري - العطار' : 'Military Specialized Medical Center – Al-Attar'}
        </p>
      </div>

      {/* Main Card */}
      <Card className="w-full max-w-md bg-black/30 border-white/10 backdrop-blur-md">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="bg-white/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              {isAdminMode ? <Shield className="w-8 h-8 text-[#C9A54C]" /> : isDoctorMode ? <Stethoscope className="w-8 h-8 text-[#C9A54C]" /> : <User className="w-8 h-8 text-white" />}
            </div>
            <h2 className="text-2xl font-bold text-white">
              {isAdminMode ? (language === 'ar' ? 'دخول الإدارة' : 'Admin Login') : isDoctorMode ? (language === 'ar' ? 'دخول الطبيب' : 'Doctor Login') : (language === 'ar' ? 'مرحباً بك في نظام اللجنة الطبية' : 'Welcome to MMC System')}
            </h2>
          </div>

          {!isAdminMode && !isDoctorMode ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  {language === 'ar' ? 'الرقم الشخصي / العسكري' : 'Personal / Military ID'}
                </label>
                <Input
                  type="text"
                  placeholder={language === 'ar' ? 'أدخل الرقم الشخصي أو العسكري' : 'Enter ID number'}
                  value={patientId}
                  onChange={(e) => setPatientId(normalizeNumerals(e.target.value))}
                  className="bg-white/10 border-white/20 text-white placeholder-white/40 h-12"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-3">
                  {language === 'ar' ? 'الجنس' : 'Gender'}
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    type="button"
                    variant={gender === 'male' ? 'default' : 'outline'}
                    className={`h-12 text-lg ${gender === 'male' ? 'bg-[#8A1538] hover:bg-[#6B0F2A]' : 'border-white/20 text-white'}`}
                    onClick={() => setGender('male')}
                  >
                    👨 {language === 'ar' ? 'ذكر' : 'Male'}
                  </Button>
                  <Button
                    type="button"
                    variant={gender === 'female' ? 'default' : 'outline'}
                    className={`h-12 text-lg ${gender === 'female' ? 'bg-[#8A1538] hover:bg-[#6B0F2A]' : 'border-white/20 text-white'}`}
                    onClick={() => setGender('female')}
                  >
                    👩 {language === 'ar' ? 'أنثى' : 'Female'}
                  </Button>
                </div>
              </div>

              {validationError && (
                <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {validationError}
                </div>
              )}

              <Button type="submit" className="w-full h-12 text-xl font-bold bg-[#8A1538] hover:bg-[#6B0F2A] text-white" disabled={loading}>
                {loading ? (language === 'ar' ? 'جاري المعالجة...' : 'Processing...') : (language === 'ar' ? 'تأكيد ←' : 'Confirm →')}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleAdminSubmit} className="space-y-6">
              <Input
                type="text"
                placeholder={language === 'ar' ? 'اسم المستخدم' : 'Username'}
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                className="bg-white/10 border-white/20 text-white h-12"
                required
              />
              <Input
                type="password"
                placeholder={language === 'ar' ? 'كلمة المرور' : 'Password'}
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="bg-white/10 border-white/20 text-white h-12"
                required
              />
              <Button type="submit" className="w-full h-12 text-xl font-bold bg-[#8A1538] hover:bg-[#6B0F2A] text-white" disabled={loading}>
                {language === 'ar' ? 'دخول' : 'Login'}
              </Button>
              <Button type="button" variant="ghost" className="w-full text-white/60" onClick={() => { setIsAdminMode(false); setIsDoctorMode(false); }}>
                {language === 'ar' ? 'رجوع' : 'Back'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

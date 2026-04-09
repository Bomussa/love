import React, { useState } from 'react'
import { Card, CardContent } from './Card'
import { Button } from './Button'
import { Input } from './Input'
import { User, Globe, Shield, QrCode, BarChart3, AlertCircle, Stethoscope } from 'lucide-react'
import { enhancedMedicalThemes } from '../lib/enhanced-themes'
import { t } from '../lib/i18n'
import { logPatientRegistered, logAdminLogin } from '../lib/activityLogger'
import { QRScanner } from './QRScanner'
import featuresConfig from '../config/features.json'
import LiveStatisticsPanel from './LiveStatisticsPanel'
import { validateMilitaryId, validateAdminData, sanitizeInput } from '../lib/validation'

export function LoginPage({ onLogin, onAdminLogin, onDoctorLogin, currentTheme, onThemeChange, language, toggleLanguage }) {
  const [patientId, setPatientId] = useState('')
  const [gender, setGender] = useState('male')
  const [loading, setLoading] = useState(false)
  const [isAdminMode, setIsAdminMode] = useState(false)
  const [isDoctorMode, setIsDoctorMode] = useState(false)
  const [adminUsername, setAdminUsername] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [showQRScanner, setShowQRScanner] = useState(false)
  const [showStatistics, setShowStatistics] = useState(false)
  const [validationError, setValidationError] = useState('')
  const [showUsageGuide, setShowUsageGuide] = useState(false)

  // تحويل الأرقام العربية إلى إنجليزية
  const normalizeArabicNumbers = (str) => {
    const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    const englishNumbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    
    let result = str;
    for (let i = 0; i < arabicNumbers.length; i++) {
      result = result.replace(new RegExp(arabicNumbers[i], 'g'), englishNumbers[i]);
    }
    return result;
  }

  // معالج تغيير رقم المراجع
  const handlePatientIdChange = (e) => {
    const normalized = normalizeArabicNumbers(e.target.value);
    setPatientId(normalized);
  }

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) {
      e.preventDefault()
    }
    setValidationError('')
    
    const inputElement = document.querySelector('input[type="text"]')
    const currentPatientId = inputElement ? inputElement.value : patientId
    
    const sanitizedId = sanitizeInput(currentPatientId || patientId)
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
      await onAdminLogin(`${sanitizedUsername}:${adminPassword.trim()}`)
    } catch (error) {
      setValidationError(language === 'ar' ? 'خطأ في اسم المستخدم أو كلمة المرور' : 'Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  const handleDoctorSubmit = async (e) => {
    e.preventDefault()
    setValidationError('')

    if (!adminUsername.trim() || !adminPassword.trim()) {
      setValidationError(language === 'ar' ? 'يرجى إدخال اسم المستخدم وكلمة المرور' : 'Please enter username and password')
      return
    }

    setLoading(true)
    try {
      await onDoctorLogin(`${sanitizeInput(adminUsername)}:${adminPassword.trim()}`)
    } catch (error) {
      setValidationError(language === 'ar' ? 'خطأ في اسم المستخدم أو كلمة المرور' : 'Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen max-h-screen flex items-center justify-center p-4 relative overflow-hidden w-full max-w-full" style={{overflowY: "auto", overflowX: "hidden"}}>
      <div className="w-full max-w-md mx-auto space-y-8">
        {/* Language Selector (Left) and Admin Access (Right) */}
        <div className="absolute top-4 left-4 z-50 flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-300 hover:text-white hover:bg-gray-800/50"
            onClick={() => setShowStatistics(true)}
            title={language === 'ar' ? 'الإحصائيات' : 'Statistics'}
          >
            <BarChart3 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-300 hover:text-white hover:bg-gray-800/50"
            onClick={toggleLanguage}
          >
            <Globe className="w-4 h-4 mr-2" />
            {language === 'ar' ? 'English 🇺🇸' : 'العربية 🇶🇦'}
          </Button>
        </div>
        
        {onAdminLogin && (
          <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
            {!isAdminMode && (
              <div className="relative">
                <button
                  onClick={() => setShowUsageGuide(!showUsageGuide)}
                  className="flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white rounded-lg px-2 py-1 transition-all duration-200 border border-white/10"
                  title={language === 'ar' ? 'طريقة الاستخدام' : 'How to use'}
                >
                  <span className="text-sm">ℹ️</span>
                  <span className="text-[10px] font-medium leading-tight max-w-[70px] text-right">
                    {language === 'ar' ? 'تعليمات الدخول' : 'Instructions'}
                  </span>
                </button>
                {showUsageGuide && (
                  <div className="absolute top-10 right-0 z-50 w-60">
                    <div className="bg-gray-900/95 rounded-xl shadow-2xl p-4 text-white border border-white/20 backdrop-blur-sm">
                      <button
                        onClick={() => setShowUsageGuide(false)}
                        className="absolute top-2 left-2 text-white/60 hover:text-white text-base font-bold"
                      >×</button>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">👋</span>
                        <h3 className="text-xs font-bold">{language === 'ar' ? 'طريقة الاستخدام' : 'How to use'}</h3>
                      </div>
                      <div className="text-xs leading-relaxed space-y-1 text-white/90">
                        {language === 'ar' ? (
                          <>
                            <div>1️⃣ أدخل رقمك الشخصي أو العسكري</div>
                            <div>2️⃣ اختر الجنس (ذكر / أنثى)</div>
                            <div>3️⃣ اضغط تأكيد لأخذ دورك</div>
                            <div>4️⃣ تابع رقم دورك على الشاشة</div>
                            <div>5️⃣ ادخل العيادة عند مناداتك</div>
                          </>
                        ) : (
                          <>
                            <div>1️⃣ Enter your personal or military ID</div>
                            <div>2️⃣ Select gender (Male / Female)</div>
                            <div>3️⃣ Press confirm to get your turn</div>
                            <div>4️⃣ Watch your number on screen</div>
                            <div>5️⃣ Enter clinic when called</div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 border border-blue-600/50"
              onClick={() => {
                setIsDoctorMode(!isDoctorMode)
                setIsAdminMode(false)
              }}
              title={language === 'ar' ? 'دخول الطبيب' : 'Doctor Login'}
            >
              <Stethoscope className="w-4 h-4 mr-2" />
              {language === 'ar' ? 'الطبيب' : 'Doctor'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900/30 border border-yellow-600/50"
              onClick={() => {
                setIsAdminMode(!isAdminMode)
                setIsDoctorMode(false)
              }}
              title={language === 'ar' ? 'دخول الإدارة' : 'Admin Login'}
            >
              <Shield className="w-4 h-4 mr-2" />
              {language === 'ar' ? 'الإدارة' : 'Admin'}
            </Button>
          </div>
        )}

        <div className="text-center space-y-2">
          <img src="/mms-logo.png" alt="اللجنة الطبية العسكرية" className="mx-auto w-24 h-24 object-contain" />
          <div>
            <h1 className="text-xl font-bold text-white">
              {language === 'ar' ? 'اللجنة الطبية العسكرية' : 'Military Medical Committee'}
            </h1>
            <p className="text-sm text-[#C9A54C] font-semibold mt-1">
              {language === 'ar' ? 'قيادة الخدمات الطبية العسكرية' : 'Military Medical Services Command'}
            </p>
            <p className="text-gray-400 text-xs mt-1">
              {language === 'ar'
                ? 'المركز الطبي التخصصي العسكري - العطار'
                : 'Military Specialized Medical Center – Al-Attar'}
            </p>
          </div>
        </div>

        <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-xl shadow-2xl">
          <CardContent className="p-6">
            {isAdminMode || isDoctorMode ? (
              <form onSubmit={isDoctorMode ? handleDoctorSubmit : handleAdminSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">
                    {language === 'ar' ? 'اسم المستخدم' : 'Username'}
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      type="text"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      className="pl-10 bg-gray-800/50 border-gray-700 text-white"
                      placeholder={language === 'ar' ? 'أدخل اسم المستخدم' : 'Enter username'}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">
                    {language === 'ar' ? 'كلمة المرور' : 'Password'}
                  </label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="pl-10 bg-gray-800/50 border-gray-700 text-white"
                      placeholder={language === 'ar' ? 'أدخل كلمة المرور' : 'Enter password'}
                      required
                    />
                  </div>
                </div>
                {validationError && (
                  <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {validationError}
                  </div>
                )}
                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-6"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {language === 'ar' ? 'جاري التحقق...' : 'Verifying...'}
                    </div>
                  ) : (
                    language === 'ar' ? 'تسجيل الدخول' : 'Login'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-gray-400 hover:text-white"
                  onClick={() => {
                    setIsAdminMode(false)
                    setIsDoctorMode(false)
                    setValidationError('')
                  }}
                >
                  {language === 'ar' ? 'العودة لتسجيل المراجعين' : 'Back to Patient Login'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">
                      {language === 'ar' ? 'الرقم الشخصي أو العسكري' : 'Personal or Military ID'}
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={patientId}
                        onChange={handlePatientIdChange}
                        className="pl-10 py-6 bg-gray-800/50 border-gray-700 text-white text-lg font-bold tracking-wider"
                        placeholder={language === 'ar' ? 'أدخل رقمك هنا' : 'Enter your ID here'}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setGender('male')}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-2 ${
                        gender === 'male'
                          ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                          : 'bg-gray-800/30 border-gray-700 text-gray-500 hover:border-gray-600'
                      }`}
                    >
                      <span className="text-2xl">👨</span>
                      <span className="font-bold">{language === 'ar' ? 'ذكر' : 'Male'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender('female')}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-2 ${
                        gender === 'female'
                          ? 'bg-pink-600/20 border-pink-500 text-pink-400'
                          : 'bg-gray-800/30 border-gray-700 text-gray-500 hover:border-gray-600'
                      }`}
                    >
                      <span className="text-2xl">👩</span>
                      <span className="font-bold">{language === 'ar' ? 'أنثى' : 'Female'}</span>
                    </button>
                  </div>
                </div>

                {validationError && (
                  <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {validationError}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-8 text-xl shadow-lg shadow-blue-900/20"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                      {language === 'ar' ? 'جاري تسجيل دورك...' : 'Registering...'}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <QrCode className="w-6 h-6" />
                      {language === 'ar' ? 'تأكيد وأخذ دور' : 'Confirm & Get Ticket'}
                    </div>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="text-center">
          <p className="text-gray-500 text-xs">
            {language === 'ar' 
              ? '© ٢٠٢٦ اللجنة الطبية العسكرية - جميع الحقوق محفوظة' 
              : '© 2026 Military Medical Committee - All Rights Reserved'}
          </p>
        </div>
      </div>

      {showStatistics && (
        <LiveStatisticsPanel 
          onClose={() => setShowStatistics(false)} 
          language={language}
        />
      )}
    </div>
  )
}

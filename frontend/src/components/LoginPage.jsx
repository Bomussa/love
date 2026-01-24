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
import { validateMilitaryId, validateAdminData, sanitizeInput } from '../lib/validation'

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
    console.log('=== handleSubmit CALLED ===')
    setValidationError('')
    
    // قراءة القيمة من DOM مباشرة للتأكد من الحصول على القيمة الصحيحة
    const inputElement = document.querySelector('input[type="text"]')
    const currentPatientId = inputElement ? inputElement.value : patientId
    console.log('=== handleSubmit START ===', { patientId, currentPatientId, gender })
    
    // التحقق من صحة الرقم العسكري
    const sanitizedId = sanitizeInput(currentPatientId || patientId)
    const validation = validateMilitaryId(sanitizedId)
    
    if (!validation.isValid) {
      console.log('=== Validation FAILED ===', validation.error)
      setValidationError(validation.error)
      return
    }
    console.log('=== Validation PASSED ===')

    setLoading(true)
    try {
      // تسجيل دخول المراجع
      logPatientRegistered({ militaryId: sanitizedId, gender })
      
      console.log('=== Calling onLogin ===')
      await onLogin({ patientId: sanitizedId, gender })
      console.log('=== onLogin SUCCESS ===')
    } catch (error) {
      console.error('=== onLogin ERROR ===', error)
      setValidationError(language === 'ar' ? 'حدث خطأ في تسجيل الدخول' : 'Login error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleAdminSubmit = async (e) => {
    e.preventDefault()
    setValidationError('')
    
    // التحقق من صحة بيانات الإدارة
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
      // تسجيل دخول الإدارة
      const sanitizedUsername = sanitizeInput(adminUsername)
      logAdminLogin(sanitizedUsername)
      
      // إرسال username:password كرمز واحد
      await onAdminLogin(`${sanitizedUsername}:${adminPassword.trim()}`)
    } catch (error) {
      setValidationError(language === 'ar' ? 'خطأ في اسم المستخدم أو كلمة المرور' : 'Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
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
        
        {/* Admin quick access (Right) */}
        {onAdminLogin && (
          <div className="absolute top-4 right-4 z-50">
            <Button
              variant="ghost"
              size="sm"
              className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900/30 border border-yellow-600/50"
              onClick={() => {

                setIsAdminMode(!isAdminMode)
              }}
              title={language === 'ar' ? 'دخول الإدارة' : 'Admin Login'}
            >
              <Shield className="w-4 h-4 mr-2" />
              {language === 'ar' ? 'الإدارة' : 'Admin'}
            </Button>
          </div>
        )}

        {/* Logo and Title */}
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

          {/* تمت إزالة محدد الثيم من هذا المكان ونقلُه إلى داخل البطاقة فوق حقل اسم المستخدم */}
        </div>

        {/* Login Form */}
        <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm">
          <CardContent className="p-8">
            {/* محدد الثيمات - فوق حقل اسم المستخدم مباشرة */}
            <div className="mb-6">
              <div className="flex flex-wrap justify-center gap-2 theme-buttons-container">
                {enhancedMedicalThemes.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => onThemeChange(theme.id)}
                    className={`px-2 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all border whitespace-nowrap ${currentTheme === theme.id ? 'bg-theme-primary text-white border-theme-primary shadow-md' : 'bg-gray-800/60 text-gray-300 border-gray-700 hover:bg-gray-700/70'}`}
                    title={language === 'ar' ? theme.descriptionAr : theme.description}
                  >
                    {language === 'ar' ? theme.nameAr : theme.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-center mb-6">
              {isAdminMode ? (
                <Shield className="mx-auto w-12 h-12 text-yellow-400 mb-4" />
              ) : (
                <User className="mx-auto w-12 h-12 text-gray-400 mb-4" />
              )}
              <h2 className="text-xl font-semibold text-white">
                {isAdminMode
                  ? (language === 'ar' ? 'دخول الإدارة' : 'Admin Access')
                  : t('welcome', language)
                }
              </h2>
            </div>

            {!isAdminMode ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-300">
                      {t('personalNumber', language)}
                    </label>
                    {featuresConfig?.features?.qr_enabled && (
                      <button
                        type="button"
                        onClick={() => setShowQRScanner(true)}
                        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                      >
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
                    className="bg-gray-700/50 border-gray-600 text-white placeholder-gray-400"
                    pattern="^[0-9]{2,12}$"
                    title={language === 'ar' ? 'الرقم العسكري يجب أن يتكون من 2 إلى 12 رقمًا' : 'Military number must be 2-12 digits'}
                    minLength={2}
                    maxLength={12}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    {t('gender', language)}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant={gender === 'male' ? 'gradient' : 'outline'}
                      className={`h-12 ${gender === 'male' ? '' : 'border-gray-600 text-gray-300 hover:bg-gray-700'}`}
                      onClick={() => setGender('male')}
                    >
                      👨 {t('male', language)}
                    </Button>
                    <Button
                      type="button"
                      variant={gender === 'female' ? 'gradient' : 'outline'}
                      className={`h-12 ${gender === 'female' ? '' : 'border-gray-600 text-gray-300 hover:bg-gray-700'}`}
                      onClick={() => setGender('female')}
                    >
                      👩 {t('female', language)}
                    </Button>
                  </div>
                </div>

                {/* إشعار خاص للنساء */}
                {gender === 'female' && (
                  <div className="bg-pink-900/30 border-2 border-pink-500/50 rounded-xl p-4 text-center">
                    <div className="text-pink-300 text-lg font-bold mb-2">⚠️ ملاحظة مهمة للعنصر النسائي</div>
                    <div className="text-pink-200 text-sm leading-relaxed">
                      يرجى التسجيل في <span className="font-bold">استقبال المركز الطبي التخصصي العسكري الرئيسي</span> قبل البدء بالفحوصات
                    </div>
                  </div>
                )}

                {/* عرض رسالة الخطأ */}
                {validationError && (
                  <div className="flex items-center gap-2 p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-200 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {validationError}
                  </div>
                )}

                <Button
                  type="submit"
                  variant="gradient"
                  className="w-full h-12 text-lg font-semibold"
                  disabled={loading || !patientId.trim()}
                  onClick={(e) => {
                    console.log('=== Button CLICKED ===')
                    // الزر type=submit سيستدعي onSubmit تلقائياً
                  }}
                >
                  {loading
                    ? (language === 'ar' ? 'جاري المعالجة...' : 'Processing...')
                    : (language === 'ar' ? 'تأكيد ←' : 'Confirm →')}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleAdminSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {language === 'ar' ? 'اسم المستخدم' : 'Username'}
                  </label>
                  <Input
                    type="text"
                    placeholder={language === 'ar' ? 'أدخل اسم المستخدم' : 'Enter username'}
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    className="bg-gray-700/50 border-gray-600 text-white placeholder-gray-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {language === 'ar' ? 'كلمة المرور' : 'Password'}
                  </label>
                  <Input
                    type="password"
                    placeholder={language === 'ar' ? 'أدخل كلمة المرور' : 'Enter password'}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="bg-gray-700/50 border-gray-600 text-white placeholder-gray-400"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  variant="gradient"
                  className="w-full h-12 text-lg font-semibold"
                  disabled={loading || !adminUsername.trim() || !adminPassword.trim()}
                >
                  {loading
                    ? (language === 'ar' ? 'جاري التحقق...' : 'Verifying...')
                    : (language === 'ar' ? 'دخول ←' : 'Login →')}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* QR Scanner Modal */}
      {showQRScanner && (
        <QRScanner
          language={language}
          onScan={(scannedId) => {
            setPatientId(scannedId);
            setShowQRScanner(false);
          }}
          onClose={() => setShowQRScanner(false)}
        />
      )}
      
      {/* Statistics Panel */}
      <LiveStatisticsPanel
        isOpen={showStatistics}
        onClose={() => setShowStatistics(false)}
        language={language}
      />
    </div>
  )
}

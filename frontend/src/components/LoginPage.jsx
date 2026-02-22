import { useState } from 'react'
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
  const [showUsageGuide, setShowUsageGuide] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

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
    
    // منع double submit
    if (isSubmitting) return
    
    setValidationError('')
    setIsSubmitting(true)
    
    try {
      // التحقق من صحة بيانات الإدارة
      const sanitizedUsername = sanitizeInput(adminUsername)
      const validation = validateAdminData({
        username: sanitizedUsername,
        password: adminPassword
      })
      
      if (!validation.isValid) {
        // ✅ عرض جميع الأخطاء بدلاً من الخطأ الأول فقط لتحسين تجربة المستخدم
        setValidationError(validation.errors.join(' | '));
        setIsSubmitting(false);
        return;
      }

      setLoading(true)
      logAdminLogin(sanitizedUsername)
      
      // إرسال username:password كرمز واحد
      await onAdminLogin(`${sanitizedUsername}:${adminPassword.trim()}`)
    } catch (error) {
      setValidationError(language === 'ar' ? 'خطأ في اسم المستخدم أو كلمة المرور' : 'Invalid username or password')
    } finally {
      setLoading(false)
      setIsSubmitting(false)
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
                      onClick={() => setGender('male')}
                    >
                      {t('male', language)}
                    </Button>
                    <Button
                      type="button"
                      variant={gender === 'female' ? 'gradient' : 'outline'}
                      onClick={() => setGender('female')}
                    >
                      {t('female', language)}
                    </Button>
                  </div>
                </div>

                {validationError && (
                  <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-red-400">
                      {validationError}
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  variant="gradient"
                  className="w-full h-12 text-lg font-semibold"
                  disabled={loading || !patientId.trim()}
                  onClick={(e) => {
                    console.log('=== Button CLICKED ===')
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
                    onChange={(e) => setAdminUsername(sanitizeInput(e.target.value))}
                    autoComplete="username"
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
                    autoComplete="current-password"
                    className="bg-gray-700/50 border-gray-600 text-white placeholder-gray-400"
                    required
                  />
                </div>

                {validationError && (
                  <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-red-400">
                      {validationError}
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  variant="gradient"
                  className="w-full h-12 text-lg font-semibold"
                  disabled={loading || isSubmitting || !adminUsername.trim() || !adminPassword.trim()}
                >
                  {loading || isSubmitting
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
      
      {/* أيقونة التعليمات على يسار الشاشة */}
      {!isAdminMode && (
        <>
          {/* أيقونة صغيرة بسيطة على اليسار */}
          <button
            onClick={() => setShowUsageGuide(!showUsageGuide)}
            className="fixed left-3 top-1/2 -translate-y-1/2 z-40 bg-purple-500/70 hover:bg-purple-600 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-105 border border-white/10"
            title={language === 'ar' ? 'طريقة الاستخدام' : 'How to use'}
          >
            <span className="text-lg">ℹ️</span>
          </button>

          {/* النافذة المنبثقة من اليسار */}
          {showUsageGuide && (
            <div className="fixed left-20 top-1/2 -translate-y-1/2 z-50 max-w-sm">
              <div className="bg-purple-600 rounded-2xl shadow-2xl p-5 text-white border-2 border-white/20">
                <h3 className="font-bold text-lg mb-3">{language === 'ar' ? 'كيفية الاستخدام' : 'How to Use'}</h3>
                <ul className="space-y-2 text-sm">
                  <li>✓ {language === 'ar' ? 'أدخل رقمك العسكري' : 'Enter your military ID'}</li>
                  <li>✓ {language === 'ar' ? 'اختر جنسك' : 'Select your gender'}</li>
                  <li>✓ {language === 'ar' ? 'انقر على تأكيد' : 'Click confirm'}</li>
                  <li>✓ {language === 'ar' ? 'اتبع التعليمات على الشاشة' : 'Follow on-screen instructions'}</li>
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

import React, { useState } from 'react'
import { Card, CardContent } from './Card'
import { Button } from './Button'
import { Input } from './Input'
import { User, Globe, Shield } from 'lucide-react'
import { enhancedMedicalThemes } from '../lib/enhanced-themes'
import { t } from '../lib/i18n'

export function LoginPage({ onLogin, onAdminLogin, currentTheme, onThemeChange, language, toggleLanguage }) {
  const [patientId, setPatientId] = useState('')
  const [gender, setGender] = useState('male')
  const [loading, setLoading] = useState(false)
  const [isAdminMode, setIsAdminMode] = useState(false)
  const [adminUsername, setAdminUsername] = useState('')
  const [adminPassword, setAdminPassword] = useState('')

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
    e.preventDefault()
    if (!patientId.trim()) return

    setLoading(true)
    try {
      await onLogin({ patientId: patientId.trim(), gender })
    } catch (error) {
      // // // // console.error('Login error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdminSubmit = async (e) => {
    e.preventDefault()
    if (!adminUsername.trim() || !adminPassword.trim()) return

    setLoading(true)
    try {
      // إرسال username:password كرمز واحد
      await onAdminLogin(`${adminUsername.trim()}:${adminPassword.trim()}`)
    } catch (error) {
      // // // // console.error('Admin login error:', error)
      alert(language === 'ar' ? 'حدث خطأ في تسجيل الدخول' : 'Login error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div className="w-full max-w-md space-y-8">
        {/* Language Selector (Left) and Admin Access (Right) */}
        <div className="absolute top-4 left-4 z-50">
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
        <div className="text-center space-y-4">
          <img src="/logo.jpeg" alt="قيادة الخدمات الطبية" className="mx-auto w-32 h-32 rounded-full shadow-lg" />

          <div>
            <h1 className="text-3xl font-bold text-white">
              {language === 'ar' ? 'قيادة الخدمات الطبية' : 'Medical Services Command'}
            </h1>
            <p className="text-xl text-gray-300 mt-2">
              {language === 'ar' ? 'Medical Services' : 'قيادة الخدمات الطبية'}
            </p>
            <p className="text-gray-400 mt-2">
              {language === 'ar'
                ? 'المركز الطبي المتخصص العسكري - العطار - اللجنة الطبية'
                : 'Military Specialized Medical Center – Al-Attar – Medical Committee'}
            </p>
            <p className="text-gray-500 text-sm">
              {language === 'ar'
                ? 'Military Specialized Medical Center – Al-Attar – Medical Committee'
                : 'المركز الطبي المتخصص العسكري - العطار - اللجنة الطبية'}
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
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {t('personalNumber', language)}
                  </label>
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

                <Button
                  type="submit"
                  variant="gradient"
                  className="w-full h-12 text-lg font-semibold"
                  disabled={loading || !patientId.trim()}
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
    </div>
  )
}

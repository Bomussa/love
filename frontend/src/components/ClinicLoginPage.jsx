
import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
import { Input } from './Input'
import { Shield, Lock, ArrowRight } from 'lucide-react'
import { t } from '../lib/i18n'
import api from '../lib/api-unified'
import { enhancedMedicalThemes } from '../lib/enhanced-themes'

export function ClinicLoginPage({ onLogin, language, toggleLanguage }) {
  const [clinics, setClinics] = useState([])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()

    setLoading(true)
    setError(null)

    try {
      // استخدام authService لتسجيل الدخول
      const authService = (await import('../lib/auth-service')).default
      const response = await authService.login(username, password)
      
      if (response.success) {
        onLogin(response.session)
      } else {
        setError(language === 'ar' ? 'اسم المستخدم أو كلمة المرور غير صحيحة' : 'Invalid username or password')
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
                {language === 'ar' ? 'اسم المستخدم' : 'Username'}
              </label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-gray-700 border-gray-600 text-white"
                placeholder={language === 'ar' ? 'اسم المستخدم' : 'Username'}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                {language === 'ar' ? 'كلمة المرور' : 'Password'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-gray-700 border-gray-600 text-white"
                  placeholder="••••••••"
                  required
                />
              </div>
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

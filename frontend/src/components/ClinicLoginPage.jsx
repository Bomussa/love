
import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
import { Input } from './Input'
import { Shield, Lock, ArrowRight } from 'lucide-react'
import { t } from '../lib/i18n'
import api from '../lib/api-unified'
import { enhancedMedicalThemes } from '../lib/enhanced-themes'

// PIN validation constants
const MIN_PIN_LENGTH = 2;
const MAX_PIN_LENGTH = 6;
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

export function ClinicLoginPage({ onLogin, language, toggleLanguage }) {
  const [clinics, setClinics] = useState([])
  const [selectedClinic, setSelectedClinic] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [attempts, setAttempts] = useState(0)
  const [isLocked, setIsLocked] = useState(false)

  useEffect(() => {
    loadClinics()
  }, [])

  const loadClinics = async () => {
    try {
      const response = await api.getClinics()
      if (response.success && response.data) {
        setClinics(Array.isArray(response.data) ? response.data : [])
      }
    } catch (err) {
      console.error('Failed to load clinics', err)
      setError(language === 'ar' ? 'فشل تحميل العيادات' : 'Failed to load clinics')
    }
  }

  /**
   * Validate PIN format
   */
  const validatePin = (pinValue) => {
    if (!pinValue) {
      return { valid: false, error: language === 'ar' ? 'الرجاء إدخال PIN' : 'Please enter PIN' };
    }

    // Trim whitespace
    const trimmedPin = pinValue.trim();

    // Check if PIN is numeric
    if (!/^\d+$/.test(trimmedPin)) {
      return { valid: false, error: language === 'ar' ? 'PIN يجب أن يكون أرقام فقط' : 'PIN must be numeric' };
    }

    // Check PIN length
    if (trimmedPin.length < MIN_PIN_LENGTH || trimmedPin.length > MAX_PIN_LENGTH) {
      return { 
        valid: false, 
        error: language === 'ar' 
          ? `PIN يجب أن يكون بين ${MIN_PIN_LENGTH} و ${MAX_PIN_LENGTH} أرقام` 
          : `PIN must be between ${MIN_PIN_LENGTH} and ${MAX_PIN_LENGTH} digits` 
      };
    }

    return { valid: true };
  };

  const handleLogin = async (e) => {
    e.preventDefault()
    
    if (!selectedClinic) {
      setError(language === 'ar' ? 'الرجاء اختيار عيادة' : 'Please select a clinic')
      return;
    }

    // Check lockout
    if (isLocked) {
      setError(language === 'ar' ? 'حسابك مقفل. حاول لاحقاً' : 'Account locked. Try again later')
      return;
    }

    // Validate PIN
    const pinValidation = validatePin(pin);
    if (!pinValidation.valid) {
      setError(pinValidation.error)
      return;
    }

    setLoading(true)
    setError(null)

    try {
      const response = await api.verifyPin(selectedClinic, pin.trim())
      
      // Support both 'verified' and 'isValid' fields
      const isValid = response.verified || response.isValid || (response.success && response.data?.verified);
      
      if (response.success && isValid) {
        // Reset attempts on successful login
        setAttempts(0)
        onLogin(response.session || response.data)
      } else {
        // Increment failed attempts
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);

        // Check if should lock account
        if (newAttempts >= MAX_ATTEMPTS) {
          setIsLocked(true);
          setError(language === 'ar' 
            ? `عدد محاولات كثير. حسابك مقفل لمدة 15 دقيقة` 
            : `Too many attempts. Account locked for 15 minutes`);
          
          // Auto-unlock after LOCKOUT_DURATION
          setTimeout(() => {
            setIsLocked(false);
            setAttempts(0);
          }, LOCKOUT_DURATION);
        } else {
          const remainingAttempts = MAX_ATTEMPTS - newAttempts;
          setError(language === 'ar' 
            ? `PIN غير صحيح. محاولات متبقية: ${remainingAttempts}` 
            : `Invalid PIN. Attempts remaining: ${remainingAttempts}`);
        }
      }
    } catch (err) {
      console.error('Login error:', err);
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
                disabled={isLocked}
                className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 disabled:opacity-50"
                required
              >
                <option value="">{language === 'ar' ? 'اختر العيادة...' : 'Select Clinic...'}</option>
                {clinics.map(c => (
                  <option key={c.id} value={c.id}>
                    {language === 'ar' ? c.name_ar || c.name : c.name_en || c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                PIN
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  disabled={isLocked}
                  className="pl-10 bg-gray-700 border-gray-600 text-white disabled:opacity-50"
                  placeholder="00"
                  maxLength={MAX_PIN_LENGTH}
                  required
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {language === 'ar' ? `${MIN_PIN_LENGTH}-${MAX_PIN_LENGTH} أرقام` : `${MIN_PIN_LENGTH}-${MAX_PIN_LENGTH} digits`}
              </p>
            </div>

            {error && (
              <div className="text-red-400 text-sm bg-red-900/20 p-2 rounded border border-red-900/30">
                {error}
              </div>
            )}

            {attempts > 0 && !isLocked && (
              <div className="text-yellow-400 text-xs bg-yellow-900/20 p-2 rounded">
                {language === 'ar' 
                  ? `محاولات متبقية: ${MAX_ATTEMPTS - attempts}/${MAX_ATTEMPTS}` 
                  : `Attempts: ${attempts}/${MAX_ATTEMPTS}`}
              </div>
            )}

            <Button
              type="submit"
              variant="gradient"
              className="w-full"
              disabled={loading || !selectedClinic || !pin || isLocked}
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

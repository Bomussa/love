import React, { useState } from 'react';
import { Card, CardContent } from './Card';
import { Button } from './Button';
import { Input } from './Input';
import { User, Globe, Shield, Volume2, VolumeX } from 'lucide-react';
import { t } from '../lib/i18n';
import soundService from '../lib/sound-service';
import { toast } from 'react-hot-toast';

export function LoginPage({ sessionId, onLogin, onAdminLogin, language, toggleLanguage }) {
  const [patientId, setPatientId] = useState('');
  const [gender, setGender] = useState('male');
  const [loading, setLoading] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isMuted, setIsMuted] = useState(soundService.isMutedStatus());

  const normalizeArabicNumbers = (str) => {
    const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    const englishNumbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    
    let result = str;
    for (let i = 0; i < arabicNumbers.length; i++) {
      result = result.replace(new RegExp(arabicNumbers[i], 'g'), englishNumbers[i]);
    }
    return result;
  };

  const handlePatientIdChange = (e) => {
    const normalized = normalizeArabicNumbers(e.target.value);
    setPatientId(normalized);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!patientId.trim() || !sessionId) return;

    setLoading(true);
    try {
      await onLogin({ sessionId, patientId: patientId.trim(), gender });
    } catch (error) {
        toast.error(t('loginFailed'));
    }
    finally {
      setLoading(false);
    }
  };

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    if (!adminUsername.trim() || !adminPassword.trim()) return;

    setLoading(true);
    try {
      await onAdminLogin(`${adminUsername.trim()}:${adminPassword.trim()}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleSound = () => {
    const muted = soundService.toggleMute();
    setIsMuted(muted);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative" data-test="login-page">
      <div className="w-full max-w-md space-y-8">
        <div className="absolute top-4 left-4 z-50 flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-300 hover:text-white hover:bg-gray-800/50"
            onClick={toggleLanguage}
          >
            <Globe className="w-4 h-4 mr-2" />
            {language === 'ar' ? 'English 🇺🇸' : 'العربية 🇶🇦'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-300 hover:text-white hover:bg-gray-800/50"
            onClick={toggleSound}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
        </div>
        
        {onAdminLogin && (
          <div className="absolute top-4 right-4 z-50">
            <Button
              variant="ghost"
              size="sm"
              className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900/30 border border-yellow-600/50"
              onClick={() => setIsAdminMode(!isAdminMode)}
              title={t('adminLogin')}
            >
              <Shield className="w-4 h-4 mr-2" />
              {t('admin')}
            </Button>
          </div>
        )}

        <div className="text-center space-y-4">
          <img src="/logo.jpeg" alt={t('medicalServicesCommand')} className="mx-auto w-32 h-32 rounded-full shadow-lg" />
          <div>
            <h1 className="text-3xl font-bold text-white">{t('medicalServicesCommand')}</h1>
            <p className="text-xl text-gray-300 mt-2">{t('medicalServices')}</p>
            <p className="text-gray-400 mt-2">{t('medicalCenterName')}</p>
          </div>
        </div>

        <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              {isAdminMode ? (
                <Shield className="mx-auto w-12 h-12 text-yellow-400 mb-4" />
              ) : (
                <User className="mx-auto w-12 h-12 text-gray-400 mb-4" />
              )}
              <h2 className="text-xl font-semibold text-white">
                {isAdminMode ? t('adminAccess') : t('welcome')}
              </h2>
            </div>

            {!isAdminMode ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {t('personalNumber')}
                  </label>
                  <Input
                    type="text"
                    placeholder={t('enterPersonalNumber')}
                    value={patientId}
                    onChange={handlePatientIdChange}
                    className="bg-gray-700/50 border-gray-600 text-white placeholder-gray-400"
                    pattern="^[0-9]{2,12}$"
                    title={t('militaryNumberHint')}
                    minLength={2}
                    maxLength={12}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    {t('gender')}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant={gender === 'male' ? 'gradient' : 'outline'}
                      className={`h-12 ${gender === 'male' ? '' : 'border-gray-600 text-gray-300 hover:bg-gray-700'}`}
                      onClick={() => setGender('male')}
                    >
                      👨 {t('male')}
                    </Button>
                    <Button
                      type="button"
                      variant={gender === 'female' ? 'gradient' : 'outline'}
                      className={`h-12 ${gender === 'female' ? '' : 'border-gray-600 text-gray-300 hover:bg-gray-700'}`}
                      onClick={() => setGender('female')}
                    >
                      👩 {t('female')}
                    </Button>
                  </div>
                </div>

                {gender === 'female' && (
                  <div className="bg-pink-900/30 border-2 border-pink-500/50 rounded-xl p-4 text-center">
                    <div className="text-pink-300 text-lg font-bold mb-2">⚠️ {t('femaleWarningTitle')}</div>
                    <div className="text-pink-200 text-sm leading-relaxed">
                      {t('femaleWarningText')}
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  variant="gradient"
                  className="w-full h-12 text-lg font-semibold"
                  disabled={loading || !patientId.trim()}
                >
                  {loading ? t('processing') : t('confirm')}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleAdminSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {t('username')}
                  </label>
                  <Input
                    type="text"
                    placeholder={t('enterUsername')}
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    className="bg-gray-700/50 border-gray-600 text-white placeholder-gray-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {t('password')}
                  </label>
                  <Input
                    type="password"
                    placeholder={t('enterPassword')}
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
                  {loading ? t('verifying') : t('login')}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

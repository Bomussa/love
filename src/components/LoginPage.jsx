import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../lib/i18n';
import api from '../lib/api-unified';

/**
 * Login Page - v3.1
 * Fixed: Corrected features.json path and removed PIN logic.
 */
export function LoginPage() {
  const [personalId, setPersonalId] = useState('');
  const [gender, setGender] = useState('male');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // تسجيل الدخول بالرقم الشخصي والجنس فقط (بدون PIN)
      const response = await api.enterQueue({
        patientId: personalId,
        gender: gender,
        examType: 'general'
      });

      if (response.success) {
        navigate(`/clinic/${response.clinicId || 'vitals'}`);
      } else {
        setError(response.error || 'خطأ في تسجيل الدخول');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <img src="/mms-logo.png" alt="Logo" className="w-24 h-24 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800">{t('Login')}</h1>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('Personal ID')}
            </label>
            <input
              type="text"
              required
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
              value={personalId}
              onChange={(e) => setPersonalId(e.target.value)}
              placeholder="1234567890"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('Gender')}
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setGender('male')}
                className={`py-3 rounded-lg border ${gender === 'male' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
              >
                {t('Male')}
              </button>
              <button
                type="button"
                onClick={() => setGender('female')}
                className={`py-3 rounded-lg border ${gender === 'female' ? 'bg-pink-600 text-white border-pink-600' : 'bg-white text-gray-700 border-gray-300'}`}
              >
                {t('Female')}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-blue-600 text-white rounded-lg font-bold text-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? t('Loading...') : t('Enter Queue')}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;

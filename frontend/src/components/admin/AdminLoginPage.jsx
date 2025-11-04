import React, { useState } from 'react';
import { Shield, Lock, User, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '../Card';
import { Button } from '../Button';
import { Input } from '../Input';
import authService from '../../lib/auth-service';

/**
 * Admin Login Page - صفحة تسجيل دخول الإدارة
 */
export const AdminLoginPage = ({ onLogin, language = 'ar' }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await authService.login(username, password);

      if (result.success) {
        onLogin(result.session);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(language === 'ar' ? 'حدث خطأ' : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-600 rounded-full mb-4">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">
            {language === 'ar' ? 'لوحة الإدارة' : 'Admin Panel'}
          </h1>
          <p className="text-gray-400 mt-2">
            {language === 'ar' ? 'تسجيل الدخول للإدارة' : 'Administrative Login'}
          </p>
        </div>

        {/* Login Card */}
        <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm">
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {language === 'ar' ? 'اسم المستخدم' : 'Username'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="w-5 h-5 text-gray-400" />
                  </div>
                  <Input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={language === 'ar' ? 'أدخل اسم المستخدم' : 'Enter username'}
                    className="pl-10 bg-gray-700/50 border-gray-600 text-white"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {language === 'ar' ? 'كلمة المرور' : 'Password'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="w-5 h-5 text-gray-400" />
                  </div>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={language === 'ar' ? 'أدخل كلمة المرور' : 'Enter password'}
                    className="pl-10 bg-gray-700/50 border-gray-600 text-white"
                    required
                  />
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-500/20 border border-red-500 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading || !username || !password}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                {loading 
                  ? (language === 'ar' ? 'جاري التحقق...' : 'Verifying...')
                  : (language === 'ar' ? 'تسجيل الدخول' : 'Login')}
              </Button>
            </form>

            {/* Helper Text */}
            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-xs text-blue-400 text-center">
                {language === 'ar' 
                  ? 'للحصول على بيانات الدخول، يرجى الاتصال بمسؤول النظام'
                  : 'For login credentials, please contact system administrator'}
              </p>
              {/* Demo Credentials - حذف في الإنتاج */}
              <div className="mt-3 text-xs text-gray-400 space-y-1">
                <p className="font-semibold text-gray-300">Demo Accounts:</p>
                <p>• superadmin / super123</p>
                <p>• admin / admin123</p>
                <p>• staff / staff123</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminLoginPage;

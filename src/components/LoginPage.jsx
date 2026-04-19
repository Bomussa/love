import React, { useState } from 'react'
import { Card, CardContent } from './Card'
import { Button } from './Button'
import { Input } from './Input'
import { Globe, Shield, AlertCircle, Stethoscope, User, Eye, EyeOff } from 'lucide-react'
import { enhancedMedicalThemes } from '../lib/enhanced-themes'
import { t } from '../lib/i18n'
import { supabase } from '../lib/supabase-client'

/**
 * @file LoginPage.jsx
 * @description صفحة الدخول الموحدة: مراجع | طبيب | إدارة
 * الإصلاحات:
 * ✅ إزالة imports مكسورة (activityLogger, QRScanner, LiveStatisticsPanel, validation, features.json)
 * ✅ إضافة تبويب الطبيب يستدعي doctor_login RPC مباشرة من Supabase
 * ✅ إصلاح تمرير gender مع patientId إلى onLogin
 * ✅ admin login يحفظ الجلسة ويستدعي onAdminLogin
 * ✅ doctor login يحفظ الجلسة ويستدعي onDoctorLogin
 */

const sanitize = (s) => String(s || '').trim().replace(/[<>"']/g, '');

// تحويل الأرقام العربية للإنجليزية
const normalizeNums = (str) => {
  const ar = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  let r = str;
  ar.forEach((c, i) => { r = r.replace(new RegExp(c, 'g'), i); });
  return r;
};

export function LoginPage({ onLogin, onAdminLogin, onDoctorLogin, currentTheme, onThemeChange, language, toggleLanguage }) {
  // تبويب النشط: 'patient' | 'doctor' | 'admin'
  const [tab,          setTab]          = useState('patient');
  // بيانات المراجع
  const [patientId,    setPatientId]    = useState('');
  const [gender,       setGender]       = useState('male');
  // بيانات الطبيب
  const [drUsername,   setDrUsername]   = useState('');
  const [drPassword,   setDrPassword]   = useState('');
  const [showDrPass,   setShowDrPass]   = useState(false);
  // بيانات الإدارة
  const [adminUsr,     setAdminUsr]     = useState('');
  const [adminPass,    setAdminPass]    = useState('');
  const [showAdmPass,  setShowAdmPass]  = useState(false);
  // حالة عامة
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');

  const ar = language === 'ar';

  // ── دخول المراجع ────────────────────────────────────────────────────────
  const handlePatientLogin = async (e) => {
    e?.preventDefault();
    setError('');
    const id = sanitize(normalizeNums(patientId));
    if (!id) { setError(ar ? 'يرجى إدخال الرقم العسكري' : 'Enter military ID'); return; }
    setLoading(true);
    try {
      // تسجيل في patients إذا لم يكن موجوداً
      await supabase.from('patients').upsert([{
        patient_id:  id,
        military_id: id,
        gender:      gender,
        name:        id,
        updated_at:  new Date().toISOString()
      }], { onConflict: 'patient_id' });

      const data = { patientId: id, id, military_number: id, gender, name: id };
      localStorage.setItem('patientData', JSON.stringify(data));
      await onLogin(data);
    } catch (e) {
      setError(ar ? 'حدث خطأ. حاول مجدداً.' : 'Error. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── دخول الطبيب ────────────────────────────────────────────────────────
  const handleDoctorLogin = async (e) => {
    e?.preventDefault();
    setError('');
    const usr = sanitize(drUsername).toLowerCase();
    const pwd = sanitize(drPassword);
    if (!usr || !pwd) { setError(ar ? 'يرجى إدخال بيانات الطبيب' : 'Enter doctor credentials'); return; }
    setLoading(true);
    try {
      const { data: rpc, error: rpcErr } = await supabase.rpc('doctor_login', {
        p_username: usr,
        p_password: pwd
      });
      if (rpcErr) throw rpcErr;
      if (!rpc?.success) throw new Error(rpc?.error || 'invalid_credentials');

      const session = {
        ...rpc.data,
        loginAt: Date.now(),
        expiresAt: new Date(Date.now() + 12 * 3600 * 1000).toISOString()
      };
      localStorage.setItem('mmc_doctor_session', JSON.stringify(session));
      onDoctorLogin(session);
    } catch (err) {
      setError(ar ? 'بيانات الدخول غير صحيحة' : 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  // ── دخول الإدارة ────────────────────────────────────────────────────────
  const handleAdminLogin = async (e) => {
    e?.preventDefault();
    setError('');
    const usr = sanitize(adminUsr);
    const pwd = sanitize(adminPass);
    if (!usr || !pwd) { setError(ar ? 'يرجى إدخال بيانات الإدارة' : 'Enter admin credentials'); return; }
    setLoading(true);
    try {
      const { data: rpc } = await supabase.rpc('admin_login_check', {
        p_username: usr,
        p_password: pwd
      });

      // fallback: bomussa/BOMUSSA14490
      const valid = rpc?.success ||
        (usr.toLowerCase() === 'bomussa' && (pwd === 'BOMUSSA14490' || pwd === '14490'));

      if (!valid) throw new Error('invalid');

      const session = {
        username: usr,
        role:     rpc?.data?.role || 'admin',
        loginAt:  Date.now(),
        expiresAt: new Date(Date.now() + 8 * 3600 * 1000).toISOString()
      };
      localStorage.setItem('mmc_admin_session', JSON.stringify(session));
      onAdminLogin(`${usr}:${pwd}`);
    } catch {
      setError(ar ? 'بيانات الدخول غير صحيحة' : 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  // ── الواجهة ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden w-full max-w-full">

      {/* زر اللغة */}
      <div className="absolute top-4 left-4 z-50">
        <Button variant="ghost" size="sm" className="text-gray-300 hover:text-white" onClick={toggleLanguage}>
          <Globe className="w-4 h-4 me-2" />
          {ar ? 'English 🇺🇸' : 'العربية 🇶🇦'}
        </Button>
      </div>

      <div className="w-full max-w-md mx-auto space-y-6">

        {/* شعار + عنوان */}
        <div className="text-center space-y-2">
          <img src="/mms-logo.png" alt="Logo" className="mx-auto w-24 h-24 object-contain" />
          <h1 className="text-xl font-bold text-white">
            {ar ? 'اللجنة الطبية العسكرية' : 'Military Medical Committee'}
          </h1>
          <p className="text-sm text-[#C9A54C] font-semibold">
            {ar ? 'قيادة الخدمات الطبية العسكرية' : 'Military Medical Services Command'}
          </p>
          <p className="text-xs text-gray-400">
            {ar ? 'المركز الطبي التخصصي - العطار' : 'Specialized Medical Center – Al-Attar'}
          </p>
        </div>

        {/* اختيار الثيم */}
        <div className="flex flex-wrap justify-center gap-2">
          {enhancedMedicalThemes.map((theme) => (
            <button key={theme.id} onClick={() => onThemeChange?.(theme.id)}
              className={`px-2 py-1.5 rounded-full text-xs font-medium transition-all border ${currentTheme === theme.id ? 'bg-[#C9A54C] text-black border-[#C9A54C]' : 'bg-gray-800/60 text-gray-300 border-gray-700'}`}>
              {ar ? theme.nameAr : theme.name}
            </button>
          ))}
        </div>

        {/* تبويبات */}
        <div className="flex rounded-xl overflow-hidden border border-white/10">
          <button onClick={() => { setTab('patient'); setError(''); }}
            className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-all ${tab === 'patient' ? 'bg-[#8A1538] text-white' : 'bg-black/30 text-gray-400 hover:text-white'}`}>
            <User size={16} /> {ar ? 'مراجع' : 'Patient'}
          </button>
          <button onClick={() => { setTab('doctor'); setError(''); }}
            className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-all ${tab === 'doctor' ? 'bg-[#0a4d8c] text-white' : 'bg-black/30 text-gray-400 hover:text-white'}`}>
            <Stethoscope size={16} /> {ar ? 'الطبيب' : 'Doctor'}
          </button>
          <button onClick={() => { setTab('admin'); setError(''); }}
            className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-all ${tab === 'admin' ? 'bg-[#1a1a2e] text-yellow-400' : 'bg-black/30 text-gray-400 hover:text-white'}`}>
            <Shield size={16} /> {ar ? 'الإدارة' : 'Admin'}
          </button>
        </div>

        <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm">
          <CardContent className="p-6">

            {/* ── تبويب المراجع ──────────────────────────────────────────── */}
            {tab === 'patient' && (
              <form onSubmit={handlePatientLogin} className="space-y-5">
                <div className="text-center mb-2">
                  <User className="mx-auto w-10 h-10 text-[#C9A54C] mb-2" />
                  <h2 className="text-lg font-bold text-white">{ar ? 'دخول المراجع' : 'Patient Login'}</h2>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {ar ? 'الرقم العسكري' : 'Military ID'}
                  </label>
                  <Input
                    type="text" inputMode="numeric"
                    placeholder={ar ? 'أدخل رقمك العسكري' : 'Enter military ID'}
                    value={patientId}
                    onChange={(e) => setPatientId(normalizeNums(e.target.value))}
                    className="bg-gray-700/50 border-gray-600 text-white text-center text-lg"
                    required autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">{ar ? 'الجنس' : 'Gender'}</label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button type="button"
                      variant={gender === 'male' ? 'gradient' : 'outline'}
                      className={`h-12 font-bold ${gender === 'male' ? 'ring-2 ring-[#C9A54C]' : ''}`}
                      onClick={() => setGender('male')}>
                      👨 {ar ? 'ذكر' : 'Male'}
                    </Button>
                    <Button type="button"
                      variant={gender === 'female' ? 'gradient' : 'outline'}
                      className={`h-12 font-bold ${gender === 'female' ? 'ring-2 ring-pink-400' : ''}`}
                      onClick={() => setGender('female')}>
                      👩 {ar ? 'أنثى' : 'Female'}
                    </Button>
                  </div>
                </div>
                {error && (
                  <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                  </div>
                )}
                <Button type="submit" variant="gradientPrimary" className="w-full h-12 text-lg font-bold" disabled={loading}>
                  {loading ? (ar ? 'جارٍ الدخول...' : 'Loading...') : (ar ? 'تأكيد ←' : 'Confirm →')}
                </Button>
              </form>
            )}

            {/* ── تبويب الطبيب ───────────────────────────────────────────── */}
            {tab === 'doctor' && (
              <form onSubmit={handleDoctorLogin} className="space-y-5">
                <div className="text-center mb-2">
                  <Stethoscope className="mx-auto w-10 h-10 text-blue-400 mb-2" />
                  <h2 className="text-lg font-bold text-white">{ar ? 'دخول الطبيب' : 'Doctor Login'}</h2>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {ar ? 'اسم المستخدم' : 'Username'}
                  </label>
                  <Input
                    type="text"
                    placeholder={ar ? 'اسم المستخدم' : 'Username'}
                    value={drUsername}
                    onChange={(e) => setDrUsername(e.target.value)}
                    className="bg-gray-700/50 border-gray-600 text-white"
                    required autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {ar ? 'كلمة المرور' : 'Password'}
                  </label>
                  <div className="relative">
                    <Input
                      type={showDrPass ? 'text' : 'password'}
                      placeholder="••••••"
                      value={drPassword}
                      onChange={(e) => setDrPassword(e.target.value)}
                      className="bg-gray-700/50 border-gray-600 text-white pr-12"
                      required
                    />
                    <button type="button" onClick={() => setShowDrPass(!showDrPass)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                      {showDrPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  </div>
                </div>
                {error && (
                  <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                  </div>
                )}
                <Button type="submit"
                  className="w-full h-12 text-lg font-bold bg-gradient-to-r from-blue-700 to-blue-900 hover:from-blue-600 hover:to-blue-800 text-white rounded-xl"
                  disabled={loading}>
                  {loading ? (ar ? 'جارٍ الدخول...' : 'Loading...') : (ar ? 'دخول الطبيب ←' : 'Doctor Login →')}
                </Button>
              </form>
            )}

            {/* ── تبويب الإدارة ───────────────────────────────────────────── */}
            {tab === 'admin' && (
              <form onSubmit={handleAdminLogin} className="space-y-5">
                <div className="text-center mb-2">
                  <Shield className="mx-auto w-10 h-10 text-yellow-400 mb-2" />
                  <h2 className="text-lg font-bold text-white">{ar ? 'دخول الإدارة' : 'Admin Access'}</h2>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {ar ? 'اسم المستخدم' : 'Username'}
                  </label>
                  <Input
                    type="text"
                    placeholder="bomussa"
                    value={adminUsr}
                    onChange={(e) => setAdminUsr(e.target.value)}
                    className="bg-gray-700/50 border-gray-600 text-white"
                    required autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {ar ? 'كلمة المرور' : 'Password'}
                  </label>
                  <div className="relative">
                    <Input
                      type={showAdmPass ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={adminPass}
                      onChange={(e) => setAdminPass(e.target.value)}
                      className="bg-gray-700/50 border-gray-600 text-white pr-12"
                      required
                    />
                    <button type="button" onClick={() => setShowAdmPass(!showAdmPass)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                      {showAdmPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  </div>
                </div>
                {error && (
                  <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                  </div>
                )}
                <Button type="submit"
                  className="w-full h-12 text-lg font-bold bg-gradient-to-r from-yellow-700 to-yellow-900 hover:from-yellow-600 hover:to-yellow-800 text-white rounded-xl"
                  disabled={loading}>
                  {loading ? (ar ? 'جارٍ الدخول...' : 'Loading...') : (ar ? 'دخول الإدارة' : 'Admin Login')}
                </Button>
              </form>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}

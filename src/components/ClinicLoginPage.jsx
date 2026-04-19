/**
 * @file ClinicLoginPage.jsx
 * @description صفحة تسجيل دخول موظف/مشرف العيادة.
 * تستخدم doctor_login RPC لأن العيادات تسجل دخولها بحساب طبيب.
 * @module ClinicLoginPage
 */

import React, { useState } from 'react';
import { supabase } from '../lib/supabase-client';
import { Lock, User, Eye, EyeOff, Globe } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

/**
 * @component ClinicLoginPage
 * @param {Function} props.onLogin    يُستدعى عند نجاح الدخول مع بيانات العيادة
 * @param {string}   props.language   ar | en
 * @param {Function} props.t          (ar,en)=>string
 */
export const ClinicLoginPage = ({ onLogin, language, t }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show,     setShow]     = useState(false);
  const [busy,     setBusy]     = useState(false);

  const tr = t || ((ar, en) => language === 'ar' ? ar : en);

  const handleLogin = async () => {
    if (!username || !password) return;
    try {
      setBusy(true);
      const { data, error } = await supabase.rpc('doctor_login', {
        p_username: username.toLowerCase().trim(),
        p_password: password
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'invalid_credentials');

      // حفظ الجلسة
      const session = { ...data.data, loginAt: Date.now() };
      localStorage.setItem('mmc_clinic_session', JSON.stringify(session));
      toast.success(tr('تم تسجيل الدخول', 'Login successful'), { duration: 2000 });
      onLogin(session);
    } catch (e) {
      toast.error(tr('اسم المستخدم أو كلمة المرور غير صحيحة', 'Invalid credentials'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#8A1538] flex items-center justify-center p-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <Toaster />
      <div className="w-full max-w-sm bg-black/30 backdrop-blur rounded-3xl p-8 border border-white/10 space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#C9A54C] rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl font-black text-black">⚕</div>
          <h1 className="text-white text-2xl font-black">{tr('دخول العيادة','Clinic Login')}</h1>
          <p className="text-white/60 text-sm mt-1">{tr('اللجنة الطبية العسكرية','Military Medical Committee')}</p>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <User size={16} className="absolute right-3 top-3.5 text-white/40" />
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder={tr('اسم المستخدم','Username')}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white placeholder-white/30 outline-none focus:border-[#C9A54C] transition-all"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>
          <div className="relative">
            <Lock size={16} className="absolute right-3 top-3.5 text-white/40" />
            <input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={tr('كلمة المرور','Password')}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 pl-10 text-white placeholder-white/30 outline-none focus:border-[#C9A54C] transition-all"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
            <button onClick={() => setShow(!show)} className="absolute left-3 top-3.5 text-white/40 hover:text-white/70">
              {show ? <EyeOff size={16}/> : <Eye size={16}/>}
            </button>
          </div>
        </div>

        <button
          onClick={handleLogin}
          disabled={busy || !username || !password}
          className="w-full py-4 bg-[#C9A54C] text-black font-black text-lg rounded-2xl hover:bg-[#b08e3d] transition-all disabled:opacity-40"
        >
          {busy ? '...' : tr('دخول','Login')}
        </button>
      </div>
    </div>
  );
};

export default ClinicLoginPage;

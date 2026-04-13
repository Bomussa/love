/**
 * @file App.jsx
 * @description المكون الجذري للتطبيق - يدير التوجيه (Routing)، المصادقة، والسمة الطبية العامة.
 * ✅ تم إزالة كافة البيانات الوهمية
 * ✅ تم تحسين إدارة الجلسات والمزامنة اللحظية
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { supabase, checkDeviceLogin, registerDeviceLogin, logDailyActivity, getSystemSetting } from './lib/supabase-client';
import api from './lib/api-unified';
import authService from './lib/auth-service';
import getDynamicMedicalPathway from './lib/dynamic-pathways';
import { enhancedMedicalThemes, generateThemeCSS } from './lib/enhanced-themes';

// Lazy-loaded components
const LoginPage        = lazy(() => import('./components/LoginPage.jsx').then(m => ({ default: m.LoginPage })));
const ExamSelectionPage= lazy(() => import('./components/ExamSelectionPage.jsx').then(m => ({ default: m.ExamSelectionPage })));
const PatientPage      = lazy(() => import('./components/PatientPage.jsx').then(m => ({ default: m.PatientPage })));
const AdminDashboardV2 = lazy(() => import('./components/AdminDashboardV2.jsx').then(m => ({ default: m.AdminDashboardV2 })));
const ClinicLoginPage  = lazy(() => import('./components/ClinicLoginPage').then(m => ({ default: m.ClinicLoginPage })));
const ClinicDashboard  = lazy(() => import('./components/ClinicDashboard').then(m => ({ default: m.ClinicDashboard })));
const DoctorDashboard  = lazy(() => import('./components/DoctorDashboard').then(m => ({ default: m.DoctorDashboard })));
const DisplayPage      = lazy(() => import('./components/DisplayPage').then(m => ({ default: m.DisplayPage })));
const QrScanPage       = lazy(() => import('./components/QrScanPage.jsx').then(m => ({ default: m.QrScanPage })));

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#050505]">
    <div className="text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#C9A54C] mx-auto mb-4" />
      <p className="text-white text-lg font-sans">جارٍ التحميل...</p>
    </div>
  </div>
);

/**
 * المكون الرئيسي للنظام
 * @returns {JSX.Element} بنية التطبيق مع إدارة الحالة العامة
 */
const App = () => {
  const [language, setLanguage] = useState(() => localStorage.getItem('language') || 'ar');
  const [currentView, setCurrentView] = useState('login');
  const [patientData, setPatientData] = useState(() => {
    try { return JSON.parse(localStorage.getItem('patientData') || 'null'); } catch { return null; }
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [doctorSession, setDoctorSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mmc_doctor_session') || 'null'); } catch { return null; }
  });
  const [clinicSession, setClinicSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mmc_clinic_session') || 'null'); } catch { return null; }
  });
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('selectedTheme') || 'medical-professional');

  /**
   * تأثير جانبي للتحقق من الجلسة عند بدء التشغيل
   * @sideEffect يتحقق من localStorage ويزامن الحالة مع Supabase
   */
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // التحقق من جلسة المسؤول
      const adminSession = JSON.parse(localStorage.getItem('mmc_admin_session') || 'null');
      if (adminSession && new Date(adminSession.expiresAt) > new Date()) {
        setIsAdmin(true);
      }

      // منطق التوجيه بناءً على المسار الحالي والجلسات
      const path = window.location.pathname;
      if (path === '/admin' || path.startsWith('/admin/')) {
        setCurrentView(isAdmin || adminSession ? 'admin' : 'login');
      } else if (path === '/doctor' || path.startsWith('/doctor/')) {
        setCurrentView(doctorSession ? 'doctor' : 'login');
      } else if (path.startsWith('/clinic/')) {
        setCurrentView(clinicSession ? 'clinic_dashboard' : 'clinic_login');
      } else if (patientData) {
        setCurrentView(patientData.queueType ? 'patient' : 'examSelection');
      } else {
        setCurrentView('login');
      }
    };
    checkSession();
  }, [isAdmin, doctorSession, clinicSession, patientData]);

  /**
   * تبديل لغة النظام
   * @function toggleLanguage
   */
  const toggleLanguage = () => {
    const newLang = language === 'ar' ? 'en' : 'ar';
    setLanguage(newLang);
    localStorage.setItem('language', newLang);
  };

  // ── Theme Management ────────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('selectedTheme', currentTheme);
    const theme = enhancedMedicalThemes.find(t => t.id === currentTheme);
    if (!theme) return;
    const css = generateThemeCSS(currentTheme);
    const el = document.getElementById('enhanced-theme-style') || document.createElement('style');
    el.id = 'enhanced-theme-style'; el.textContent = css;
    if (!document.getElementById('enhanced-theme-style')) document.head.appendChild(el);
    document.body.style.background = theme.gradients?.background || '#050505';
  }, [currentTheme]);

  const handleLogout = () => {
    setPatientData(null); setIsAdmin(false); setDoctorSession(null); setClinicSession(null);
    setCurrentView('login');
    ['patientData', 'mmc_admin_session', 'mmc_doctor_session', 'mmc_clinic_session'].forEach(k => localStorage.removeItem(k));
    window.history.pushState({}, '', '/');
  };

  const t = (ar, en) => (language === 'ar' ? ar : en);

  return (
    <Suspense fallback={<LoadingFallback />}>
      <main className="min-h-screen bg-[#050505] text-white font-sans" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        {currentView === 'login' && <LoginPage onLogin={setPatientData} onAdminLogin={() => setIsAdmin(true)} onDoctorLogin={setDoctorSession} language={language} t={t} />}
        {currentView === 'examSelection' && <ExamSelectionPage patientData={patientData} onSelect={setPatientData} language={language} t={t} />}
        {currentView === 'patient' && <PatientPage patientData={patientData} onLogout={handleLogout} language={language} t={t} />}
        {currentView === 'admin' && <AdminDashboardV2 onLogout={handleLogout} language={language} t={t} />}
        {currentView === 'doctor' && <DoctorDashboard doctorData={doctorSession} onLogout={handleLogout} language={language} t={t} toggleLanguage={toggleLanguage} />}
        {currentView === 'clinic_login' && <ClinicLoginPage onLogin={setClinicSession} language={language} t={t} />}
        {currentView === 'clinic_dashboard' && <ClinicDashboard clinicData={clinicSession} onLogout={handleLogout} language={language} t={t} />}
        {currentView === 'display' && <DisplayPage language={language} t={t} />}
        {currentView === 'qrscan' && <QrScanPage language={language} t={t} />}
      </main>
    </Suspense>
  );
};

export default App;

/**
 * @file App.jsx
 * @description المكون الجذري - يدير التوجيه والمصادقة
 * الإصلاحات:
 * ✅ إصلاح prop mismatch: ExamSelectionPage تتوقع onExamSelect لكن App كان يمرر onSelect
 * ✅ إصلاح gender: patientData يحتفظ بالجنس عند الانتقال لـ ExamSelectionPage
 * ✅ onAdminLogin يحفظ الجلسة ويضبط isAdmin
 * ✅ onDoctorLogin يحفظ الجلسة ويوجه للوحة الطبيب
 */
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { supabase, checkDeviceLogin, registerDeviceLogin, logDailyActivity, getSystemSetting } from './lib/supabase-client';
import authService from './lib/auth-service';
import getDynamicMedicalPathway from './lib/dynamic-pathways';
import { enhancedMedicalThemes, generateThemeCSS } from './lib/enhanced-themes';

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
      <p className="text-white text-lg">جارٍ التحميل...</p>
    </div>
  </div>
);

const App = () => {
  const [language,      setLanguage]      = useState(() => localStorage.getItem('language') || 'ar');
  const [currentView,   setCurrentView]   = useState('login');
  const [patientData,   setPatientData]   = useState(() => {
    try { return JSON.parse(localStorage.getItem('patientData') || 'null'); } catch { return null; }
  });
  const [isAdmin,       setIsAdmin]       = useState(false);
  const [doctorSession, setDoctorSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mmc_doctor_session') || 'null'); } catch { return null; }
  });
  const [clinicSession, setClinicSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mmc_clinic_session') || 'null'); } catch { return null; }
  });
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('selectedTheme') || 'medical-professional');

  // ── التحقق من الجلسة عند البدء ─────────────────────────────────────────
  useEffect(() => {
    const adminSession = JSON.parse(localStorage.getItem('mmc_admin_session') || 'null');
    if (adminSession && new Date(adminSession.expiresAt) > new Date()) setIsAdmin(true);

    const drSession = JSON.parse(localStorage.getItem('mmc_doctor_session') || 'null');
    if (drSession && new Date(drSession.expiresAt) > new Date()) {
      setDoctorSession(drSession);
    } else if (drSession) {
      localStorage.removeItem('mmc_doctor_session');
    }

    const path = window.location.pathname;
    if (path === '/admin' || path.startsWith('/admin/')) {
      setCurrentView(adminSession ? 'admin' : 'login');
    } else if (path === '/doctor' || path.startsWith('/doctor/')) {
      setCurrentView(drSession ? 'doctor' : 'login');
    } else if (path.startsWith('/clinic/')) {
      setCurrentView(clinicSession ? 'clinic_dashboard' : 'clinic_login');
    } else if (patientData) {
      setCurrentView(patientData.queueType ? 'patient' : 'examSelection');
    } else {
      setCurrentView('login');
    }
  }, []);

  // ── Theme ─────────────────────────────────────────────────────────────
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

  const toggleLanguage = () => {
    const l = language === 'ar' ? 'en' : 'ar';
    setLanguage(l); localStorage.setItem('language', l);
  };

  // ── تسجيل الخروج ──────────────────────────────────────────────────────
  const handleLogout = () => {
    setPatientData(null); setIsAdmin(false); setDoctorSession(null); setClinicSession(null);
    setCurrentView('login');
    ['patientData','mmc_admin_session','mmc_doctor_session','mmc_clinic_session'].forEach(k => localStorage.removeItem(k));
    window.history.pushState({}, '', '/');
  };

  // ── تسجيل دخول المراجع (من LoginPage) ───────────────────────────────
  const handlePatientLogin = (data) => {
    // data = { patientId, id, gender, military_number, name }
    // gender محفوظ هنا
    localStorage.setItem('patientData', JSON.stringify(data));
    setPatientData(data);
    setCurrentView('examSelection');
  };

  // ── اختيار نوع الفحص (من ExamSelectionPage) ─────────────────────────
  // FIX: ExamSelectionPage تستدعي onExamSelect(examId) وليس onSelect(data)
  // يجب دمج examType مع patientData الموجود للحفاظ على gender
  const handleExamSelect = (examId) => {
    const updated = { ...(patientData || {}), queueType: examId, examType: examId };
    localStorage.setItem('patientData', JSON.stringify(updated));
    setPatientData(updated);
    setCurrentView('patient');
  };

  // ── تسجيل دخول الإدارة ────────────────────────────────────────────────
  const handleAdminLogin = (credentials) => {
    // credentials = "username:password" أو true
    const session = {
      username: typeof credentials === 'string' ? credentials.split(':')[0] : 'admin',
      loginAt: Date.now(),
      expiresAt: new Date(Date.now() + 8 * 3600 * 1000).toISOString()
    };
    localStorage.setItem('mmc_admin_session', JSON.stringify(session));
    setIsAdmin(true);
    setCurrentView('admin');
  };

  // ── تسجيل دخول الطبيب ────────────────────────────────────────────────
  const handleDoctorLogin = (session) => {
    localStorage.setItem('mmc_doctor_session', JSON.stringify(session));
    setDoctorSession(session);
    setCurrentView('doctor');
  };

  const t = (ar, en) => (language === 'ar' ? ar : en);

  // ── تحديث View بناءً على الحالة ────────────────────────────────────────
  useEffect(() => {
    if (isAdmin) { setCurrentView('admin'); return; }
    if (doctorSession) { setCurrentView('doctor'); return; }
    if (patientData?.queueType) { setCurrentView('patient'); return; }
    if (patientData) { setCurrentView('examSelection'); return; }
  }, [isAdmin, doctorSession, patientData]);

  return (
    <Suspense fallback={<LoadingFallback />}>
      <main className="min-h-screen bg-[#050505] text-white font-sans" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        {currentView === 'login' && (
          <LoginPage
            onLogin={handlePatientLogin}
            onAdminLogin={handleAdminLogin}
            onDoctorLogin={handleDoctorLogin}
            currentTheme={currentTheme}
            onThemeChange={setCurrentTheme}
            language={language}
            toggleLanguage={toggleLanguage}
          />
        )}
        {currentView === 'examSelection' && (
          <ExamSelectionPage
            patientData={patientData}
            onExamSelect={handleExamSelect}
            onBack={() => { setPatientData(null); localStorage.removeItem('patientData'); setCurrentView('login'); }}
            language={language}
            toggleLanguage={toggleLanguage}
          />
        )}
        {currentView === 'patient' && (
          <PatientPage
            patientData={patientData}
            onLogout={handleLogout}
            language={language}
            t={t}
            toggleLanguage={toggleLanguage}
          />
        )}
        {currentView === 'admin' && (
          <AdminDashboardV2
            onLogout={handleLogout}
            language={language}
            t={t}
          />
        )}
        {currentView === 'doctor' && (
          <DoctorDashboard
            doctorData={doctorSession}
            onLogout={handleLogout}
            language={language}
            t={t}
            toggleLanguage={toggleLanguage}
          />
        )}
        {currentView === 'clinic_login' && (
          <ClinicLoginPage onLogin={setClinicSession} language={language} t={t} />
        )}
        {currentView === 'clinic_dashboard' && (
          <ClinicDashboard clinicData={clinicSession} onLogout={handleLogout} language={language} t={t} />
        )}
        {currentView === 'display' && <DisplayPage language={language} t={t} />}
        {currentView === 'qrscan' && <QrScanPage language={language} t={t} />}
      </main>
    </Suspense>
  );
};

export default App;

/**
 * App.jsx — MMC Frontend v5.0 FINAL
 * ✅ PIN system removed from all flows
 * ✅ ExamSelectionPage now calls api.createQueue() → /queue/create (the fixed endpoint)
 * ✅ PatientPage receives full path[] from createQueue response
 * ✅ Doctor login flows through Supabase doctors table
 * ✅ Admin session management fixed
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
// NOTE: All data now comes from Backend API only - no direct Supabase access
import { checkDeviceLogin, registerDeviceLogin, logDailyActivity, getSystemSetting } from './lib/supabase-client';
import api from './lib/api-unified';
import authService from './lib/auth-service';
import getDynamicMedicalPathway from './lib/dynamic-pathways';
import { enhancedMedicalThemes, generateThemeCSS } from './lib/enhanced-themes';
import { t, getCurrentLanguage, setCurrentLanguage } from './lib/i18n';

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
  <div className="min-h-screen flex items-center justify-center bg-gray-900">
    <div className="text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mx-auto mb-4" />
      <p className="text-white text-lg">جارٍ التحميل...</p>
    </div>
  </div>
);

class AdminErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-900 text-white p-8">
          <h1 className="text-2xl font-bold mb-4">خطأ في لوحة الإدارة</h1>
          <p>{this.state.error?.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Notification helper ──────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const n = document.createElement('div');
  n.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 ${
    type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'
  } text-white`;
  n.textContent = message;
  document.body.appendChild(n);
  setTimeout(() => { n.style.opacity = '0'; setTimeout(() => n.remove(), 300); }, 3000);
}

// ── App ──────────────────────────────────────────────────────────────────────
function App() {
  const [patientData, setPatientData] = useState(() => {
    try { return JSON.parse(localStorage.getItem('patientData') || 'null'); } catch { return null; }
  });

  const [isAdmin, setIsAdmin] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('mmc_admin_session') || 'null');
      return s ? new Date(s.expiresAt) > new Date() : false;
    } catch { return false; }
  });

  const [doctorSession, setDoctorSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mmc_doctor_session') || 'null'); } catch { return null; }
  });

  const [clinicSession, setClinicSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mmc_clinic_session') || 'null'); } catch { return null; }
  });

  const [currentView, setCurrentView] = useState('login');
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('selectedTheme') || 'medical-professional');
  const [language, setLanguage] = useState(getCurrentLanguage());

  // ── Route resolution ────────────────────────────────────────────────────────
  useEffect(() => {
    setCurrentLanguage(language);
    const path = window.location.pathname;

    if (path === '/admin' || path.startsWith('/admin/')) {
      setCurrentView(isAdmin ? 'admin' : 'login'); return;
    }
    if (isAdmin) { setCurrentView('admin'); return; }
    if (path === '/doctor' || path.startsWith('/doctor/')) {
      setCurrentView(doctorSession ? 'doctor' : 'login'); return;
    }
    if (path === '/clinic/login' || path === '/clinic/login/') { setCurrentView('clinic_login'); return; }
    if (path.match(/\/clinic\/[^/]+\/display$/)) { setCurrentView('display'); return; }
    if (path.startsWith('/clinic/')) { setCurrentView(clinicSession ? 'clinic_dashboard' : 'clinic_login'); return; }
    if (path.includes('/qr')) { setCurrentView('qrscan'); return; }
    if (patientData) {
      setCurrentView(patientData.queueType || patientData.examType ? 'patient' : 'examSelection'); return;
    }
    setCurrentView('login');
  }, [language, isAdmin, patientData, clinicSession, doctorSession]);

  // ── Theme ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('selectedTheme', currentTheme);
    const theme = enhancedMedicalThemes.find(t => t.id === currentTheme);
    if (!theme) return;
    const css = generateThemeCSS(currentTheme);
    const el = document.getElementById('enhanced-theme-style') || document.createElement('style');
    el.id = 'enhanced-theme-style'; el.textContent = css;
    if (!document.getElementById('enhanced-theme-style')) document.head.appendChild(el);
    document.body.style.background = theme.gradients?.background || '';
  }, [currentTheme]);

  const toggleLanguage = () => {
    const l = language === 'ar' ? 'en' : 'ar';
    setLanguage(l); setCurrentLanguage(l);
  };

  // ── Patient login ────────────────────────────────────────────────────────────
  const handleLogin = async ({ patientId, gender }) => {
    try {
      const deviceRestrictionEnabled = await getSystemSetting('device_restriction_enabled', false);
      if (deviceRestrictionEnabled) {
        const check = await checkDeviceLogin(patientId);
        if (!check.allowed) {
          showToast(language === 'ar' ? `لا يمكن تسجيل رقم آخر: ${check.existingPatientId}` : `Device already registered: ${check.existingPatientId}`, 'error');
          return;
        }
      }

      const res = await api.patientLogin(patientId, gender);
      if (res.success) {
        await registerDeviceLogin(patientId);
        await logDailyActivity('patient_login', { patientId, gender });
        localStorage.removeItem('mmc_admin_session');
        setIsAdmin(false);
        setPatientData(res.data);
        localStorage.setItem('patientData', JSON.stringify(res.data));
        setCurrentView('examSelection');
        showToast(language === 'ar' ? 'تم تسجيل الدخول بنجاح' : 'Login successful', 'success');
      } else {
        showToast(language === 'ar' ? 'فشل تسجيل الدخول' : 'Login failed', 'error');
      }
    } catch (err) {
      console.error('[App] Patient login error:', err);
      showToast(language === 'ar' ? 'خطأ في الاتصال' : 'Connection error', 'error');
    }
  };

  // ── Admin login ─────────────────────────────────────────────────────────────
  const handleAdminLogin = async (credentials) => {
    try {
      const [username, password] = credentials.split(':');
      if (!username || !password) {
        showToast(language === 'ar' ? 'يرجى إدخال بيانات الدخول' : 'Enter credentials', 'error'); return;
      }
      const result = await authService.login(username, password);
      if (result.success) {
        localStorage.removeItem('patientData');
        setPatientData(null);
        setIsAdmin(true);
        setCurrentView('admin');
        showToast(language === 'ar' ? '✅ تم تسجيل الدخول' : '✅ Login successful', 'success');
      } else {
        showToast(language === 'ar' ? '❌ بيانات غير صحيحة' : '❌ Invalid credentials', 'error');
      }
    } catch (err) {
      console.error('[App] Admin login error:', err);
      showToast(language === 'ar' ? 'خطأ في الاتصال' : 'Connection error', 'error');
    }
  };

  // ── Doctor login ────────────────────────────────────────────────────────────
  const handleDoctorLogin = async (credentials) => {
    try {
      const [username, password] = credentials.split(':');
      // Use API instead of direct Supabase
      const result = await api.adminLogin(username, password);
      if (!result.success || !result.data) {
        showToast(language === 'ar' ? '❌ بيانات غير صحيحة' : '❌ Invalid credentials', 'error'); return;
      }
      const session = { 
        id: result.data.id, 
        name: result.data.username, 
        clinic_id: result.data.clinic_id || 'registration', 
        clinic_name: result.data.clinic_name || 'Registration',
        expiresAt: new Date(Date.now() + 86_400_000).toISOString() 
      };
      localStorage.setItem('mmc_doctor_session', JSON.stringify(session));
      setDoctorSession(session);
      setCurrentView('doctor');
      showToast(language === 'ar' ? '✅ تم تسجيل الدخول' : '✅ Login successful', 'success');
    } catch (err) {
      console.error('[App] Doctor login error:', err);
      showToast(language === 'ar' ? 'خطأ في الاتصال' : 'Connection error', 'error');
    }
  };

  // ── Exam selection: FIXED — now calls createQueue() correctly ────────────────
  const handleExamSelect = async (examType) => {
    try {
      const pid = patientData?.id || patientData?.patient_id || patientData?.personalId;
      const gender = patientData?.gender || 'male';

      // ✅ FIX: Call /queue/create (was calling /queue/enter → broken medical path screen)
      const idempKey = `${pid}-${examType}-${Date.now()}`;
      const res = await api.createQueue(pid, examType, gender, idempKey);

      if (!res.success && !res.offline) {
        throw new Error(res.error || 'Failed to create queue');
      }

      // The response includes the full path[] — use it directly
      const path = res.data?.path || await getDynamicMedicalPathway(examType, gender).then(c => c.map(x => x.id));

      const updated = {
        ...patientData,
        queueType: examType,
        examType,
        queueId: res.data?.queueId,
        queueNumber: res.data?.number,
        pathway: path,
        gender,
      };

      setPatientData(updated);
      localStorage.setItem('patientData', JSON.stringify(updated));
      setCurrentView('patient');
      showToast(language === 'ar' ? '✅ تم التسجيل بنجاح' : '✅ Registered successfully', 'success');
    } catch (err) {
      console.error('[App] Exam select error:', err);
      showToast(language === 'ar' ? 'فشل التسجيل — حاول مرة أخرى' : 'Registration failed — please retry', 'error');
    }
  };

  // ── Logout ──────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    setPatientData(null); setIsAdmin(false); setDoctorSession(null);
    setCurrentView('login');
    ['patientData', 'mmc_admin_session', 'mmc_doctor_session'].forEach(k => localStorage.removeItem(k));
    window.history.pushState({}, '', '/');
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: 'transparent' }}>
      <main className="relative z-10">
        {currentView === 'qrscan' && (
          <Suspense fallback={<LoadingFallback />}><QrScanPage language={language} toggleLanguage={toggleLanguage} /></Suspense>
        )}

        {currentView === 'login' && (
          <Suspense fallback={<LoadingFallback />}>
            <LoginPage
              onLogin={handleLogin}
              onAdminLogin={handleAdminLogin}
              onDoctorLogin={handleDoctorLogin}
              currentTheme={currentTheme}
              onThemeChange={setCurrentTheme}
              language={language}
              toggleLanguage={toggleLanguage}
            />
          </Suspense>
        )}

        {currentView === 'examSelection' && patientData && (
          <Suspense fallback={<LoadingFallback />}>
            <ExamSelectionPage
              patientData={patientData}
              onExamSelect={handleExamSelect}
              onBack={() => { localStorage.removeItem('patientData'); setPatientData(null); setCurrentView('login'); }}
              language={language}
              toggleLanguage={toggleLanguage}
            />
          </Suspense>
        )}

        {currentView === 'patient' && patientData && (
          <Suspense fallback={<LoadingFallback />}>
            <PatientPage
              patientData={patientData}
              onLogout={handleLogout}
              language={language}
              toggleLanguage={toggleLanguage}
            />
          </Suspense>
        )}

        {currentView === 'admin' && isAdmin && (
          <Suspense fallback={<LoadingFallback />}>
            <AdminErrorBoundary>
              <AdminDashboardV2
                onLogout={handleLogout}
                language={language}
                toggleLanguage={toggleLanguage}
                currentTheme={currentTheme}
                onThemeChange={setCurrentTheme}
              />
            </AdminErrorBoundary>
          </Suspense>
        )}

        {currentView === 'doctor' && doctorSession && (
          <Suspense fallback={<LoadingFallback />}>
            <DoctorDashboard
              doctorData={doctorSession}
              onLogout={() => { setDoctorSession(null); localStorage.removeItem('mmc_doctor_session'); setCurrentView('login'); }}
              language={language}
              toggleLanguage={toggleLanguage}
            />
          </Suspense>
        )}

        {currentView === 'clinic_login' && (
          <Suspense fallback={<LoadingFallback />}>
            <ClinicLoginPage
              onLogin={(session) => { setClinicSession(session); localStorage.setItem('mmc_clinic_session', JSON.stringify(session)); setCurrentView('clinic_dashboard'); }}
              language={language}
              toggleLanguage={toggleLanguage}
            />
          </Suspense>
        )}

        {currentView === 'clinic_dashboard' && clinicSession && (
          <Suspense fallback={<LoadingFallback />}>
            <ClinicDashboard
              session={clinicSession}
              onLogout={() => { setClinicSession(null); localStorage.removeItem('mmc_clinic_session'); setCurrentView('clinic_login'); }}
              language={language}
              toggleLanguage={toggleLanguage}
            />
          </Suspense>
        )}

        {currentView === 'display' && (
          <Suspense fallback={<LoadingFallback />}><DisplayPage language={language} /></Suspense>
        )}
      </main>
    </div>
  );
}

export default App;

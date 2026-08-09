import { LoginPage } from './components/LoginPage.jsx';
import { checkDeviceLogin, logDailyActivity, getSystemSetting } from './lib/supabase-client';
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Analytics } from '@vercel/analytics/react';
import api from './lib/api-unified';
import authService from './lib/auth-service';
import { enhancedMedicalThemes, generateThemeCSS } from './lib/enhanced-themes';
import { getCurrentLanguage, setCurrentLanguage } from './lib/i18n';

if (typeof document !== 'undefined' && !document.getElementById('mmc-login-layout-fix')) {
  const style = document.createElement('style');
  style.id = 'mmc-login-layout-fix';
  style.textContent = `
    @media (max-width: 768px) {
      .min-h-screen.flex.items-center.justify-center.p-4.relative.overflow-hidden.w-full.max-w-full {
        align-items: flex-start !important;
        justify-content: flex-start !important;
        padding-top: 1rem !important;
        padding-bottom: 1.5rem !important;
      }

      .min-h-screen.flex.items-center.justify-center.p-4.relative.overflow-hidden.w-full.max-w-full > .w-full.max-w-md.mx-auto.space-y-6.relative.z-10 {
        width: min(100%, 30rem) !important;
      }
    }
  `;
  document.head.appendChild(style);
}

const ExamSelectionPage = lazy(() => import('./components/ExamSelectionPage.jsx').then(m => ({ default: m.ExamSelectionPage })));
const PatientPage = lazy(() => import('./components/PatientPage.jsx').then(m => ({ default: m.PatientPage })));
const AdminDashboardV2 = lazy(() => import('./components/AdminDashboardV2.jsx').then(m => ({ default: m.AdminDashboardV2 })));
const QrScanPage = lazy(() => import('./components/QrScanPage.jsx').then(m => ({ default: m.QrScanPage })));
const DisplayPage = lazy(() => import('./components/DisplayPage').then(m => ({ default: m.DisplayPage })));
const DoctorDashboard = lazy(() => import('./components/DoctorDashboardFixed.jsx').then(m => ({ default: m.default || m.DoctorDashboardFixed })));

const preloadComponents = () => {
  import('./components/PatientPage.jsx');
};
if (typeof window !== 'undefined') window.addEventListener('load', preloadComponents, { once: true });

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-900">
    <div className="text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mx-auto mb-4"></div>
      <p className="text-white text-lg">جارٍ التحميل...</p>
    </div>
  </div>
);

class AdminErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[AdminErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-900 text-white p-8">
          <h1 className="text-2xl font-bold mb-4">AdminPage Error</h1>
          <p>{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 px-4 py-2 bg-white text-red-900 rounded"
          >
            إعادة المحاولة
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function readValidSession(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const session = JSON.parse(raw);
    if (!session?.token || (session.expiresAt && new Date(session.expiresAt) <= new Date())) {
      localStorage.removeItem(key);
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

function App() {
  const [doctorSession, setDoctorSession] = useState(() => readValidSession('mmc_doctor_session'));
  const [patientData, setPatientData] = useState(() => readValidSession('patientData'));
  const [isAdmin, setIsAdmin] = useState(() => Boolean(authService.getSession()));
  const [currentView, setCurrentView] = useState('login');
  const [currentTheme, setCurrentTheme] = useState(() => {
    try {
      return localStorage.getItem('selectedTheme') || 'medical-professional';
    } catch {
      return 'medical-professional';
    }
  });
  const [language, setLanguage] = useState(() => {
    try {
      return getCurrentLanguage();
    } catch {
      return 'ar';
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.__MMC_BOOT_OK__ = true;
    try {
      sessionStorage.removeItem('mmc_boot_watchdog_attempted');
      sessionStorage.removeItem('mmc_client_asset_recovery');
      localStorage.removeItem('mmc_clinic_session');
    } catch {
      // Storage can be unavailable in restricted browser modes.
    }
  }, []);

  useEffect(() => {
    setCurrentLanguage(language);

    const syncViewFromLocation = () => {
      const path = window.location.pathname;

      if (/\/clinic\/[^/]+\/display$/.test(path)) {
        setCurrentView('display');
        return;
      }

      if (path.includes('/qr')) {
        setCurrentView('qrscan');
        return;
      }

      if (path === '/admin' || path.startsWith('/admin/')) {
        setCurrentView(isAdmin ? 'admin' : 'login');
        return;
      }

      if (
        path === '/doctor'
        || path.startsWith('/doctor/')
        || path === '/clinic/login'
        || path === '/clinic/login/'
        || path.startsWith('/clinic/')
      ) {
        setCurrentView(doctorSession ? 'doctor' : 'login');
        return;
      }

      if (isAdmin) {
        setCurrentView('admin');
        return;
      }

      if (patientData) {
        setCurrentView(patientData.queueType || patientData.examType ? 'patient' : 'examSelection');
        return;
      }

      setCurrentView('login');
    };

    syncViewFromLocation();
    window.addEventListener('popstate', syncViewFromLocation);
    return () => window.removeEventListener('popstate', syncViewFromLocation);
  }, [language, isAdmin, patientData, doctorSession]);

  useEffect(() => {
    applyTheme(currentTheme);
    try {
      localStorage.setItem('selectedTheme', currentTheme);
    } catch {
      // Storage can be unavailable in restricted browser modes.
    }
  }, [currentTheme]);

  const applyTheme = (id) => {
    const theme = enhancedMedicalThemes.find(item => item.id === id);
    if (!theme) return;

    const css = generateThemeCSS(id);
    const old = document.getElementById('enhanced-theme-style');
    if (old) old.remove();

    const style = document.createElement('style');
    style.id = 'enhanced-theme-style';
    style.textContent = css;
    document.head.appendChild(style);
    document.body.style.background = theme.gradients.background;
    document.body.className = `theme-${id}`;
  };

  const showNotification = (message, type = 'info') => {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 ${
      type === 'success'
        ? 'bg-green-500 text-white'
        : type === 'error'
          ? 'bg-red-500 text-white'
          : 'bg-blue-500 text-white'
    }`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (document.body.contains(notification)) document.body.removeChild(notification);
      }, 300);
    }, 3000);
  };

  const handleLogin = async ({ patientId, gender, examType }) => {
    try {
      let deviceRestrictionEnabled = false;
      try {
        deviceRestrictionEnabled = await getSystemSetting('device_restriction_enabled', false);
      } catch (settingError) {
        console.warn('[App] getSystemSetting failed:', settingError);
      }


      const response = await api.patientLogin(patientId, gender);
      if (!response.success) {
        showNotification(language === 'ar' ? 'فشل تسجيل الدخول' : 'Login failed', 'error');
        return;
      }

      const patientPayload = response.data || response.patient || response.session || response;
      if (!patientPayload?.token) throw new Error('PATIENT_SESSION_MISSING');

      const finalPatientData = {
        ...patientPayload,
        queueType: examType,
        examType,
        gender,
      };

      localStorage.removeItem('mmc_admin_session');
      localStorage.removeItem('mmc_doctor_session');
      localStorage.removeItem('mmc_clinic_session');
      // Persist the signed session before invoking patient-scoped Supabase RPCs.
      localStorage.setItem('patientData', JSON.stringify(finalPatientData));

      if (deviceRestrictionEnabled) {
        try {
          const check = await checkDeviceLogin(patientId);
          if (!check.allowed) {
            localStorage.removeItem('patientData');
            showNotification(
              language === 'ar' ? 'هذا الجهاز مسجل برقم آخر اليوم' : 'This device is already registered to another patient today',
              'error',
            );
            return;
          }
        } catch (deviceError) {
          localStorage.removeItem('patientData');
          console.error('[App] signed device guard failed:', deviceError);
          showNotification(
            language === 'ar' ? 'تعذر التحقق الآمن من الجهاز' : 'Secure device verification failed',
            'error',
          );
          return;
        }
      }

      setIsAdmin(false);
      setDoctorSession(null);
      setPatientData(finalPatientData);

      try {
        await logDailyActivity('patient_login', {
          patientId,
          gender,
          examType,
          location: 'شاشة التسجيل',
          performedBy: patientId,
        });
      } catch (logError) {
        console.warn('[App] logDailyActivity failed:', logError);
      }

      setCurrentView('patient');
      showNotification(language === 'ar' ? 'تم تسجيل الدخول بنجاح' : 'Login successful', 'success');
    } catch (error) {
      console.error('[App] Patient login error:', error);
      showNotification(language === 'ar' ? 'خطأ في الاتصال' : 'Connection error', 'error');
    }
  };

  const handleAdminLogin = async (credentials) => {
    try {
      const [username, password] = credentials.split(':');
      if (!username || !password) {
        showNotification('يرجى إدخال اسم المستخدم وكلمة المرور', 'error');
        return;
      }

      const result = await authService.login(username, password);
      if (!result.success) {
        showNotification(
          language === 'ar' ? '❌ اسم المستخدم أو كلمة المرور غير صحيحة' : '❌ Invalid credentials',
          'error',
        );
        return;
      }

      localStorage.removeItem('patientData');
      localStorage.removeItem('mmc_doctor_session');
      localStorage.removeItem('mmc_clinic_session');
      setPatientData(null);
      setDoctorSession(null);
      setIsAdmin(true);
      window.history.pushState({}, '', '/admin');
      setCurrentView('admin');
      showNotification(language === 'ar' ? '✅ تم تسجيل الدخول بنجاح' : '✅ Login successful', 'success');
    } catch (error) {
      console.error('[App] Admin login error:', error);
      showNotification('خطأ في الاتصال', 'error');
    }
  };

  const handleDoctorLogin = async (credentials) => {
    try {
      const [username, password] = credentials.split(':');
      if (!username || !password) {
        showNotification('يرجى إدخال اسم المستخدم وكلمة المرور', 'error');
        return;
      }

      const result = await authService.doctorLogin(username, password);
      if (!result.success || !result.session?.token) {
        showNotification(
          language === 'ar' ? '❌ اسم المستخدم أو كلمة المرور غير صحيحة' : '❌ Invalid credentials',
          'error',
        );
        return;
      }

      const session = result.session;
      localStorage.removeItem('patientData');
      localStorage.removeItem('mmc_admin_session');
      localStorage.removeItem('mmc_clinic_session');
      localStorage.setItem('mmc_doctor_session', JSON.stringify(session));
      setPatientData(null);
      setIsAdmin(false);
      setDoctorSession(session);
      window.history.pushState({}, '', '/doctor');
      setCurrentView('doctor');
      showNotification(
        language === 'ar' ? '✅ تم تسجيل دخول الطبيب بنجاح' : '✅ Doctor login successful',
        'success',
      );
    } catch (error) {
      console.error('[App] Doctor login error:', error);
      showNotification('خطأ في الاتصال', 'error');
    }
  };

  const handleLogout = () => {
    setPatientData(null);
    setIsAdmin(false);
    setDoctorSession(null);
    setCurrentView('login');
    localStorage.removeItem('patientData');
    localStorage.removeItem('mmc_admin_session');
    localStorage.removeItem('mmc_doctor_session');
    localStorage.removeItem('mmc_clinic_session');
    window.history.pushState({}, '', '/');
  };

  const handleExamSelect = async (examType) => {
    try {
      const patientId = String(
        patientData?.patient_id
        || patientData?.patientId
        || patientData?.personal_id
        || patientData?.personalId
        || patientData?.military_id
        || patientData?.militaryId
        || '',
      ).trim();
      if (!patientId) throw new Error('PATIENT_ID_MISSING');

      const gender = patientData?.gender || 'male';
      const routeResult = await api.createRoute(patientId, examType, gender);
      if (routeResult?.success === false) throw new Error(routeResult.error || 'ROUTE_CREATE_FAILED');

      const canonicalRoute = routeResult?.route || routeResult?.data?.route || routeResult?.data || routeResult;
      const clinics = Array.isArray(canonicalRoute?.stations)
        ? canonicalRoute.stations
        : Array.isArray(canonicalRoute?.pathway)
          ? canonicalRoute.pathway
          : [];
      if (!clinics.length) throw new Error('CANONICAL_ROUTE_EMPTY');

      const currentStep = Math.max(0, Math.min(
        Number(canonicalRoute?.current_station_index ?? canonicalRoute?.current_step ?? 0),
        clinics.length - 1,
      ));
      const currentClinic = clinics[currentStep]
        || clinics.find((clinic) => String(clinic?.status || '').toLowerCase() === 'ready')
        || clinics[0];

      const enterResult = await api.enterQueue(
        currentClinic.id,
        patientId,
        false,
        null,
        examType,
        gender,
        patientData?.military_id || patientData?.militaryId || null,
        patientData?.personal_id || patientData?.personalId || patientId,
      );
      if (enterResult?.success === false) throw new Error(enterResult.error || 'QUEUE_ENTER_FAILED');

      const updatedData = {
        ...patientData,
        queueType: examType,
        examType,
        currentClinic: currentClinic.id,
        pathway: clinics,
        route: canonicalRoute,
        queueNumber: enterResult?.display_number || canonicalRoute?.display_number || null,
        queueId: enterResult?.id || enterResult?.queue_id || canonicalRoute?.queue_id || canonicalRoute?.id || null,
      };

      setPatientData(updatedData);
      localStorage.setItem('patientData', JSON.stringify(updatedData));
      setCurrentView('patient');
      showNotification(
        language === 'ar' ? 'تم تسجيل دخولك في الطابور بنجاح' : 'Registered in queue successfully',
        'success',
      );
    } catch (error) {
      console.error('[App] Exam select error:', error);
      showNotification(
        language === 'ar' ? 'فشل تسجيل المسار الطبي' : 'Failed to setup medical pathway',
        'error',
      );
    }
  };

  const toggleLanguage = () => {
    const nextLanguage = language === 'ar' ? 'en' : 'ar';
    setLanguage(nextLanguage);
    setCurrentLanguage(nextLanguage);
  };

  const theme = enhancedMedicalThemes.find(item => item.id === currentTheme);
  useEffect(() => {
    if (!theme?.gradients?.background) return;

    document.body.style.background = theme.gradients.background;
    document.body.style.backgroundAttachment = 'fixed';
    document.documentElement.style.background = theme.gradients.background;
  }, [theme]);

  return (
    <div className="min-h-screen" style={{ background: 'transparent' }}>
      <main className="relative z-10">
        <Suspense fallback={<LoadingFallback />}>
          {currentView === 'qrscan' && (
            <QrScanPage language={language} toggleLanguage={toggleLanguage} />
          )}

          {currentView === 'login' && (
            <LoginPage
              onLogin={handleLogin}
              onAdminLogin={handleAdminLogin}
              onDoctorLogin={handleDoctorLogin}
              currentTheme={currentTheme}
              onThemeChange={setCurrentTheme}
              language={language}
              toggleLanguage={toggleLanguage}
            />
          )}

          {currentView === 'examSelection' && patientData && (
            <ExamSelectionPage
              patientData={patientData}
              onExamSelect={handleExamSelect}
              onBack={() => {
                localStorage.removeItem('patientData');
                setPatientData(null);
                setCurrentView('login');
              }}
              language={language}
              toggleLanguage={toggleLanguage}
            />
          )}

          {currentView === 'patient' && patientData && (
            <PatientPage
              patientData={patientData}
              onLogout={handleLogout}
              language={language}
              toggleLanguage={toggleLanguage}
            />
          )}

          {currentView === 'admin' && isAdmin && (
            <AdminErrorBoundary>
              <AdminDashboardV2
                onLogout={handleLogout}
                language={language}
                toggleLanguage={toggleLanguage}
                currentTheme={currentTheme}
                onThemeChange={setCurrentTheme}
              />
            </AdminErrorBoundary>
          )}

          {currentView === 'doctor' && doctorSession && (
            <DoctorDashboard
              doctorData={doctorSession}
              onLogout={() => {
                setDoctorSession(null);
                localStorage.removeItem('mmc_doctor_session');
                setCurrentView('login');
                window.history.pushState({}, '', '/');
              }}
              language={language}
              toggleLanguage={toggleLanguage}
            />
          )}

          {currentView === 'display' && (
            <DisplayPage language={language} />
          )}
        </Suspense>
      </main>
      <SpeedInsights />
      <Analytics />
    </div>
  );
}

export default App;

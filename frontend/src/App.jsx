import InteractiveElementReporter from './lib/interactive-element-reporter';
import healthMonitor from './lib/app-health-monitor';
import HealthAlertBanner from './components/HealthAlertBanner';
import AdvancedAutoRepair from './lib/advanced-auto-repair';
import { apiClient } from './lib/api/client';
import './core/notification-engine.js';
import React, { useState, useEffect, lazy, Suspense } from 'react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { Analytics } from '@vercel/analytics/react'
// Lazy loading للمكونات الرئيسية لتسريع التحميل الأولي
const LoginPage = lazy(() => import('./components/LoginPage.jsx').then(m => ({ default: m.LoginPage })))
const ExamSelectionPage = lazy(() => import('./components/ExamSelectionPage.jsx').then(m => ({ default: m.ExamSelectionPage })))
const PatientPage = lazy(() => import('./components/PatientPage.jsx').then(m => ({ default: m.PatientPage })))
import api from './lib/api-unified'
import authService from './lib/auth-service'
const ClinicLoginPage = lazy(() => import('./components/ClinicLoginPage').then(m => ({ default: m.ClinicLoginPage })))
import getDynamicMedicalPathway from './lib/dynamic-pathways'
import { enhancedMedicalThemes, generateThemeCSS } from './lib/enhanced-themes'
import { t, getCurrentLanguage, setCurrentLanguage } from './lib/i18n'
import { autoRepairSystem } from './lib/auto-repair-system'
import { functionTableMonitor } from './lib/function-table-monitor'
import { elementMonitor } from './lib/element-monitor'
import { realtimeSyncManager } from './lib/realtime-sync-manager'
import { performanceOptimizer } from './lib/performance-optimizer'
import { instantUpdateBroadcaster } from './lib/instant-update-broadcaster'

// Lazy Loading للمكونات الثقيلة
const AdminDashboardV2 = lazy(() => import('./components/AdminDashboardV2.jsx').then(m => ({ default: m.AdminDashboardV2 })))
const QrScanPage = lazy(() => import('./components/QrScanPage.jsx').then(m => ({ default: m.QrScanPage })))
const DisplayPage = lazy(() => import('./components/DisplayPage').then(m => ({ default: m.DisplayPage })))
const ClinicDashboard = lazy(() => import('./components/ClinicDashboard').then(m => ({ default: m.ClinicDashboard })))

// Preload المكونات عند بدء التطبيق لتسريع التنقل
const preloadComponents = () => {
  import('./components/LoginPage.jsx');
  import('./components/PatientPage.jsx');
};
if (typeof window !== 'undefined') {
  window.addEventListener('load', preloadComponents, { once: true });
}

// Loading Fallback Component
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-900">
    <div className="text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mx-auto mb-4"></div>
      <p className="text-white text-lg">جارٍ التحميل...</p>
    </div>
  </div>
)

// Error Boundary for AdminPage
class AdminErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('[AdminErrorBoundary] Error caught:', error, errorInfo);
    this.setState({ errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-900 text-white p-8">
          <h1 className="text-2xl font-bold mb-4">AdminPage Error</h1>
          <p className="mb-2">Error: {this.state.error?.message || 'Unknown error'}</p>
          <pre className="bg-black p-4 rounded overflow-auto text-sm">
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  // ============= STATE MANAGEMENT =============
  const [clinicSession, setClinicSession] = useState(() => {
    try {
      const stored = localStorage.getItem('mmc_clinic_session')
      return stored ? JSON.parse(stored) : null
    } catch(e) { return null }
  })

  const [patientData, setPatientData] = useState(() => {
    try {
      const storedData = localStorage.getItem('patientData');
      return storedData ? JSON.parse(storedData) : null;
    } catch (error) { return null }
  })

  // ✅ إصلاح: التحقق من حالة الإدارة بطريقة أفضل
  const [isAdmin, setIsAdmin] = useState(() => {
    try {
      const adminSession = localStorage.getItem('mmc_admin_session');
      if (adminSession) {
        const session = JSON.parse(adminSession);
        const isValid = new Date(session.expiresAt) > new Date();
        console.log('[App] Admin session check:', { isValid, expiresAt: session.expiresAt });
        return isValid;
      }
    } catch (e) { 
      console.error('[App] Error checking admin session:', e);
      return false 
    }
    return false
  })

  const [currentView, setCurrentView] = useState('login')
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('selectedTheme') || 'medical-professional')
  const [language, setLanguage] = useState(getCurrentLanguage())

  // ============= AUTO REPAIR SYSTEM =============
  useEffect(() => {
    // تفعيل نظام الإصلاح التلقائي
    autoRepairSystem.startMonitoring();
    console.log('✅ نظام الإصلاح التلقائي: تم التفعيل');

    functionTableMonitor.startMonitoring();

    // تفعيل نظام مراقبة العناصر التفاعلية
    elementMonitor.startMonitoring();

    // تفعيل نظام الإصلاح التلقائي المتقدم
    const advancedRepair = new AdvancedAutoRepair(apiClient);
    advancedRepair.startAutoRepair();
    // تهيئة نظام المراقبة الذاتية الشامل
    healthMonitor.init(apiClient);

    // تفعيل نظام التقارير للعناصر التفاعلية
    const elementReporter = new InteractiveElementReporter();
    elementReporter.startReporting();
    console.log('✅ نظام التقارير: تم التفعيل');
    console.log('✅ نظام الإصلاح التلقائي المتقدم: تم التفعيل');
    console.log('✅ نظام مراقبة العناصر: تم التفعيل');
    console.log('✅ نظام مراقبة الدوال والجداول: تم التفعيل');

    return () => {
      // لا نوقف المراقبة - نريدها مستمرة طوال فترة الجلسة
    };
  }, []);

  // ============= ROUTING LOGIC - ✅ إصلاح شامل =============
  useEffect(() => {
    setCurrentLanguage(language)

    const path = window.location.pathname;
    console.log('[App] Route check:', { path, isAdmin, hasPatientData: !!patientData });

    // ✅ إصلاح: الأولوية 1 - المسارات الإدارية (يجب التحقق منها أولاً)
    if (path === '/admin' || path.startsWith('/admin/')) {
      console.log('[App] Admin path detected');
      if (isAdmin) {
        console.log('[App] Admin session valid, showing admin dashboard');
        setCurrentView('admin');
      } else {
        console.log('[App] No admin session, showing login with admin mode');
        setCurrentView('login');
      }
      return;
    }

    // ✅ إصلاح: إذا كان المستخدم admin، نوجهه لشاشة الإدارة مباشرة
    if (isAdmin) {
      console.log('[App] Admin logged in, redirecting to admin dashboard');
      setCurrentView('admin');
      return;
    }

    // Priority 2: Patient flow
    if (patientData) {
      console.log('[App] Patient data found, showing patient view');
      // If patient is logged in, they MUST NOT see admin screen
      setCurrentView(patientData.queueType || patientData.examType ? 'patient' : 'examSelection');
      return;
    }

    // Priority 3: Clinic routes
    if (path === '/clinic/login' || path === '/clinic/login/') {
      setCurrentView('clinic_login');
      return;
    }
    if (path.match(/\/clinic\/[^/]+\/display$/)) {
      setCurrentView('display');
      return;
    }
    if (path.startsWith('/clinic/')) {
      setCurrentView(clinicSession ? 'clinic_dashboard' : 'clinic_login');
      return;
    }

    // Priority 4: QR Scan
    if (path.includes('/qr')) {
      setCurrentView('qrscan');
      return;
    }

    // Default: Login
    console.log('[App] Default to login view');
    setCurrentView('login');
  }, [language, isAdmin, patientData, clinicSession])

  // ============= THEME MANAGEMENT =============
  useEffect(() => {
    applyTheme(currentTheme)
    localStorage.setItem('selectedTheme', currentTheme)
  }, [currentTheme])

  const applyTheme = (themeId) => {
    const theme = enhancedMedicalThemes.find(t => t.id === themeId)
    if (!theme) return

    const themeCSS = generateThemeCSS(themeId)
    const existingStyle = document.getElementById('enhanced-theme-style')
    if (existingStyle) existingStyle.remove()

    const style = document.createElement('style')
    style.id = 'enhanced-theme-style'
    style.textContent = themeCSS
    document.head.appendChild(style)
    document.body.style.background = theme.gradients.background
    document.body.className = `theme-${themeId}`
  }

  // ============= NOTIFICATION SYSTEM =============
  const showNotification = (message, type = 'info') => {
    const notification = document.createElement('div')
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 ${
      type === 'success' ? 'bg-green-500 text-white' : type === 'error' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
    }`
    notification.textContent = message
    document.body.appendChild(notification)
    setTimeout(() => {
      notification.style.opacity = '0'
      setTimeout(() => { if (document.body.contains(notification)) document.body.removeChild(notification) }, 300)
    }, 3000)
  }

  // ============= LOGIN HANDLERS =============
  const handleLogin = async ({ patientId, gender }) => {
    try {
      // التحقق من عدم استخدام نفس الجهاز لإدخال رقم جديد في نفس اليوم - عبر قاعدة البيانات
      // Use static imports to avoid TDZ errors

      // التحقق من تفعيل نظام منع الجهاز
      const deviceRestrictionEnabled = await getSystemSetting('device_restriction_enabled', false);

      if (deviceRestrictionEnabled) {
        const deviceCheck = await checkDeviceLogin(patientId);
        if (!deviceCheck.allowed) {
          showNotification(
            language === 'ar' 
              ? 'لا يمكن استخدام هذا الجهاز لتسجيل رقم آخر اليوم. الرقم المسجل: ' + deviceCheck.existingPatientId
              : 'This device cannot register another number today. Registered: ' + deviceCheck.existingPatientId,
            'error'
          );
          return;
        }
      }

      const res = await api.patientLogin(patientId, gender)

      if (res.success) {
        // تسجيل الجهاز في قاعدة البيانات
        await registerDeviceLogin(patientId);

        // تسجيل النشاط اليومي
        await logDailyActivity('patient_login', {
          patientId,
          gender,
          location: 'شاشة التسجيل',
          performedBy: patientId
        });
        // Clear admin session when patient logs in to prevent conflicts
        localStorage.removeItem('mmc_admin_session');
        setIsAdmin(false);

        setPatientData(res.data)
        localStorage.setItem('patientData', JSON.stringify(res.data))
        setCurrentView('examSelection')
        showNotification(language === 'ar' ? 'تم تسجيل الدخول بنجاح' : 'Login successful', 'success')
      } else {
        showNotification(language === 'ar' ? 'فشل تسجيل الدخول' : 'Login failed', 'error')
      }
    } catch (error) {
      console.error('[App] Patient login error:', error);
      showNotification(language === 'ar' ? 'خطأ في الاتصال' : 'Connection error', 'error')
    }
  }

  const handleAdminLogin = async (credentials) => {
    try {
      console.log('[App] Admin login attempt');
      const [username, password] = credentials.split(':')

      if (!username || !password) {
        showNotification(language === 'ar' ? 'يرجى إدخال اسم المستخدم وكلمة المرور' : 'Please enter username and password', 'error')
        return;
      }

      const result = await authService.login(username, password)
      console.log('[App] Auth result:', result);

      if (result.success) {
        // Clear patient data when admin logs in
        localStorage.removeItem('patientData');
        setPatientData(null);

        setIsAdmin(true)
        setCurrentView('admin')
        showNotification(language === 'ar' ? '✅ تم تسجيل الدخول بنجاح' : '✅ Login successful', 'success')
      } else {
        showNotification(language === 'ar' ? '❌ اسم المستخدم أو كلمة المرور غير صحيحة' : '❌ Invalid credentials', 'error')
      }
    } catch (error) {
      console.error('[App] Admin login error:', error);
      showNotification(language === 'ar' ? 'خطأ في الاتصال' : 'Connection error', 'error')
    }
  }

  // ============= LOGOUT HANDLER =============
  const handleLogout = () => {
    setPatientData(null)
    setIsAdmin(false)
    setCurrentView('login')
    localStorage.removeItem('patientData')
    localStorage.removeItem('mmc_admin_session')
    window.history.pushState({}, '', '/')
  }

  // ============= LANGUAGE TOGGLE =============
  const toggleLanguage = () => {
    const newLang = language === 'ar' ? 'en' : 'ar'
    setLanguage(newLang)
    setCurrentLanguage(newLang)
  }

  // ============= RENDER =============
  const theme = enhancedMedicalThemes.find(t => t.id === currentTheme)

  // Apply theme background to body for full coverage
  React.useEffect(() => {
    if (theme?.gradients?.background) {
      document.body.style.background = theme.gradients.background;
      document.body.style.backgroundAttachment = 'fixed';
      document.documentElement.style.background = theme.gradients.background;
      document.documentElement.style.backgroundAttachment = 'fixed';
    }
  }, [theme]);

  return (
    <div className="min-h-screen" style={{ background: 'transparent' }}>
      <main className="relative z-10">
        {currentView === 'qrscan' && (
          <Suspense fallback={<LoadingFallback />}>
            <QrScanPage language={language} toggleLanguage={toggleLanguage} />
          </Suspense>
        )}

        {currentView === 'login' && (
          <LoginPage
            onLogin={handleLogin}
            onAdminLogin={handleAdminLogin}
            currentTheme={currentTheme}
            onThemeChange={setCurrentTheme}
            language={language}
            toggleLanguage={toggleLanguage}
          />
        )}

        {currentView === 'examSelection' && patientData && (
          <ExamSelectionPage
            patientData={patientData}
            onExamSelect={async (examType) => {
              try {
                // جلب المسار الديناميكي بناءً على نوع الفحص والجنس
                const clinics = await getDynamicMedicalPathway(examType, patientData.gender)

                if (!clinics || clinics.length === 0) {
                  console.error('[App] No clinics found for:', examType, patientData.gender);
                  throw new Error('No clinics found');
                }

                // ✅ إصلاح: ترتيب العيادات حسب الأقل ازدحاماً
                let firstClinic = clinics[0].id;
                try {
                  const queueCounts = await Promise.all(
                    clinics.map(async (clinic) => {
                      const count = await api.getQueueCount(clinic.id);
                      return { id: clinic.id, count: count || 0, clinic };
                    })
                  );
                  // ترتيب العيادات حسب الأقل ازدحاماً
                  queueCounts.sort((a, b) => a.count - b.count);
                  firstClinic = queueCounts[0].id;
                  console.log('[App] Weighted clinic selection:', queueCounts.map(q => `${q.clinic.nameAr}: ${q.count}`), 'Selected:', firstClinic);
                } catch (weightError) {
                  console.warn('[App] Weight calculation failed, using first clinic:', weightError);
                }

                const queueRes = await api.enterQueue(firstClinic, patientData.id, false)

                if (queueRes.success) {
                  const updatedPatientData = {
                    ...patientData,
                    queueType: examType,
                    currentClinic: firstClinic,
                    queueNumber: queueRes.display_number || queueRes.number,
                    ahead: queueRes.ahead || 0,
                    pathway: clinics
                  };

                  setPatientData(updatedPatientData)
                  localStorage.setItem('patientData', JSON.stringify(updatedPatientData))
                  setCurrentView('patient')
                  showNotification(language === 'ar' ? 'تم التسجيل بنجاح' : 'Registered successfully', 'success')
                } else {
                  throw new Error(queueRes.error || 'Failed to enter queue')
                }
              } catch (error) {
                console.error('[App] Exam select error:', error);
                showNotification(language === 'ar' ? 'فشل التسجيل' : 'Registration failed', 'error')
              }
            }}
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
          <Suspense fallback={<LoadingFallback />}>
            <HealthAlertBanner language={language} />
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

        {currentView === 'clinic_login' && (
          <ClinicLoginPage
            onLogin={(session) => {
              setClinicSession(session)
              localStorage.setItem('mmc_clinic_session', JSON.stringify(session))
              setCurrentView('clinic_dashboard')
            }}
            language={language}
            toggleLanguage={toggleLanguage}
          />
        )}

        {currentView === 'clinic_dashboard' && clinicSession && (
          <Suspense fallback={<LoadingFallback />}>
            <ClinicDashboard
              session={clinicSession}
              onLogout={() => {
                setClinicSession(null)
                localStorage.removeItem('mmc_clinic_session')
                setCurrentView('clinic_login')
              }}
              language={language}
              toggleLanguage={toggleLanguage}
            />
          </Suspense>
        )}

        {currentView === 'display' && (
          <Suspense fallback={<LoadingFallback />}>
            <DisplayPage language={language} />
          </Suspense>
        )}
      </main>
      <SpeedInsights />
      <Analytics />
    </div>
  )
}

export default App

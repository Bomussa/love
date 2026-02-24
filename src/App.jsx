import InteractiveElementReporter from './lib/interactive-element-reporter';
import AdvancedAutoRepair from './lib/advanced-auto-repair';
import { supabase } from './lib/supabase-client';
import './core/notification-engine.js';
import React, { useState, useEffect, lazy, Suspense } from 'react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { Analytics } from '@vercel/analytics/react'
import { LoginPage } from './components/LoginPage.jsx'
import { ExamSelectionPage } from './components/ExamSelectionPage.jsx'
import { PatientPage } from './components/PatientPage.jsx'
import api from './lib/api-unified'
import authService from './lib/auth-service'
import { ClinicLoginPage } from './components/ClinicLoginPage'
import getDynamicMedicalPathway from './lib/dynamic-pathways'
import { enhancedMedicalThemes, generateThemeCSS } from './lib/enhanced-themes'
import { t, getCurrentLanguage, setCurrentLanguage } from './lib/i18n'
import { autoRepairSystem } from './lib/auto-repair-system'
import { functionTableMonitor } from './lib/function-table-monitor'
import { elementMonitor } from './lib/element-monitor'

// Lazy Loading للمكونات الثقيلة
const AdminDashboardV2 = lazy(() => import('./components/AdminDashboardV2.jsx').then(m => ({ default: m.AdminDashboardV2 })))
const QrScanPage = lazy(() => import('./components/QrScanPage.jsx').then(m => ({ default: m.QrScanPage })))
const DisplayPage = lazy(() => import('./components/DisplayPage').then(m => ({ default: m.DisplayPage })))
const ClinicDashboard = lazy(() => import('./components/ClinicDashboard').then(m => ({ default: m.ClinicDashboard })))

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

  const [isAdmin, setIsAdmin] = useState(() => {
    try {
      const adminSession = localStorage.getItem('mmc_admin_session');
      if (adminSession) {
        const session = JSON.parse(adminSession);
        const isValid = new Date(session.expiresAt) > new Date();
        return isValid;
      }
    } catch (e) { 
      return false 
    }
    return false
  })

  const [currentView, setCurrentView] = useState('login')
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('selectedTheme') || 'medical-professional')
  const [language, setLanguage] = useState(getCurrentLanguage())

  // ============= AUTO REPAIR SYSTEM =============
  useEffect(() => {
    autoRepairSystem.startMonitoring();
    functionTableMonitor.startMonitoring();
    elementMonitor.startMonitoring();
    const advancedRepair = new AdvancedAutoRepair(supabase);
    advancedRepair.startAutoRepair();
    const elementReporter = new InteractiveElementReporter();
    elementReporter.startReporting();
    return () => {};
  }, []);

  // ============= ROUTING LOGIC =============
  useEffect(() => {
    setCurrentLanguage(language)
    const path = window.location.pathname;

    // الأولوية 1: الإدارة
    if (isAdmin || path === '/admin' || path.startsWith('/admin/')) {
      if (isAdmin) {
        setCurrentView('admin');
        if (path === '/' || path === '/login') {
          window.history.pushState({}, '', '/admin');
        }
      } else if (path.startsWith('/admin')) {
        setCurrentView('login');
      }
    }

    // الأولوية 2: المراجع
    if (!isAdmin && patientData) {
      setCurrentView(patientData.queueType || patientData.examType ? 'patient' : 'examSelection');
      return;
    }

    // الأولوية 3: العيادة
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

    // الأولوية 4: QR Scan
    if (path.includes('/qr')) {
      setCurrentView('qrscan');
      return;
    }

    // الوضع الافتراضي
    if (!isAdmin && !patientData && !path.startsWith('/clinic')) {
      setCurrentView('login');
    }
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
    notification.className = `fixed top-4 right-4 z-[100] p-4 rounded-lg shadow-lg transition-all duration-300 ${
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
      const { checkDeviceLogin, registerDeviceLogin, logDailyActivity, getSystemSetting } = await import('./lib/supabase-client.js');
      const deviceRestrictionEnabled = await getSystemSetting('device_restriction_enabled', false);
      if (deviceRestrictionEnabled) {
        const deviceCheck = await checkDeviceLogin(patientId);
        if (!deviceCheck.allowed) {
          showNotification(language === 'ar' ? 'لا يمكن استخدام هذا الجهاز لتسجيل رقم آخر اليوم' : 'Device restricted today', 'error');
          return;
        }
      }
      const res = await api.patientLogin(patientId, gender)
      if (res.success) {
        await registerDeviceLogin(patientId);
        await logDailyActivity('patient_login', { patientId, gender, location: 'شاشة التسجيل' });
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
      showNotification(language === 'ar' ? 'خطأ في الاتصال' : 'Connection error', 'error')
    }
  }

  const handleAdminLogin = async (credentials) => {
    try {
      const [username, password] = credentials.split(':')
      if (!username || !password) {
        showNotification(language === 'ar' ? 'يرجى إدخال البيانات' : 'Enter credentials', 'error')
        return;
      }
      const result = await authService.login(username, password)
      if (result.success) {
        // تحديث الحالات فوراً لضمان الدخول من أول مرة
        setIsAdmin(true)
        setPatientData(null)
        localStorage.removeItem('patientData')
        setCurrentView('admin')
        window.history.pushState({}, '', '/admin')
        showNotification(language === 'ar' ? '✅ تم تسجيل الدخول بنجاح' : '✅ Login successful', 'success')
      } else {
        showNotification(language === 'ar' ? '❌ بيانات غير صحيحة' : '❌ Invalid credentials', 'error')
      }
    } catch (error) {
      showNotification(language === 'ar' ? 'خطأ في الاتصال' : 'Connection error', 'error')
    }
  }

  const handleLogout = () => {
    setPatientData(null)
    setIsAdmin(false)
    setCurrentView('login')
    localStorage.removeItem('patientData')
    localStorage.removeItem('mmc_admin_session')
    window.history.pushState({}, '', '/')
  }

  const toggleLanguage = () => {
    const newLang = language === 'ar' ? 'en' : 'ar'
    setLanguage(newLang)
    setCurrentLanguage(newLang)
  }

  const theme = enhancedMedicalThemes.find(t => t.id === currentTheme)
  useEffect(() => {
    if (theme?.gradients?.background) {
      document.body.style.background = theme.gradients.background;
      document.body.style.backgroundAttachment = 'fixed';
      document.documentElement.style.background = theme.gradients.background;
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

        {currentView === 'examSelection' && (
          <ExamSelectionPage
            patientData={patientData}
            onExamSelect={(examType) => {
              const updatedData = { ...patientData, examType }
              setPatientData(updatedData)
              localStorage.setItem('patientData', JSON.stringify(updatedData))
              setCurrentView('patient')
            }}
            language={language}
            toggleLanguage={toggleLanguage}
          />
        )}

        {currentView === 'patient' && (
          <PatientPage
            patientData={patientData}
            onLogout={handleLogout}
            language={language}
            toggleLanguage={toggleLanguage}
          />
        )}

        {currentView === 'admin' && (
          <AdminErrorBoundary>
            <Suspense fallback={<LoadingFallback />}>
              {/* استيراد مباشر لضمان عدم وجود تأخير */}
              {(() => {
                const AdminPage = lazy(() => import('./components/AdminPage.jsx').then(m => ({ default: m.AdminPage })))
                return (
                  <AdminPage
                    onLogout={handleLogout}
                    language={language}
                    toggleLanguage={toggleLanguage}
                    currentTheme={currentTheme}
                    onThemeChange={setCurrentTheme}
                  />
                )
              })()}
            </Suspense>
          </AdminErrorBoundary>
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

        {currentView === 'clinic_dashboard' && (
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

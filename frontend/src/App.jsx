// Ensure notification listeners are active globally
import './core/notification-engine.js';
import React, { useState, useEffect } from 'react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { LoginPage } from './components/LoginPage'
import { ExamSelectionPage } from './components/ExamSelectionPage'
import { PatientPage } from './components/PatientPage'
import { AdminPage } from './components/AdminPage'
import { QrScanPage } from './components/QrScanPage'
import api from './lib/api-unified'
import authService from './lib/auth-service'
import { DisplayPage } from './components/DisplayPage'
import { ClinicLoginPage } from './components/ClinicLoginPage'
import { ClinicDashboard } from './components/ClinicDashboard'
import { enhancedMedicalThemes, generateThemeCSS } from './lib/enhanced-themes'
import { t, getCurrentLanguage, setCurrentLanguage } from './lib/i18n'

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
    const adminSession = localStorage.getItem('mmc_admin_session');
    if (adminSession) {
      try {
        const session = JSON.parse(adminSession);
        return new Date(session.expiresAt) > new Date();
      } catch (e) { return false }
    }
    return false;
  })

  const [currentView, setCurrentView] = useState('login')
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('selectedTheme') || 'medical-professional')
  const [language, setLanguage] = useState(getCurrentLanguage())
  const [systemHealth, setSystemHealth] = useState({ status: 'healthy', message: t('system_healthy') })

  useEffect(() => {
    setCurrentLanguage(language)
    
    // Routing Logic
    const path = window.location.pathname;
    if (path.includes('/admin') || isAdmin) {
      setCurrentView('admin');
    } else if (path.includes('/clinic/login')) {
      setCurrentView('clinic_login');
    } else if (path.match(/\/clinic\/[^/]+\/display$/)) {
      setCurrentView('display');
    } else if (path.match(/\/clinic\/[^/]+$/)) {
      setCurrentView(clinicSession ? 'clinic_dashboard' : 'clinic_login');
    } else if (path.includes('/qr')) {
      setCurrentView('qrscan');
    } else if (patientData) {
      setCurrentView(patientData.examType ? 'patient' : 'examSelection');
    } else {
      setCurrentView('login');
    }
  }, [language, isAdmin, patientData, clinicSession])

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

  const handleLogin = async ({ patientId, gender }) => {
    const res = await api.patientLogin(patientId, gender)
    if (res.success) {
      setPatientData(res.data)
      localStorage.setItem('patientData', JSON.stringify(res.data))
      showNotification(language === 'ar' ? 'تم تسجيل الدخول بنجاح' : 'Login successful', 'success')
    } else {
      showNotification(language === 'ar' ? 'فشل تسجيل الدخول' : 'Login failed', 'error')
    }
  }

  const handleAdminLogin = async (credentials) => {
    const [username, password] = credentials.split(':')
    const result = await authService.login(username, password)
    if (result.success) {
      setIsAdmin(true)
      setCurrentView('admin')
      showNotification(language === 'ar' ? '✅ تم تسجيل الدخول بنجاح' : '✅ Login successful', 'success')
    } else {
      showNotification(language === 'ar' ? `❌ ${result.error}` : `❌ ${result.error}`, 'error')
    }
  }

  const handleClinicLogin = async (clinicId, pin) => {
    const result = await api.verifyPin(clinicId, pin)
    if (result.success) {
      const session = { clinicId, pin, loginTime: Date.now() }
      setClinicSession(session)
      localStorage.setItem('mmc_clinic_session', JSON.stringify(session))
      showNotification(language === 'ar' ? 'تم الدخول بنجاح' : 'Login successful', 'success')
    } else {
      showNotification(language === 'ar' ? 'PIN غير صحيح' : 'Invalid PIN', 'error')
    }
  }

  const handleLogout = () => {
    setPatientData(null)
    setIsAdmin(false)
    localStorage.removeItem('patientData')
    localStorage.removeItem('mmc_admin_session')
    setCurrentView('login')
    window.history.pushState({}, '', '/')
  }

  const toggleLanguage = () => {
    const newLang = language === 'ar' ? 'en' : 'ar'
    setLanguage(newLang)
    setCurrentLanguage(newLang)
  }

  return (
    <div className="min-h-screen">
      <main className="relative z-10">
        {currentView === 'qrscan' && <QrScanPage language={language} toggleLanguage={toggleLanguage} />}
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
            onExamSelect={(type) => { setPatientData({...patientData, examType: type}); setCurrentView('patient'); }} 
            onBack={() => setCurrentView('login')} 
            language={language} 
            toggleLanguage={toggleLanguage} 
          />
        )}
        {currentView === 'patient' && patientData && <PatientPage patientData={patientData} onLogout={handleLogout} language={language} toggleLanguage={toggleLanguage} />}
        {currentView === 'clinic_login' && <ClinicLoginPage onLogin={handleClinicLogin} language={language} toggleLanguage={toggleLanguage} />}
        {currentView === 'clinic_dashboard' && clinicSession && (
          <ClinicDashboard clinicId={clinicSession.clinicId} pin={clinicSession.pin} onLogout={() => { setClinicSession(null); localStorage.removeItem('mmc_clinic_session'); }} language={language} />
        )}
        {currentView === 'display' && <DisplayPage clinicId={window.location.pathname.split('/')[2]} language={language} />}
        {currentView === 'admin' && isAdmin && (
          <AdminErrorBoundary>
            <AdminPage onLogout={handleLogout} language={language} toggleLanguage={toggleLanguage} currentTheme={currentTheme} onThemeChange={setCurrentTheme} systemHealth={systemHealth} />
          </AdminErrorBoundary>
        )}
      </main>
      <SpeedInsights />
    </div>
  )
}
export default App

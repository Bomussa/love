import React, { useState, useEffect, lazy, Suspense } from 'react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { Analytics } from '@vercel/analytics/react'
import api from './lib/api-unified'
import { enhancedMedicalThemes, generateThemeCSS } from './lib/enhanced-themes'
import { getCurrentLanguage, setCurrentLanguage } from './lib/i18n'

// Lazy loading للمكونات الرئيسية لتسريع التحميل الأولي
const LoginPage = lazy(() => import('./components/LoginPage.jsx').then(m => ({ default: m.LoginPage })))
const ExamSelectionPage = lazy(() => import('./components/ExamSelectionPage.jsx').then(m => ({ default: m.ExamSelectionPage })))
const PatientPage = lazy(() => import('./components/PatientPage.jsx').then(m => ({ default: m.PatientPage })))
const ClinicLoginPage = lazy(() => import('./components/ClinicLoginPage').then(m => ({ default: m.ClinicLoginPage })))
const AdminDashboardV2 = lazy(() => import('./components/AdminDashboardV2.jsx').then(m => ({ default: m.AdminDashboardV2 })))
const QrScanPage = lazy(() => import('./components/QrScanPage.jsx').then(m => ({ default: m.QrScanPage })))
const DisplayPage = lazy(() => import('./components/DisplayPage').then(m => ({ default: m.DisplayPage })))
const ClinicDashboard = lazy(() => import('./components/ClinicDashboard').then(m => ({ default: m.ClinicDashboard })))
const DoctorDashboard = lazy(() => import('./components/DoctorDashboard').then(m => ({ default: m.DoctorDashboard })))

// Loading Fallback Component
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-900">
    <div className="text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#C9A54C] mx-auto mb-4"></div>
      <p className="text-white text-lg">جارٍ التحميل...</p>
    </div>
  </div>
)

function App() {
  const [doctorSession, setDoctorSession] = useState(() => {
    try {
      const stored = localStorage.getItem('mmc_doctor_session')
      return stored ? JSON.parse(stored) : null
    } catch(e) { return null }
  })

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
        return new Date(session.expiresAt) > new Date();
      }
    } catch (e) { return false }
    return false
  })

  const [currentView, setCurrentView] = useState('login')
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('selectedTheme') || 'medical-professional')
  const [language, setLanguage] = useState(getCurrentLanguage())

  useEffect(() => {
    setCurrentLanguage(language)
    const path = window.location.pathname;

    if (path === '/admin' || path.startsWith('/admin/')) {
      setCurrentView(isAdmin ? 'admin' : 'login');
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

    if (path === '/doctor' || path.startsWith('/doctor/')) {
      setCurrentView(doctorSession ? 'doctor' : 'login');
      return;
    }

    if (path === '/clinic/login' || path === '/clinic/login/') {
      setCurrentView('clinic_login');
      return;
    }
    
    const clinicDisplayMatch = path.match(/\/clinic\/([^/]+)\/display$/);
    if (clinicDisplayMatch) {
      const clinicId = clinicDisplayMatch[1];
      setCurrentView('display');
      // Store clinicId for DisplayPage
      window.__clinicId = clinicId;
      return;
    }
    
    if (path.startsWith('/clinic/')) {
      const clinicId = path.split('/')[2];
      if (clinicId && clinicId !== 'login') {
        window.__clinicId = clinicId;
      }
      setCurrentView(clinicSession ? 'clinic_dashboard' : 'clinic_login');
      return;
    }

    if (path.includes('/qr')) {
      setCurrentView('qrscan');
      return;
    }

    setCurrentView('login');
  }, [language, isAdmin, patientData, clinicSession, doctorSession])

  useEffect(() => {
    const theme = enhancedMedicalThemes.find(t => t.id === currentTheme)
    if (!theme) return
    const themeCSS = generateThemeCSS(currentTheme)
    const existingStyle = document.getElementById('enhanced-theme-style')
    if (existingStyle) existingStyle.remove()
    const style = document.createElement('style')
    style.id = 'enhanced-theme-style'
    style.textContent = themeCSS
    document.head.appendChild(style)
    document.body.style.background = theme.gradients.background
    document.body.className = `theme-${currentTheme}`
    localStorage.setItem('selectedTheme', currentTheme)
  }, [currentTheme])

  const handleLogin = async ({ patientId, gender }) => {
    const res = await api.patientLogin(patientId, gender)
    if (res.success) {
      const data = { ...res.data, id: patientId, gender }
      setPatientData(data)
      localStorage.setItem('patientData', JSON.stringify(data))
      setCurrentView('examSelection')
    }
  }

  const handleExamSelect = (examType) => {
    const updatedData = { ...patientData, examType, queueType: examType }
    setPatientData(updatedData)
    localStorage.setItem('patientData', JSON.stringify(updatedData))
    setCurrentView('patient')
  }

  const handleLogout = () => {
    localStorage.removeItem('patientData')
    localStorage.removeItem('mmc_admin_session')
    localStorage.removeItem('mmc_doctor_session')
    localStorage.removeItem('mmc_clinic_session')
    setPatientData(null)
    setIsAdmin(false)
    setDoctorSession(null)
    setClinicSession(null)
    setCurrentView('login')
    window.location.href = '/'
  }

  const renderView = () => {
    switch (currentView) {
      case 'admin': return <AdminDashboardV2 onLogout={handleLogout} language={language} />
      case 'examSelection': return <ExamSelectionPage patientData={patientData} onSelect={handleExamSelect} onLogout={handleLogout} language={language} />
      case 'patient': return <PatientPage patientData={patientData} onLogout={handleLogout} language={language} toggleLanguage={() => setLanguage(l => l === 'ar' ? 'en' : 'ar')} />
      case 'clinic_login': return <ClinicLoginPage onLogin={(session) => { setClinicSession(session); localStorage.setItem('mmc_clinic_session', JSON.stringify(session)); setCurrentView('clinic_dashboard'); }} language={language} />
      case 'clinic_dashboard': return <ClinicDashboard session={clinicSession} onLogout={handleLogout} language={language} toggleLanguage={() => setLanguage(l => l === 'ar' ? 'en' : 'ar')} />
      case 'doctor': return <DoctorDashboard doctorData={doctorSession} onLogout={handleLogout} language={language} toggleLanguage={() => setLanguage(l => l === 'ar' ? 'en' : 'ar')} />
      case 'display': return <DisplayPage clinicId={window.__clinicId} language={language} />
      case 'qrscan': return <QrScanPage language={language} />
      default: return <LoginPage onLogin={handleLogin} onAdminLogin={() => setIsAdmin(true)} language={language} toggleLanguage={() => setLanguage(l => l === 'ar' ? 'en' : 'ar')} />
    }
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      {renderView()}
      <SpeedInsights />
      <Analytics />
    </Suspense>
  )
}

export default App

import React, { useState, useEffect, lazy, Suspense } from 'react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { Analytics } from '@vercel/analytics/react'
import { Toaster } from 'react-hot-toast'
import { generateThemeCSS } from './lib/enhanced-themes'
import authService from './lib/auth-service'

// Lazy loading components
const LoginPage = lazy(() => import('./components/LoginPage.jsx').then(m => ({ default: m.LoginPage })))
const AdminDashboardV2 = lazy(() => import('./components/AdminDashboardV2.jsx').then(m => ({ default: m.AdminDashboardV2 })))
const PatientPage = lazy(() => import('./components/PatientPage.jsx').then(m => ({ default: m.PatientPage })))

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#8A1538]">
    <div className="text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#C9A54C] mx-auto mb-4"></div>
      <p className="text-white text-lg font-bold">جاري تحميل نظام اللجنة الطبية...</p>
    </div>
  </div>
)

function App() {
  const [session, setSession] = useState(null)
  const [adminUser, setAdminUser] = useState(null)
  const [language, setLanguage] = useState('ar')

  useEffect(() => {
    // Apply Official Theme CSS
    const themeCSS = generateThemeCSS('medical-professional')
    const style = document.createElement('style')
    style.id = 'official-theme-style'
    style.textContent = themeCSS
    document.head.appendChild(style)
    
    // Check for existing session
    const storedSession = localStorage.getItem('mmc_session')
    if (storedSession) setSession(JSON.parse(storedSession))
    
    const storedAdmin = localStorage.getItem('mmc_admin_user')
    if (storedAdmin) setAdminUser(JSON.parse(storedAdmin))
  }, [])

  const handleLogin = (data) => {
    setSession(data)
    localStorage.setItem('mmc_session', JSON.stringify(data))
  }

  const handleAdminLogin = async (credentials) => {
    const [username, password] = credentials.split(':')
    const result = await authService.login(username, password)
    if (result.success) {
      const user = authService.getCurrentUser()
      setAdminUser(user)
      localStorage.setItem('mmc_admin_user', JSON.stringify(user))
    } else {
      throw new Error('Invalid credentials')
    }
  }

  const handleLogout = () => {
    setSession(null)
    setAdminUser(null)
    localStorage.clear()
    authService.logout()
  }

  const toggleLanguage = () => setLanguage(prev => prev === 'ar' ? 'en' : 'ar')

  return (
    <div className="min-h-screen font-cairo" style={{ background: 'transparent' }}>
      <Toaster position="top-center" />
      <Suspense fallback={<LoadingFallback />}>
        {adminUser ? (
          <AdminDashboardV2 user={adminUser} onLogout={handleLogout} language={language} />
        ) : session ? (
          <PatientPage session={session} onLogout={handleLogout} language={language} />
        ) : (
          <LoginPage 
            onLogin={handleLogin} 
            onAdminLogin={handleAdminLogin} 
            language={language} 
            toggleLanguage={toggleLanguage} 
          />
        )}
      </Suspense>
      <SpeedInsights />
      <Analytics />
    </div>
  )
}

export default App

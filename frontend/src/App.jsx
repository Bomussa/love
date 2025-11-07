// Ensure notification listeners are active globally
import './core/notification-engine.js';
import React, { useState, useEffect } from 'react'
import { LoginPage } from './components/LoginPage'
import { ExamSelectionPage } from './components/ExamSelectionPage'
import { PatientPage } from './components/PatientPage'
import { AdminPage } from './components/AdminPage'
import { QrScanPage } from './components/QrScanPage'
import EnhancedThemeSelector from './components/EnhancedThemeSelector'
import api from './lib/api-unified'
import enhancedApi from './lib/api-unified'
import { validateAdminCredentials } from './config/admin-credentials'
import authService from './lib/auth-service'

import { themes, medicalPathways } from './lib/utils'
import { enhancedMedicalThemes, generateThemeCSS } from './lib/enhanced-themes'
import { t, getCurrentLanguage, setCurrentLanguage } from './lib/i18n'

function App() {
  const [currentView, setCurrentView] = useState("login")
  const [patientData, setPatientData] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('selectedTheme') || 'medical-professional') // استخدام الثيم الطبي الاحترافي كافتراضي
  const [language, setLanguage] = useState(getCurrentLanguage())
  const [showThemeSelector, setShowThemeSelector] = useState(false)
  const [themeSettings, setThemeSettings] = useState({
    enableThemeSelector: true,
    showThemePreview: true
  })
  const [notif, setNotif] = useState(null)

  useEffect(() => {
    // Set initial language and direction
    setCurrentLanguage(language)

    // Check URL for QR scan
    if (window.location.pathname.includes('/qr') || window.location.search.includes('token=')) {
      setCurrentView('qrscan')
      return
    }

    // Check URL for admin access
    if (window.location.pathname.includes('/admin') || window.location.search.includes('admin=true')) {
      setCurrentView('admin')
      setIsAdmin(true)
    }
  }, [language])

  // SSE notifications with sound (fallback-friendly)
  useEffect(() => {
    let es
    let connected = false
    let fallbackTimers = []

    // Create notification sound using Web Audio API
    const playNotificationSound = () => {
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)()

        // Create a simple beep sound
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)

        // Configure the sound
        oscillator.frequency.value = 800 // Frequency in Hz (800 Hz = pleasant notification tone)
        oscillator.type = 'sine' // Sine wave for smooth sound

        // Set volume envelope (fade in/out for smooth sound)
        gainNode.gain.setValueAtTime(0, audioContext.currentTime)
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01)
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1)
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2)

        // Play the sound
        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.2)
      } catch (e) {
        // Audio generation failed silently
      }
    }

    try {
      es = new EventSource('/api/v1/events/stream')
      es.onopen = () => { connected = true }
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data || '{}')
          if (data?.type === 'NEAR_TURN') {
            const msg = language === 'ar' ? 'اقترب دورك' : 'Near your turn'
            setNotif(msg)
            showNotification(msg, 'info')
            playNotificationSound()
          }
          if (data?.type === 'YOUR_TURN') {
            const msg = language === 'ar' ? 'دورك الآن' : 'Your turn now'
            setNotif(msg)
            showNotification(msg, 'success')
            playNotificationSound()
          }
        } catch { }
      }
      es.onerror = () => {
        // Auto-retry after short delay
        setTimeout(() => {
          try { es && es.close() } catch { }
          // new EventSource will be created by effect rerun only on mount; keep it simple
        }, 3000)
      }
    } catch { }

    // Cleanup on unmount
    return () => {
      try { es && es.close() } catch { }
    }
  }, [language])

  // تطبيق الثيم عند تغييره
  useEffect(() => {
    applyTheme(currentTheme)
    try { localStorage.setItem('selectedTheme', currentTheme) } catch (e) { }
  }, [currentTheme])

  const applyTheme = (themeId) => {
    const theme = enhancedMedicalThemes.find(t => t.id === themeId)
    if (!theme) return

    const themeCSS = generateThemeCSS(themeId)

    // Applying theme

    // إزالة الثيم السابق
    const existingStyle = document.getElementById('enhanced-theme-style')
    if (existingStyle) {
      existingStyle.remove()
    }

    // إضافة الثيم الجديد
    const style = document.createElement('style')
    style.id = 'enhanced-theme-style'
    style.textContent = themeCSS
    document.head.appendChild(style)

    // تطبيق الخلفية من الثيم على body
    document.body.style.background = theme.gradients.background
    document.body.className = `theme-${themeId}`

    // Theme applied successfully
  }

  const handleThemeChange = (themeId) => {
    setCurrentTheme(themeId)
  }

  const showNotification = (message, type = 'info') => {
    // إنشاء إشعار مؤقت
    const notification = document.createElement('div')
    notification.className = `
      fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300
      ${type === 'success' ? 'bg-green-500 text-white' :
        type === 'error' ? 'bg-red-500 text-white' :
          'bg-blue-500 text-white'}
    `
    notification.textContent = message

    document.body.appendChild(notification)

    setTimeout(() => {
      notification.style.opacity = '0'
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification)
        }
      }, 300)
    }, 3000)
  }

  const handleLogin = async ({ patientId, gender }) => {
    try {
      // First login the patient
      const loginResponse = await api.patientLogin(patientId, gender)
      if (loginResponse.success) {
        setPatientData(loginResponse.data)
        setCurrentView("examSelection")
        showNotification(
          language === 'ar' ? 'تم تسجيل الدخول بنجاح' : 'Login successful',
          'success'
        )
      } else {
        throw new Error(loginResponse.error || 'Login failed')
      }
    } catch (error) {
      // Login failed - show notification
      showNotification(
        language === 'ar' ? 'فشل تسجيل الدخول' : 'Login failed',
        'error'
      )
    }
  }

  const handleExamSelection = async (examType) => {
    try {
      console.log('Exam selection:', examType, 'Gender:', patientData.gender)
      
      // Update patient data with exam type and navigate to patient page
      // The PatientPage will handle pathway loading using dynamic pathways
      setPatientData({
        ...patientData,
        examType: examType,
        queueType: examType
      })
      
      setCurrentView('patient')
      
      showNotification(
        language === 'ar' ? 'تم اختيار نوع الفحص بنجاح' : 'Exam type selected successfully',
        'success'
      )
    } catch (error) {
      // console.error('Exam selection failed:', error)
      showNotification(
        language === 'ar' ? 'فشل اختيار نوع الفحص' : 'Failed to select exam type',
        'error'
      )
    }
  }

  const handleAdminLogin = async (credentials) => {
    console.log('[App] handleAdminLogin called with:', credentials)
    // credentials format: "username:password"
    const [username, password] = credentials.split(':')
    console.log('[App] Parsed username:', username, 'password length:', password?.length)

    // التحقق من صحة البيانات المدخلة
    if (!username || !password) {
      console.log('[App] Missing username or password')
      showNotification(
        language === 'ar' ? 'يرجى إدخال اسم المستخدم وكلمة المرور' : 'Please enter username and password',
        'error'
      )
      return
    }

    // استخدام auth-service للتحقق من بيانات الدخول
    console.log('[App] Calling authService.login...')
    const result = await authService.login(username, password)
    console.log('[App] authService.login result:', result)
    
    if (result.success) {
      console.log('[App] Login successful! Setting isAdmin=true and currentView=admin')
      setIsAdmin(true)
      setCurrentView('admin')
      console.log('[App] State updated. isAdmin:', true, 'currentView:', 'admin')
      showNotification(
        language === 'ar' ? '✅ تم تسجيل الدخول بنجاح' : '✅ Login successful',
        'success'
      )
    } else {
      showNotification(
        language === 'ar' ? `❌ ${result.error}` : `❌ ${result.error}`,
        'error'
      )
    }
  }

  const handleLogout = () => {
    setPatientData(null)
    setIsAdmin(false)
    setCurrentView('login')
    // Clear URL parameters
    window.history.pushState({}, '', window.location.pathname)
  }

  const toggleLanguage = () => {
    const newLang = language === 'ar' ? 'en' : 'ar'
    setLanguage(newLang)
    setCurrentLanguage(newLang)
  }

  return (
    <div className="min-h-screen"
      style={{
        background: enhancedMedicalThemes.find(t => t.id === currentTheme)?.gradients?.background || '#0b0b0f'
      }}
    >

      {/* المحتوى الرئيسي */}
      <main className="relative z-10">
        {currentView === 'qrscan' && (
          <QrScanPage
            language={language}
            toggleLanguage={toggleLanguage}
          />
        )}

        {currentView === 'login' && (
          <LoginPage
            onLogin={handleLogin}
            onAdminLogin={handleAdminLogin}
            currentTheme={currentTheme}
            onThemeChange={handleThemeChange}
            language={language}
            toggleLanguage={toggleLanguage}
          />
        )}

        {currentView === 'examSelection' && patientData && (
          <ExamSelectionPage
            patientData={patientData}
            onExamSelect={handleExamSelection}
            onBack={() => setCurrentView('login')}
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
          <AdminPage
            onLogout={handleLogout}
            language={language}
            toggleLanguage={toggleLanguage}
            currentTheme={currentTheme}
            onThemeChange={handleThemeChange}
          />
        )}
      </main>

    </div>
  )
}

export default App

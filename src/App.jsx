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
import enhancedApi from './lib/enhanced-api'
import { validateAdminCredentials } from './config/admin-credentials'

import { themes, medicalPathways } from './lib/utils'
import { enhancedMedicalThemes, generateThemeCSS } from './lib/enhanced-themes'
import { t, getCurrentLanguage, setCurrentLanguage } from './lib/i18n'
import eventBus from './core/event-bus'

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

    // Check for resync trigger (?resync=1 or #resync=1)
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
    if (urlParams.get('resync') === '1' || hashParams.get('resync') === '1') {
      // Trigger immediate resync of offline queue
      console.log('🔄 Resync trigger detected - syncing offline queue...');
      api.syncOfflineQueue().then(() => {
        console.log('✅ Offline queue sync completed');
      }).catch(err => {
        console.error('❌ Offline queue sync failed:', err);
      });
    }

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

  // Notifications via central event bus (single SSE connection managed elsewhere)
  useEffect(() => {
    // Create notification sound using Web Audio API
    const playNotificationSound = () => {
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)()
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()
        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)
        oscillator.frequency.value = 800
        oscillator.type = 'sine'
        gainNode.gain.setValueAtTime(0, audioContext.currentTime)
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01)
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1)
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2)
        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.2)
      } catch {}
    }

    const onNotice = (data) => {
      try {
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
      } catch {}
    }

    const unsubNotice = eventBus.on('notice', onNotice)

    return () => {
      unsubNotice && unsubNotice()
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
      // Get first clinic from medical pathway based on exam type and gender
      const pathway = medicalPathways[examType]?.[patientData.gender] || []
      if (pathway.length === 0) {
        throw new Error('No clinics found for this exam type')
      }
      
      const firstClinic = pathway[0].id
      
      // Enter queue for the first clinic
      const queueData = await api.enterQueue(firstClinic, patientData.id, false)
      
      if (!queueData.success) {
        throw new Error(queueData.error || 'Failed to enter queue')
      }
      
      // Update patient data with queue information
      setPatientData({
        ...patientData,
        queueType: examType,
        currentClinic: firstClinic,
        queueNumber: queueData.display_number || queueData.number,
        ahead: queueData.ahead || 0,
        pathway: pathway
      })
      
      setCurrentView('patient')
      
      showNotification(
        language === 'ar' ? 'تم التسجيل بنجاح في قائمة الانتظار' : 'Successfully registered in queue',
        'success'
      )
    } catch (error) {
      // console.error('Exam selection failed:', error)
      showNotification(
        language === 'ar' ? 'فشل التسجيل في قائمة الانتظار' : 'Failed to register in queue',
        'error'
      )
    }
  }

  const handleAdminLogin = async (credentials) => {
    // credentials format: "username:password"
    const [username, password] = credentials.split(':')

    // التحقق من صحة البيانات المدخلة
    if (!username || !password) {
      showNotification(
        language === 'ar' ? 'يرجى إدخال اسم المستخدم وكلمة المرور' : 'Please enter username and password',
        'error'
      )
      return
    }

    // التحقق من طول اسم المستخدم
    if (username.length < 3) {
      showNotification(
        language === 'ar' ? 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل' : 'Username must be at least 3 characters',
        'error'
      )
      return
    }

    // التحقق من طول كلمة المرور
    if (password.length < 4) {
      showNotification(
        language === 'ar' ? 'كلمة المرور يجب أن تكون 4 أحرف على الأقل' : 'Password must be at least 4 characters',
        'error'
      )
      return
    }

    // ✅ التحقق من بيانات الدخول المحلية أولاً (مشروع 2027)
    if (validateAdminCredentials(username, password)) {
      setIsAdmin(true)
      setCurrentView('admin')
      showNotification(
        language === 'ar' ? '✅ تم تسجيل الدخول بنجاح - مشروع 2027' : '✅ Login successful - Project 2027',
        'success'
      )
      return
    }

    try {
      const formData = new URLSearchParams()
      formData.append('username', username)
      formData.append('password', password)

      const response = await fetch('/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
        credentials: 'include',
        redirect: 'follow'
      })

      // التحقق من النجاح: إذا وصل للـ dashboard أو status 200
      const finalUrl = response.url
      if (response.ok || finalUrl.includes('/admin/dashboard') || finalUrl.includes('/admin')) {
        setIsAdmin(true)
        setCurrentView('admin')
        showNotification(
          language === 'ar' ? 'تم تسجيل الدخول بنجاح' : 'Login successful',
          'success'
        )
        return
      }

      // التحقق من نوع الخطأ
      if (response.status === 401 || response.status === 403) {
        showNotification(
          language === 'ar' ? '❌ اسم المستخدم أو كلمة المرور غير صحيحة' : '❌ Invalid username or password',
          'error'
        )
      } else if (response.status === 404) {
        showNotification(
          language === 'ar' ? '⚠️ الخادم غير متوفر حالياً' : '⚠️ Server not available',
          'error'
        )
      } else {
        showNotification(
          language === 'ar' ? 'فشل تسجيل الدخول - يرجى المحاولة مرة أخرى' : 'Login failed - please try again',
          'error'
        )
      }
    } catch (error) {
      // console.error('Admin login error:', error)
      showNotification(
        language === 'ar' ? '⚠️ لا يمكن الاتصال بالخادم - يرجى التحقق من الاتصال' : '⚠️ Cannot connect to server - please check connection',
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

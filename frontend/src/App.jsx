// Ensure notification listeners are active globally
import './core/notification-engine.js';
import React, { useState, useEffect } from 'react'
import { LoginPage } from './components/LoginPage'
import { ExamSelectionPage } from './components/ExamSelectionPage'
import { PatientPage } from './components/PatientPage'
import { AdminPage } from './components/AdminPage'
import { QrScanPage } from './components/QrScanPage'
import { CompletionPage } from './components/CompletionPage'
import api from './lib/api-unified'
import { t, getCurrentLanguage, setCurrentLanguage } from './lib/i18n'

function App() {
  const [currentView, setCurrentView] = useState("qrScan") // Start with QR scan
  const [patientData, setPatientData] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [language, setLanguage] = useState(getCurrentLanguage())

  useEffect(() => {
    // Set initial language and direction
    setCurrentLanguage(language)

    // Check URL for admin access
    if (window.location.pathname.includes('/admin') || window.location.search.includes('admin=true')) {
      setCurrentView('admin')
      setIsAdmin(true)
    }
  }, [language])

  const handleSessionStart = async () => {
    try {
      // For QR scan, we don't have a personalId yet, so we can't log in.
      // We'll just move to the login page.
      setCurrentView("login")
    } catch (error) {
      // Handle error if needed
    }
  }

  const handleLogin = async ({ patientId, gender }) => {
    try {
      const loginResponse = await api.patientLogin(patientId, gender)
      if (loginResponse.success) {
        setPatientData(loginResponse.data)
        setCurrentView("examSelection")
      } else {
        throw new Error(loginResponse.error || 'Login failed')
      }
    } catch (error) {
      // Handle login failure
    }
  }

  const handleExamSelection = async (examType) => {
    try {
      const pathwayResponse = await api.createPathway(patientData.personalId, examType, patientData.gender);
      if (pathwayResponse.success) {
        setPatientData({
          ...patientData,
          examType: examType,
          pathway: pathwayResponse.data,
        })
        setCurrentView('patient')
      } else {
        throw new Error(pathwayResponse.error || 'Failed to create pathway');
      }
    } catch (error) {
      // Handle exam selection failure
    }
  }

  const handleCompletion = () => {
    setCurrentView('completion');
  };

  const handleAdminLogin = async (credentials) => {
    // Admin login logic...
  }

  const handleLogout = () => {
    setPatientData(null)
    setIsAdmin(false)
    setCurrentView('login')
    window.history.pushState({}, '', window.location.pathname)
  }

  const toggleLanguage = () => {
    const newLang = language === 'ar' ? 'en' : 'ar'
    setLanguage(newLang)
    setCurrentLanguage(newLang)
  }

  return (
    <div className="min-h-screen">
      <main className="relative z-10">
        {currentView === 'qrScan' && (
          <QrScanPage onSessionStart={handleSessionStart} />
        )}

        {currentView === 'login' && (
          <LoginPage
            onLogin={handleLogin}
            onAdminLogin={handleAdminLogin}
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
            onCompletion={handleCompletion}
            language={language}
            toggleLanguage={toggleLanguage}
          />
        )}

        {currentView === 'admin' && isAdmin && (
          <AdminPage
            onLogout={handleLogout}
            language={language}
            toggleLanguage={toggleLanguage}
          />
        )}

        {currentView === 'completion' && (
          <CompletionPage onLogout={handleLogout} />
        )}
      </main>
    </div>
  )
}

export default App

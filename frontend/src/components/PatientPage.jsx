import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
import { Input } from './Input'
import { Lock, Unlock, Clock, Globe, LogIn, LogOut, ArrowRight, CheckCircle, Loader2, AlertCircle, PartyPopper, Award, MapPin, Timer } from 'lucide-react'
import { calculateWaitTime, examTypes, formatTime } from '../lib/utils'
import { computeEtaMinutes } from '../lib/eta'
import { getDynamicMedicalPathway } from '../lib/dynamic-pathways'
import { t } from '../lib/i18n'
import api from '../lib/api-unified'
import { ZFDTicketDisplay, ZFDBanner } from './ZFDTicketDisplay'
import NotificationSystem, { useNotifications } from './NotificationSystem'
import { CountdownTimer } from './CountdownTimer'
import eventBus from '../core/event-bus'
import { supabase } from '../lib/supabase-client'

/**
 * PatientPage Component - صفحة متابعة المراجع
 *
 * @description تعرض هذه الصفحة رحلة المراجع عبر العيادات المختلفة
 * تتضمن:
 * - عرض مسار الفحص الكامل
 * - تتبع التقدم عبر العيادات
 * - شاشة الإنهاء عند إكمال جميع العيادات
 *
 * @author MiniMax Agent
 * @date 2026-04-08
 */
export function PatientPage({ patientData, onLogout, language, toggleLanguage }) {
  // State definitions
  const [stations, setStations] = useState([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [activeTicket, setActiveTicket] = useState(null)
  const [routeWithZFD, setRouteWithZFD] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState('connected')
  const [examCompleted, setExamCompleted] = useState(false)
  const [completedClinics, setCompletedClinics] = useState([])
  const [currentClinicIndex, setCurrentClinicIndex] = useState(0)
  const { notifications: notifList, push: pushNotif, dismiss: dismissNotif } = useNotifications()
  const isInitialLoadRef = useRef(false)

  // Translation helper
  const t_local = (ar, en) => language === 'ar' ? ar : en

  /**
   * Initialize the exam pathway on component mount
   * تهيئة مسار الفحص عند تحميل المكون
   */
  useEffect(() => {
    const initializePathway = async () => {
      if (!patientData?.id || !patientData?.examType) {
        setInitialLoading(false)
        return
      }

      try {
        setConnectionStatus('loading')

        // Get the medical pathway based on exam type and gender
        const pathwayResult = await getDynamicMedicalPathway(
          patientData.examType,
          patientData.gender || 'male'
        )

        if (pathwayResult.success) {
          // Initialize stations based on path
          const stationsList = pathwayResult.path.map((clinicId, idx) => {
            const clinicInfo = pathwayResult.clinics[idx]
            return {
              id: clinicId,
              name: clinicInfo?.name_ar || clinicId,
              nameEn: clinicInfo?.name_en || clinicId,
              floor: clinicInfo?.floor || '',
              floorName: clinicInfo?.floorName_ar || '',
              order: idx + 1,
              isEntered: idx === 0, // First clinic is ready
              isCompleted: false,
              status: idx === 0 ? 'current' : 'pending',
              completedAt: null
            }
          })

          setStations(stationsList)
          setActiveTicket({
            queueId: null,
            number: null,
            status: 'WAITING',
            path: pathwayResult.path,
            examType: patientData.examType,
            patientId: patientData.id
          })

          setConnectionStatus('connected')
          pushNotif({
            type: 'success',
            title: t_local('تم تحميل المسار', 'Pathway Loaded'),
            message: t_local(`عدد العيادات: ${stationsList.length}`, `Clinics: ${stationsList.length}`)
          })
        } else {
          setConnectionStatus('error')
          pushNotif({
            type: 'error',
            message: pathwayResult.error || t_local('فشل تحميل المسار', 'Failed to load pathway')
          })
        }
      } catch (err) {
        setConnectionStatus('error')
        console.error('[PatientPage] Pathway initialization failed:', err)
        pushNotif({
          type: 'error',
          message: language === 'ar' ? 'خطأ في الاتصال' : 'Connection error'
        })
      } finally {
        setInitialLoading(false)
      }
    }

    if (!isInitialLoadRef.current) {
      isInitialLoadRef.current = true
      initializePathway()
    }
  }, [patientData?.id, patientData?.examType, patientData?.gender, language])

  /**
   * Enter a specific clinic
   * الدخول إلى عيادة محددة
   */
  const handleEnterClinic = async (clinicId, clinicIndex) => {
    if (!activeTicket) return

    try {
      setLoading(true)
      // Update station status to "in_progress"
      setStations(prev => prev.map((s, idx) => {
        if (idx === clinicIndex) {
          return { ...s, status: 'in_progress', isEntered: true }
        }
        return s
      }))

      pushNotif({
        type: 'info',
        title: t_local('العيادة الحالية', 'Current Clinic'),
        message: t_local(`يرجى التوجه للعيادة رقم ${clinicIndex + 1}`, `Go to clinic ${clinicIndex + 1}`)
      })

      setLoading(false)
    } catch (err) {
      console.error('[PatientPage] Enter clinic failed:', err)
      pushNotif({
        type: 'error',
        message: t_local('فشل الدخول', 'Failed to enter')
      })
      setLoading(false)
    }
  }

  /**
   * Mark current clinic as completed and move to next
   * إكمال العيادة الحالية والانتقال لل seguinte
   */
  const handleCompleteClinic = async (clinicId, clinicIndex) => {
    try {
      setLoading(true)

      // Mark clinic as completed
      setStations(prev => prev.map((s, idx) => {
        if (idx === clinicIndex) {
          return {
            ...s,
            status: 'completed',
            isCompleted: true,
            completedAt: new Date().toISOString()
          }
        }
        return s
      }))

      // Add to completed clinics
      setCompletedClinics(prev => [...prev, clinicId])

      // Check if all clinics are completed
      const allCompleted = (stations.length > 0 && completedClinics.length + 1 === stations.length) ||
                          (stations.length === 0 && completedClinics.length === 1)

      if (stations.length > 0 && completedClinics.length + 1 >= stations.length) {
        // Exam completed!
        setExamCompleted(true)
        pushNotif({
          type: 'success',
          title: t_local('تم إكمال الفحص!', 'Exam Completed!'),
          message: t_local('شكراً لك، تم إكمال جميع الفحوصات بنجاح', 'Thank you! All exams completed successfully')
        })
      } else {
        // Move to next clinic
        const nextIndex = clinicIndex + 1
        setCurrentClinicIndex(nextIndex)

        // Update next station to current
        setStations(prev => prev.map((s, idx) => {
          if (idx === nextIndex) {
            return { ...s, status: 'current', isEntered: true }
          }
          return s
        }))

        pushNotif({
          type: 'success',
          title: t_local('تم الإكمال', 'Completed'),
          message: t_local(`يرجى التوجه للعيادة التالية`, `Please go to the next clinic`)
        })
      }

      setLoading(false)
    } catch (err) {
      console.error('[PatientPage] Complete clinic failed:', err)
      pushNotif({
        type: 'error',
        message: t_local('فشل الإكمال', 'Failed to complete')
      })
      setLoading(false)
    }
  }

  // Check if all clinics are completed and show completion screen
  useEffect(() => {
    if (stations.length > 0 && completedClinics.length === stations.length) {
      setExamCompleted(true)
      pushNotif({
        type: 'success',
        title: t_local('تم إكمال الفحص!', 'Exam Completed!'),
        message: t_local('شكراً لك، تم إكمال جميع الفحوصات بنجاح', 'Thank you! All exams completed successfully')
      })
    }
  }, [completedClinics.length, stations.length])

  // Helper to get current station index
  const getCurrentStationIndex = () => {
    // Find the first non-completed station that's marked as current or in_progress
    for (let i = 0; i < stations.length; i++) {
      if (!stations[i].isCompleted && (stations[i].status === 'current' || stations[i].status === 'in_progress')) {
        return i
      }
    }
    // If all are completed, return -1
    return -1
  }

  // Get current station for display
  const getCurrentStation = () => {
    const idx = getCurrentStationIndex()
    return idx >= 0 ? stations[idx] : null
  }

  // Check if a station can be entered
  const canEnterStation = (station, idx) => {
    // Can't enter if already completed
    if (station.isCompleted) return false
    // Can't enter if not current or in_progress
    if (station.status !== 'current' && station.status !== 'in_progress') return false
    // Only first uncompleted station can be entered
    return idx === getCurrentStationIndex()
  }

  // Check if a station can be completed
  const canCompleteStation = (station) => {
    return station.status === 'in_progress' || (station.isEntered && !station.isCompleted)
  }

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-white text-xl">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
        </div>
      </div>
    )
  }

  // Exam Completion Screen - شاشة إكمال الفحص
  if (examCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-gray-900 to-gray-900 flex items-center justify-center p-4">
        <div className="max-w-lg mx-auto text-center">
          {/* Success Animation */}
          <div className="mb-8">
            <div className="w-32 h-32 mx-auto bg-green-500 rounded-full flex items-center justify-center animate-bounce">
              <PartyPopper className="w-16 h-16 text-white" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-4xl font-bold text-white mb-4">
            {t_local('تم إكمال الفحص!', 'Exam Completed!')}
          </h1>

          <p className="text-xl text-green-300 mb-8">
            {t_local('شكراً لك على صبرك', 'Thank you for your patience')}
          </p>

          {/* Summary Card */}
          <Card className="bg-gradient-to-br from-green-800 to-green-900 border-2 border-green-500 mb-8">
            <CardHeader>
              <CardTitle className="text-white text-center text-2xl flex items-center justify-center gap-3">
                <Award className="w-8 h-8 text-yellow-400" />
                {t_local('ملخص الفحص', 'Exam Summary')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Exam Type */}
                <div className="flex justify-between items-center py-2 border-b border-green-700">
                  <span className="text-green-300">{t_local('نوع الفحص', 'Exam Type')}</span>
                  <span className="text-white font-bold">{patientData?.examType}</span>
                </div>

                {/* Patient ID */}
                <div className="flex justify-between items-center py-2 border-b border-green-700">
                  <span className="text-green-300">{t_local('الرقم الشخصي', 'Personal ID')}</span>
                  <span className="text-white font-bold font-mono">{patientData?.id}</span>
                </div>

                {/* Clinics Completed */}
                <div className="flex justify-between items-center py-2 border-b border-green-700">
                  <span className="text-green-300">{t_local('العيادات المكتملة', 'Clinics Completed')}</span>
                  <span className="text-white font-bold">{stations.length}</span>
                </div>

                {/* Completion Time */}
                <div className="flex justify-between items-center py-2">
                  <span className="text-green-300">{t_local('وقت الإكمال', 'Completion Time')}</span>
                  <span className="text-white font-bold">{new Date().toLocaleTimeString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Completed Clinics List */}
          <Card className="bg-gray-800 border-gray-700 mb-8">
            <CardHeader>
              <CardTitle className="text-white text-lg">
                {t_local('العيادات التي تم زيارتها', 'Visited Clinics')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {stations.map((station) => (
                  <div key={station.id} className="flex items-center gap-2 text-sm bg-green-900/30 rounded-lg p-2">
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span className="text-white">{station.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Message */}
          <div className="bg-blue-900/30 border border-blue-500/50 rounded-xl p-6 mb-8">
            <p className="text-blue-300 text-lg">
              {t_local(
                'يرجى التوجه إلى قسم الاستقبال لتسليم النتيجة',
                'Please proceed to reception to submit your result'
              )}
            </p>
          </div>

          {/* Exit Button */}
          <button
            onClick={onLogout}
            className="w-full py-4 text-lg bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl flex items-center justify-center gap-2"
          >
            <LogOut className="w-6 h-6 ml-2" />
            {t_local('خروج', 'Exit')}
          </button>

          {/* Notifications */}
          <NotificationSystem notifications={notifList} onDismiss={dismissNotif} />
        </div>
      </div>
    )
  }

  // Main Patient Page
  const currentStation = getCurrentStation()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">{t_local('الطابور', 'Queue')}</h1>
            <p className="text-gray-300">{t_local('نوع الفحص', 'Exam Type')}: {patientData?.examType}</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={toggleLanguage}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
            >
              <Globe size={20} />
              {language === 'ar' ? 'EN' : 'AR'}
            </button>
            <button
              onClick={onLogout}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2"
            >
              <LogOut size={20} />
              {t_local('خروج', 'Exit')}
            </button>
          </div>
        </div>

        {/* Connection Status */}
        <div className="mb-6">
          <div className={`p-4 rounded-lg flex items-center gap-2 ${
            connectionStatus === 'connected' ? 'bg-green-900/30 border border-green-500' :
            connectionStatus === 'loading' ? 'bg-yellow-900/30 border border-yellow-500' :
            'bg-red-900/30 border border-red-500'
          }`}>
            <div className={`w-3 h-3 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500' :
              connectionStatus === 'loading' ? 'bg-yellow-500 animate-pulse' :
              'bg-red-500'
            }`} />
            <span className="text-white">
              {connectionStatus === 'connected' ? t_local('متصل', 'Connected') :
               connectionStatus === 'loading' ? t_local('جاري الاتصال...', 'Connecting...') :
               t_local('خطأ في الاتصال', 'Connection Error')}
            </span>
          </div>
        </div>

        {/* Active Ticket */}
        {activeTicket && (
          <Card className="bg-gradient-to-br from-yellow-900 to-yellow-800 border-2 border-yellow-500 mb-8">
            <CardHeader>
              <CardTitle className="text-white text-center text-5xl">{activeTicket.number}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-gray-300 text-sm">{t_local('الحالة', 'Status')}</p>
                  <p className="text-xl font-bold text-white">{activeTicket.status}</p>
                </div>
                <div>
                  <p className="text-gray-300 text-sm">{t_local('الخطوة', 'Step')}</p>
                  <p className="text-xl font-bold text-white">{(activeTicket.current_step || 0) + 1}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stations */}
        <div className="space-y-4">
          {stations.map((station, idx) => (
            <Card 
              key={station.id}
              className={`border-2 ${
                station.isEntered ? 'border-green-500 bg-green-900/20' : 'border-gray-600 bg-gray-900/20'
              }`}
            >
              <CardHeader>
                <CardTitle className="text-white">{t_local('العيادة', 'Clinic')} {idx + 1}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">{station.id}</span>
                  {!station.isEntered && activeTicket?.status === 'WAITING' && idx === 0 && (
                    <button
                      onClick={() => handleEnterClinic(station.id)}
                      disabled={loading}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg flex items-center gap-2"
                    >
                      <ArrowRight size={18} />
                      {t_local('دخول', 'Enter')}
                    </button>
                  )}
                  {station.isEntered && (
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle size={20} />
                      {t_local('مكتمل', 'Completed')}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Notifications */}
        <NotificationSystem notifications={notifList} onDismiss={dismissNotif} />
      </div>
    </div>
  )
}

export default PatientPage

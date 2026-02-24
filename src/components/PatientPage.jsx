import React, { useState, useEffect } from 'react'
import { GENERAL_REFRESH_INTERVAL, NEAR_TURN_REFRESH_INTERVAL } from '../core/config/refresh.constants'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
import { Input } from './Input'
import { Lock, Unlock, Clock, Globe, LogIn, LogOut, ArrowRight, CheckCircle, HelpCircle, Info } from 'lucide-react'
import { calculateWaitTime, examTypes, formatTime } from '../lib/utils'
import { computeEtaMinutes } from '../lib/eta'
import { getDynamicMedicalPathway } from '../lib/dynamic-pathways'
import { t } from '../lib/i18n'
import api from '../lib/api-unified'
import { ZFDTicketDisplay, ZFDBanner } from './ZFDTicketDisplay'
import NotificationSystem from './NotificationSystem'
import { CountdownTimer } from './CountdownTimer'
import eventBus from '../core/event-bus'

export function PatientPage({ patientData, onLogout, language, toggleLanguage }) {
  const [stations, setStations] = useState([])
  const [pinInput, setPinInput] = useState('')
  const [selectedStation, setSelectedStation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [clinicPins, setClinicPins] = useState({})
  const [activeTicket, setActiveTicket] = useState(null)
  const [currentNotice, setCurrentNotice] = useState(null)
  const [routeWithZFD, setRouteWithZFD] = useState(null)
  const [queuePositions, setQueuePositions] = useState({})
  const [showInstructions, setShowInstructions] = useState(false)

  const [systemSettings, setSystemSettings] = useState({
    pin_system_enabled: true,
    pin_system_visible: true,
    queue_system_enabled: true,
    queue_system_visible: true
  })

  useEffect(() => {
    const fetchSystemSettings = async () => {
      try {
        const response = await api.getSettings()
        if (response && response.settings) {
          setSystemSettings({
            pin_system_enabled: response.settings.pin_system_enabled !== 'false',
            pin_system_visible: response.settings.pin_system_visible !== 'false',
            queue_system_enabled: response.settings.queue_system_enabled !== 'false',
            queue_system_visible: response.settings.queue_system_visible !== 'false'
          })
        }
      } catch (err) {
        console.error('Failed to fetch system settings:', err)
      }
    }
    fetchSystemSettings()
    const interval = setInterval(fetchSystemSettings, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleGetTicketForFirstClinic = async (station) => {
    try {
      await api.enterQueue(station.id, patientData.id, false)
      const positionData = await api.getQueuePosition(station.id, patientData.id)
      if (positionData && positionData.success) {
        setStations(prev => prev.map((s, idx) => idx === 0 ? {
          ...s,
          yourNumber: positionData.display_number,
          current: positionData.current_number,
          ahead: positionData.ahead,
          totalWaiting: positionData.total_waiting,
          status: 'ready',
          isEntered: false,
        } : s))
      }
    } catch (e) {
      console.error('Get ticket for first clinic failed:', e)
    }
  }

  const handleEnterClinic = async (station) => {
    try {
      setLoading(true)
      const entryTime = new Date().toISOString();
      const enterResult = await api.enterQueue(station.id, patientData.id, true, patientData.name, patientData.queueType)
      if (enterResult && !enterResult.success && enterResult.error) {
        setCurrentNotice({ type: 'error', message: enterResult.error })
        setTimeout(() => setCurrentNotice(null), 5000)
        setLoading(false)
        return
      }
      const positionData = await api.getQueuePosition(station.id, patientData.id)
      if (positionData && positionData.success) {
        setActiveTicket({ clinicId: station.id, ticket: positionData.display_number })
        setStations(prev => prev.map(s => s.id === station.id ? {
          ...s,
          yourNumber: positionData.display_number,
          current: positionData.current_number,
          ahead: positionData.ahead,
          totalWaiting: positionData.total_waiting,
          status: 'ready',
          isEntered: true,
          entered_at: positionData.entered_at || entryTime
        } : s))
        setCurrentNotice({
          type: 'success',
          message: language === 'ar' 
            ? `✅ تم الدخول بنجاح - رقمك ${positionData.display_number}`
            : `✅ Entered successfully - Your # ${positionData.display_number}`
        })
        setTimeout(() => setCurrentNotice(null), 4000)
      }
      setLoading(false)
    } catch (e) {
      setLoading(false)
    }
  }

  useEffect(() => {
    const loadPathway = async () => {
      try {
        let examStations = await getDynamicMedicalPathway(patientData.examType || patientData.queueType, patientData.gender)
        const initialStations = examStations.map((station, index) => ({
          ...station,
          status: index === 0 ? 'ready' : 'locked',
          current: 0,
          yourNumber: null,
          ahead: 0,
          isEntered: false
        }))
        setStations(initialStations)
        if (examStations.length > 0) {
          await handleGetTicketForFirstClinic(examStations[0])
        }
      } catch (err) {
        console.error('Failed to load pathway:', err)
      }
    }
    loadPathway()
  }, [patientData.examType, patientData.queueType, patientData.gender])

  const getExamName = () => {
    const type = patientData.examType || patientData.queueType
    const exam = examTypes.find(e => e.id === type)
    return language === 'ar' ? (exam?.nameAr || type) : (exam?.name || type)
  }

  const allStationsCompleted = stations.length > 0 && stations.every(s => s.status === 'completed')

  if (allStationsCompleted) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <Card className="w-full max-w-2xl bg-gray-800/50 border-gray-700 text-center">
          <CardContent className="p-12 space-y-6">
            <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-16 h-16 text-green-500" />
            </div>
            <h2 className="text-3xl font-bold text-white">{language === 'ar' ? 'اكتملت جميع الفحوصات' : 'All Exams Completed'}</h2>
            <p className="text-gray-300 text-lg">{language === 'ar' ? 'يرجى التوجه إلى الاستقبال لاستلام النتائج' : 'Please go to reception to receive results'}</p>
            <Button onClick={onLogout} variant="gradientPrimary" className="px-8 py-3 text-lg">{language === 'ar' ? 'خروج' : 'Logout'}</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 relative" data-test="patient-page">
      {/* أيقونة التعليمات في الأعلى يسار موازية لكلمة الإدارة */}
      <div className="absolute top-4 left-4 z-50 flex flex-col items-center">
        <Button
          variant="ghost"
          size="sm"
          className="text-blue-400 hover:text-blue-300 flex flex-col items-center gap-1"
          onClick={() => setShowInstructions(true)}
        >
          <HelpCircle className="w-6 h-6" />
          <span className="text-[10px] font-bold">{language === 'ar' ? 'تعليمات الدخول' : 'Login Instructions'}</span>
        </Button>
      </div>

      <div className="absolute top-4 right-4 z-50">
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-300 hover:text-white"
          onClick={toggleLanguage}
        >
          <Globe className="w-4 h-4 mr-2" />
          {language === 'ar' ? 'English 🇺🇸' : 'العربية 🇶🇦'}
        </Button>
      </div>

      {currentNotice && (
        <ZFDBanner
          notice={currentNotice}
          onDismiss={() => setCurrentNotice(null)}
        />
      )}

      <NotificationSystem
        patientId={patientData?.id}
        currentClinic={stations.find(s => s.status === 'active' || s.status === 'ready')}
        yourNumber={stations.find(s => s.status === 'active' || s.status === 'ready')?.yourNumber}
        currentServing={stations.find(s => s.status === 'active' || s.status === 'ready')?.current}
        allStationsCompleted={allStationsCompleted}
        language={language}
      />

      <div className="max-w-4xl mx-auto space-y-6 mt-12">
        <div className="text-center space-y-2">
          <img src="/mms-logo.png" alt="Logo" className="mx-auto w-24 h-24 object-contain" />
          <div>
            <h1 className="text-xl font-bold text-white">
              {language === 'ar' ? 'اللجنة الطبية العسكرية' : 'Military Medical Committee'}
            </h1>
            <p className="text-sm text-[#C9A54C] font-semibold mt-1">
              {language === 'ar' ? 'قيادة الخدمات الطبية العسكرية' : 'Military Medical Services Command'}
            </p>
          </div>
        </div>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="text-center">
            <CardTitle className="text-white text-2xl font-bold">{t('yourMedicalRoute', language)}</CardTitle>
            <p className="text-gray-300 mt-2">{t('exam', language)}: <span className="font-semibold text-white">{getExamName()}</span></p>
          </CardHeader>
          <CardContent className="space-y-4">
            {stations.map((station, index) => (
              <Card key={station.id} className={`bg-gray-700/50 border-gray-600 ${station.status === 'completed' ? 'opacity-70' : ''}`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {station.status === 'ready' ? <Unlock className="w-6 h-6 text-green-400" /> : station.status === 'completed' ? <CheckCircle className="w-6 h-6 text-green-400" /> : <Lock className="w-6 h-6 text-gray-500" />}
                      <div>
                        <h3 className="text-white text-lg font-bold">{language === 'ar' ? station.nameAr : station.name}</h3>
                        <p className="text-gray-300 text-sm">{t('floor', language)}: {language === 'ar' ? station.floor : station.floorCode}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${station.status === 'ready' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                      {station.status === 'ready' ? t('ready', language) : station.status === 'completed' ? (language === 'ar' ? 'مكتمل' : 'Completed') : t('locked', language)}
                    </span>
                  </div>

                  {station.status !== 'completed' && (
                    <div className="grid grid-cols-3 gap-4 text-center bg-gray-800/30 p-4 rounded-xl">
                      <div>
                        <div className="text-2xl font-bold text-white">{station.current || 0}</div>
                        <div className="text-gray-400 text-xs">{t('current', language)}</div>
                      </div>
                      <div className="bg-yellow-500/20 rounded-lg py-2">
                        <div className="text-2xl font-bold text-yellow-400">{station.yourNumber || '-'}</div>
                        <div className="text-yellow-200 text-xs">{t('yourNumber', language)}</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-white">{station.ahead || 0}</div>
                        <div className="text-gray-400 text-xs">{t('ahead', language)}</div>
                      </div>
                    </div>
                  )}

                  {station.status === 'ready' && !station.isEntered && (
                    <div className="mt-4">
                      {(station.ahead === 0 || station.yourNumber === station.current) ? (
                        <Button variant="gradientPrimary" onClick={() => handleEnterClinic(station)} className="w-full py-4 text-lg font-bold">
                          <LogIn className="w-5 h-5 mr-2" />
                          {t('enterClinic', language)}
                        </Button>
                      ) : (
                        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl text-center">
                          <p className="text-blue-300 font-bold">{language === 'ar' ? 'انتظر دورك' : 'Wait for your turn'}</p>
                          <p className="text-blue-400 text-2xl font-bold mt-1">{computeEtaMinutes(station.ahead, 2)}:00</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* مودال التعليمات المحدث */}
      {showInstructions && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <Card className="w-full max-w-lg bg-gray-900 border-blue-500/50">
            <CardHeader className="border-b border-gray-800 flex flex-row items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <Info className="text-blue-400" />
                {language === 'ar' ? 'تعليمات الدخول والتوجه' : 'Login & Direction Instructions'}
              </CardTitle>
              <Button variant="ghost" className="text-white" onClick={() => setShowInstructions(false)}>✕</Button>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-3">
                <div className="p-4 bg-blue-500/10 border-l-4 border-blue-500 rounded-r-lg">
                  <h4 className="text-blue-400 font-bold mb-1">{language === 'ar' ? 'قسم المختبر والأشعة' : 'Lab & Radiology Section'}</h4>
                  <p className="text-gray-300 text-sm">
                    {language === 'ar' 
                      ? 'للتوجه إلى قسم المختبر والأشعة استخدم المصعد بالضغط على حرف M او الدرج بجانب البوابة الخلفية للمبنى'
                      : 'To go to Lab & Radiology, use the elevator and press M or use the stairs next to the building rear gate'}
                  </p>
                </div>
                <div className="p-4 bg-yellow-500/10 border-l-4 border-yellow-500 rounded-r-lg">
                  <h4 className="text-yellow-400 font-bold mb-1">{language === 'ar' ? 'طريقة الدخول للعيادة' : 'Clinic Entry Method'}</h4>
                  <p className="text-gray-300 text-sm">
                    {language === 'ar'
                      ? 'يتم الدخول والخروج باستخدام البن كود (رقم الدور) الذي سيظهر لك في النظام أو يعطى من قبل مسؤول العيادة'
                      : 'Entry and exit are managed using the PIN code (Queue Number) shown in the system or provided by the clinic staff'}
                  </p>
                </div>
                <div className="p-4 bg-green-500/10 border-l-4 border-green-500 rounded-r-lg">
                  <h4 className="text-green-400 font-bold mb-1">{language === 'ar' ? 'إشعارات الدور' : 'Queue Notifications'}</h4>
                  <p className="text-gray-300 text-sm">
                    {language === 'ar'
                      ? 'ستصلك إشعارات توضح مكان التوجه (الميزانين أو الأول) حسب العيادة المحددة في مسارك'
                      : 'You will receive notifications indicating where to go (Mezzanine or 1st Floor) based on the clinic in your pathway'}
                  </p>
                </div>
              </div>
              <Button variant="gradientPrimary" onClick={() => setShowInstructions(false)} className="w-full mt-4">
                {language === 'ar' ? 'فهمت' : 'I Understand'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

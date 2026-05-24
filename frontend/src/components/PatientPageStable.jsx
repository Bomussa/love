import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
import { Lock, Unlock, Clock, Globe, LogIn, CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react'
import { examTypes, formatTime } from '../lib/utils'
import { getDynamicMedicalPathway } from '../lib/dynamic-pathways'
import { t } from '../lib/i18n'
import api from '../lib/api-unified'
import { supabase } from '../lib/supabase-client'
import { GENERAL_REFRESH_INTERVAL } from '../core/config/refresh.constants'

const normalizeStatus = (status) => {
  const v = String(status || '').trim().toLowerCase()
  if (v === 'completed' || v === 'done') return 'completed'
  if (v === 'called' || v === 'serving' || v === 'in_progress' || v === 'in-service' || v === 'in_service') return 'called'
  if (v === 'waiting' || v === 'ready' || v === 'locked' || v === 'cancelled' || v === 'no_show') return v
  return 'waiting'
}

const getId = (patientData) => String(patientData?.patient_id || patientData?.personal_id || patientData?.patientId || patientData?.personalId || patientData?.id || '').trim()
const getSessionId = (patientData) => String(patientData?.sessionId || patientData?.session_id || patientData?.id || '').trim()

function stationTemplate(stations) {
  return stations.map((s, i) => ({ ...s, status: i === 0 ? 'ready' : 'locked', isEntered: false, yourNumber: null, ahead: null, current: null, totalWaiting: null, entered_at: null }))
}

async function queuePosition(clinicId, patientId) {
  const today = new Date().toISOString().slice(0, 10)
  const { data: myRow } = await supabase.from('unified_queue').select('id, display_number, status, entered_at').eq('clinic_id', clinicId).eq('patient_id', patientId).eq('queue_date', today).not('status', 'eq', 'cancelled').order('entered_at', { ascending: false }).limit(1).maybeSingle()
  if (!myRow) return null

  const { data: serving } = await supabase.from('unified_queue').select('display_number').eq('clinic_id', clinicId).eq('queue_date', today).in('status', ['called', 'serving', 'in_progress']).order('display_number', { ascending: false }).limit(1).maybeSingle()
  const { count: ahead } = await supabase.from('unified_queue').select('*', { count: 'exact', head: true }).eq('clinic_id', clinicId).eq('queue_date', today).in('status', ['waiting', 'called', 'serving', 'in_progress']).lt('display_number', myRow.display_number)
  const { count: totalWaiting } = await supabase.from('unified_queue').select('*', { count: 'exact', head: true }).eq('clinic_id', clinicId).eq('queue_date', today).in('status', ['waiting', 'called', 'serving', 'in_progress'])

  return { ...myRow, display_number: myRow.display_number, current_number: serving?.display_number ?? 0, ahead: ahead ?? 0, total_waiting: totalWaiting ?? 0, success: true }
}

export function PatientPageStable({ patientData, onLogout, language, toggleLanguage }) {
  const [stations, setStations] = useState([])
  const [booting, setBooting] = useState(true)
  const [error, setError] = useState(null)
  const [loadingStationId, setLoadingStationId] = useState(null)
  const [notice, setNotice] = useState(null)
  const activeRef = useRef(null)
  const pollRef = useRef(null)

  const patientId = useMemo(() => getId(patientData), [patientData])
  const sessionId = useMemo(() => getSessionId(patientData), [patientData])
  const queueType = patientData?.queueType || patientData?.examType || 'general'
  const gender = patientData?.gender || 'male'
  const patientName = patientData?.name || patientData?.patient_name || patientId || sessionId || ''

  const examName = useMemo(() => {
    const exam = examTypes.find((e) => e.id === queueType)
    return exam ? (language === 'ar' ? exam.nameAr : exam.name) : (language === 'ar' ? 'فحص طبي' : 'Medical Exam')
  }, [language, queueType])

  const notify = useCallback((message) => {
    setNotice(message)
    window.clearTimeout(window.__patientStableNotice)
    window.__patientStableNotice = window.setTimeout(() => setNotice(null), 4000)
  }, [])

  const markCompletedAndUnlockNext = useCallback((prevStations, completedIndex) => prevStations.map((station, idx) => {
    if (idx === completedIndex) return { ...station, status: 'completed', isEntered: false }
    if (idx === completedIndex + 1 && normalizeStatus(station.status) === 'locked') return { ...station, status: 'ready' }
    return station
  }), [])

  const enterStation = useCallback(async (station, index) => {
    try {
      setLoadingStationId(station.id)
      const { data, error } = await supabase.rpc('enter_unified_queue_safe', {
        p_clinic_id: station.id,
        p_patient_id: patientId,
        p_patient_name: patientName,
        p_exam_type: queueType,
        p_gender: gender,
        p_military_id: patientId,
        p_personal_id: patientId,
        p_force: false,
      })
      if (error) throw error
      if (data?.status === 'ALREADY_ACTIVE_IN_OTHER_CLINIC') {
        notify(language === 'ar' ? 'أنت مرتبط بعيادة أخرى. أكملها أولاً.' : 'You are active in another clinic. Finish it first.')
        return
      }
      const pos = await queuePosition(station.id, patientId)
      if (!pos) throw new Error('QUEUE_POSITION_MISSING')
      setStations((prev) => prev.map((s, i) => i === index ? { ...s, queueId: data?.id || pos.id, yourNumber: pos.display_number, current: pos.current_number, ahead: pos.ahead, totalWaiting: pos.total_waiting, status: 'ready', isEntered: true, entered_at: pos.entered_at } : s))
      notify(language === 'ar' ? `✅ رقمك: ${pos.display_number}` : `✅ Your number: ${pos.display_number}`)
    } catch (err) {
      console.error('[PatientPageStable] enterStation:', err)
      notify(language === 'ar' ? 'فشل الدخول للعيادة' : 'Failed to enter clinic')
    } finally {
      setLoadingStationId(null)
    }
  }, [gender, language, notify, patientId, patientName, queueType])

  const loadPathway = useCallback(async () => {
    if (!patientId) {
      setBooting(false)
      setError(language === 'ar' ? 'بيانات المراجع غير مكتملة.' : 'Patient data is incomplete.')
      return
    }
    setBooting(true)
    setError(null)
    try {
      let pathway = Array.isArray(patientData?.pathway) && patientData.pathway.length ? patientData.pathway : null
      if (!pathway && Array.isArray(patientData?.route?.stations) && patientData.route.stations.length) pathway = patientData.route.stations
      if (!pathway) {
        const saved = await api.getRoute(sessionId || patientId)
        if (saved?.success && Array.isArray(saved?.route?.stations) && saved.route.stations.length) pathway = saved.route.stations
      }
      if (!pathway) pathway = await getDynamicMedicalPathway(queueType, gender)
      if (!Array.isArray(pathway) || pathway.length === 0) throw new Error('EMPTY_PATHWAY')
      const prepared = stationTemplate(pathway)
      setStations(prepared)
      try { void api.createRoute(patientId, queueType, gender, pathway) } catch {}
      await enterStation(prepared[0], 0)
    } catch (err) {
      console.error('[PatientPageStable] loadPathway:', err)
      setError(language === 'ar' ? 'تعذر تحميل المسار الطبي. حاول مرة أخرى.' : 'Unable to load the medical pathway. Please try again.')
    } finally {
      setBooting(false)
    }
  }, [enterStation, gender, language, patientData, patientId, queueType, sessionId])

  const activeIndex = useMemo(() => stations.findIndex((s) => normalizeStatus(s.status) === 'ready' && s.yourNumber !== null), [stations])
  const activeStation = activeIndex >= 0 ? stations[activeIndex] : null
  const completedCount = useMemo(() => stations.filter((s) => normalizeStatus(s.status) === 'completed').length, [stations])
  const allCompleted = stations.length > 0 && stations.every((s) => normalizeStatus(s.status) === 'completed')
  const progress = stations.length > 0 ? Math.round((completedCount / stations.length) * 100) : 0

  useEffect(() => { void loadPathway() }, [loadPathway])

  useEffect(() => {
    if (!patientId || !activeStation) return undefined
    if (activeRef.current) {
      supabase.removeChannel(activeRef.current)
      activeRef.current = null
    }
    const channel = supabase.channel(`patient_queue_${patientId}_${activeStation.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'unified_queue', filter: `clinic_id=eq.${activeStation.id}` }, async () => {
      const pos = await queuePosition(activeStation.id, patientId)
      if (!pos) return
      const status = normalizeStatus(pos.status)
      setStations((prev) => {
        const idx = prev.findIndex((s) => s.id === activeStation.id)
        if (idx === -1) return prev
        return status === 'completed' ? markCompletedAndUnlockNext(prev, idx) : prev.map((station, i) => i === idx ? { ...station, yourNumber: pos.display_number, current: pos.current_number, ahead: pos.ahead, totalWaiting: pos.total_waiting, isEntered: true } : station)
      })
    }).subscribe()
    activeRef.current = channel
    return () => {
      if (activeRef.current) {
        supabase.removeChannel(activeRef.current)
        activeRef.current = null
      }
    }
  }, [activeStation, markCompletedAndUnlockNext, patientId])

  useEffect(() => {
    if (!patientId || !activeStation) return undefined
    pollRef.current = window.setInterval(async () => {
      const pos = await queuePosition(activeStation.id, patientId)
      if (!pos) return
      const status = normalizeStatus(pos.status)
      setStations((prev) => {
        const idx = prev.findIndex((s) => s.id === activeStation.id)
        if (idx === -1) return prev
        return status === 'completed' ? markCompletedAndUnlockNext(prev, idx) : prev.map((station, i) => i === idx ? { ...station, yourNumber: pos.display_number, current: pos.current_number, ahead: pos.ahead, totalWaiting: pos.total_waiting, isEntered: true } : station)
      })
    }, GENERAL_REFRESH_INTERVAL)
    return () => { if (pollRef.current) window.clearInterval(pollRef.current) }
  }, [activeStation, markCompletedAndUnlockNext, patientId])

  useEffect(() => {
    if (!patientId) return undefined
    let alive = true
    const channel = supabase.channel(`patient_alerts_${patientId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_alerts', filter: `patient_id=eq.${patientId}` }, (payload) => {
      const alert = payload.new
      if (alive && alert?.is_active) notify(language === 'ar' ? alert.message : (alert.message_en || alert.message))
    }).subscribe()
    return () => {
      alive = false
      supabase.removeChannel(channel)
    }
  }, [language, notify, patientId])

  if (allCompleted) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center bg-gradient-to-b from-[#08111f] to-[#04070d]" data-test="completion-screen">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <img src="/mms-logo.png" alt="اللجنة الطبية العسكرية" className="mx-auto w-24 h-24 object-contain" />
          <CheckCircle className="w-24 h-24 mx-auto text-green-400" />
          <Card className="bg-gradient-to-br from-green-900/30 to-blue-900/30 border-green-500/30 shadow-2xl">
            <CardContent className="p-8 space-y-6">
              <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight">{language === 'ar' ? '✅ تم إنهاء الفحص الطبي' : '✅ Medical Examination Completed'}</h1>
              <p className="text-gray-300 text-lg sm:text-xl">{language === 'ar' ? 'تهانينا، لقد أكملت جميع الفحوصات الطبية المطلوبة بنجاح.' : 'Congratulations, you have successfully completed all required medical examinations.'}</p>
              <Button variant="default" size="lg" onClick={onLogout} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3">{language === 'ar' ? '🏠 العودة للرئيسية' : '🏠 Return Home'}</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (booting) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-950"><div className="text-white">{language === 'ar' ? 'جارٍ تحميل المسار الطبي...' : 'Loading medical pathway...'}</div></div>
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-950">
        <Card className="w-full max-w-lg bg-gray-800/80 border-red-500/40">
          <CardContent className="p-6 text-center space-y-4">
            <AlertTriangle className="w-10 h-10 mx-auto text-red-400" />
            <h2 className="text-xl font-bold text-white">{language === 'ar' ? 'تعذر تحميل المسار' : 'Unable to load pathway'}</h2>
            <p className="text-gray-300 leading-relaxed">{error}</p>
            <div className="flex gap-3 justify-center pt-2">
              <Button onClick={() => window.location.reload()} variant="default" className="bg-[#C9A54C] text-black font-bold"><RefreshCw className="w-4 h-4 me-2" />{language === 'ar' ? 'إعادة المحاولة' : 'Retry'}</Button>
              <Button onClick={onLogout} variant="outline" className="border-gray-600 text-gray-200">{language === 'ar' ? 'العودة' : 'Back'}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#05070d] px-3 py-4 overflow-x-hidden overflow-y-auto">
      {notice && <div className="fixed top-4 right-4 z-50 max-w-sm rounded-2xl border border-white/10 bg-[#111827]/95 p-4 text-white shadow-2xl">{notice}</div>}
      <NotificationSystem notifications={[]} onDismiss={() => {}} />
      <div className="w-full max-w-2xl mx-auto space-y-5 px-2 sm:px-4">
        <div className="absolute top-4 left-4">
          <Button variant="ghost" size="sm" className="text-gray-300 hover:text-white hover:bg-gray-800/50" onClick={toggleLanguage}><Globe className="w-4 h-4 me-2" />{language === 'ar' ? 'English 🇺🇸' : 'العربية 🇶🇦'}</Button>
        </div>
        <div className="text-center space-y-2 pt-4">
          <img src="/mms-logo.png" alt="اللجنة الطبية العسكرية" className="mx-auto w-24 h-24 object-contain" />
          <div className="space-y-0.5">
            <h1 className="text-xl font-bold text-white">{language === 'ar' ? 'اللجنة الطبية العسكرية' : 'Military Medical Committee'}</h1>
            <p className="text-sm text-[#C9A54C] font-semibold">{language === 'ar' ? 'قيادة الخدمات الطبية العسكرية' : 'Military Medical Services Command'}</p>
            <p className="text-gray-400 text-xs">{language === 'ar' ? 'المركز الطبي التخصصي العسكري - العطار' : 'Military Specialized Medical Center – Al-Attar'}</p>
          </div>
        </div>

        <Card className="bg-gray-800/50 border-gray-700 shadow-xl">
          <CardHeader className="text-center pb-3 pt-4">
            <CardTitle className="text-white text-xl font-bold tracking-tight">{t('yourMedicalRoute', language)}</CardTitle>
            <p className="text-gray-400 text-sm mt-1.5">{t('exam', language)}: <span className="font-bold text-[#C9A54C]">{getExamName()}</span></p>
            <div className="mt-3 h-2 w-full rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-[#8A1538] to-[#C9A54C]" style={{ width: `${progress}%` }} /></div>
            <p className="text-xs text-gray-400 mt-2">{language === 'ar' ? `تقدم الرحلة: ${completedCount}/${stations.length} مكتمل` : `Journey progress: ${completedCount}/${stations.length} completed`}</p>
          </CardHeader>
          <CardContent className="space-y-3 px-3 pb-4">
            {stations.map((station, index) => {
              const status = normalizeStatus(station.status)
              const canEnter = status === 'ready' && !station.isEntered
              const isActive = activeStationIndex === index
              return (
                <Card key={station.id} className={`border transition-all duration-200 ${status === 'ready' ? 'bg-gray-700/60 border-green-500/30 shadow-md' : status === 'completed' ? 'bg-gray-700/30 border-gray-600/50 opacity-70' : 'bg-gray-700/40 border-gray-600/60'}`}>
                  <CardContent className="p-3.5 sm:p-5">
                    <div className="flex items-center justify-between mb-3 gap-2">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${status === 'ready' ? 'bg-green-500/20' : status === 'completed' ? 'bg-green-500/15' : 'bg-gray-600/50'}`}>{status === 'ready' ? <Unlock className="w-5 h-5 text-green-400" /> : status === 'completed' ? <CheckCircle className="w-5 h-5 text-green-400" /> : <Lock className="w-5 h-5 text-gray-400" />}</div>
                        <div className="min-w-0"><h3 className="text-white text-base font-bold leading-tight">{language === 'ar' ? station.nameAr : station.name}</h3><p className="text-gray-400 text-sm mt-0.5">{t('floor', language)}: <span className="text-gray-200 font-semibold">{language === 'ar' ? station.floor : station.floorCode}</span></p></div>
                      </div>
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${status === 'ready' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : status === 'completed' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'}`}>{status === 'ready' ? t('ready', language) : status === 'completed' ? (language === 'ar' ? 'مكتمل ✓' : 'Completed ✓') : t('locked', language)}</span>
                    </div>
                    {status !== 'completed' && (
                      <div className="grid grid-cols-2 gap-2.5 text-center">
                        <div className="py-4 px-2 bg-yellow-500/15 rounded-xl border-2 border-yellow-500/40"><div className="text-4xl font-black text-yellow-400 mb-1.5 leading-none">{typeof station.yourNumber === 'number' ? station.yourNumber : (status === 'ready' ? '...' : '—')}</div><div className="text-yellow-300/80 text-sm font-bold tracking-wide mt-0.5">{t('yourNumber', language)}</div></div>
                        <div className="py-4 px-2 bg-gray-700/50 rounded-xl border border-gray-500/50"><div className="text-4xl font-black text-white mb-1.5 leading-none">{typeof station.ahead === 'number' ? station.ahead : (status === 'ready' ? '...' : '—')}</div><div className="text-gray-400 text-sm font-bold tracking-wide mt-0.5">{t('ahead', language)}</div></div>
                      </div>
                    )}
                    {canEnter && (
                      <div className="mt-4 pt-4 border-t border-gray-600/40">
                        <Button variant="gradientPrimary" onClick={() => enterStation(station, index)} disabled={loadingStationId === station.id} className="w-full py-3 text-lg font-bold"><LogIn className="w-4 h-4 me-2" />{t('enterClinic', language)}</Button>
                      </div>
                    )}
                    {status === 'ready' && station.isEntered && <div className="mt-3 pt-3 border-t border-gray-600 space-y-2"><div className="text-center text-sm text-green-400 p-3 bg-green-900/20 rounded border border-green-500/30">{language === 'ar' ? '✓ تم الدخول - انتظر مناداتك من الطبيب' : '✓ Entered - Wait for doctor to call you'}</div>{station.entered_at && <div className="text-sm text-gray-400 flex items-center gap-2"><Clock className="w-4 h-4" /><span>{language === 'ar' ? 'وقت الدخول:' : 'Entry time:'} {formatTime(new Date(station.entered_at))}</span></div>}</div>}
                    {isActive && status !== 'completed' && <div className="mt-3 pt-3 border-t border-green-500/20 text-center text-green-300 text-sm font-bold">{language === 'ar' ? 'المحطة الحالية ✓' : 'Current station ✓'}</div>}
                    {status === 'completed' && <div className="mt-3 pt-3 border-t border-green-500/20 text-center text-green-400 text-sm font-bold">{language === 'ar' ? 'تم إنهاء هذه المحطة ✓' : 'Station completed ✓'}</div>}
                  </CardContent>
                </Card>
              )
            })}
          </CardContent>
        </Card>
        <div className="text-center pb-6 flex flex-wrap justify-center gap-3"><Button variant="outline" onClick={() => window.location.reload()} className="border-gray-600 text-gray-300"><RefreshCw className="w-4 h-4 me-2" />{language === 'ar' ? 'تحديث' : 'Refresh'}</Button><Button variant="outline" onClick={onLogout} className="border-gray-600 text-gray-300">{t('exitSystem', language)}</Button></div>
      </div>
    </div>
  )
}

export default PatientPageStable

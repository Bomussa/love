import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
import {
  Globe, LogOut, Users, Clock, CheckCircle, SkipForward,
  UserCheck, Calendar, TrendingUp, Activity, Star,
  ArrowRightLeft, UserX, Timer, RotateCcw, Building2, ShieldCheck,
  Phone, RefreshCw, ChevronRight, AlertCircle, Stethoscope
} from 'lucide-react'
import { supabase } from '../lib/supabase-client'
import NotificationSystem, { useNotifications } from './NotificationSystem'

export function DoctorDashboard({ doctorData, onLogout, language, toggleLanguage }) {
  const [patients, setPatients] = useState([])
  const [clinics, setClinics] = useState([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)
  const [stats, setStats] = useState({ totalToday: 0, completedToday: 0, waitingNow: 0, absentCount: 0, avgWait: 0 })
  const [currentPatient, setCurrentPatient] = useState(null)
  const [examTimer, setExamTimer] = useState('00:00')
  const [showTransfer, setShowTransfer] = useState(false)
  const [filterTab, setFilterTab] = useState('all')
  const timerRef = useRef(null)
  const { notifications: notifList, push: pushNotif, dismiss: dismissNotif } = useNotifications()

  const clinicId = doctorData?.clinic_id
  const clinicName = doctorData?.clinic_name || doctorData?.name || (language === 'ar' ? 'العيادة' : 'Clinic')
  const t = (ar, en) => language === 'ar' ? ar : en

  /* ─── جلب العيادات ─── */
  const fetchClinics = async () => {
    try {
      const { data } = await supabase.from('clinics').select('id, name_ar, name_en').eq('is_active', true).order('name_ar')
      setClinics(data || [])
    } catch (e) { console.error('fetchClinics:', e) }
  }

  /* ─── جلب المرضى والإحصائيات ─── */
  const fetchPatients = async () => {
    if (!clinicId) return
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('unified_queue')
        .select('id, display_number, patient_name, patient_id, status, entered_at, called_at, exam_start_time, completed_at, queue_date, clinic_id, route_id, current_station_index')
        .eq('clinic_id', clinicId)
        .eq('queue_date', today)
        .order('display_number', { ascending: true })
      if (error) throw error

      const all = data || []
      // المريض الحالي: serving / called / in_progress
      const current = all.find(p => ['serving', 'called', 'in_progress'].includes(p.status)) || null
      // قائمة الانتظار: waiting فقط
      const waiting = all.filter(p => p.status === 'waiting')
      const completed = all.filter(p => ['done', 'completed'].includes(p.status))
      const absent = all.filter(p => ['no_show', 'absent'].includes(p.status))

      // حساب متوسط الانتظار
      let avgWait = 0
      const withWait = completed.filter(p => p.entered_at && p.called_at)
      if (withWait.length > 0) {
        const total = withWait.reduce((s, p) => s + (new Date(p.called_at) - new Date(p.entered_at)), 0)
        avgWait = Math.round(total / withWait.length / 60000)
      }

      setCurrentPatient(current)
      setPatients(waiting)
      setStats({
        totalToday: all.length,
        completedToday: completed.length,
        waitingNow: waiting.length,
        absentCount: absent.length,
        avgWait
      })
    } catch (err) {
      console.error('fetchPatients:', err)
      pushNotif({ type: 'error', message: t('خطأ في تحميل البيانات', 'Error loading data') + ': ' + err.message })
    }
  }

  /* ─── مؤقت الفحص ─── */
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (currentPatient?.exam_start_time) {
      const start = new Date(currentPatient.exam_start_time).getTime()
      timerRef.current = setInterval(() => {
        const diff = Date.now() - start
        const m = Math.floor(diff / 60000)
        const s = Math.floor((diff % 60000) / 1000)
        setExamTimer(`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
      }, 1000)
    } else {
      setExamTimer('00:00')
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [currentPatient?.id])

  /* ─── Real-time + تحميل أولي ─── */
  useEffect(() => {
    fetchPatients()
    fetchClinics()
    const ch = supabase
      .channel(`dd_${clinicId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unified_queue',
        filter: `clinic_id=eq.${clinicId}` }, fetchPatients)
      .subscribe()
    const iv = setInterval(fetchPatients, 15000)
    return () => { supabase.removeChannel(ch); clearInterval(iv) }
  }, [clinicId])

  /* ─── تنفيذ الإجراءات ─── */
  const handleAction = async (actionType, patientId, payload = {}) => {
    if (!clinicId) {
      pushNotif({ type: 'error', message: t('خطأ: معرف العيادة غير موجود', 'Error: Clinic ID is missing') })
      return
    }
    setActionLoading(actionType + patientId)
    try {
      const patient = currentPatient?.id === patientId ? currentPatient : patients.find(p => p.id === patientId)

      switch (actionType) {

        case 'CALL_NEXT': {
          const { data: cd, error: ce } = await supabase.rpc('call_next_patient', {
            p_clinic_id: clinicId, p_mark_current_done: false
          })
          if (ce) throw ce
          if (cd?.data) {
            pushNotif({ type: 'success', title: t('تم الاستدعاء','Called'),
              message: t('رقم: ','#') + cd.data.display_number })
          } else {
            pushNotif({ type: 'info', message: t('لا يوجد مرضى في الانتظار','No patients waiting') })
          }
          break
        }

        case 'START_EXAM': {
          const { error } = await supabase.from('unified_queue').update({
            status: 'serving',
            entered_clinic_at: new Date().toISOString(),
            exam_start_time: new Date().toISOString()
          }).eq('id', patientId)
          if (error) throw error
          pushNotif({ type: 'success', message: t('بدأ الفحص','Exam started') })
          break
        }

        case 'FINISH_EXAM': {
          // 1) أنهِ الفحص
          const { error: fe } = await supabase.from('unified_queue').update({
            status: 'done',
            completed_at: new Date().toISOString(),
            exam_end_time: new Date().toISOString()
          }).eq('id', patientId)
          if (fe) throw fe

          // 2) حاول الانتقال للمحطة التالية في المسار
          if (patient?.patient_id) {
            const { data: adv } = await supabase.rpc('advance_patient_route', {
              p_patient_id: patient.patient_id,
              p_clinic_id: clinicId
            })
            if (adv?.success && !adv?.completed) {
              pushNotif({
                type: 'success',
                title: t('✅ تم إنهاء الفحص','✅ Exam Done'),
                message: t(
                  `انتقل المراجع إلى ${adv.next_clinic_name} — رقم ${adv.next_display_number}`,
                  `Patient moved to ${adv.next_clinic_name} — #${adv.next_display_number}`
                )
              })
            } else if (adv?.completed) {
              pushNotif({ type: 'success', message: t('✅ اكتمل المسار الطبي كاملاً','✅ Medical route completed') })
            } else {
              pushNotif({ type: 'success', message: t('✅ تم إنهاء الفحص','✅ Exam completed') })
            }
          } else {
            pushNotif({ type: 'success', message: t('✅ تم إنهاء الفحص','✅ Exam completed') })
          }
          break
        }

        case 'ABSENT': {
          const { error } = await supabase.from('unified_queue').update({
            status: 'no_show',
            notes: t('غياب - ','Absent - ') + new Date().toLocaleTimeString('ar-SA')
          }).eq('id', patientId)
          if (error) throw error
          pushNotif({ type: 'warning', message: t('تم تسجيل الغياب','Absence recorded') })
          break
        }

        case 'MOVE_TO_LAST': {
          const { data: last } = await supabase.from('unified_queue')
            .select('display_number').eq('clinic_id', clinicId)
            .order('display_number', { ascending: false }).limit(1).maybeSingle()
          const { error } = await supabase.from('unified_queue').update({
            display_number: (last?.display_number || 0) + 1,
            status: 'waiting', called_at: null
          }).eq('id', patientId)
          if (error) throw error
          pushNotif({ type: 'info', message: t('تم نقل المراجع لآخر القائمة','Patient moved to end') })
          break
        }

        case 'MILITARY_COMMITTEE': {
          const { error } = await supabase.from('unified_queue').update({
            is_military_committee: true, is_priority: true,
            priority_reason: t('لجنة عسكرية','Military Committee'), status: 'waiting'
          }).eq('id', patientId)
          if (error) throw error
          pushNotif({ type: 'success', message: t('تم تحديد للجنة العسكرية','Marked for Military Committee') })
          break
        }

        case 'TRANSFER_CLINIC': {
          const { error } = await supabase.from('unified_queue').update({
            clinic_id: payload.targetClinicId, status: 'waiting',
            transferred_from: clinicId, transfer_reason: payload.reason || null,
            called_at: null, exam_start_time: null
          }).eq('id', patientId)
          if (error) throw error
          const tName = clinics.find(c => c.id === payload.targetClinicId)
          pushNotif({ type: 'success', message: t(`تم التحويل إلى ${tName?.name_ar || ''}`, `Transferred to ${tName?.name_en || ''}`) })
          setShowTransfer(false)
          break
        }

        case 'VIP': {
          const { error } = await supabase.from('unified_queue').update({
            is_vip: true, is_priority: true, priority_reason: 'VIP'
          }).eq('id', patientId)
          if (error) throw error
          pushNotif({ type: 'success', message: t('تم تحديد VIP','Marked as VIP') })
          break
        }

        default: throw new Error('Unknown action: ' + actionType)
      }

      await fetchPatients()
    } catch (err) {
      console.error('handleAction error:', actionType, err)
      let errMsg = err.message || String(err)
      if (errMsg.includes('violates not-null')) {
        errMsg = t('بيانات ناقصة، لا يمكن إتمام العملية', 'Incomplete data, cannot complete action')
      } else if (errMsg.includes('TypeError')) {
        errMsg = t('خطأ داخلي في التطبيق', 'Internal application error')
      }
      pushNotif({ type: 'error', title: t('فشل الإجراء', 'Action Failed'), message: errMsg })
    } finally {
      setActionLoading(null)
    }
  }

  /* ─── مكوّن: زر أيقونة مع tooltip ─── */
  const IconBtn = ({ action, patientId, payload, icon: Icon, label, color, disabled }) => {
    const isLoading = actionLoading === action + patientId
    return (
      <button
        title={label}
        aria-label={label}
        disabled={disabled || isLoading || loading}
        onClick={() => handleAction(action, patientId, payload || {})}
        className={`relative flex items-center justify-center w-11 h-11 rounded-xl transition-all
          hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed
          border border-white/10 ${color}`}
      >
        {isLoading
          ? <RefreshCw className="w-4 h-4 animate-spin" />
          : <Icon className="w-5 h-5" />
        }
        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] bg-black/80
          text-white px-1.5 py-0.5 rounded whitespace-nowrap opacity-0
          group-hover:opacity-100 pointer-events-none z-10">
          {label}
        </span>
      </button>
    )
  }

  /* ─── بطاقة المريض في القائمة ─── */
  const PatientRow = ({ patient, isCurrentPatient }) => (
    <div className={`group px-4 py-3 border-b border-white/5 last:border-0 transition-all
      ${isCurrentPatient ? 'bg-[#C9A54C]/10 border-[#C9A54C]/20' : 'hover:bg-white/5'}
    `}>
      <div className="flex items-center justify-between gap-2">
        {/* رقم الدور + اسم */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black flex-shrink-0
            ${isCurrentPatient ? 'bg-[#C9A54C] text-black' : 'bg-white/10 text-white'}`}>
            {patient.display_number}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">
              {patient.patient_name || patient.patient_id}
              {patient.is_vip && <span className="ml-1 text-yellow-400 text-xs">★</span>}
              {patient.is_military_committee && <span className="ml-1 text-purple-400 text-xs">🛡</span>}
            </p>
            <p className="text-xs text-gray-500">
              {patient.patient_id}
              {patient.gender === 'female' ? ' · أنثى' : ' · ذكر'}
              {patient.exam_type ? ` · ${patient.exam_type}` : ''}
            </p>
          </div>
        </div>

        {/* أيقونات الإجراءات - جنب بعض */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isCurrentPatient ? (
            <>
              <IconBtn action="FINISH_EXAM" patientId={patient.id}
                icon={CheckCircle} label={t('إنهاء الفحص','Finish Exam')}
                color="bg-green-500/20 text-green-400 hover:bg-green-500/30" />
              <IconBtn action="ABSENT" patientId={patient.id}
                icon={UserX} label={t('متغيب','Absent')}
                color="bg-red-500/20 text-red-400 hover:bg-red-500/30" />
              <IconBtn action="MOVE_TO_LAST" patientId={patient.id}
                icon={RotateCcw} label={t('نقل للأخير','Move to End')}
                color="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30" />
              <IconBtn action="MILITARY_COMMITTEE" patientId={patient.id}
                icon={ShieldCheck} label={t('لجنة عسكرية','Military Committee')}
                color="bg-purple-500/20 text-purple-400 hover:bg-purple-500/30" />
              <button
                title={t('تحويل عيادة','Transfer')}
                onClick={() => setShowTransfer(showTransfer === patient.id ? null : patient.id)}
                className="flex items-center justify-center w-11 h-11 rounded-xl
                  bg-orange-500/20 text-orange-400 hover:bg-orange-500/30
                  border border-white/10 transition-all hover:scale-105"
              >
                <ArrowRightLeft className="w-5 h-5" />
              </button>
            </>
          ) : (
            <>
              <IconBtn action="START_EXAM" patientId={patient.id}
                icon={Stethoscope} label={t('بدء الفحص','Start Exam')}
                color="bg-[#C9A54C]/20 text-[#C9A54C] hover:bg-[#C9A54C]/30" />
              <IconBtn action="VIP" patientId={patient.id}
                icon={Star} label={t('VIP','VIP')}
                color="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30" />
              <IconBtn action="ABSENT" patientId={patient.id}
                icon={UserX} label={t('متغيب','Absent')}
                color="bg-red-500/20 text-red-400 hover:bg-red-500/30" />
              <IconBtn action="MOVE_TO_LAST" patientId={patient.id}
                icon={RotateCcw} label={t('نقل للأخير','Move to End')}
                color="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30" />
            </>
          )}
        </div>
      </div>

      {/* تحويل العيادة - يظهر عند الضغط */}
      {showTransfer === patient.id && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <p className="text-xs text-gray-400 mb-2">{t('اختر العيادة للتحويل:','Select target clinic:')}</p>
          <div className="flex flex-wrap gap-1.5">
            {clinics.filter(c => c.id !== clinicId).map(clinic => (
              <button key={clinic.id}
                onClick={() => handleAction('TRANSFER_CLINIC', patient.id, { targetClinicId: clinic.id })}
                className="px-3 py-1.5 text-xs bg-white/10 hover:bg-[#C9A54C]/20
                  text-white rounded-lg border border-white/10 transition-all">
                {language === 'ar' ? clinic.name_ar : clinic.name_en}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  /* ─── الواجهة الرئيسية ─── */
  return (
    <div className="min-h-screen bg-[#0b0b0f] text-white overflow-x-hidden">
      <NotificationSystem notifications={notifList} onDismiss={dismissNotif} />

      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0b0b0f]/95 backdrop-blur border-b border-white/5 px-4 py-3">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#C9A54C] to-[#8A1538] rounded-xl
              flex items-center justify-center">
              <img src="/mms-logo.png" alt="MMC" className="w-7 h-7 object-contain" onError={e => { e.target.style.display='none' }} />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-tight">
                {t('لوحة تحكم الطبيب','Doctor Dashboard')}
              </h1>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#C9A54C] font-bold uppercase">{clinicName}</span>
                <span className="text-[10px] text-gray-500">{doctorData?.name || ''}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchPatients} disabled={loading}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#C9A54C]' : 'text-gray-400'}`} />
            </button>
            <button onClick={toggleLanguage}
              className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 transition-all">
              <Globe className="w-3.5 h-3.5 inline me-1" />
              {language === 'ar' ? 'EN' : 'ع'}
            </button>
            <button onClick={onLogout}
              className="px-3 py-1.5 text-xs bg-red-500/10 hover:bg-red-500 text-red-400
                hover:text-white rounded-lg border border-red-500/20 transition-all">
              <LogOut className="w-3.5 h-3.5 inline me-1" />
              {t('خروج','Logout')}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">

        {/* بطاقات الإحصائيات — أيقونة موحدة */}
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          {[
            { label: t('انتظار','Waiting'), val: stats.waitingNow,      icon: Users,        color: 'text-blue-400',   bg: 'bg-blue-500/10' },
            { label: t('قيد الفحص','In Exam'), val: currentPatient ? 1 : 0, icon: Activity,     color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
            { label: t('مكتمل','Done'),      val: stats.completedToday, icon: CheckCircle,  color: 'text-green-400',  bg: 'bg-green-500/10' },
            { label: t('غياب','Absent'),     val: stats.absentCount,    icon: UserX,        color: 'text-red-400',    bg: 'bg-red-500/10' },
            { label: t('متوسط انتظار','Avg Wait'), val: stats.avgWait + t('د','m'), icon: Clock, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          ].map((s,i) => (
            <div key={i} className={`${s.bg} border border-white/10 rounded-xl p-3 text-center`}>
              <s.icon className={`w-5 h-5 ${s.color} mx-auto mb-1`} />
              <p className={`text-xl font-black ${s.color}`}>{s.val}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* المريض الحالي */}
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-b from-[#12121a] to-[#0b0b0f] border border-white/10 rounded-2xl overflow-hidden">
              <div className="h-0.5 bg-gradient-to-r from-[#C9A54C] via-[#8A1538] to-[#C9A54C]" />
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-gray-300 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#C9A54C]" />
                    {t('المراجع الحالي','Current Patient')}
                  </h2>
                  {currentPatient && (
                    <div className="flex items-center gap-1.5 bg-red-500/10 text-red-400
                      px-2.5 py-1 rounded-full border border-red-500/20 text-xs">
                      <Timer className="w-3.5 h-3.5 animate-pulse" />
                      <span className="font-mono font-bold">{examTimer}</span>
                    </div>
                  )}
                </div>

                {currentPatient ? (
                  <PatientRow patient={currentPatient} isCurrentPatient={true} />
                ) : (
                  <div className="py-8 text-center">
                    <Users className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 mb-4">{t('لا يوجد مراجع حالي','No current patient')}</p>
                    <button
                      onClick={() => handleAction('CALL_NEXT', 'none')}
                      disabled={stats.waitingNow === 0 || !!actionLoading}
                      className="flex items-center gap-2 px-5 py-2.5 bg-[#C9A54C] text-black
                        font-bold rounded-xl hover:bg-[#B8943D] transition-all mx-auto
                        disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {actionLoading === 'CALL_NEXTnone'
                        ? <RefreshCw className="w-4 h-4 animate-spin" />
                        : <Phone className="w-4 h-4" />
                      }
                      {t('استدعاء التالي','Call Next')}
                      {stats.waitingNow > 0 && (
                        <span className="bg-black/20 text-black text-xs px-2 py-0.5 rounded-full font-bold">
                          {stats.waitingNow}
                        </span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* قائمة الانتظار */}
          <div className="lg:col-span-3">
            <div className="bg-[#12121a] border border-white/10 rounded-2xl overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                <h2 className="text-sm font-bold flex items-center gap-2 text-gray-300">
                  <Users className="w-4 h-4 text-blue-400" />
                  {t('قائمة الانتظار','Waiting List')}
                  <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded-full font-bold">
                    {patients.length}
                  </span>
                </h2>
                <button
                  onClick={() => handleAction('CALL_NEXT', 'none')}
                  disabled={stats.waitingNow === 0 || !!actionLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#C9A54C] text-black
                    text-xs font-bold rounded-lg hover:bg-[#B8943D] transition-all
                    disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {actionLoading === 'CALL_NEXTnone'
                    ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    : <Phone className="w-3.5 h-3.5" />
                  }
                  {t('التالي','Next')}
                </button>
              </div>

              <div className="overflow-y-auto max-h-[500px]">
                {patients.length === 0 ? (
                  <div className="py-12 text-center text-gray-600">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">{t('القائمة فارغة','No patients waiting')}</p>
                  </div>
                ) : (
                  patients.map(p => <PatientRow key={p.id} patient={p} isCurrentPatient={false} />)
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DoctorDashboard

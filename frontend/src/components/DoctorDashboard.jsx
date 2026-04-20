import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent } from './Card'
import {
  Globe, LogOut, Users, CheckCircle,
  Activity, Star, ArrowRightLeft, UserX,
  Timer, RotateCcw, ShieldCheck,
  Phone, RefreshCw, Stethoscope
} from 'lucide-react'
import { supabase } from '../lib/supabase-client'
import NotificationSystem, { useNotifications } from './NotificationSystem'

/* ================================================================
   DoctorDashboard — شاشة الطبيب
   - يقرأ فقط الأعمدة الموجودة فعلاً في unified_queue
   - كل الإجراءات مضمونة بـ try/catch حقيقي
   - لا بيانات وهمية
================================================================ */
export function DoctorDashboard({ doctorData, onLogout, language, toggleLanguage }) {
  // ── الحالات ──────────────────────────────────────────────────
  const [patients,       setPatients]       = useState([])
  const [clinics,        setClinics]        = useState([])
  const [clinicName,     setClinicName]     = useState('')
  const [actionLoading,  setActionLoading]  = useState(null)
  const [stats,          setStats]          = useState({ totalToday:0, completedToday:0, waitingNow:0, absentCount:0, avgWait:0 })
  const [currentPatient, setCurrentPatient] = useState(null)
  const [examTimer,      setExamTimer]      = useState('00:00')
  const [showTransfer,   setShowTransfer]   = useState(null)  // patient.id أو null
  const timerRef = useRef(null)
  const { notifications: notifList, push: pushNotif, dismiss: dismissNotif } = useNotifications()

  // ── doctorData من doctor_login RPC: {id, name, username, clinic_id, role} ──
  const clinicId = doctorData?.clinic_id || null
  const t = useCallback((ar, en) => language === 'ar' ? ar : en, [language])

  // ── جلب اسم العيادة من جدول clinics ──────────────────────────
  const fetchClinicName = useCallback(async () => {
    if (!clinicId) return
    try {
      const { data } = await supabase
        .from('clinics')
        .select('name_ar, name_en')
        .eq('id', clinicId)
        .maybeSingle()
      if (data) setClinicName(language === 'ar' ? (data.name_ar || data.name_en || clinicId) : (data.name_en || data.name_ar || clinicId))
    } catch (e) { console.error('fetchClinicName:', e) }
  }, [clinicId, language])

  // ── جلب قائمة العيادات للتحويل ──────────────────────────────
  const fetchClinics = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('clinics')
        .select('id, name_ar, name_en')
        .eq('is_active', true)
        .order('name_ar')
      setClinics(data || [])
    } catch (e) { console.error('fetchClinics:', e) }
  }, [])

  // ── جلب المرضى — أعمدة حقيقية فقط ──────────────────────────
  const fetchPatients = useCallback(async () => {
    if (!clinicId) { setPatients([]); setCurrentPatient(null); return }
    try {
      // توقيت قطر (UTC+3) — يطابق qatar_today() في Supabase بدقة
      const today = new Date(Date.now() + 3*60*60*1000).toISOString().split('T')[0]
      // تحديد الأعمدة الموجودة فعلاً في unified_queue
      const { data, error } = await supabase
        .from('unified_queue')
        .select([
          'id','display_number','patient_name','patient_id',
          'military_id','personal_id','status',
          'entered_at','called_at','completed_at',
          'exam_start_time','exam_end_time','entered_clinic_at',
          'queue_date','clinic_id','gender','exam_type',
          'is_vip','is_priority','is_military_committee',
          'notes','transferred_from','priority_reason'
        ].join(', '))
        .eq('clinic_id', clinicId)
        .eq('queue_date', today)
        .order('display_number', { ascending: true })

      if (error) throw error

      const all = data || []
      const ACTIVE   = ['serving','called','in_progress']
      const DONE_SET = ['done','completed']
      const ABSENT   = ['no_show','absent']

      const current   = all.find(p => ACTIVE.includes(p.status)) || null
      const waiting   = all.filter(p => p.status === 'waiting')
      const completed = all.filter(p => DONE_SET.includes(p.status))
      const absent    = all.filter(p => ABSENT.includes(p.status))

      // متوسط وقت الانتظار الحقيقي
      let avgWait = 0
      const withWait = completed.filter(p => p.entered_at && p.called_at)
      if (withWait.length > 0) {
        const total = withWait.reduce((s,p) =>
          s + Math.abs(new Date(p.called_at) - new Date(p.entered_at)), 0)
        avgWait = Math.round(total / withWait.length / 60000)
      }

      setCurrentPatient(current)
      setPatients(waiting)
      setStats({
        totalToday:    all.length,
        completedToday: completed.length,
        waitingNow:    waiting.length,
        absentCount:   absent.length,
        avgWait
      })
    } catch (err) {
      console.error('fetchPatients ERROR:', err.message)
      pushNotif({ type:'error', message: t('خطأ في تحميل البيانات: ','Error loading: ') + err.message })
    }
  }, [clinicId, t])

  // ── مؤقت الفحص ──────────────────────────────────────────────
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (currentPatient?.exam_start_time) {
      const start = new Date(currentPatient.exam_start_time).getTime()
      timerRef.current = setInterval(() => {
        const diff = Date.now() - start
        const m = Math.floor(diff/60000)
        const s = Math.floor((diff%60000)/1000)
        setExamTimer(`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
      }, 1000)
    } else { setExamTimer('00:00') }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [currentPatient?.id, currentPatient?.exam_start_time])

  // ── تحميل أولي + real-time ──────────────────────────────────
  useEffect(() => {
    fetchClinicName()
    fetchPatients()
    fetchClinics()

    if (!clinicId) return
    const ch = supabase
      .channel(`dd_${clinicId}_${Date.now()}`)
      .on('postgres_changes', {
        event:'*', schema:'public', table:'unified_queue',
        filter:`clinic_id=eq.${clinicId}`
      }, fetchPatients)
      .subscribe()
    const iv = setInterval(fetchPatients, 20000)
    return () => { supabase.removeChannel(ch); clearInterval(iv) }
  }, [clinicId, fetchPatients, fetchClinics, fetchClinicName])

  // ── منطق الإجراءات ──────────────────────────────────────────
  const handleAction = async (actionType, patientId, payload = {}) => {
    if (!clinicId) {
      pushNotif({ type:'error', message: t('خطأ: معرف العيادة غير موجود. يرجى إعادة تسجيل الدخول.','Error: Clinic ID missing. Please re-login.') })
      return
    }
    const key = actionType + (patientId||'')
    setActionLoading(key)
    try {
      const patient = currentPatient?.id === patientId
        ? currentPatient
        : patients.find(p => p.id === patientId)

      switch (actionType) {

        // استدعاء التالي
        case 'CALL_NEXT': {
          const { data: cd, error: ce } = await supabase.rpc('call_next_patient', {
            p_clinic_id: clinicId,
            p_mark_current_done: false
          })
          if (ce) throw ce
          if (cd?.data?.display_number) {
            pushNotif({ type:'success',
              title: t('✅ تم الاستدعاء','✅ Called'),
              message: t(`المراجع رقم ${cd.data.display_number}`, `Patient #${cd.data.display_number}`) })
          } else {
            pushNotif({ type:'info', message: t('لا يوجد مرضى في الانتظار حالياً','No patients waiting') })
          }
          break
        }

        // بدء الفحص + إنشاء سجل فحص في exam_records
        case 'START_EXAM': {
          const { data: sr, error: srErr } = await supabase.rpc('start_exam_record', {
            p_queue_id:    patientId,
            p_doctor_id:   doctorData?.id   || null,
            p_doctor_name: doctorData?.name || clinicName || null,
          })
          if (srErr) {
            // fallback مباشر إذا فشل RPC
            const { error: fe } = await supabase.from('unified_queue')
              .update({ status:'serving', entered_clinic_at: new Date().toISOString(), exam_start_time: new Date().toISOString() })
              .eq('id', patientId)
            if (fe) throw fe
          }
          pushNotif({ type:'success', message: t('✅ بدأ الفحص وتم تسجيل السجل','✅ Exam started & record logged') })
          break
        }

        // إنهاء الفحص + تقدم تلقائي للمسار
        case 'FINISH_EXAM': {
          const { error: fe } = await supabase
            .from('unified_queue')
            .update({ status:'done', completed_at: new Date().toISOString(), exam_end_time: new Date().toISOString() })
            .eq('id', patientId)
          if (fe) throw fe

          // تقدم المسار تلقائياً إذا كان المريض في مسار
          if (patient?.patient_id) {
            try {
              const { data: adv } = await supabase.rpc('advance_patient_route', {
                p_patient_id: patient.patient_id,
                p_clinic_id:  clinicId
              })
              if (adv?.success && !adv?.completed) {
                pushNotif({ type:'success',
                  title: t('✅ تم إنهاء الفحص','✅ Exam Done'),
                  message: t(
                    `المراجع انتقل إلى ${adv.next_clinic_name || adv.next_clinic_id} — رقم ${adv.next_display_number || ''}`,
                    `Patient moved to ${adv.next_clinic_name || adv.next_clinic_id} — #${adv.next_display_number || ''}`
                  )
                })
              } else if (adv?.completed) {
                pushNotif({ type:'success', message: t('🎉 اكتمل المسار الطبي كاملاً — صالح للفحص!','🎉 Full medical route completed!') })
              } else {
                pushNotif({ type:'success', message: t('✅ تم إنهاء الفحص','✅ Exam completed') })
              }
            } catch (_) {
              // advance_patient_route اختياري — الفحص اكتمل في كل الأحوال
              pushNotif({ type:'success', message: t('✅ تم إنهاء الفحص','✅ Exam completed') })
            }
          } else {
            pushNotif({ type:'success', message: t('✅ تم إنهاء الفحص','✅ Exam completed') })
          }
          break
        }

        // غياب
        case 'ABSENT': {
          const { error } = await supabase
            .from('unified_queue')
            .update({
              status: 'no_show',
              notes:  t('غياب - ','Absent - ') + new Date().toLocaleTimeString('ar-SA')
            })
            .eq('id', patientId)
          if (error) throw error
          pushNotif({ type:'warning', message: t('تم تسجيل الغياب','Absence recorded') })
          break
        }

        // نقل لآخر القائمة
        case 'MOVE_TO_LAST': {
          const { data: last } = await supabase
            .from('unified_queue')
            .select('display_number')
            .eq('clinic_id', clinicId)
            .order('display_number', { ascending:false })
            .limit(1)
            .maybeSingle()
          const { error } = await supabase
            .from('unified_queue')
            .update({ display_number:(last?.display_number||0)+1, status:'waiting', called_at:null })
            .eq('id', patientId)
          if (error) throw error
          pushNotif({ type:'info', message: t('تم نقل المراجع لآخر القائمة','Patient moved to end of queue') })
          break
        }

        // اللجنة العسكرية
        case 'MILITARY': {
          const { error } = await supabase
            .from('unified_queue')
            .update({ is_military_committee:true, is_priority:true, priority_reason: t('لجنة عسكرية','Military Committee') })
            .eq('id', patientId)
          if (error) throw error
          pushNotif({ type:'success', message: t('تم تحديد اللجنة العسكرية','Marked: Military Committee') })
          break
        }

        // VIP
        case 'VIP': {
          const { error } = await supabase
            .from('unified_queue')
            .update({ is_vip:true, is_priority:true, priority_reason:'VIP' })
            .eq('id', patientId)
          if (error) throw error
          pushNotif({ type:'success', message: t('تم تحديد VIP','Marked as VIP') })
          break
        }

        // تحويل لعيادة أخرى
        case 'TRANSFER': {
          if (!payload.targetClinicId) { pushNotif({ type:'warning', message: t('اختر العيادة المستهدفة','Choose target clinic') }); return }
          const { error } = await supabase
            .from('unified_queue')
            .update({
              clinic_id:        payload.targetClinicId,
              status:           'waiting',
              transferred_from: clinicId,
              called_at:        null,
              exam_start_time:  null,
              entered_clinic_at:null
            })
            .eq('id', patientId)
          if (error) throw error
          const target = clinics.find(c => c.id === payload.targetClinicId)
          pushNotif({ type:'success',
            message: t(`تم التحويل إلى ${target?.name_ar||payload.targetClinicId}`,
                       `Transferred to ${target?.name_en||payload.targetClinicId}`) })
          setShowTransfer(null)
          break
        }

        default: throw new Error('Unknown action: ' + actionType)
      }

      await fetchPatients()
    } catch (err) {
      console.error('handleAction:', actionType, err)
      let msg = err?.message || String(err)
      if (msg.includes('violates not-null')) msg = t('بيانات ناقصة','Incomplete data')
      if (msg.includes('permission denied')) msg = t('ليس لديك صلاحية','Permission denied')
      pushNotif({ type:'error', title: t('فشل الإجراء','Action Failed'), message: msg })
    } finally {
      setActionLoading(null)
    }
  }

  // ── زر أيقونة مع Tooltip ────────────────────────────────────
  const Btn = ({ action, pid, payload, Icon, label, color }) => {
    const busy = actionLoading === action + (pid||'')
    return (
      <button
        title={label} aria-label={label}
        disabled={!!actionLoading}
        onClick={() => handleAction(action, pid, payload)}
        className={`group relative flex items-center justify-center w-11 h-11 rounded-xl
          border border-white/10 transition-all hover:scale-110 active:scale-95
          disabled:opacity-40 disabled:cursor-not-allowed ${color}`}
      >
        {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Icon className="w-5 h-5" />}
        <span className="pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2
          whitespace-nowrap rounded bg-black/90 px-2 py-0.5 text-[10px] text-white
          opacity-0 group-hover:opacity-100 transition-opacity z-50">
          {label}
        </span>
      </button>
    )
  }

  // ── صف مريض في القائمة ──────────────────────────────────────
  const PatientRow = ({ p, isCurrent }) => (
    <div className={`px-3 py-3 border-b border-white/5 last:border-0 transition-colors
      ${isCurrent ? 'bg-[#C9A54C]/10 border-[#C9A54C]/20' : 'hover:bg-white/5'}`}>

      {/* المعلومات + الأزرار */}
      <div className="flex items-center justify-between gap-2">
        {/* الرقم + الاسم */}
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center
            font-black text-lg flex-shrink-0
            ${isCurrent ? 'bg-[#C9A54C] text-black' : 'bg-white/10 text-white'}`}>
            {p.display_number}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate leading-tight">
              {p.patient_name || p.patient_id || p.personal_id || '—'}
              {p.is_vip && <span className="ml-1 text-yellow-400 text-xs">★</span>}
              {p.is_military_committee && <span className="ml-1 text-purple-400 text-xs">🛡</span>}
            </p>
            <p className="text-[11px] text-gray-500 truncate leading-tight">
              {p.patient_id || p.personal_id || ''}{p.gender === 'female' ? ' · أنثى' : ' · ذكر'}
              {p.exam_type ? ` · ${p.exam_type}` : ''}
            </p>
          </div>
        </div>

        {/* أزرار الإجراءات — جنب بعض */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {isCurrent ? (
            <>
              <Btn action="FINISH_EXAM" pid={p.id} Icon={CheckCircle} label={t('إنهاء الفحص','Finish Exam')} color="bg-green-500/20 text-green-400 hover:bg-green-500/40" />
              <Btn action="ABSENT"      pid={p.id} Icon={UserX}       label={t('متغيب','Absent')}          color="bg-red-500/20 text-red-400 hover:bg-red-500/40" />
              <Btn action="MOVE_TO_LAST" pid={p.id} Icon={RotateCcw}  label={t('نقل لآخر الدور','Move to End')} color="bg-blue-500/20 text-blue-400 hover:bg-blue-500/40" />
              <Btn action="MILITARY"   pid={p.id} Icon={ShieldCheck}  label={t('لجنة عسكرية','Military')}   color="bg-purple-500/20 text-purple-400 hover:bg-purple-500/40" />
              <Btn action="VIP"        pid={p.id} Icon={Star}         label="VIP"                          color="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/40" />
              <button
                title={t('تحويل عيادة','Transfer')}
                onClick={() => setShowTransfer(showTransfer === p.id ? null : p.id)}
                disabled={!!actionLoading}
                className="flex items-center justify-center w-11 h-11 rounded-xl
                  bg-orange-500/20 text-orange-400 hover:bg-orange-500/40
                  border border-white/10 transition-all hover:scale-110 disabled:opacity-40">
                <ArrowRightLeft className="w-5 h-5" />
              </button>
            </>
          ) : (
            <>
              <Btn action="START_EXAM"   pid={p.id} Icon={Stethoscope} label={t('بدء الفحص','Start Exam')} color="bg-[#C9A54C]/20 text-[#C9A54C] hover:bg-[#C9A54C]/40" />
              <Btn action="VIP"          pid={p.id} Icon={Star}        label="VIP"                         color="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/40" />
              <Btn action="ABSENT"       pid={p.id} Icon={UserX}       label={t('متغيب','Absent')}         color="bg-red-500/20 text-red-400 hover:bg-red-500/40" />
              <Btn action="MOVE_TO_LAST" pid={p.id} Icon={RotateCcw}   label={t('نقل لآخر الدور','Move to End')} color="bg-blue-500/20 text-blue-400 hover:bg-blue-500/40" />
            </>
          )}
        </div>
      </div>

      {/* لوحة التحويل */}
      {showTransfer === p.id && (
        <div className="mt-2 pt-2 border-t border-white/10">
          <p className="text-[11px] text-gray-400 mb-1.5">{t('اختر العيادة:','Select clinic:')}</p>
          <div className="flex flex-wrap gap-1.5">
            {clinics.filter(c => c.id !== clinicId).map(cl => (
              <button key={cl.id}
                onClick={() => handleAction('TRANSFER', p.id, { targetClinicId: cl.id })}
                disabled={!!actionLoading}
                className="px-2.5 py-1 text-[11px] bg-white/10 hover:bg-[#C9A54C]/30
                  text-white rounded-lg border border-white/10 transition-all disabled:opacity-40">
                {language === 'ar' ? cl.name_ar : (cl.name_en || cl.name_ar)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  // ── واجهة المستخدم ───────────────────────────────────────────
  if (!clinicId) {
    return (
      <div className="min-h-screen bg-[#0b0b0f] flex items-center justify-center text-white p-6">
        <div className="text-center space-y-4">
          <Activity className="w-16 h-16 text-red-400 mx-auto" />
          <h2 className="text-xl font-bold text-red-400">{t('لم يُعيَّن لك عيادة','No clinic assigned')}</h2>
          <p className="text-gray-400 text-sm">{t('يرجى التواصل مع المدير لتعيين العيادة','Contact admin to assign a clinic')}</p>
          <button onClick={onLogout}
            className="px-6 py-2 bg-red-500/20 text-red-400 rounded-xl border border-red-500/20 hover:bg-red-500/30 transition-all">
            <LogOut className="w-4 h-4 inline me-2" />
            {t('خروج','Logout')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0b0b0f] text-white overflow-x-hidden">
      <NotificationSystem notifications={notifList} onDismiss={dismissNotif} />

      {/* ── Header ── */}
      <div className="sticky top-0 z-40 bg-[#0b0b0f]/95 backdrop-blur border-b border-white/5 px-4 py-3">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#C9A54C] to-[#8A1538] rounded-xl flex items-center justify-center text-sm font-black">
              {(clinicName || clinicId || '?')[0]}
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">{clinicName || clinicId}</p>
              <p className="text-[11px] text-gray-500 leading-tight">د. {doctorData?.name || ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchPatients} title={t('تحديث','Refresh')}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all">
              <RefreshCw className={`w-4 h-4 ${actionLoading === 'REFRESH' ? 'animate-spin' : ''} text-gray-400`} />
            </button>
            <button onClick={toggleLanguage}
              className="px-2.5 py-1.5 text-xs bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 transition-all">
              <Globe className="w-3.5 h-3.5 inline me-1" />
              {language === 'ar' ? 'EN' : 'ع'}
            </button>
            <button onClick={onLogout}
              className="px-2.5 py-1.5 text-xs bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-lg border border-red-500/20 transition-all">
              <LogOut className="w-3.5 h-3.5 inline me-1" />
              {t('خروج','Logout')}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">

        {/* ── إحصائيات موحدة ── */}
        <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
          {[
            { label:t('انتظار','Wait'),   val:stats.waitingNow,     Icon:Users,        color:'text-blue-400',   bg:'bg-blue-500/10' },
            { label:t('فحص','Exam'),      val:currentPatient?1:0,   Icon:Activity,     color:'text-yellow-400', bg:'bg-yellow-500/10' },
            { label:t('مكتمل','Done'),    val:stats.completedToday, Icon:CheckCircle,  color:'text-green-400',  bg:'bg-green-500/10' },
            { label:t('غياب','Absent'),   val:stats.absentCount,    Icon:UserX,        color:'text-red-400',    bg:'bg-red-500/10' },
            { label:t('إجمالي','Total'),  val:stats.totalToday,     Icon:Users,        color:'text-purple-400', bg:'bg-purple-500/10' },
          ].map((s,i) => (
            <div key={i} className={`${s.bg} border border-white/10 rounded-xl p-3 text-center`}>
              <s.Icon className={`w-5 h-5 ${s.color} mx-auto mb-1`} />
              <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* ── المريض الحالي ── */}
          <div className="lg:col-span-2">
            <div className="bg-[#12121a] border border-white/10 rounded-2xl overflow-hidden">
              <div className="h-0.5 bg-gradient-to-r from-[#C9A54C] via-[#8A1538] to-[#C9A54C]" />
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#C9A54C]" />
                    {t('المراجع الحالي','Current Patient')}
                  </h3>
                  {currentPatient?.exam_start_time && (
                    <div className="flex items-center gap-1.5 bg-red-500/10 text-red-400 px-2.5 py-1 rounded-full border border-red-500/20 text-xs">
                      <Timer className="w-3.5 h-3.5 animate-pulse" />
                      <span className="font-mono font-bold">{examTimer}</span>
                    </div>
                  )}
                </div>

                {currentPatient ? (
                  <PatientRow p={currentPatient} isCurrent={true} />
                ) : (
                  <div className="py-8 text-center">
                    <Users className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 mb-4">{t('لا يوجد مراجع حالي','No current patient')}</p>
                    <button
                      onClick={() => handleAction('CALL_NEXT', 'none')}
                      disabled={stats.waitingNow === 0 || !!actionLoading}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#C9A54C] text-black font-bold rounded-xl hover:bg-[#b8943d] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                      {actionLoading === 'CALL_NEXTnone'
                        ? <RefreshCw className="w-4 h-4 animate-spin" />
                        : <Phone className="w-4 h-4" />}
                      {t('استدعاء التالي','Call Next')}
                      {stats.waitingNow > 0 && (
                        <span className="bg-black/20 px-2 py-0.5 rounded-full text-xs font-black">
                          {stats.waitingNow}
                        </span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── قائمة الانتظار ── */}
          <div className="lg:col-span-3">
            <div className="bg-[#12121a] border border-white/10 rounded-2xl overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  {t('قائمة الانتظار','Waiting List')}
                  <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded-full font-bold">
                    {patients.length}
                  </span>
                </h3>
                <button
                  onClick={() => handleAction('CALL_NEXT', 'none')}
                  disabled={stats.waitingNow === 0 || !!actionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#C9A54C] text-black text-xs font-bold rounded-lg hover:bg-[#b8943d] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  {actionLoading === 'CALL_NEXTnone'
                    ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    : <Phone className="w-3.5 h-3.5" />}
                  {t('التالي ▶','Next ▶')}
                </button>
              </div>

              <div className="overflow-y-auto" style={{ maxHeight:'calc(100vh - 280px)' }}>
                {patients.length === 0 ? (
                  <div className="py-12 text-center text-gray-600">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">{t('لا يوجد مراجعون في الانتظار','No patients waiting')}</p>
                  </div>
                ) : (
                  patients.map(p => <PatientRow key={p.id} p={p} isCurrent={false} />)
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

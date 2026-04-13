import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
import { Input } from './Input'
import { 
  Globe, LogOut, Users, Clock, CheckCircle, SkipForward, 
  UserCheck, Calendar, TrendingUp, Activity, Star, 
  ArrowRightLeft, UserX, Timer, RotateCcw, Building2, ShieldCheck
} from 'lucide-react'
import { supabase } from '../lib/supabase-client'
import { formatTime, formatDuration } from '../lib/utils'
import NotificationSystem, { useNotifications } from './NotificationSystem'
import api from '../lib/api-unified'

export function DoctorDashboard({ doctorData, onLogout, language, toggleLanguage }) {
  const [patients, setPatients] = useState([])
  const [clinics, setClinics] = useState([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({
    totalToday: 0,
    completedToday: 0,
    waitingNow: 0,
    absentCount: 0
  })
  const [currentPatient, setCurrentPatient] = useState(null)
  const [examTimer, setExamTimer] = useState('00:00')
  const timerRef = useRef(null)
  const { notifications: notifList, push: pushNotif, dismiss: dismissNotif } = useNotifications()

  const clinicId = doctorData?.clinic_id
  const clinicName = doctorData?.clinic_name || (language === 'ar' ? 'العيادة' : 'Clinic')

  // Fetch all clinics for transfer functionality
  const fetchClinics = async () => {
    try {
      const { data, error } = await supabase.from('clinics').select('id, name_ar, name_en')
      if (error) throw error
      setClinics(data || [])
    } catch (err) {
      console.error('Error fetching clinics:', err)
    }
  }

  // Fetch patients and stats
  const fetchPatients = async () => {
    if (!clinicId) return
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('unified_queue')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('queue_date', today)
        .order('display_number', { ascending: true })

      if (error) throw error

      const waiting = data?.filter(p => p.status === 'waiting' || p.status === 'called') || []
      const completed = data?.filter(p => p.status === 'completed') || []
      const absent = data?.filter(p => p.status === 'absent' || p.status === 'no_show') || []
      const inProgress = data?.find(p => p.status === 'in_progress')

      setPatients(waiting)
      setStats({
        totalToday: data?.length || 0,
        completedToday: completed.length,
        waitingNow: waiting.length,
        absentCount: absent.length
      })

      if (inProgress) {
        setCurrentPatient(inProgress)
      } else {
        setCurrentPatient(null)
      }
    } catch (err) {
      console.error('Error fetching patients:', err)
    }
  }

  // Timer logic
  useEffect(() => {
    if (currentPatient && currentPatient.exam_start_time) {
      const startTime = new Date(currentPatient.exam_start_time).getTime()
      
      if (timerRef.current) clearInterval(timerRef.current)
      
      timerRef.current = setInterval(() => {
        const now = new Date().getTime()
        const diff = now - startTime
        const minutes = Math.floor(diff / 60000)
        const seconds = Math.floor((diff % 60000) / 1000)
        setExamTimer(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      setExamTimer('00:00')
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [currentPatient])

  useEffect(() => {
    fetchPatients()
    fetchClinics()
    
    // Real-time subscription
    const channel = supabase
      .channel(`doctor_dashboard_${clinicId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'unified_queue',
        filter: `clinic_id=eq.${clinicId}`
      }, () => {
        fetchPatients()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [clinicId])

  const translate = (ar, en) => (language === 'ar' ? ar : en)

  // Actions
  const handleAction = async (actionType, patientId, payload = {}) => {
    setLoading(true)
    try {
      let result;
      const patient = patients.find(p => p.id === patientId) || currentPatient;
      
      switch (actionType) {
        case 'CALL_NEXT':
          // Using the unified API for calling next
          result = await api.callNextPatient(clinicId, doctorData?.pin || '0000');
          break;
        case 'START_EXAM':
          result = await supabase.from('unified_queue').update({
            status: 'in_progress',
            exam_start_time: new Date().toISOString()
          }).eq('id', patientId);
          break;
        case 'FINISH_EXAM':
          result = await supabase.from('unified_queue').update({
            status: 'completed',
            exam_end_time: new Date().toISOString()
          }).eq('id', patientId);
          break;
        case 'MARK_VIP':
          result = await supabase.from('unified_queue').update({
            is_vip: true,
            priority_score: 100
          }).eq('id', patientId);
          break;
        case 'MOVE_TO_LAST':
          const { data: lastPatient } = await supabase.from('unified_queue')
            .select('display_number')
            .eq('clinic_id', clinicId)
            .order('display_number', { ascending: false })
            .limit(1).single();
          result = await supabase.from('unified_queue').update({
            display_number: (lastPatient?.display_number || 0) + 1
          }).eq('id', patientId);
          break;
        case 'TRANSFER_CLINIC':
          result = await supabase.from('unified_queue').update({
            clinic_id: payload.targetClinicId,
            status: 'waiting',
            called_at: null,
            exam_start_time: null
          }).eq('id', patientId);
          break;
        case 'MILITARY_COMMITTEE':
          // Assuming a specific clinic ID or flag for military committee
          result = await supabase.from('unified_queue').update({
            is_military_committee: true,
            status: 'waiting'
          }).eq('id', patientId);
          break;
        case 'ABSENT':
          result = await supabase.from('unified_queue').update({
            status: 'absent',
            marked_absent_at: new Date().toISOString()
          }).eq('id', patientId);
          break;
        default:
          throw new Error('Unknown action');
      }

      if (result.error) throw result.error;

      pushNotif({
        type: 'success',
        title: translate('تمت العملية', 'Action Successful'),
        message: translate('تم تحديث حالة المراجع بنجاح', 'Patient status updated successfully')
      })
      fetchPatients()
    } catch (err) {
      pushNotif({
        type: 'error',
        message: translate('فشل الإجراء: ', 'Action failed: ') + err.message
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1115] text-white p-4 sm:p-6 overflow-x-hidden">
      <NotificationSystem notifications={notifList} onDismiss={dismissNotif} />

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-900/40 p-6 rounded-2xl border border-white/5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-[#C9A54C] to-[#8A1538] rounded-2xl flex items-center justify-center shadow-lg shadow-red-900/20">
              <img src="/mms-logo.png" alt="Logo" className="w-12 h-12 object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{translate('اللجنة الطبية العسكرية', 'Military Medical Committee')}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 bg-[#C9A54C]/10 text-[#C9A54C] text-xs font-bold rounded-full border border-[#C9A54C]/20 uppercase">
                  {clinicName}
                </span>
                <span className="text-gray-400 text-sm">د. {doctorData?.name || 'غير معروف'}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={toggleLanguage} className="text-gray-400 hover:text-white">
              <Globe className="w-4 h-4 me-2" />
              {language === 'ar' ? 'English' : 'العربية'}
            </Button>
            <Button variant="destructive" size="sm" onClick={onLogout} className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20">
              <LogOut className="w-4 h-4 me-2" />
              {translate('خروج', 'Logout')}
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: translate('المنتظرين', 'Waiting'), value: stats.waitingNow, icon: Users, color: 'text-blue-400', bg: 'bg-blue-400/10' },
            { label: translate('المنتهين', 'Completed'), value: stats.completedToday, icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-400/10' },
            { label: translate('المتغيبين', 'Absent'), value: stats.absentCount, icon: UserX, color: 'text-red-400', bg: 'bg-red-400/10' },
            { label: translate('الإجمالي', 'Total'), value: stats.totalToday, icon: Activity, color: 'text-purple-400', bg: 'bg-purple-400/10' },
          ].map((stat, i) => (
            <Card key={i} className="bg-gray-900/40 border-white/5 overflow-hidden relative group">
              <div className={`absolute top-0 right-0 w-16 h-16 ${stat.bg} rounded-bl-full -mr-8 -mt-8 transition-all group-hover:scale-110`} />
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`p-3 rounded-xl ${stat.bg}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Action Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Current Patient Card */}
            <Card className="bg-gradient-to-br from-gray-900 to-black border-white/10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#C9A54C] via-[#8A1538] to-[#C9A54C]" />
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-[#C9A54C]" />
                    {translate('المراجع الحالي', 'Current Patient')}
                  </span>
                  {currentPatient && (
                    <div className="flex items-center gap-2 bg-red-500/10 text-red-500 px-3 py-1 rounded-full border border-red-500/20">
                      <Timer className="w-4 h-4 animate-pulse" />
                      <span className="font-mono font-bold text-lg">{examTimer}</span>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {currentPatient ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between bg-white/5 p-6 rounded-2xl border border-white/5">
                      <div className="space-y-1">
                        <p className="text-sm text-gray-400 uppercase tracking-wider">{translate('رقم الدور', 'Queue Number')}</p>
                        <h2 className="text-5xl font-black text-white">{currentPatient.display_number}</h2>
                      </div>
                      <div className="text-right space-y-2">
                        <p className="text-sm text-gray-400">{translate('نوع الفحص', 'Exam Type')}</p>
                        <p className="text-xl font-bold text-[#C9A54C]">{currentPatient.exam_type || translate('عام', 'General')}</p>
                        {currentPatient.is_vip && (
                          <span className="inline-flex items-center gap-1 bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded text-xs font-bold border border-yellow-500/20">
                            <Star className="w-3 h-3 fill-current" /> VIP
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <Button 
                        variant="gradient" 
                        className="h-14 font-bold" 
                        onClick={() => handleAction('FINISH_EXAM', currentPatient.id)}
                        disabled={loading}
                      >
                        <CheckCircle className="w-5 h-5 me-2" />
                        {translate('إنهاء الفحص', 'Finish')}
                      </Button>
                      <Button 
                        variant="outline" 
                        className="h-14 border-white/10 hover:bg-white/5"
                        onClick={() => handleAction('ABSENT', currentPatient.id)}
                        disabled={loading}
                      >
                        <UserX className="w-5 h-5 me-2 text-red-400" />
                        {translate('عدم حضور', 'Absent')}
                      </Button>
                      <Button 
                        variant="outline" 
                        className="h-14 border-white/10 hover:bg-white/5"
                        onClick={() => handleAction('MOVE_TO_LAST', currentPatient.id)}
                        disabled={loading}
                      >
                        <RotateCcw className="w-5 h-5 me-2 text-blue-400" />
                        {translate('ترحيل للأخير', 'Last')}
                      </Button>
                      <Button 
                        variant="outline" 
                        className="h-14 border-white/10 hover:bg-white/5"
                        onClick={() => handleAction('MILITARY_COMMITTEE', currentPatient.id)}
                        disabled={loading}
                      >
                        <ShieldCheck className="w-5 h-5 me-2 text-purple-400" />
                        {translate('اللجنة العسكرية', 'Military')}
                      </Button>
                    </div>
                    
                    <div className="pt-4 border-t border-white/5">
                      <p className="text-xs text-gray-500 mb-3 uppercase font-bold tracking-widest">{translate('تحويل لعيادة أخرى', 'Transfer to Clinic')}</p>
                      <div className="flex flex-wrap gap-2">
                        {clinics.filter(c => c.id !== clinicId).slice(0, 4).map(clinic => (
                          <Button 
                            key={clinic.id} 
                            variant="ghost" 
                            size="sm" 
                            className="bg-white/5 hover:bg-[#C9A54C]/20 text-xs border border-white/5"
                            onClick={() => handleAction('TRANSFER_CLINIC', currentPatient.id, { targetClinicId: clinic.id })}
                          >
                            <Building2 className="w-3 h-3 me-1" />
                            {language === 'ar' ? clinic.name_ar : clinic.name_en}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center space-y-4">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/5">
                      <Users className="w-10 h-10 text-gray-600" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xl font-bold text-gray-400">{translate('لا يوجد مراجع حالي', 'No Active Patient')}</h3>
                      <p className="text-sm text-gray-500">{translate('قم باستدعاء المراجع التالي من القائمة', 'Call the next patient from the waiting list')}</p>
                    </div>
                    <Button 
                      variant="gradientSecondary" 
                      size="lg" 
                      className="mt-4 px-12 h-14 text-lg font-black shadow-xl shadow-red-900/20"
                      onClick={() => handleAction('CALL_NEXT')}
                      disabled={loading || patients.length === 0}
                    >
                      <TrendingUp className="w-6 h-6 me-3" />
                      {translate('استدعاء المراجع التالي', 'Call Next Patient')}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Waiting List Sidebar */}
          <div className="space-y-6">
            <Card className="bg-gray-900/40 border-white/5 h-full flex flex-col">
              <CardHeader className="border-b border-white/5 pb-4">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-400" />
                    {translate('قائمة الانتظار', 'Waiting List')}
                  </span>
                  <span className="bg-blue-400/10 text-blue-400 px-2 py-0.5 rounded text-xs font-bold border border-blue-400/20">
                    {patients.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex-grow overflow-y-auto max-h-[600px] custom-scrollbar">
                {patients.length === 0 ? (
                  <div className="p-12 text-center text-gray-500 italic">
                    {translate('القائمة فارغة', 'List is empty')}
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {patients.map((patient) => (
                      <div key={patient.id} className={`p-4 hover:bg-white/5 transition-colors group ${patient.status === 'called' ? 'bg-yellow-500/5' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl border shadow-inner ${
                              patient.status === 'called' 
                                ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-500' 
                                : 'bg-gray-800 border-white/10 text-white'
                            }`}>
                              {patient.display_number}
                            </div>
                            <div>
                              <div className="font-bold flex items-center gap-2">
                                {translate(`مراجع رقم ${patient.display_number}`, `Patient #${patient.display_number}`)}
                                {patient.is_vip && <Star className="w-3 h-3 text-yellow-500 fill-current" />}
                              </div>
                              <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                                <Clock className="w-3 h-3" />
                                {new Date(patient.entered_at || patient.created_at).toLocaleTimeString(language === 'ar' ? 'ar-QA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {patient.status === 'called' ? (
                              <Button 
                                size="sm" 
                                variant="gradient" 
                                className="h-8 text-xs font-bold"
                                onClick={() => handleAction('START_EXAM', patient.id)}
                                disabled={loading || currentPatient}
                              >
                                <UserCheck className="w-3 h-3 me-1" /> {translate('بدء', 'Start')}
                              </Button>
                            ) : (
                              <div className="flex gap-1">
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-8 w-8 p-0 bg-white/5 hover:bg-yellow-500/20 text-yellow-500"
                                  onClick={() => handleAction('MARK_VIP', patient.id)}
                                  title={translate('تمييز VIP', 'Mark VIP')}
                                >
                                  <Star className="w-4 h-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-8 w-8 p-0 bg-white/5 hover:bg-red-500/20 text-red-500"
                                  onClick={() => handleAction('ABSENT', patient.id)}
                                  title={translate('غياب', 'Absent')}
                                >
                                  <UserX className="w-4 h-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
              <div className="p-4 bg-black/20 border-t border-white/5">
                <p className="text-[10px] text-center text-gray-600 uppercase tracking-widest font-bold">
                  {translate('نظام إدارة طوابير اللجنة الطبية', 'MMC Queue Management System')}
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}} />
    </div>
  )
}

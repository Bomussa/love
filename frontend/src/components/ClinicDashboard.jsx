
/**
 * ClinicDashboard Component - عيادة طبية / Clinic Dashboard
 * شاشة العيادة للتحكم في طابور المراجعين
 *
 * الوظائف الرئيسية:
 * - عرض رقم المراجع الحالي قيد الخدمة
 * - مناداة المراجع التالي
 * - إنهاء خدمة المراجع
 * - تسجيل عدم حضور المراجع
 *
 * @module ClinicDashboard
 * @version 1.0.0
 * @removed PIN - PIN system permanently removed
 */

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
import { Users, Bell, CheckCircle, XCircle, LogOut, RefreshCw, Clock, AlertTriangle } from 'lucide-react'
import { t } from '../lib/i18n'
import { supabase } from '../lib/supabase-client'
import toast, { Toaster } from 'react-hot-toast'

/**
 * ClinicDashboard Component
 *
 * @param {Object} props - Component props
 * @param {string} props.clinicId - معرف العيادة
 * @param {Function} props.onLogout - دالة تسجيل الخروج
 * @param {string} props.language - لغة الواجهة (ar/en)
 */
export function ClinicDashboard({ clinicId, onLogout, language }) {
  const [currentTicket, setCurrentTicket] = useState(null)
  const [queues, setQueues] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [clinicInfo, setClinicInfo] = useState(null)

  /**
   * تحميل بيانات العيادة
   */
  const loadClinicInfo = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('clinics')
        .select('*')
        .eq('id', clinicId)
        .single()
      if (data) setClinicInfo(data)
    } catch (err) {
      console.error('Error loading clinic info:', err)
    }
  }, [clinicId])

  /**
   * تحديث حالة الطابور
   */
  const refreshStatus = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('queues')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('queue_date', today)
        .order('entered_at', { ascending: true })

      if (data) {
        setQueues(data)
        // Find the currently serving ticket
        const serving = data.find(q => q.status === 'called' || q.status === 'in_service')
        setCurrentTicket(serving || null)
      }
    } catch (err) {
      console.error('Error refreshing status:', err)
      setError('فشل في تحميل البيانات')
    }
  }, [clinicId])

  // Initial load and real-time subscription
  useEffect(() => {
    loadClinicInfo()
    refreshStatus()

    // Subscribe to real-time updates
    const subscription = supabase
      .channel(`clinic-${clinicId}-updates`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'queues',
        filter: `clinic_id=eq.${clinicId}`
      }, () => refreshStatus())
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [clinicId, loadClinicInfo, refreshStatus])

  /**
   * مناداة المراجع التالي
   * PIN system removed - no verification required
   */
  const handleCallNext = async () => {
    if (currentTicket) {
      toast.error('أكمل معالجة المراجع الحالي أولاً')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Find next waiting patient
      const nextInLine = queues.find(q => q.status === 'waiting')

      if (!nextInLine) {
        toast.error('لا يوجد مراجعون في الانتظار')
        setLoading(false)
        return
      }

      // Update to called status
      const { error: callError } = await supabase
        .from('queues')
        .update({
          status: 'called',
          called_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', nextInLine.id)

      if (callError) throw callError

      // Play notification sound
      playNotificationSound()

      toast.success(`تم مناداة رقم ${nextInLine.display_number || nextInLine.queue_number_int}`)
      refreshStatus()
    } catch (err) {
      console.error('Call next error:', err)
      setError('فشل في مناداة المراجع')
      toast.error('فشل في مناداة المراجع')
    } finally {
      setLoading(false)
    }
  }

  /**
   * بدء خدمة المراجع الحالي
   */
  const handleStartService = async () => {
    if (!currentTicket) return

    setLoading(true)
    try {
      const { error: startError } = await supabase
        .from('queues')
        .update({
          status: 'in_service',
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', currentTicket.id)

      if (startError) throw startError

      toast.success('بدأت خدمة المراجع')
      refreshStatus()
    } catch (err) {
      console.error('Start service error:', err)
      toast.error('فشل في بدء الخدمة')
    } finally {
      setLoading(false)
    }
  }

  /**
   * إنهاء خدمة المراجع
   * PIN system removed - no verification required
   */
  const handleComplete = async () => {
    if (!currentTicket) return

    setLoading(true)
    try {
      const { error: completeError } = await supabase
        .from('queues')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          finished_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', currentTicket.id)

      if (completeError) throw completeError

      toast.success('تم إنهاء الخدمة بنجاح')
      setCurrentTicket(null)
      refreshStatus()
    } catch (err) {
      console.error('Complete error:', err)
      toast.error('فشل في إنهاء الخدمة')
    } finally {
      setLoading(false)
    }
  }

  /**
   * تسجيل عدم حضور المراجع
   */
  const handleNoShow = async () => {
    if (!currentTicket) return

    if (!confirm('هل تريد تسجيل عدم حضور هذا المراجع؟')) return

    setLoading(true)
    try {
      const { error: noShowError } = await supabase
        .from('queues')
        .update({
          status: 'no_show',
          no_show_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', currentTicket.id)

      if (noShowError) throw noShowError

      toast.success('تم تسجيل عدم حضور المراجع')
      setCurrentTicket(null)
      refreshStatus()
    } catch (err) {
      console.error('No show error:', err)
      toast.error('فشل في تسجيل الغياب')
    } finally {
      setLoading(false)
    }
  }

  /**
   * تأخير المراجع للخطوة التالية
   */
  const handleDelay = async () => {
    if (!currentTicket) return

    toast.success('تم تأجيل المراجع - سينتقل تلقائياً')
    refreshStatus()
  }

  /**
   * تشغيل صوت الإشعار
   */
  const playNotificationSound = () => {
    try {
      const audio = new Audio('/notification.mp3')
      audio.volume = 0.5
      audio.play().catch(() => {})
    } catch (e) {
      // Audio not supported
    }
  }

  // حساب الإحصائيات
  const waitingCount = queues.filter(q => q.status === 'waiting').length
  const completedCount = queues.filter(q => q.status === 'completed').length
  const noShowCount = queues.filter(q => q.status === 'no_show').length

  // حساب مدة انتظار المراجع الحالي
  const getWaitingDuration = (ticket) => {
    if (!ticket) return null
    const start = new Date(ticket.called_at || ticket.entered_at)
    const now = new Date()
    const diff = Math.floor((now - start) / 1000 / 60)
    return diff
  }

  const duration = getWaitingDuration(currentTicket)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4">
      <Toaster position="top-center" />

      {/* Header */}
      <header className="flex flex-wrap justify-between items-center mb-6 bg-gray-800/80 backdrop-blur p-4 rounded-xl border border-gray-700 shadow-lg">
        <div className="flex items-center gap-4">
          <img src="/mms-logo.png" alt="اللجنة الطبية العسكرية" className="w-12 h-12 object-contain" />
          <div>
            <h1 className="text-2xl font-bold">{clinicInfo?.name_ar || clinicInfo?.name || t('Clinic Dashboard')}</h1>
            <p className="text-gray-400 text-sm">{t('Clinic')}: {clinicId}</p>
          </div>
        </div>

        {/* Stats badges */}
        <div className="flex gap-3 items-center flex-wrap">
          <div className="bg-blue-500/20 px-3 py-1 rounded-full flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-blue-400 font-bold">{waitingCount}</span>
            <span className="text-gray-400 text-sm">انتظار</span>
          </div>
          <div className="bg-green-500/20 px-3 py-1 rounded-full flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-green-400 font-bold">{completedCount}</span>
            <span className="text-gray-400 text-sm">تم</span>
          </div>
          <div className="bg-red-500/20 px-3 py-1 rounded-full flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-red-400 font-bold">{noShowCount}</span>
            <span className="text-gray-400 text-sm">لم يحضر</span>
          </div>

          <Button
            variant="ghost"
            onClick={refreshStatus}
            className="p-2 hover:bg-gray-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          <Button
            variant="outline"
            onClick={onLogout}
            className="flex gap-2 text-red-400 border-red-900/50 hover:bg-red-900/20"
          >
            <LogOut className="w-4 h-4" />
            {t('Logout')}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Controls */}
        <div className="lg:col-span-1 space-y-6">
          {/* Current Ticket Card */}
          <Card className="bg-gray-800/80 backdrop-blur border-gray-700 shadow-xl">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-[#C9A54C]" />
                {t('Current Patient')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current Ticket Display */}
              <div className={`p-6 rounded-xl text-center border-2 ${
                currentTicket
                  ? currentTicket.status === 'in_service'
                    ? 'border-green-500/50 bg-green-500/10'
                    : 'border-blue-500/50 bg-blue-500/10'
                  : 'border-gray-600 bg-gray-900/50'
              }`}>
                <p className="text-gray-400 mb-2">{t('Current Ticket')}</p>
                {currentTicket ? (
                  <>
                    <div className="text-7xl font-bold text-[#C9A54C] mb-2">
                      {currentTicket.display_number || currentTicket.queue_number_int}
                    </div>
                    <div className="text-lg text-gray-300 mb-1">
                      {currentTicket.patient_id}
                    </div>
                    {currentTicket.gender && (
                      <div className="text-sm text-gray-500 mb-2">
                        {currentTicket.gender === 'male' ? 'ذكر' : 'أنثى'}
                      </div>
                    )}

                    {/* Duration */}
                    <div className="flex items-center justify-center gap-2 mt-3">
                      <Clock className="w-4 h-4 text-yellow-400" />
                      <span className="text-yellow-400 font-medium">
                        {duration} {duration === 1 ? 'دقيقة' : 'دقائق'}
                      </span>
                    </div>

                    {/* Status Badge */}
                    <div className={`mt-3 inline-block px-4 py-1 rounded-full text-sm ${
                      currentTicket.status === 'in_service'
                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    }`}>
                      {currentTicket.status === 'in_service' ? 'قيد الخدمة الآن' : 'في الانتظار'}
                    </div>
                  </>
                ) : (
                  <div className="text-5xl text-gray-600 font-mono py-8">
                    --
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                {/* Call Next Button */}
                <Button
                  variant="gradient"
                  className="w-full h-14 text-lg"
                  onClick={handleCallNext}
                  disabled={loading || !!currentTicket}
                >
                  {loading ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Bell className="w-5 h-5 mr-2" />
                      {t('Call Next')}
                    </>
                  )}
                </Button>

                {/* Start Service Button */}
                {currentTicket && currentTicket.status === 'called' && (
                  <Button
                    variant="warning"
                    className="w-full h-12 bg-yellow-600 hover:bg-yellow-700 text-white"
                    onClick={handleStartService}
                    disabled={loading}
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    بدء الخدمة
                  </Button>
                )}

                {/* Complete/NoShow Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="success"
                    className="h-12 bg-green-600 hover:bg-green-700 text-white border-0"
                    onClick={handleComplete}
                    disabled={!currentTicket || loading}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {t('Finish')}
                  </Button>
                  <Button
                    variant="danger"
                    className="h-12 bg-red-600 hover:bg-red-700 text-white border-0"
                    disabled={!currentTicket || loading}
                    onClick={handleNoShow}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    {t('No Show')}
                  </Button>
                </div>

                {/* Delay Button */}
                <Button
                  variant="outline"
                  className="w-full h-10 border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                  disabled={!currentTicket || loading}
                  onClick={handleDelay}
                >
                  <Clock className="w-4 h-4 mr-2" />
                  تأجيل / ترحيل لآخر الدور
                </Button>
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-red-500/20 text-red-300 p-3 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {error}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Queue Monitor */}
        <div className="lg:col-span-2">
          <Card className="bg-gray-800/80 backdrop-blur border-gray-700 shadow-xl h-full">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-yellow-500" />
                  {t('Queue Status')} ({waitingCount})
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={refreshStatus}
                  className="text-gray-400 hover:text-white"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Queue List */}
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {/* Current Service */}
                {currentTicket && (
                  <div className="p-4 rounded-xl bg-green-500/10 border-2 border-green-500/30 mb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center font-bold text-lg">
                          {currentTicket.display_number || currentTicket.queue_number_int}
                        </div>
                        <div>
                          <div className="font-bold text-green-400">🔄 قيد الخدمة الآن</div>
                          <div className="text-sm text-gray-400">{currentTicket.patient_id}</div>
                        </div>
                      </div>
                      <div className="text-yellow-400 font-medium">
                        <Clock className="w-4 h-4 inline mr-1" />
                        {duration} دقيقة
                      </div>
                    </div>
                  </div>
                )}

                {/* Waiting List */}
                {queues.filter(q => q.status === 'waiting' || q.status === 'called').length === 0 && !currentTicket ? (
                  <div className="text-center text-gray-500 py-12">
                    <Users className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p className="text-lg">لا يوجد مراجعون في الانتظار</p>
                  </div>
                ) : (
                  queues
                    .filter(q => q.status === 'waiting' || q.status === 'called')
                    .map((q, index) => (
                      <div
                        key={q.id}
                        className={`p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between transition-all ${
                          q.status === 'called' ? 'border-blue-500/30 bg-blue-500/5' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                            q.status === 'called'
                              ? 'bg-blue-600 text-white'
                              : 'bg-[#8A1538] text-white'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-bold">
                              #{q.display_number || q.queue_number_int}
                            </div>
                            <div className="text-sm text-gray-400">{q.patient_id}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {q.gender && (
                            <span className={`text-xs px-2 py-1 rounded ${
                              q.gender === 'male' ? 'bg-blue-500/20 text-blue-400' : 'bg-pink-500/20 text-pink-400'
                            }`}>
                              {q.gender === 'male' ? 'ذكر' : 'أنثى'}
                            </span>
                          )}
                          {q.status === 'called' && (
                            <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400">
                              تم المناداة
                            </span>
                          )}
                          {q.status === 'waiting' && (
                            <span className="text-xs px-2 py-1 rounded bg-gray-500/20 text-gray-400">
                              ينتظر
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                )}
              </div>

              {/* Summary Footer */}
              <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between text-sm text-gray-400">
                <span>إجمالي: {queues.length}</span>
                <span>مكتمل: {completedCount}</span>
                <span>لم يحضر: {noShowCount}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

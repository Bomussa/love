import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
import { Users, Bell, CheckCircle, XCircle, LogOut, RefreshCw, Stethoscope, Activity } from 'lucide-react'
import api from '../lib/api-unified'
import { supabase } from '../lib/supabase-client'
import { AdminQueueMonitor } from './AdminQueueMonitor'

/**
 * Clinic Dashboard Component
 * ✅ FIXED: PIN removed, uses call_next_patient RPC, real-time updates, Qatar time
 */
export function ClinicDashboard({ session, onLogout, language, toggleLanguage }) {
  const clinicId   = session?.clinicId;
  const clinicName = session?.clinicName || clinicId;
  const tr = (ar, en) => language === 'ar' ? ar : en;

  const [currentTicket, setCurrentTicket] = useState(null)
  const [queueStats,    setQueueStats]    = useState({ waiting: 0, serving: 0, done: 0 })
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState(null)

  // ── جلب حالة الطابور ─────────────────────────────────────────
  const refreshStatus = useCallback(async () => {
    if (!clinicId) return
    try {
      const response = await api.getQueueStatus(clinicId)
      if (response.success) {
        const q = response.queue || []
        const inService = q.find(p => ['called','serving','in_progress'].includes(p.status))
        setCurrentTicket(inService || null)
        setQueueStats({
          waiting: q.filter(p => p.status === 'waiting').length,
          serving: q.filter(p => ['called','serving','in_progress'].includes(p.status)).length,
          done:    q.filter(p => ['done','completed'].includes(p.status)).length,
        })
      }
    } catch (err) {
      console.error('Failed to refresh status:', err)
    }
  }, [clinicId])

  // ── Real-time subscription + polling ─────────────────────────
  useEffect(() => {
    refreshStatus()
    const interval = setInterval(refreshStatus, 10000)

    const sub = supabase
      .channel(`clinic_dashboard_${clinicId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'unified_queue',
        filter: `clinic_id=eq.${clinicId}`
      }, () => refreshStatus())
      .subscribe()

    return () => {
      clearInterval(interval)
      sub.unsubscribe()
    }
  }, [clinicId, refreshStatus])

  // ── استدعاء التالي عبر RPC ────────────────────────────────────
  const handleCallNext = async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await api.callNextPatient(clinicId)
      if (result.success) {
        setCurrentTicket(result.ticket || result.data)
        await refreshStatus()
      } else {
        setError(result.error || tr('لا يوجد مرضى في الانتظار', 'No patients waiting'))
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── إنهاء الفحص ───────────────────────────────────────────────
  const handleComplete = async () => {
    if (!currentTicket) return
    try {
      setLoading(true)
      setError(null)
      // استخدام finish_exam_record RPC أولاً
      const { error: rpcErr } = await supabase.rpc('finish_exam_record', {
        p_queue_id: currentTicket.id,
        p_result:   'completed',
        p_notes:    null,
        p_status:   'completed',
      })
      if (rpcErr) {
        // fallback مباشر
        await api.updateQueueStatus(clinicId, currentTicket.patient_id, 'done')
      }
      setCurrentTicket(null)
      await refreshStatus()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── تغيب ──────────────────────────────────────────────────────
  const handleNoShow = async () => {
    if (!currentTicket) return
    try {
      setLoading(true)
      setError(null)
      await supabase.rpc('finish_exam_record', {
        p_queue_id: currentTicket.id,
        p_status:   'absent',
        p_notes:    tr('غياب', 'No Show'),
      }).catch(() => null)
      await api.updateQueueStatus(clinicId, currentTicket.patient_id, 'no_show')
      setCurrentTicket(null)
      await refreshStatus()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0b0f] text-white p-4">
      {/* Header */}
      <header className="flex justify-between items-center mb-6 bg-[#12121a] p-4 rounded-2xl border border-white/5">
        <div className="flex items-center gap-4">
          <img src="/mms-logo.png" alt="قيادة الخدمات الطبية" className="w-10 h-10 object-contain rounded-full border border-[#C9A54C]/30" />
          <div>
            <h1 className="text-xl font-bold text-white">{clinicName}</h1>
            <p className="text-xs text-[#C9A54C]/70 uppercase tracking-widest">
              {tr('لوحة العيادة', 'Clinic Dashboard')}
            </p>
          </div>
        </div>
        <div className="flex gap-3 items-center">
          {/* Stats badges */}
          <div className="hidden sm:flex gap-2">
            <span className="px-3 py-1 rounded-full text-xs bg-blue-500/20 text-blue-400 font-medium">
              {tr('انتظار', 'Waiting')}: {queueStats.waiting}
            </span>
            <span className="px-3 py-1 rounded-full text-xs bg-yellow-500/20 text-yellow-400 font-medium">
              {tr('يُخدَّم', 'Serving')}: {queueStats.serving}
            </span>
            <span className="px-3 py-1 rounded-full text-xs bg-green-500/20 text-green-400 font-medium">
              {tr('مكتمل', 'Done')}: {queueStats.done}
            </span>
          </div>
          <button
            onClick={refreshStatus}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all"
            title={tr('تحديث', 'Refresh')}
          >
            <RefreshCw className="w-4 h-4 text-gray-400" />
          </button>
          <Button variant="outline" onClick={onLogout} className="flex gap-2 text-red-400 border-red-900/50 hover:bg-red-900/20">
            <LogOut className="w-4 h-4" />
            {tr('خروج', 'Logout')}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Controls */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-[#12121a] border-white/5">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-[#C9A54C]" />
                {tr('التحكم', 'Controls')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current Ticket Display */}
              <div className={`p-6 rounded-2xl text-center border-2 transition-all ${
                currentTicket
                  ? 'bg-[#C9A54C]/10 border-[#C9A54C]/30'
                  : 'bg-white/5 border-white/10'
              }`}>
                <p className="text-gray-400 mb-2 text-sm">{tr('الرقم الحالي', 'Current Ticket')}</p>
                {currentTicket ? (
                  <>
                    <div className="text-6xl font-black text-[#C9A54C] mb-2">
                      #{currentTicket.display_number}
                    </div>
                    <p className="text-sm text-gray-300 font-medium">
                      {currentTicket.patient_name || currentTicket.patient_id || currentTicket.personal_id || '—'}
                    </p>
                    {currentTicket.exam_type && (
                      <p className="text-xs text-gray-500 mt-1">{currentTicket.exam_type}</p>
                    )}
                  </>
                ) : (
                  <div className="text-2xl text-gray-600 font-mono py-4">
                    — —
                  </div>
                )}
              </div>

              {/* Call Next Button */}
              <button
                onClick={handleCallNext}
                disabled={loading || !!currentTicket}
                className="w-full h-16 text-lg font-bold rounded-2xl bg-gradient-to-r from-[#8A1538] to-[#6B0F2A] hover:from-[#9A1848] hover:to-[#7B1F3A] disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Stethoscope className="w-5 h-5" />
                {loading ? tr('جارٍ...', 'Loading...') : tr('استدعاء التالي', 'Call Next')}
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleComplete}
                  disabled={!currentTicket || loading}
                  className="h-12 rounded-xl bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 font-medium"
                >
                  <CheckCircle className="w-4 h-4" />
                  {tr('إنهاء', 'Finish')}
                </button>
                <button
                  onClick={handleNoShow}
                  disabled={!currentTicket || loading}
                  className="h-12 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 font-medium"
                >
                  <XCircle className="w-4 h-4" />
                  {tr('غياب', 'No Show')}
                </button>
              </div>

              {error && (
                <div className="bg-red-900/20 text-red-300 p-3 rounded-xl text-sm text-center border border-red-500/20">
                  {error}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Queue Monitor */}
        <div className="lg:col-span-2">
          <Card className="bg-[#12121a] border-white/5 h-full">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-[#C9A54C]" />
                {tr('قائمة الانتظار', 'Queue Status')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AdminQueueMonitor clinicId={clinicId} autoRefresh={true} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default ClinicDashboard

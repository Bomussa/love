
import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
import { Users, Bell, CheckCircle, XCircle, LogOut } from 'lucide-react'
import { t } from '../lib/i18n'
import api from '../lib/api-unified'
import { AdminQueueMonitor } from './AdminQueueMonitor'
// AdminPINMonitor removed - not used in this component

export function ClinicDashboard({ session, onLogout, language, toggleLanguage }) {
  // استخراج clinicId و pin من session
  const clinicId = session?.clinicId;
  const pin = session?.pin;
  const [currentTicket, setCurrentTicket] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Initial load
  useEffect(() => {
    refreshStatus()
  }, [clinicId])

  const refreshStatus = async () => {
    try {
      const status = await api.getQueueStatus(clinicId)
      if (status.success) {
        // Find the currently serving ticket
        const serving = status.queue.find(q => q.status === 'called' || q.status === 'in_service')
        setCurrentTicket(serving || null)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleCallNext = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.callNextPatient(clinicId, pin)
      if (result.success) {
        refreshStatus()
        // Play sound?
      } else {
        setError(result.error || 'Failed to call next')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = async () => {
    if (!currentTicket) return
    setLoading(true)
    try {
      const result = await api.queueDone(clinicId, currentTicket.patient_id, pin)
      if (result.success) {
        setCurrentTicket(null)
        refreshStatus()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleNoShow = async () => {
    if (!currentTicket) return
    setLoading(true)
    try {
      // تحديث حالة المراجع إلى "no_show" والانتقال للتالي
      const result = await api.updateQueueStatus(clinicId, currentTicket.patient_id, 'no_show')
      if (result.success) {
        setCurrentTicket(null)
        refreshStatus()
      } else {
        setError(result.error || 'Failed to mark as no show')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      {/* Header */}
      <header className="flex justify-between items-center mb-6 bg-gray-800 p-4 rounded-lg border border-gray-700">
        <div className="flex items-center gap-4">
          <img src="/mms-logo.png" alt="اللجنة الطبية العسكرية" className="w-10 h-10 object-contain" />
          <div>
            <h1 className="text-2xl font-bold">{t('Clinic Dashboard')}</h1>
            <p className="text-gray-400">{t('Clinic')}: {clinicId}</p>
          </div>
        </div>
        <div className="flex gap-4 items-center">
            {/* PIN Monitor (Compact) */}
            <div className="bg-gray-700 px-3 py-1 rounded">
                <span className="text-xs text-gray-400">PIN:</span>
                <span className="ml-2 font-mono font-bold text-yellow-400">{pin}</span>
            </div>
            
          <Button variant="outline" onClick={onLogout} className="flex gap-2 text-red-400 border-red-900/50 hover:bg-red-900/20">
            <LogOut className="w-4 h-4" />
            {t('Logout')}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Controls */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-500" />
                {t('Controls')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current Ticket Display */}
              <div className="bg-gray-900 p-6 rounded-lg text-center border-2 border-blue-500/30">
                <p className="text-gray-400 mb-2">{t('Current Ticket')}</p>
                {currentTicket ? (
                  <>
                    <div className="text-6xl font-bold text-blue-400 mb-2">
                      {currentTicket.ticket_number}
                    </div>
                    <p className="text-sm text-gray-500">
                        {currentTicket.patient_id}
                    </p>
                  </>
                ) : (
                  <div className="text-xl text-gray-600 font-mono py-4">
                    --
                  </div>
                )}
              </div>

              {/* Actions */}
              <Button 
                variant="gradient" 
                className="w-full h-16 text-xl" 
                onClick={handleCallNext}
                disabled={loading || !!currentTicket} // Disable if someone is currently in service? Or allow overriding?
                // Usually allow calling next if current is done.
                // If currentTicket exists, we should probably 'Finish' first.
              >
                {loading ? '...' : t('Call Next')}
              </Button>

              <div className="grid grid-cols-2 gap-3">
                <Button 
                    variant="outline" 
                    className="h-12 border-green-600 text-green-400 hover:bg-green-900/20"
                    onClick={handleComplete}
                    disabled={!currentTicket || loading}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {t('Finish')}
                </Button>
                <Button 
                    variant="outline" 
                    className="h-12 border-red-600 text-red-400 hover:bg-red-900/20"
                    disabled={!currentTicket || loading}
                    onClick={handleNoShow}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  {t('No Show')}
                </Button>
              </div>

              {error && (
                <div className="bg-red-900/30 text-red-300 p-3 rounded text-sm text-center">
                  {error}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Queue Monitor */}
        <div className="lg:col-span-2">
          <Card className="bg-gray-800 border-gray-700 h-full">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-yellow-500" />
                {t('Queue Status')}
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

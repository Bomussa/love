import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
import { Users, Bell, CheckCircle, XCircle, LogOut } from 'lucide-react'
import { t } from '../lib/i18n'
import api from '../lib/api-unified'
import { AdminQueueMonitor } from './AdminQueueMonitor'
import {
  selectCurrentClinicTicket,
  getTicketDisplayNumber,
  getTicketPatientId,
} from '../lib/clinic-dashboard-utils'

export function ClinicDashboard({ clinicId, pin, session, onLogout, language }) {
  const effectiveClinicId = clinicId || session?.clinicId || null
  const effectivePin = pin || session?.pin || null

  const [currentTicket, setCurrentTicket] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    refreshStatus()
  }, [effectiveClinicId, language])

  const refreshStatus = async () => {
    try {
      if (!effectiveClinicId) {
        setCurrentTicket(null)
        setError(language === 'ar' ? 'بيانات العيادة غير متوفرة' : 'Clinic session is unavailable')
        return
      }

      const status = await api.getQueueStatus(effectiveClinicId)

      if (status.success) {
        setError(null)
        setCurrentTicket(selectCurrentClinicTicket(status))
        return
      }

      setCurrentTicket(null)
      setError(status.error || (language === 'ar' ? 'تعذر تحميل حالة الطابور' : 'Failed to load queue status'))
    } catch (err) {
      console.error(err)
      setCurrentTicket(null)
      setError(err?.message || (language === 'ar' ? 'تعذر تحميل حالة الطابور' : 'Failed to load queue status'))
    }
  }

  const handleCallNext = async () => {
    setLoading(true)
    setError(null)

    try {
      if (!effectiveClinicId) return

      const result = await api.callNextPatient(effectiveClinicId, effectivePin)
      if (result.success) {
        await refreshStatus()
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
    const currentPatientId = getTicketPatientId(currentTicket)
    if (!currentPatientId) return

    setLoading(true)

    try {
      if (!effectiveClinicId) return

      const result = await api.queueDone(effectiveClinicId, currentPatientId, effectivePin)
      if (result.success) {
        setCurrentTicket(null)
        await refreshStatus()
      } else {
        setError(result.error || 'Failed to finish current ticket')
      }
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleNoShow = async () => {
    const currentPatientId = getTicketPatientId(currentTicket)
    if (!currentPatientId) return

    setLoading(true)

    try {
      if (!effectiveClinicId) return

      const result = await api.updateQueueStatus(effectiveClinicId, currentPatientId, 'no_show')
      if (result.success) {
        setCurrentTicket(null)
        await refreshStatus()
      } else {
        setError(result.error || 'Failed to mark as no show')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const currentTicketNumber = getTicketDisplayNumber(currentTicket)
  const currentPatientId = getTicketPatientId(currentTicket)

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <header className="flex justify-between items-center mb-6 bg-gray-800 p-4 rounded-lg border border-gray-700">
        <div className="flex items-center gap-4">
          <img src="/mms-logo.png" alt="اللجنة الطبية العسكرية" className="w-10 h-10 object-contain" />
          <div>
            <h1 className="text-2xl font-bold">{t('Clinic Dashboard')}</h1>
            <p className="text-gray-400">{t('Clinic')}: {effectiveClinicId || '--'}</p>
          </div>
        </div>

        <div className="flex gap-4 items-center">
          <div className="bg-gray-700 px-3 py-1 rounded">
            <span className="text-xs text-gray-400">PIN:</span>
            <span className="ml-2 font-mono font-bold text-yellow-400">{effectivePin || '--'}</span>
          </div>

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
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-500" />
                {t('Controls')}
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="bg-gray-900 p-6 rounded-lg text-center border-2 border-blue-500/30">
                <p className="text-gray-400 mb-2">{t('Current Ticket')}</p>

                {currentTicketNumber ? (
                  <>
                    <div className="text-6xl font-bold text-blue-400 mb-2">
                      {currentTicketNumber}
                    </div>
                    {currentPatientId && (
                      <p className="text-sm text-gray-500">
                        {currentPatientId}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="text-xl text-gray-600 font-mono py-4">
                    --
                  </div>
                )}
              </div>

              <Button
                variant="gradient"
                className="w-full h-16 text-xl"
                onClick={handleCallNext}
                disabled={loading || !!currentTicketNumber}
              >
                {loading ? '...' : t('Call Next')}
              </Button>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-12 border-green-600 text-green-400 hover:bg-green-900/20"
                  onClick={handleComplete}
                  disabled={!currentPatientId || loading}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {t('Finish')}
                </Button>

                <Button
                  variant="outline"
                  className="h-12 border-red-600 text-red-400 hover:bg-red-900/20"
                  disabled={!currentPatientId || loading}
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

        <div className="lg:col-span-2">
          <Card className="bg-gray-800 border-gray-700 h-full">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-yellow-500" />
                {t('Queue Status')}
              </CardTitle>
            </CardHeader>

            <CardContent>
              {effectiveClinicId ? (
                <AdminQueueMonitor clinicId={effectiveClinicId} autoRefresh={true} />
              ) : (
                <div className="text-sm text-red-300">
                  {language === 'ar' ? 'تعذر تحميل معرف العيادة' : 'Clinic ID is missing'}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

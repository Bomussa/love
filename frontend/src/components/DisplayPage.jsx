
import React, { useState, useEffect } from 'react'
import { ZFDTicketDisplay } from './ZFDTicketDisplay'
import { t } from '../lib/i18n'
import api from '../lib/api-unified'

export function DisplayPage({ clinicId, language }) {
  const [currentStep, setCurrentStep] = useState(null)
  
  useEffect(() => {
    const interval = setInterval(fetchStatus, 3000)
    fetchStatus()
    return () => clearInterval(interval)
  }, [clinicId])

  const fetchStatus = async () => {
    try {
        const status = await api.getQueueStatus(clinicId)
        if (status.success && status.serving) {
            setCurrentStep({
                status: 'OK',
                assigned: { ticket: status.serving },
                clinicId: clinicId
            })
        } else {
            setCurrentStep({ assigned: null })
        }
    } catch (e) { console.warn(e) }
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-12">{t('Current Patient')}</h1>
      
      <div className="scale-150 transform">
        <ZFDTicketDisplay step={currentStep} className="bg-gray-800 rounded-3xl p-12 min-w-[400px]" />
      </div>

      <div className="mt-12 text-2xl text-gray-500">
        {t('Clinic')}: {clinicId}
      </div>
    </div>
  )
}

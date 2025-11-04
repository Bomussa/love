import React from 'react'
import { t } from '../lib/i18n'

/**
 * ZFD Ticket Display Component
 * Zero-Fault Display: Shows ticket number only if status is OK
 * Otherwise shows appropriate banner
 * 
 * NO VISUAL CHANGES - Uses existing styles
 */
export function ZFDTicketDisplay({ step, className = '' }) {
    if (!step || !step.assigned) {
        return (
            <div className={`text-center p-4 ${className}`} data-test="zfd-waiting">
                <p className="text-gray-500">{t('Waiting for assignment...')}</p>
            </div>
        )
    }

    const status = step.status || 'OK'
    const ticket = step.assigned.ticket
    const clinicId = step.clinicId

    // OK Status - Show ticket number
    if (status === 'OK') {
        return (
            <div className={`text-center ${className}`} data-test="zfd-ok">
                <div className="mb-2">
                    <span className="text-6xl font-bold" data-test="ticket-number">
                        {ticket}
                    </span>
                </div>
                <p className="text-sm text-gray-600" data-test="clinic-name">
                    {t('Clinic')}: {clinicId}
                </p>
            </div>
        )
    }

    // LATE Status - Show banner
    if (status === 'LATE') {
        return (
            <div
                className={`bg-yellow-50 border-l-4 border-yellow-400 p-4 ${className}`}
                data-test="zfd-late"
                role="alert"
            >
                <div className="flex items-center">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="mr-3">
                        <p className="text-sm font-medium text-yellow-800">
                            {t('⏰ Please proceed to the clinic')}
                        </p>
                        <p className="text-xs text-yellow-700 mt-1">
                            {t('Your ticket was issued more than 5 minutes ago')}
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    // INVALID Status - Show error banner
    if (status === 'INVALID') {
        return (
            <div
                className={`bg-red-50 border-l-4 border-red-400 p-4 ${className}`}
                data-test="zfd-invalid"
                role="alert"
            >
                <div className="flex items-center">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="mr-3">
                        <p className="text-sm font-medium text-red-800">
                            {t('❌ Ticket not found')}
                        </p>
                        <p className="text-xs text-red-700 mt-1">
                            {step.validationReason || t('Please contact reception')}
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    // Unknown status
    return (
        <div className={`text-center p-4 ${className}`} data-test="zfd-unknown">
            <p className="text-gray-500">{t('Unknown status')}: {status}</p>
        </div>
    )
}

/**
 * ZFD Banner Component (for notifications)
 * Displays temporary notifications with auto-dismiss
 */
export function ZFDBanner({ notice, onDismiss, duration = 10000 }) {
    React.useEffect(() => {
        if (notice && duration > 0) {
            const timer = setTimeout(() => {
                if (onDismiss) onDismiss()
            }, duration)
            return () => clearTimeout(timer)
        }
    }, [notice, duration, onDismiss])

    if (!notice) return null

    const typeColors = {
        NEAR_TURN: 'bg-blue-50 border-blue-400 text-blue-800',
        YOUR_TURN: 'bg-green-50 border-green-400 text-green-800',
        STEP_DONE_NEXT: 'bg-purple-50 border-purple-400 text-purple-800',
        START_HINT: 'bg-gray-50 border-gray-400 text-gray-800'
    }

    const typeIcons = {
        NEAR_TURN: '🔔',
        YOUR_TURN: '✅',
        STEP_DONE_NEXT: '➡️',
        START_HINT: 'ℹ️'
    }

    const typeMessages = {
        NEAR_TURN: t('Your turn is approaching'),
        YOUR_TURN: t('Your turn now!'),
        STEP_DONE_NEXT: t('Please proceed to next clinic'),
        START_HINT: t('Welcome to the system')
    }

    const colorClass = typeColors[notice.type] || 'bg-gray-50 border-gray-400 text-gray-800'
    const icon = typeIcons[notice.type] || 'ℹ️'
    const message = typeMessages[notice.type] || notice.type

    return (
        <div
            className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full animate-slide-down`}
            data-test={`zfd-banner-${notice.type}`}
            role="alert"
        >
            <div className={`border-l-4 p-4 rounded shadow-lg ${colorClass}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <span className="text-2xl mr-3">{icon}</span>
                        <div>
                            <p className="font-medium">{message}</p>
                            {notice.clinicId && (
                                <p className="text-sm mt-1">{t('Clinic')}: {notice.clinicId}</p>
                            )}
                        </div>
                    </div>
                    {onDismiss && (
                        <button
                            onClick={onDismiss}
                            className="ml-4 text-gray-500 hover:text-gray-700"
                            data-test="banner-dismiss"
                        >
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

export default ZFDTicketDisplay

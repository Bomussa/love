import React, { useState, useEffect } from 'react'
import { t } from '../lib/i18n'
import enhancedApi from '../lib/enhanced-api'

/**
 * Admin PIN Monitor Component
 * Displays current PIN for clinic
 * NO VISUAL CHANGES - Uses existing admin panel styles
 */
export function AdminPINMonitor({ clinicId, autoRefresh = false, refreshInterval = 30000 }) {
    const [pinData, setPinData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [issuing, setIssuing] = useState(false)
    const [lastRefresh, setLastRefresh] = useState(null)

    const fetchCurrentPin = async () => {
        try {
            setLoading(true)
            setError(null)

            const data = await enhancedApi.getCurrentPin(clinicId)
            setPinData(data)
            setLastRefresh(new Date())
        } catch (err) {
            setError(err.message)
            console.error('Failed to fetch PIN:', err)
        } finally {
            setLoading(false)
        }
    }

    const issueNewPin = async () => {
        try {
            setIssuing(true)
            setError(null)

            const data = await enhancedApi.issuePin(clinicId)

            // Play success sound
            enhancedApi.playNotificationSound()

            // Refresh to show new PIN
            await fetchCurrentPin()
        } catch (err) {
            setError(err.message)
            console.error('Failed to issue PIN:', err)
        } finally {
            setIssuing(false)
        }
    }

    useEffect(() => {
        fetchCurrentPin()

        if (autoRefresh) {
            const interval = setInterval(fetchCurrentPin, refreshInterval)
            return () => clearInterval(interval)
        }
    }, [clinicId, autoRefresh, refreshInterval])

    if (loading && !pinData) {
        return (
            <div className="text-center p-4" data-test="pin-monitor-loading">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-gray-600">{t('Loading PIN...')}</p>
            </div>
        )
    }

    if (error && !pinData) {
        return (
            <div className="bg-red-50 border border-red-200 rounded p-4" data-test="pin-monitor-error">
                <p className="text-red-800 font-medium">{t('Error loading PIN')}</p>
                <p className="text-red-600 text-sm mt-1">{error}</p>
                <button
                    onClick={fetchCurrentPin}
                    className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    data-test="pin-monitor-retry"
                >
                    {t('Retry')}
                </button>
            </div>
        )
    }

    if (!pinData) return null

    const { currentPin, totalIssued, dateKey, allPins = [] } = pinData

    return (
        <div className="space-y-4" data-test="pin-monitor">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold" data-test="clinic-name">
                        {t('Clinic')}: {clinicId}
                    </h3>
                    <p className="text-sm text-gray-600" data-test="date-key">
                        {t('Date')}: {dateKey}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={fetchCurrentPin}
                        disabled={loading}
                        className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                        data-test="pin-monitor-refresh"
                    >
                        {loading ? t('Refreshing...') : t('Refresh')}
                    </button>
                    <button
                        onClick={issueNewPin}
                        disabled={issuing || loading}
                        className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                        data-test="pin-monitor-issue"
                    >
                        {issuing ? t('Issuing...') : t('Issue New PIN')}
                    </button>
                </div>
            </div>

            {/* Current PIN Display */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-lg shadow-lg">
                <p className="text-sm font-medium mb-2">{t('Current PIN')}</p>
                {currentPin ? (
                    <p className="text-6xl font-bold text-center" data-test="current-pin">
                        {currentPin}
                    </p>
                ) : (
                    <p className="text-2xl text-center opacity-75" data-test="no-pin">
                        {t('No PINs issued today')}
                    </p>
                )}
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded">
                    <p className="text-sm text-gray-600">{t('Total Issued Today')}</p>
                    <p className="text-2xl font-bold" data-test="total-issued">
                        {totalIssued}
                    </p>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                    <p className="text-sm text-gray-600">{t('Next PIN')}</p>
                    <p className="text-2xl font-bold" data-test="next-pin">
                        {currentPin ? String(Number(currentPin) + 1).padStart(2, '0') : '01'}
                    </p>
                </div>
            </div>

            {/* PIN History */}
            {allPins.length > 0 && (
                <div data-test="pin-history">
                    <h4 className="font-medium mb-2">{t('Today\'s PINs')} ({allPins.length})</h4>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-gray-50 rounded">
                        {allPins.map((pin, index) => (
                            <span
                                key={`pin-${index}`}
                                className={`px-3 py-1 rounded text-sm font-medium ${pin === currentPin
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-200 text-gray-700'
                                    }`}
                                data-test={`history-pin-${pin}`}
                            >
                                {pin}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded p-3" data-test="pin-error">
                    <p className="text-red-800 text-sm">{error}</p>
                </div>
            )}

            {/* Last Refresh */}
            {lastRefresh && (
                <p className="text-xs text-gray-500 text-center" data-test="last-refresh">
                    {t('Last updated')}: {lastRefresh.toLocaleTimeString()}
                </p>
            )}
        </div>
    )
}

export default AdminPINMonitor

import React, { useState, useEffect } from 'react'
import { GENERAL_REFRESH_INTERVAL } from '../core/config/refresh.constants'
import { t } from '../lib/i18n'
import enhancedApi from '../lib/enhanced-api'

/**
 * Admin Queue Monitor Component
 * Displays real-time queue status for a clinic
 * NO VISUAL CHANGES - Uses existing admin panel styles
 */
export function AdminQueueMonitor({ clinicId, autoRefresh = true }) {
    const [queueData, setQueueData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [lastRefresh, setLastRefresh] = useState(null)

    const fetchQueueStatus = async () => {
        try {
            setLoading(true)
            setError(null)

            const data = await enhancedApi.getQueueStatus(clinicId)
            setQueueData(data)
            setLastRefresh(new Date())
        } catch (err) {
            setError(err.message)
            // console.error('Failed to fetch queue status:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchQueueStatus()

        if (autoRefresh) {
            const interval = setInterval(fetchQueueStatus, GENERAL_REFRESH_INTERVAL)
            return () => clearInterval(interval)
        }
    }, [clinicId, autoRefresh])

    if (loading && !queueData) {
        return (
            <div className="text-center p-4" data-test="queue-monitor-loading">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-gray-600">{t('Loading queue...')}</p>
            </div>
        )
    }

    if (error && !queueData) {
        return (
            <div className="bg-red-50 border border-red-200 rounded p-4" data-test="queue-monitor-error">
                <p className="text-red-800 font-medium">{t('Error loading queue')}</p>
                <p className="text-red-600 text-sm mt-1">{error}</p>
                <button
                    onClick={fetchQueueStatus}
                    className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    data-test="queue-monitor-retry"
                >
                    {t('Retry')}
                </button>
            </div>
        )
    }

    if (!queueData) return null

    const { waiting = [], in: inService = [], done = [], stats, dateKey } = queueData

    return (
        <div className="space-y-4" data-test="queue-monitor">
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
                <button
                    onClick={fetchQueueStatus}
                    disabled={loading}
                    className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                    data-test="queue-monitor-refresh"
                >
                    {loading ? t('Refreshing...') : t('Refresh')}
                </button>
            </div>

            {/* Statistics */}
            {stats && (
                <div className="grid grid-cols-4 gap-4" data-test="queue-stats">
                    <div className="bg-yellow-50 p-3 rounded">
                        <p className="text-sm text-gray-600">{t('Waiting')}</p>
                        <p className="text-2xl font-bold text-yellow-600" data-test="stat-waiting">
                            {stats.totalWaiting}
                        </p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded">
                        <p className="text-sm text-gray-600">{t('In Service')}</p>
                        <p className="text-2xl font-bold text-blue-600" data-test="stat-in">
                            {stats.totalIn}
                        </p>
                    </div>
                    <div className="bg-green-50 p-3 rounded">
                        <p className="text-sm text-gray-600">{t('Completed')}</p>
                        <p className="text-2xl font-bold text-green-600" data-test="stat-done">
                            {stats.totalDone}
                        </p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                        <p className="text-sm text-gray-600">{t('Total')}</p>
                        <p className="text-2xl font-bold text-gray-600" data-test="stat-total">
                            {stats.totalToday}
                        </p>
                    </div>
                </div>
            )}

            {/* Queue Lists */}
            <div className="grid grid-cols-3 gap-4">
                {/* Waiting */}
                <div data-test="queue-list-waiting">
                    <h4 className="font-medium mb-2 text-yellow-700">{t('Waiting')} ({waiting.length})</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {waiting.length === 0 ? (
                            <p className="text-sm text-gray-500">{t('No one waiting')}</p>
                        ) : (
                            waiting.map((entry, index) => (
                                <div
                                    key={`waiting-${entry.ticket}`}
                                    className="bg-yellow-50 p-2 rounded border border-yellow-200"
                                    data-test={`waiting-ticket-${entry.ticket}`}
                                >
                                    <p className="font-bold">#{entry.ticket}</p>
                                    <p className="text-xs text-gray-600">{entry.visitId}</p>
                                    <p className="text-xs text-gray-500">
                                        {new Date(entry.issuedAt).toLocaleTimeString()}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* In Service */}
                <div data-test="queue-list-in">
                    <h4 className="font-medium mb-2 text-blue-700">{t('In Service')} ({inService.length})</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {inService.length === 0 ? (
                            <p className="text-sm text-gray-500">{t('No one in service')}</p>
                        ) : (
                            inService.map((entry) => (
                                <div
                                    key={`in-${entry.ticket}`}
                                    className="bg-blue-50 p-2 rounded border border-blue-200"
                                    data-test={`in-ticket-${entry.ticket}`}
                                >
                                    <p className="font-bold">#{entry.ticket}</p>
                                    <p className="text-xs text-gray-600">{entry.visitId}</p>
                                    <p className="text-xs text-gray-500">
                                        {t('Called')}: {new Date(entry.calledAt).toLocaleTimeString()}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Done */}
                <div data-test="queue-list-done">
                    <h4 className="font-medium mb-2 text-green-700">{t('Completed')} ({done.length})</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {done.length === 0 ? (
                            <p className="text-sm text-gray-500">{t('None completed yet')}</p>
                        ) : (
                            done.slice(-10).reverse().map((entry) => (
                                <div
                                    key={`done-${entry.ticket}`}
                                    className="bg-green-50 p-2 rounded border border-green-200"
                                    data-test={`done-ticket-${entry.ticket}`}
                                >
                                    <p className="font-bold">#{entry.ticket}</p>
                                    <p className="text-xs text-gray-600">{entry.visitId}</p>
                                    <p className="text-xs text-gray-500">
                                        {t('Done')}: {new Date(entry.doneAt).toLocaleTimeString()}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Last Refresh */}
            {lastRefresh && (
                <p className="text-xs text-gray-500 text-center" data-test="last-refresh">
                    {t('Last updated')}: {lastRefresh.toLocaleTimeString()}
                </p>
            )}
        </div>
    )
}

export default AdminQueueMonitor

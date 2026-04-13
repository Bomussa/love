import React, { useState, useEffect } from 'react'
import { GENERAL_REFRESH_INTERVAL } from '../core/config/refresh.constants'
import { t } from '../lib/i18n'
import enhancedApi from '../lib/api-unified'

/**
 * Admin Queue Monitor Component
 * Displays real-time queue status for a clinic
 * NO VISUAL CHANGES - Uses existing admin panel styles
 * ✅ FIXED: Handles real data from unified_queue correctly
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

            const response = await enhancedApi.getQueueStatus(clinicId)
            if (response.success) {
                // تحويل البيانات من Supabase إلى التنسيق الذي يتوقعه المكون
                const rawQueue = response.queue || []
                const processedData = {
                    waiting: rawQueue.filter(q => q.status === 'waiting'),
                    in: rawQueue.filter(q => q.status === 'called' || q.status === 'serving' || q.status === 'in_progress'),
                    done: rawQueue.filter(q => q.status === 'completed' || q.status === 'done'),
                    stats: {
                        totalWaiting: rawQueue.filter(q => q.status === 'waiting').length,
                        totalIn: rawQueue.filter(q => q.status === 'called' || q.status === 'serving' || q.status === 'in_progress').length,
                        totalDone: rawQueue.filter(q => q.status === 'completed' || q.status === 'done').length,
                        totalToday: rawQueue.length
                    },
                    dateKey: new Date().toLocaleDateString('ar-QA')
                }
                setQueueData(processedData)
            } else {
                throw new Error(response.error || 'Failed to fetch data')
            }
            setLastRefresh(new Date())
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchQueueStatus()

        if (autoRefresh) {
            const interval = setInterval(fetchQueueStatus, GENERAL_REFRESH_INTERVAL || 10000)
            return () => clearInterval(interval)
        }
    }, [clinicId, autoRefresh])

    if (loading && !queueData) {
        return (
            <div className="text-center p-4" data-test="queue-monitor-loading">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-gray-400">{t('Loading queue...')}</p>
            </div>
        )
    }

    if (error && !queueData) {
        return (
            <div className="bg-red-900/20 border border-red-900/50 rounded p-4" data-test="queue-monitor-error">
                <p className="text-red-400 font-medium">{t('Error loading queue')}</p>
                <p className="text-red-300 text-sm mt-1">{error}</p>
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
                    <h3 className="text-lg font-semibold text-white" data-test="clinic-name">
                        {t('Clinic')}: {clinicId}
                    </h3>
                    <p className="text-sm text-gray-400" data-test="date-key">
                        {t('Date')}: {dateKey}
                    </p>
                </div>
                <button
                    onClick={fetchQueueStatus}
                    disabled={loading}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    data-test="queue-monitor-refresh"
                >
                    {loading ? t('Refreshing...') : t('Refresh')}
                </button>
            </div>

            {/* Statistics */}
            {stats && (
                <div className="grid grid-cols-4 gap-4" data-test="queue-stats">
                    <div className="bg-yellow-900/20 p-3 rounded border border-yellow-900/30">
                        <p className="text-sm text-gray-400">{t('Waiting')}</p>
                        <p className="text-2xl font-bold text-yellow-500" data-test="stat-waiting">
                            {stats.totalWaiting}
                        </p>
                    </div>
                    <div className="bg-blue-900/20 p-3 rounded border border-blue-900/30">
                        <p className="text-sm text-gray-400">{t('In Service')}</p>
                        <p className="text-2xl font-bold text-blue-500" data-test="stat-in">
                            {stats.totalIn}
                        </p>
                    </div>
                    <div className="bg-green-900/20 p-3 rounded border border-green-900/30">
                        <p className="text-sm text-gray-400">{t('Completed')}</p>
                        <p className="text-2xl font-bold text-green-500" data-test="stat-done">
                            {stats.totalDone}
                        </p>
                    </div>
                    <div className="bg-gray-800 p-3 rounded border border-gray-700">
                        <p className="text-sm text-gray-400">{t('Total')}</p>
                        <p className="text-2xl font-bold text-gray-300" data-test="stat-total">
                            {stats.totalToday}
                        </p>
                    </div>
                </div>
            )}

            {/* Queue Lists */}
            <div className="grid grid-cols-3 gap-4">
                {/* Waiting */}
                <div data-test="queue-list-waiting">
                    <h4 className="font-medium mb-2 text-yellow-500">{t('Waiting')} ({waiting.length})</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                        {waiting.length === 0 ? (
                            <p className="text-sm text-gray-500 italic">{t('No one waiting')}</p>
                        ) : (
                            waiting.map((entry) => (
                                <div
                                    key={`waiting-${entry.id}`}
                                    className="bg-gray-800 p-2 rounded border border-gray-700 hover:border-yellow-500/50 transition-colors"
                                    data-test={`waiting-ticket-${entry.display_number}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <p className="font-bold text-yellow-500 text-lg">#{entry.display_number}</p>
                                        <span className="text-[10px] bg-gray-700 text-gray-400 px-1 rounded">{entry.exam_type}</span>
                                    </div>
                                    <p className="text-xs text-gray-300 truncate">{entry.patient_name || entry.patient_id}</p>
                                    <p className="text-[10px] text-gray-500 mt-1">
                                        {new Date(entry.entered_at).toLocaleTimeString('ar-QA')}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* In Service */}
                <div data-test="queue-list-in">
                    <h4 className="font-medium mb-2 text-blue-500">{t('In Service')} ({inService.length})</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                        {inService.length === 0 ? (
                            <p className="text-sm text-gray-500 italic">{t('No one in service')}</p>
                        ) : (
                            inService.map((entry) => (
                                <div
                                    key={`in-${entry.id}`}
                                    className="bg-blue-900/20 p-2 rounded border border-blue-900/50"
                                    data-test={`in-ticket-${entry.display_number}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <p className="font-bold text-blue-400 text-lg">#{entry.display_number}</p>
                                        <span className="text-[10px] bg-blue-900/40 text-blue-300 px-1 rounded">{entry.status}</span>
                                    </div>
                                    <p className="text-xs text-gray-200 truncate">{entry.patient_name || entry.patient_id}</p>
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        {t('Called')}: {new Date(entry.called_at || entry.entered_at).toLocaleTimeString('ar-QA')}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Done */}
                <div data-test="queue-list-done">
                    <h4 className="font-medium mb-2 text-green-500">{t('Completed')} ({done.length})</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                        {done.length === 0 ? (
                            <p className="text-sm text-gray-500 italic">{t('None completed yet')}</p>
                        ) : (
                            done.slice(-10).reverse().map((entry) => (
                                <div
                                    key={`done-${entry.id}`}
                                    className="bg-green-900/10 p-2 rounded border border-green-900/30 opacity-70"
                                    data-test={`done-ticket-${entry.display_number}`}
                                >
                                    <p className="font-bold text-green-500">#{entry.display_number}</p>
                                    <p className="text-xs text-gray-400 truncate">{entry.patient_name || entry.patient_id}</p>
                                    <p className="text-[10px] text-gray-500 mt-1">
                                        {t('Done')}: {new Date(entry.completed_at || entry.updated_at).toLocaleTimeString('ar-QA')}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Last Refresh */}
            {lastRefresh && (
                <p className="text-[10px] text-gray-600 text-center" data-test="last-refresh">
                    {t('Last updated')}: {lastRefresh.toLocaleTimeString('ar-QA')}
                </p>
            )}
        </div>
    )
}

export default AdminQueueMonitor

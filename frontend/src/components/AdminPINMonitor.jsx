import React, { useState, useEffect } from 'react'
import { t } from '../lib/i18n'
import supabaseApi from '../lib/supabase-api'
import { RefreshCw, Shield, Calendar, Clock, CheckCircle, AlertCircle } from 'lucide-react'

/**
 * Admin PIN Monitor Component
 * Displays current daily PIN for clinic
 * ✅ يستخدم نظام PIN يومي (pin-daily function)
 * ✅ لا توجد بيانات وهمية
 * NO VISUAL CHANGES - Uses existing admin panel styles
 */
export function AdminPINMonitor({ clinicId, autoRefresh = false, refreshInterval = 30000, language = 'ar' }) {
    const [pinData, setPinData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [issuing, setIssuing] = useState(false)
    const [lastRefresh, setLastRefresh] = useState(null)

    const fetchCurrentPin = async () => {
        try {
            setLoading(true)
            setError(null)

            const data = await supabaseApi.getCurrentPin(clinicId)
            setPinData(data)
            setLastRefresh(new Date())
        } catch (err) {
            setError(err.message)
            console.error('[AdminPINMonitor] Failed to fetch PIN:', err)
        } finally {
            setLoading(false)
        }
    }

    const issueNewPin = async () => {
        try {
            setIssuing(true)
            setError(null)

            const data = await supabaseApi.issuePin(clinicId)

            // Refresh to show new PIN
            await fetchCurrentPin()
        } catch (err) {
            setError(err.message)
            console.error('[AdminPINMonitor] Failed to issue PIN:', err)
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
            <div className="text-center p-6 bg-gray-800/50 rounded-lg" data-test="pin-monitor-loading">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#C9A54C] mx-auto"></div>
                <p className="mt-3 text-gray-400">
                    {language === 'ar' ? 'جاري تحميل كود PIN...' : 'Loading PIN...'}
                </p>
            </div>
        )
    }

    if (error && !pinData) {
        return (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4" data-test="pin-monitor-error">
                <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <p className="text-red-400 font-medium">
                        {language === 'ar' ? 'خطأ في تحميل PIN' : 'Error loading PIN'}
                    </p>
                </div>
                <p className="text-red-300 text-sm mb-3">{error}</p>
                <button
                    onClick={fetchCurrentPin}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-2"
                    data-test="pin-monitor-retry"
                >
                    <RefreshCw className="w-4 h-4" />
                    {language === 'ar' ? 'إعادة المحاولة' : 'Retry'}
                </button>
            </div>
        )
    }

    if (!pinData) return null

    const { currentPin, dateKey, clinicNameAr, clinicNameEn, isToday, lastUpdated } = pinData
    const clinicName = language === 'ar' ? clinicNameAr : clinicNameEn

    return (
        <div className="space-y-4 bg-gray-800/50 rounded-lg p-6" data-test="pin-monitor">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-700 pb-4">
                <div className="flex items-center gap-3">
                    <Shield className="w-6 h-6 text-[#C9A54C]" />
                    <div>
                        <h3 className="text-lg font-semibold text-white" data-test="clinic-name">
                            {language === 'ar' ? 'كود PIN - ' : 'PIN Code - '}
                            {clinicName || clinicId}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                            <Calendar className="w-3 h-3 text-gray-400" />
                            <p className="text-xs text-gray-400" data-test="date-key">
                                {dateKey}
                            </p>
                            {isToday && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                                    <CheckCircle className="w-3 h-3" />
                                    {language === 'ar' ? 'محدّث اليوم' : 'Updated today'}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={fetchCurrentPin}
                        disabled={loading}
                        className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                        data-test="pin-monitor-refresh"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        <span className="text-sm">
                            {language === 'ar' ? 'تحديث' : 'Refresh'}
                        </span>
                    </button>
                    <button
                        onClick={issueNewPin}
                        disabled={issuing || loading}
                        className="px-3 py-2 bg-[#C9A54C] hover:bg-[#B8944B] text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                        data-test="pin-monitor-issue"
                    >
                        <Shield className="w-4 h-4" />
                        <span className="text-sm">
                            {issuing 
                              ? (language === 'ar' ? 'جاري الإصدار...' : 'Issuing...') 
                              : (language === 'ar' ? 'إصدار PIN جديد' : 'Issue New PIN')}
                        </span>
                    </button>
                </div>
            </div>

            {/* Current PIN Display */}
            <div className="bg-gradient-to-br from-[#8A1538] to-[#6B1028] text-white p-8 rounded-xl shadow-lg">
                <div className="text-center">
                    <p className="text-sm font-medium mb-3 text-gray-200">
                        {language === 'ar' ? 'كود PIN الحالي' : 'Current PIN'}
                    </p>
                    {currentPin ? (
                        <div>
                            <p className="text-7xl font-bold tracking-wider" data-test="current-pin">
                                {currentPin}
                            </p>
                            <p className="text-xs text-gray-300 mt-4">
                                {language === 'ar' ? 'صالح لليوم فقط' : 'Valid for today only'}
                            </p>
                        </div>
                    ) : (
                        <div>
                            <p className="text-3xl opacity-75" data-test="no-pin">
                                --
                            </p>
                            <p className="text-sm text-gray-300 mt-3">
                                {language === 'ar' ? 'لم يتم إصدار PIN اليوم' : 'No PIN issued today'}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-700/50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <p className="text-xs text-gray-400">
                            {language === 'ar' ? 'تاريخ اليوم' : "Today's Date"}
                        </p>
                    </div>
                    <p className="text-lg font-bold text-white" data-test="date-display">
                        {new Date(dateKey).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                        })}
                    </p>
                </div>
                <div className="bg-gray-700/50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <p className="text-xs text-gray-400">
                            {language === 'ar' ? 'آخر تحديث' : 'Last Updated'}
                        </p>
                    </div>
                    <p className="text-lg font-bold text-white" data-test="last-update">
                        {lastUpdated 
                          ? new Date(lastUpdated).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : '--:--'}
                    </p>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3" data-test="pin-error">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <p className="text-red-400 text-sm">{error}</p>
                    </div>
                </div>
            )}

            {/* Last Refresh */}
            {lastRefresh && (
                <p className="text-xs text-gray-500 text-center" data-test="last-refresh">
                    {language === 'ar' ? 'آخر تحديث: ' : 'Last refreshed: '}
                    {lastRefresh.toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US')}
                </p>
            )}

            {/* Instructions */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-blue-300 text-sm">
                    <strong>{language === 'ar' ? 'ملاحظة:' : 'Note:'}</strong>{' '}
                    {language === 'ar' 
                      ? 'يتم إصدار كود PIN واحد لكل عيادة لكل يوم. يمكنك إصدار كود جديد في أي وقت خلال اليوم.'
                      : 'One PIN code is issued per clinic per day. You can issue a new code at any time during the day.'}
                </p>
            </div>
        </div>
    )
}

export default AdminPINMonitor

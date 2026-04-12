import React, { useState, useEffect } from 'react'
import { t } from '../lib/i18n'
import api from '../lib/api-unified'

/**
 * ✅ يستخدم api-unified الموحد
 */
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [issuing, setIssuing] = useState(false)
    const [lastRefresh, setLastRefresh] = useState(null)

        try {
            setLoading(true)
            setError(null)

            if (data.success) {
            } else {
            }
            setLastRefresh(new Date())
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

        try {
            setIssuing(true)
            setError(null)

            if (!data.success) {
            }

        } catch (err) {
            setError(err.message)
        } finally {
            setIssuing(false)
        }
    }

    useEffect(() => {

        if (autoRefresh) {
            return () => clearInterval(interval)
        }
    }, [clinicId, autoRefresh, refreshInterval])

        return (
            </div>
        )
    }

        return (
                <p className="text-red-600 text-sm mt-1">{error}</p>
                <button
                    className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                    {t('Retry')}
                </button>
            </div>
        )
    }



    return (
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
                        disabled={loading}
                        className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                    >
                        {loading ? t('Refreshing...') : t('Refresh')}
                    </button>
                    <button
                        disabled={issuing || loading}
                        className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                    >
                    </button>
                </div>
            </div>

            <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-lg shadow-lg">
                    </p>
                ) : (
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
                    </p>
                </div>
            </div>

                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-gray-50 rounded">
                            <span
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-200 text-gray-700'
                                    }`}
                            >
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Error Display */}
            {error && (
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


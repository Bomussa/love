/**
 * Supabase Edge Functions API Client
 * يتصل مباشرة بـ Supabase Functions بدون وسيط
 * ✅ محدّث لاستخدام pin-daily function (PIN يومي)
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://rujwuruuosffcxazymit.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

class SupabaseApiClient {
    constructor() {
        this.functionsUrl = `${SUPABASE_URL}/functions/v1`
        this.cache = new Map()
        this.retryConfig = { maxRetries: 3, baseDelay: 1000 }
    }

    async request(functionName, options = {}) {
        const url = `${this.functionsUrl}/${functionName}${options.query || ''}`
        const config = {
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                ...options.headers
            },
            ...options
        }

        try {
            const response = await fetch(url, config)
            const data = await response.json()

            if (!response.ok) {
                throw new Error(data?.error || `HTTP ${response.status}`)
            }

            return data
        } catch (error) {
            console.error(`Supabase Function Error [${functionName}]:`, error)
            throw error
        }
    }

    // ============================================
    // PIN Management (Daily PIN System)
    // ============================================

    /**
     * Get current daily PIN for clinic
     * Function: pin-daily
     * GET /functions/v1/pin-daily?clinic_id=xxx
     */
    async getCurrentPin(clinicId) {
        const response = await this.request('pin-daily', {
            method: 'GET',
            query: `?clinic_id=${clinicId}`
        })
        
        if (!response.success) {
            throw new Error(response.error || 'Failed to get PIN')
        }

        const data = response.data
        
        // تحويل البيانات للتوافق مع AdminPINMonitor
        return {
            currentPin: data.currentPin,
            totalIssued: 1, // يمكن تحسينه لاحقاً
            dateKey: data.dateKey,
            allPins: data.currentPin ? [data.currentPin] : [],
            success: true,
            clinic: data.clinic_id,
            clinicNameAr: data.clinic_name_ar,
            clinicNameEn: data.clinic_name_en,
            isToday: data.isToday,
            lastUpdated: data.lastUpdated,
            timestamp: data.timestamp
        }
    }

    /**
     * Get all PINs for all clinics
     * Function: pin-daily
     * GET /functions/v1/pin-daily
     */
    async getAllPins() {
        const response = await this.request('pin-daily', {
            method: 'GET'
        })
        
        if (!response.success) {
            throw new Error(response.error || 'Failed to get PINs')
        }

        return {
            success: true,
            dateKey: response.data.dateKey,
            pins: response.data.pins || [],
            timestamp: response.data.timestamp
        }
    }

    /**
     * Issue new daily PIN for clinic
     * Function: pin-daily
     * POST /functions/v1/pin-daily
     */
    async issuePin(clinicId) {
        const response = await this.request('pin-daily', {
            method: 'POST',
            body: JSON.stringify({
                clinic_id: clinicId
            })
        })

        if (!response.success) {
            throw new Error(response.error || 'Failed to issue PIN')
        }

        const data = response.data

        // تحويل البيانات للتوافق مع AdminPINMonitor
        return {
            currentPin: data.currentPin,
            totalIssued: 1,
            dateKey: data.dateKey,
            allPins: [data.currentPin],
            success: true,
            clinic: data.clinic_id,
            clinicNameAr: data.clinic_name_ar,
            clinicNameEn: data.clinic_name_en,
            issuedAt: data.issuedAt,
            timestamp: data.timestamp
        }
    }

    /**
     * Verify PIN for clinic entry
     * Checks if the provided PIN matches the current clinic PIN
     */
    async verifyPin(clinicId, pin) {
        try {
            const currentPinData = await this.getCurrentPin(clinicId)
            
            if (!currentPinData.currentPin) {
                return {
                    success: false,
                    error: 'No PIN issued for this clinic today',
                    valid: false
                }
            }

            const isValid = currentPinData.currentPin === pin

            return {
                success: true,
                valid: isValid,
                clinic: clinicId,
                message: isValid ? 'PIN verified successfully' : 'Invalid PIN'
            }
        } catch (error) {
            return {
                success: false,
                error: error.message,
                valid: false
            }
        }
    }

    // ============================================
    // Queue Management
    // ============================================

    /**
     * Enter queue
     * Function: queue-enter
     * POST /functions/v1/queue-enter
     */
    async enterQueue(clinicId, token, priority = 'normal') {
        return this.request('queue-enter', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                clinic: clinicId,
                priority: priority
            })
        })
    }

    /**
     * Get queue status
     * Function: queue-status
     * GET /functions/v1/queue-status?clinic_id=xxx
     */
    async getQueueStatus(clinicId) {
        return this.request('queue-status', {
            method: 'GET',
            query: `?clinic_id=${clinicId}`
        })
    }

    // ============================================
    // Events Stream (SSE)
    // ============================================

    /**
     * Connect to events stream
     * Function: events-stream
     * GET /functions/v1/events-stream?clinic=xxx
     */
    connectEventsStream(clinicId, onMessage) {
        const url = `${this.functionsUrl}/events-stream?clinic=${clinicId}`
        const eventSource = new EventSource(url)

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                if (onMessage) onMessage(data)
            } catch (error) {
                console.error('Failed to parse SSE message:', error)
            }
        }

        eventSource.onerror = (error) => {
            console.error('SSE connection error:', error)
        }

        return eventSource
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear()
    }
}

// Export singleton instance
export const supabaseApi = new SupabaseApiClient()
export default supabaseApi

/**
 * Supabase Edge Functions API Client
 * يتصل مباشرة بـ Supabase Functions بدون وسيط
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
    // PIN Management
    // ============================================

    /**
     * Get current PIN for clinic
     * Function: pin-status
     * GET /functions/v1/pin-status?clinic=xxx
     */
    async getCurrentPin(clinicId) {
        const response = await this.request('pin-status', {
            method: 'GET',
            query: `?clinic=${clinicId}`
        })
        
        // تحويل البيانات للتوافق مع AdminPINMonitor
        return {
            currentPin: response.pin,
            totalIssued: 1,
            dateKey: new Date().toISOString().split('T')[0],
            allPins: response.pin ? [response.pin] : [],
            success: response.success,
            clinic: response.clinic,
            isExpired: response.isExpired
        }
    }

    /**
     * Issue new PIN (يستخدم نفس pin-status لأنه يُنشئ PIN تلقائياً إذا لم يكن موجوداً)
     */
    async issuePin(clinicId) {
        // pin-status يُنشئ PIN جديد تلقائياً إذا لم يكن موجوداً
        return this.getCurrentPin(clinicId)
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
     * GET /functions/v1/queue-status?clinic=xxx
     */
    async getQueueStatus(clinicId) {
        return this.request('queue-status', {
            method: 'GET',
            query: `?clinic=${clinicId}`
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
}

// Export singleton instance
export const supabaseApi = new SupabaseApiClient()
export default supabaseApi

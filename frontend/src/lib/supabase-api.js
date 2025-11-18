/**
 * Supabase API Client for Frontend
 * Connects to Supabase via Vercel rewrites (/api/v1/*)
 */

class SupabaseApiClient {
    constructor() {
        // استخدام Vercel rewrites للوصول إلى Supabase Functions
        this.apiBase = '/api/v1'
        this.cache = new Map()
        this.retryConfig = { maxRetries: 3, baseDelay: 1000 }
    }

    async request(endpoint, options = {}) {
        const url = `${this.apiBase}${endpoint}`
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        }

        try {
            const response = await fetch(url, config)
            
            // التعامل مع الاستجابات غير JSON
            const contentType = response.headers.get('content-type')
            let data
            
            if (contentType && contentType.includes('application/json')) {
                data = await response.json()
            } else {
                const text = await response.text()
                // محاولة parse كـ JSON
                try {
                    data = JSON.parse(text)
                } catch {
                    data = { message: text }
                }
            }

            if (!response.ok) {
                throw new Error(data?.error || data?.message || `HTTP ${response.status}`)
            }

            return data
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error)
            throw error
        }
    }

    // ============================================
    // PIN Management
    // ============================================

    /**
     * Get current PIN for clinic
     * GET /api/v1/pin-status?clinic=xxx
     */
    async getCurrentPin(clinicId) {
        try {
            const response = await this.request(`/admin/pin/status?clinic=${clinicId}`, {
                method: 'GET'
            })
            
            // تحويل البيانات للتوافق مع AdminPINMonitor
            // response.pin هو object يحتوي على {pin, clinic, date, generatedAt, expiresAt, active}
            const pinData = response.pin
            return {
                currentPin: pinData?.pin || null,
                totalIssued: response.totalIssued || 1,
                dateKey: response.dateKey || pinData?.date || new Date().toISOString().split('T')[0],
                allPins: response.allPins || (pinData ? [pinData] : []),
                success: response.success !== false,
                clinic: response.clinic || clinicId,
                isExpired: response.isExpired || false
            }
        } catch (error) {
            console.error('[PIN] Error fetching current PIN:', error)
            // إرجاع بيانات فارغة بدلاً من throw
            return {
                currentPin: null,
                totalIssued: 0,
                dateKey: new Date().toISOString().split('T')[0],
                allPins: [],
                success: false,
                clinic: clinicId,
                isExpired: false,
                error: error.message
            }
        }
    }

    /**
     * Issue new PIN
     * POST /api/v1/pin-issue
     */
    async issuePin(clinicId) {
        try {
            const response = await this.request('/admin/pin/issue', {
                method: 'POST',
                body: JSON.stringify({ clinic: clinicId })
            })
                        // تحويل البيانات للتوافق مع AdminPINMonitor
            // response.pin هو object يحتوي على {pin, clinic, date, generatedAt, expiresAt, active}
            const pinData = response.pin
            return {
                currentPin: pinData?.pin || null,
                nextPin: null,
                totalIssued: 0,
                dateKey: response.dateKey || pinData?.date || new Date().toISOString().split('T')[0],
                allPins: response.allPins || (pinData ? [pinData] : []),
                success: response.success !== false,
                clinic: response.clinic || clinicId,
                isExpired: false
            }   } catch (error) {
            console.error('[PIN] Error issuing new PIN:', error)
            throw error
        }
    }

    // ============================================
    // Queue Management
    // ============================================

    /**
     * Enter queue
     * POST /api/v1/queue-enter
     */
    async enterQueue(clinicId, token, priority = 'normal') {
        return this.request('/queue/enter', {
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
     * GET /api/v1/queue-status?clinic=xxx
     */
    async getQueueStatus(clinicId) {
        return this.request(`/queue/status?clinic=${clinicId}`, {
            method: 'GET'
        })
    }

    // ============================================
    // Events Stream (SSE)
    // ============================================

    /**
     * Connect to events stream
     * GET /api/v1/events-stream?clinic=xxx
     */
    connectEventsStream(clinicId, onMessage) {
        const url = `${this.apiBase}/events/stream?clinic=${clinicId}`
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

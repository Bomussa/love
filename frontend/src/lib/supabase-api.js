/**
 * Supabase Edge Functions API Client
 * Updated: 2025-11-18
 * Uses pin-generate and pin-status for daily PIN system
 * ✅ NO MOCK DATA - All real Supabase connections
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
    // Uses: pin-generate and pin-status functions
    // ============================================

    /**
     * Get current daily PIN for clinic
     * Function: pin-status
     * GET /functions/v1/pin-status?clinic_id=xxx
     */
    async getCurrentPin(clinicId) {
        const response = await this.request('pin-status', {
            method: 'GET',
            query: `?clinic_id=${clinicId}`
        })
        
        if (!response.success) {
            throw new Error(response.error || 'Failed to get PIN')
        }

        const data = response.data
        
        // Transform data for AdminPINMonitor compatibility
        return {
            currentPin: data.has_active_pin ? data.pin : null,
            totalIssued: data.has_active_pin ? 1 : 0,
            dateKey: new Date().toISOString().split('T')[0],
            allPins: data.has_active_pin ? [data.pin] : [],
            success: true,
            clinic: data.clinic_id,
            isToday: data.has_active_pin,
            lastUpdated: data.checked_at,
            timestamp: data.checked_at,
            validUntil: data.valid_until,
            expiresInSeconds: data.expires_in_seconds,
            pinId: data.pin_id,
            isUsed: data.is_used
        }
    }

    /**
     * Issue new daily PIN for clinic
     * Function: pin-generate
     * POST /functions/v1/pin-generate
     */
    async issuePin(clinicId) {
        const response = await this.request('pin-generate', {
            method: 'POST',
            body: JSON.stringify({
                clinic_id: clinicId
            })
        })

        if (!response.success) {
            throw new Error(response.error || 'Failed to issue PIN')
        }

        const data = response.data

        // Transform data for AdminPINMonitor compatibility
        return {
            currentPin: data.pin,
            totalIssued: 1,
            dateKey: new Date().toISOString().split('T')[0],
            allPins: [data.pin],
            success: true,
            clinic: clinicId,
            issuedAt: new Date().toISOString(),
            timestamp: new Date().toISOString(),
            validUntil: data.valid_until,
            expiresInSeconds: data.expires_in_seconds,
            pinId: data.pin_id,
            isExisting: data.is_existing || false
        }
    }

    /**
     * Get all PINs for all clinics
     * Fetches from Supabase clinics table and gets PIN for each
     */
    async getAllPins() {
        try {
            // Get all clinics from Supabase
            const clinicsResponse = await fetch(`${SUPABASE_URL}/rest/v1/clinics?select=id,name`, {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                }
            })

            const clinics = await clinicsResponse.json()

            // Get PIN status for each clinic
            const pinPromises = clinics.map(async (clinic) => {
                try {
                    const pinData = await this.getCurrentPin(clinic.id)
                    return {
                        clinic_id: clinic.id,
                        clinic_name: clinic.name,
                        ...pinData
                    }
                } catch (error) {
                    console.error(`Error getting PIN for clinic ${clinic.id}:`, error)
                    return {
                        clinic_id: clinic.id,
                        clinic_name: clinic.name,
                        currentPin: null,
                        success: false
                    }
                }
            })

            const pins = await Promise.all(pinPromises)

            return {
                success: true,
                dateKey: new Date().toISOString().split('T')[0],
                pins: pins.filter(p => p.currentPin),
                timestamp: new Date().toISOString()
            }
        } catch (error) {
            console.error('Error getting all PINs:', error)
            throw error
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

    /**
     * Call next patient
     * Function: queue-call
     * POST /functions/v1/queue-call
     */
    async callNextPatient(clinicId) {
        return this.request('queue-call', {
            method: 'POST',
            body: JSON.stringify({
                clinic_id: clinicId
            })
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

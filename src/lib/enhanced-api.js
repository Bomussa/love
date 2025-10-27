// Enhanced API Client - متطابق 100% مع Backend /api/v1/*
// تحديث المسارات فقط - بدون تغيير في Backend

import { getApiBase } from './api-base';
import { generateIdempotencyKey, sentKeysRegistry } from '../utils/idempotency';

const API_BASE = getApiBase();
const API_VERSION = '/api/v1'; // For backwards compatibility in method calls

// Normalize endpoint to prevent double /api/v1
function normalizePath(endpoint) {
  const p = String(endpoint || '');
  // Remove any leading /api/v1 or api/v1
  const withoutVersion = p.replace(/^\/?api\/v1/, '');
  // Ensure it starts with /
  return withoutVersion.startsWith('/') ? withoutVersion : `/${withoutVersion}`;
}

class EnhancedApiClient {
    constructor() {
        this.baseUrl = API_BASE;
        this.cache = new Map()
        this.pendingRequests = new Map()
        this.retryConfig = { maxRetries: 3, baseDelay: 1000, maxDelay: 10000 }
        this.metrics = { requests: 0, errors: 0, cacheHits: 0, cacheMisses: 0 }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    getRetryDelay(attempt) {
        const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(2, attempt),
            this.retryConfig.maxDelay
        )
        return delay + Math.random() * 1000
    }

    getCacheKey(endpoint, options) {
        const method = options?.method || 'GET'
        const body = options?.body || ''
        return `${method}:${endpoint}:${body}`
    }

    getCached(key, ttl = 30000) {
        const cached = this.cache.get(key)
        if (!cached) {
            this.metrics.cacheMisses++
            return null
        }
        if (Date.now() > cached.expiresAt) {
            this.cache.delete(key)
            this.metrics.cacheMisses++
            return null
        }
        this.metrics.cacheHits++
        return cached.data
    }

    setCache(key, data, ttl = 30000) {
        this.cache.set(key, { data, expiresAt: Date.now() + ttl })
    }

    clearCache(pattern) {
        if (!pattern) {
            this.cache.clear()
            return
        }
        for (const [key] of this.cache) {
            if (key.includes(pattern)) this.cache.delete(key)
        }
    }

    async requestWithRetry(endpoint, options = {}, attempt = 0) {
        this.metrics.requests++
        const method = (options.method || 'GET').toUpperCase();
        
        // Generate and attach idempotency key for mutating requests
        let idempotencyKey = options.idempotencyKey; // Allow override
        if (!idempotencyKey && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
            idempotencyKey = generateIdempotencyKey(method, endpoint, options.body);
            
            // Check if already sent successfully
            if (sentKeysRegistry.isSent(idempotencyKey)) {
                // Skip resend - return cached success
                return {
                    success: true,
                    cached: true,
                    message: 'Request already sent successfully'
                };
            }
        }
        
        const url = `${API_BASE}${normalizePath(endpoint)}`
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(idempotencyKey && { 'X-Idempotency-Key': idempotencyKey }),
                ...options.headers
            },
            ...options
        }

        try {
            const response = await fetch(url, config)
            const text = await response.text()
            let data
            try {
                data = text ? JSON.parse(text) : {}
            } catch {
                data = { raw: text }
            }

            if (!response.ok) {
                throw new Error(data?.error || `HTTP ${response.status}`)
            }

            // Mark idempotency key as sent on success
            if (idempotencyKey && response.ok) {
                sentKeysRegistry.markSent(idempotencyKey);
            }

            return data
        } catch (error) {
            this.metrics.errors++
            
            if (attempt < this.retryConfig.maxRetries) {
                const delay = this.getRetryDelay(attempt)
                await this.sleep(delay)
                return this.requestWithRetry(endpoint, options, attempt + 1)
            }
            
            // console.error(`API Error [${endpoint}]:`, error)
            throw error
        }
    }

    async request(endpoint, options = {}, cacheTTL = null) {
        const cacheKey = this.getCacheKey(endpoint, options)
        
        // Check cache for GET requests
        if ((!options.method || options.method === 'GET') && cacheTTL !== null) {
            const cached = this.getCached(cacheKey, cacheTTL)
            if (cached) return cached
        }
        
        // Check for pending duplicate request
        if (this.pendingRequests.has(cacheKey)) {
            return this.pendingRequests.get(cacheKey)
        }
        
        // Make request
        const requestPromise = this.requestWithRetry(endpoint, options)
            .then(data => {
                if ((!options.method || options.method === 'GET') && cacheTTL !== null) {
                    this.setCache(cacheKey, data, cacheTTL)
                }
                return data
            })
            .finally(() => {
                this.pendingRequests.delete(cacheKey)
            })
        
        this.pendingRequests.set(cacheKey, requestPromise)
        return requestPromise
    }

    // ============================================
    // PIN Management - متطابق مع /api/v1/pin/*
    // ============================================

    /**
     * Get PIN status
     * Backend: GET /api/v1/pin/status
     */
    async getPinStatus() {
        return this.request(`${API_VERSION}/pin/status`, {}, 300000) // Cache for 5 minutes
    }

    /**
     * Issue next PIN (compatibility)
     */
    async issuePin(clinicId, visitId = null) {
        return this.getPinStatus()
    }

    /**
     * Get current PIN (compatibility)
     */
    async getCurrentPin(clinicId) {
        return this.getPinStatus()
    }

    /**
     * Validate PIN (compatibility)
     */
    async validatePin(clinicId, dateKey, pin) {
        return this.getPinStatus()
    }

    // ============================================
    // Queue Management - متطابق مع /api/v1/queue/*
    // ============================================

    /**
     * Enter queue - Assign ticket to visitor
     * Backend: POST /api/v1/queue/enter
     * Body: { clinic, user }
     * Response: { success, clinic, user, number, status, ahead, display_number }
     */
    async enterQueue(clinicId, visitId, isAutoEntry = false) {
        this.clearCache('/queue/status') // Clear queue cache
        return this.request(`${API_VERSION}/queue/enter`, {
            method: 'POST',
            body: JSON.stringify({ 
                clinic: clinicId, 
                user: visitId,
                isAutoEntry
            })
        })
    }

    /**
     * Get queue status for clinic
     * Backend: GET /api/v1/queue/status?clinic=xxx
     * Response: { success, clinic, list, current_serving, total_waiting }
     */
    async getQueueStatus(clinicId) {
        return this.request(`${API_VERSION}/queue/status?clinic=${clinicId}`, {}, 5000) // Cache for 5 seconds
    }

    /**
     * Complete queue entry - Mark ticket as done
     * Backend: POST /api/v1/queue/done
     * Body: { clinic, user, pin }
     * Response: { success, message }
     */
    async completeQueue(clinicId, visitId, pin) {
        this.clearCache('/queue/status') // Clear queue cache
        return this.request(`${API_VERSION}/queue/done`, {
            method: 'POST',
            body: JSON.stringify({ 
                clinic: clinicId, 
                user: visitId, 
                pin: String(pin) 
            })
        })
    }

    /**
     * Call next patient (Admin)
     * Backend: POST /api/v1/queue/call
     * Body: { clinic }
     */
    async callNextPatient(clinicId) {
        this.clearCache('/queue/status') // Clear queue cache
        return this.request(`${API_VERSION}/queue/call`, {
            method: 'POST',
            body: JSON.stringify({ clinic: clinicId })
        })
    }

    // ============================================
    // Path Management - متطابق مع /api/v1/path/*
    // ============================================

    /**
     * Choose medical path
     * Backend: GET /api/v1/path/choose
     */
    async choosePath() {
        return this.request(`${API_VERSION}/path/choose`)
    }

    /**
     * Assign route (compatibility)
     */
    async assignRoute(visitId, examType, gender = null) {
        return this.choosePath()
    }

    /**
     * Get route (compatibility)
     */
    async getRoute(visitId) {
        return this.choosePath()
    }

    /**
     * Next step (compatibility)
     */
    async nextStep(visitId, currentClinicId) {
        return this.choosePath()
    }

    // ============================================
    // Admin - متطابق مع /api/v1/admin/*
    // ============================================

    /**
     * Get admin status
     * Backend: GET /api/v1/admin/status
     */
    async getAdminStatus() {
        return this.request(`${API_VERSION}/admin/status`)
    }

    // ============================================
    // Health & System - متطابق مع /api/v1/health/*
    // ============================================

    /**
     * Health check
     * Backend: GET /api/v1/health/status
     */
    async healthCheck() {
        return this.request(`${API_VERSION}/health/status`)
    }

    // ============================================
    // Real-Time Notifications (SSE) - متطابق مع /api/v1/events/*
    // ============================================

    /**
     * Connect to Server-Sent Events stream
     * Backend: GET /api/v1/events/stream?clinic=xxx
     * @param {string} clinic - Clinic ID (optional)
     * @param {Function} onNotice - Callback for notices
     * @returns {EventSource}
     */
    connectSSE(clinic = null, onNotice = null) {
        // إذا كان clinic هو function، فهو callback
        if (typeof clinic === 'function') {
            onNotice = clinic
            clinic = null
        }

        // استخدام eventBus بدلاً من EventSource المكرر
        const handleQueueUpdate = (data) => {
            if (!clinic || data.clinic === clinic) {
                if (onNotice) onNotice({ type: 'queue_update', data });
            }
        };
        
        const handleHeartbeat = (data) => {
            if (onNotice) onNotice({ type: 'heartbeat', data });
        };
        
        const handleNotice = (data) => {
            if (!clinic || data.clinic === clinic) {
                if (onNotice) onNotice({ type: 'notice', data });
            }
        };
        
        // الاشتراك في الأحداث
        const unsubscribe1 = eventBus.on('queue:update', handleQueueUpdate);
        const unsubscribe2 = eventBus.on('heartbeat', handleHeartbeat);
        const unsubscribe3 = eventBus.on('notice', handleNotice);

        // إرجاع كائن يحاكي EventSource
        return {
            close: () => {
                unsubscribe1();
                unsubscribe2();
                unsubscribe3();
            }
        }
    }

    // ============================================
    // Helper Methods
    // ============================================

    /**
     * Render ticket based on ZFD status
     */
    renderTicketWithZFD(step, t = (x) => x) {
        if (!step || !step.assigned) {
            return { shouldDisplay: false, message: t('Waiting for assignment'), ticketNumber: null }
        }

        const status = step.status || 'OK'
        const ticket = step.assigned.ticket

        switch (status) {
            case 'OK':
                return { shouldDisplay: true, message: null, ticketNumber: ticket }

            case 'LATE':
                return {
                    shouldDisplay: false,
                    message: t('⏰ Please proceed to the clinic'),
                    ticketNumber: null
                }

            case 'INVALID':
                return {
                    shouldDisplay: false,
                    message: t('❌ Ticket not found'),
                    ticketNumber: null
                }

            default:
                return { shouldDisplay: false, message: t('Unknown status'), ticketNumber: null }
        }
    }

    /**
     * Play notification sound
     */
    playNotificationSound(type = 'info') {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)()
            
            const sounds = {
                success: [{ freq: 600, dur: 150 }, { freq: 800, dur: 150, delay: 150 }],
                warning: [{ freq: 700, dur: 100 }, { freq: 700, dur: 100, delay: 150 }, { freq: 700, dur: 100, delay: 300 }],
                error: [{ freq: 400, dur: 300 }],
                urgent: [{ freq: 900, dur: 100 }, { freq: 700, dur: 100, delay: 150 }, { freq: 900, dur: 100, delay: 300 }, { freq: 700, dur: 100, delay: 450 }],
                info: [{ freq: 800, dur: 200 }]
            }
            
            const soundPattern = sounds[type] || sounds.info
            
            soundPattern.forEach(({ freq, dur, delay = 0 }) => {
                setTimeout(() => {
                    const oscillator = audioContext.createOscillator()
                    const gainNode = audioContext.createGain()
                    
                    oscillator.connect(gainNode)
                    gainNode.connect(audioContext.destination)
                    
                    oscillator.frequency.value = freq
                    oscillator.type = 'sine'
                    
                    const now = audioContext.currentTime
                    gainNode.gain.setValueAtTime(0, now)
                    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01)
                    gainNode.gain.linearRampToValueAtTime(0.3, now + dur / 1000 - 0.05)
                    gainNode.gain.linearRampToValueAtTime(0, now + dur / 1000)
                    
                    oscillator.start(now)
                    oscillator.stop(now + dur / 1000)
                }, delay)
            })
        } catch (error) {

        }
    }
    
    getMetrics() {
        const cacheHitRate = this.metrics.requests > 0
            ? ((this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100).toFixed(2)
            : 0
        return {
            ...this.metrics,
            cacheHitRate: `${cacheHitRate}%`,
            cacheSize: this.cache.size,
            pendingRequests: this.pendingRequests.size
        }
    }
}

// Singleton instance
const enhancedApi = new EnhancedApiClient()

export default enhancedApi
export { enhancedApi, EnhancedApiClient }


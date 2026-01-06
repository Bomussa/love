// Enhanced API Client - Wrapper around Unified API for consistency
// Ensures Admin and Patient apps use the same data source (LocalStorage or Backend)

import api from './api-unified';
import eventBus from '../core/event-bus';

class EnhancedApiClient {
    constructor() {
        this.metrics = { requests: 0, errors: 0, cacheHits: 0, cacheMisses: 0 }
    }

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
             // Audio context might be blocked
        }
    }

    // ============================================
    // PIN Management
    // ============================================

    async getPinStatus() {
        return api.getPinStatus();
    }

    async issuePin(clinicId, visitId = null) {
        // In local/unified API, this is often handled by getPinStatus or separate generation logic
        // For compatibility, we'll refresh status
        return api.getPinStatus();
    }

    async getCurrentPin(clinicId) {
        return api.getPinStatus();
    }

    async validatePin(clinicId, dateKey, pin) {
        return api.getPinStatus();
    }

    // ============================================
    // Queue Management
    // ============================================

    async enterQueue(clinicId, visitId, isAutoEntry = false) {
        return api.enterQueue(clinicId, visitId, isAutoEntry);
    }

    async getQueueStatus(clinicId) {
        return api.getQueueStatus(clinicId);
    }

    async completeQueue(clinicId, visitId, pin) {
        return api.queueDone(clinicId, visitId, pin);
    }

    async callNextPatient(clinicId) {
        return api.callNextPatient(clinicId);
    }

    // ============================================
    // Path Management
    // ============================================

    async choosePath() {
        return api.choosePath();
    }

    async assignRoute(visitId, examType, gender = null) {
        return api.choosePath(gender);
    }

    async getRoute(visitId) {
        // Maps to generic route retrieval if available, otherwise choosePath logic
        return api.choosePath();
    }

    async nextStep(visitId, currentClinicId) {
        return api.choosePath();
    }

    // ============================================
    // Admin
    // ============================================

    async getAdminStatus() {
        return api.getAdminStatus();
    }

    // ============================================
    // Health & System
    // ============================================

    async healthCheck() {
        return api.getHealthStatus();
    }

    // ============================================
    // Real-Time Notifications (SSE)
    // ============================================

    connectSSE(clinic = null, onNotice = null) {
       return api.connectSSE(clinic, onNotice);
    }

    // ============================================
    // Helper Methods
    // ============================================

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
    
    getMetrics() {
        return {
            requests: 0,
            errors: 0,
            cacheHits: 0,
            cacheMisses: 0,
            cacheHitRate: '0%',
            cacheSize: 0,
            pendingRequests: 0
        }
    }
}

const enhancedApi = new EnhancedApiClient()

export default enhancedApi
export { enhancedApi, EnhancedApiClient }

/**
 * Supabase Dashboard API Client
 * يتصل مباشرة بـ Supabase REST API للحصول على إحصائيات حقيقية
 * ✅ يستخدم الجداول الموجودة فعلياً في قاعدة البيانات
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://rujwuruuosffcxazymit.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

class DashboardApiClient {
    constructor() {
        this.restUrl = `${SUPABASE_URL}/rest/v1`
        this.cache = {
            data: null,
            timestamp: null,
            ttl: 5000 // 5 seconds cache
        }
    }

    async request(endpoint, options = {}) {
        const url = `${this.restUrl}${endpoint}`
        const config = {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Prefer': 'return=representation',
                ...options.headers
            }
        }

        if (options.body) {
            config.body = JSON.stringify(options.body)
        }

        try {
            const response = await fetch(url, config)
            
            if (!response.ok) {
                const errorText = await response.text()
                throw new Error(`HTTP ${response.status}: ${errorText}`)
            }

            const data = await response.json()
            return data
        } catch (error) {
            console.error(`[Dashboard API] Error calling ${endpoint}:`, error)
            throw error
        }
    }

    /**
     * Get dashboard statistics from Supabase tables
     */
    async getDashboardStats() {
        // Check cache first
        const now = Date.now()
        if (this.cache.data && this.cache.timestamp && (now - this.cache.timestamp) < this.cache.ttl) {
            return this.cache.data
        }

        try {
            const today = new Date().toISOString().split('T')[0]

            // Get queue stats for today
            const queues = await this.request(
                `/queues?select=*&created_at=gte.${today}T00:00:00`
            )

            // Get clinic counters
            const clinicCounters = await this.request(
                `/clinic_counters?select=*`
            )

            // Calculate stats
            const totalWaiting = queues.filter(q => q.status === 'waiting').length
            const completedToday = queues.filter(q => q.status === 'completed').length
            const totalPatients = queues.length
            const uniquePatients = new Set(queues.map(q => q.patient_id)).size

            // Get active clinics (those with waiting or serving patients)
            const activeClinics = clinicCounters.filter(c => 
                (c.waiting_count || 0) > 0 || (c.serving_count || 0) > 0
            ).length

            const transformedData = {
                // Overview stats
                totalWaiting,
                completedToday,
                totalPatients,
                uniquePatients,
                
                // Calculated stats
                activeClinics,
                totalServed: completedToday,
                
                // System health
                systemHealth: 100,
                
                // Clinics details
                clinics: clinicCounters,
                
                // Timestamp
                timestamp: new Date().toISOString()
            }

            // Cache the result
            this.cache.data = transformedData
            this.cache.timestamp = now

            return transformedData
        } catch (error) {
            console.error('[Dashboard API] Failed to fetch stats:', error)
            
            // Return empty data on error
            return {
                totalWaiting: 0,
                completedToday: 0,
                totalPatients: 0,
                uniquePatients: 0,
                activeClinics: 0,
                totalServed: 0,
                systemHealth: 0,
                clinics: [],
                timestamp: new Date().toISOString(),
                error: error.message
            }
        }
    }

    /**
     * Calculate average wait time from queues
     */
    async getAverageWaitTime() {
        try {
            const today = new Date().toISOString().split('T')[0]
            
            const data = await this.request(
                `/queues?select=entered_at,completed_at&status=eq.completed&entered_at=gte.${today}T00:00:00&completed_at=not.is.null`
            )

            if (!data || data.length === 0) {
                return 0
            }

            // Calculate average wait time in minutes
            const totalWaitMinutes = data.reduce((sum, entry) => {
                const entered = new Date(entry.entered_at)
                const completed = new Date(entry.completed_at)
                const waitMinutes = (completed - entered) / 1000 / 60
                return sum + waitMinutes
            }, 0)

            const avgWaitMinutes = Math.round(totalWaitMinutes / data.length)
            return avgWaitMinutes
        } catch (error) {
            console.error('[Dashboard API] Failed to calculate avg wait time:', error)
            return 0
        }
    }

    /**
     * Get recent activity from queues
     */
    async getRecentActivity(limit = 10) {
        try {
            const queueHistory = await this.request(
                `/queues?select=clinic_id,patient_id,status,entered_at,completed_at&order=entered_at.desc&limit=${limit}`
            )

            if (!queueHistory || queueHistory.length === 0) {
                return []
            }

            // Transform queue history to activity format
            const events = queueHistory.map(q => {
                const time = new Date(q.entered_at).toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                })
                
                let event = ''
                let type = 'info'
                
                if (q.status === 'completed') {
                    event = `Patient completed ${q.clinic_id}`
                    type = 'success'
                } else if (q.status === 'serving') {
                    event = `Patient being served at ${q.clinic_id}`
                    type = 'info'
                } else {
                    event = `Patient entered ${q.clinic_id}`
                    type = 'info'
                }

                return { time, event, type }
            })

            return events
        } catch (error) {
            console.error('[Dashboard API] Failed to fetch recent activity:', error)
            return []
        }
    }

    /**
     * Clear cache (useful for manual refresh)
     */
    clearCache() {
        this.cache.data = null
        this.cache.timestamp = null
    }
}

// Export singleton instance
export const dashboardApi = new DashboardApiClient()
export default dashboardApi

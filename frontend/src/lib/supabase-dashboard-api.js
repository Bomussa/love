/**
 * Supabase Dashboard API Client
 * يتصل بـ stats-dashboard function للحصول على إحصائيات حقيقية
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://rujwuruuosffcxazymit.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

class DashboardApiClient {
    constructor() {
        this.functionsUrl = `${SUPABASE_URL}/functions/v1`
        this.cache = {
            data: null,
            timestamp: null,
            ttl: 5000 // 5 seconds cache
        }
    }

    async request(functionName, options = {}) {
        const url = `${this.functionsUrl}/${functionName}${options.query || ''}`
        const config = {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                ...options.headers
            }
        }

        if (options.body) {
            config.body = JSON.stringify(options.body)
        }

        try {
            const response = await fetch(url, config)
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData?.error || `HTTP ${response.status}`)
            }

            const data = await response.json()
            return data
        } catch (error) {
            console.error(`[Dashboard API] Error calling ${functionName}:`, error)
            throw error
        }
    }

    /**
     * Get dashboard statistics
     * Function: stats-dashboard
     * GET /functions/v1/stats-dashboard
     */
    async getDashboardStats() {
        // Check cache first
        const now = Date.now()
        if (this.cache.data && this.cache.timestamp && (now - this.cache.timestamp) < this.cache.ttl) {
            return this.cache.data
        }

        try {
            const response = await this.request('stats-dashboard', {
                method: 'GET'
            })

            if (!response.success) {
                throw new Error(response.error || 'Failed to fetch dashboard stats')
            }

            // Transform data to match AdvancedDashboard expectations
            const overview = response.data?.overview || {}
            const clinics = response.data?.clinics || []

            const transformedData = {
                // Overview stats
                totalWaiting: overview.in_queue_now || 0,
                completedToday: overview.completed_today || 0,
                totalPatients: overview.visits_today || 0,
                uniquePatients: overview.unique_patients_today || 0,
                
                // Calculated stats
                activeClinics: clinics.filter(c => (c.waiting_count || 0) > 0 || (c.serving_count || 0) > 0).length,
                totalServed: overview.completed_today || 0,
                
                // System health (calculated based on data availability)
                systemHealth: response.success ? 100 : 0,
                
                // Clinics details
                clinics: clinics,
                
                // Timestamp
                timestamp: response.data?.timestamp || new Date().toISOString()
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
     * This requires direct Supabase query
     */
    async getAverageWaitTime() {
        try {
            // Import supabase client
            const { createClient } = await import('@supabase/supabase-js')
            const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

            // Query queues table for today's completed entries
            const today = new Date().toISOString().split('T')[0]
            
            const { data, error } = await supabase
                .from('queues')
                .select('entered_at, completed_at')
                .eq('status', 'completed')
                .gte('entered_at', `${today}T00:00:00`)
                .not('completed_at', 'is', null)

            if (error) throw error

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
     * Get recent activity from events or queue_history
     */
    async getRecentActivity(limit = 10) {
        try {
            const { createClient } = await import('@supabase/supabase-js')
            const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

            // Try to get from events table first
            let { data: events, error } = await supabase
                .from('events')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit)

            // If events table doesn't exist or is empty, use queue_history
            if (error || !events || events.length === 0) {
                const { data: queueHistory, error: qhError } = await supabase
                    .from('queues')
                    .select('clinic_id, patient_id, status, entered_at, completed_at')
                    .order('entered_at', { ascending: false })
                    .limit(limit)

                if (qhError) throw qhError

                // Transform queue history to activity format
                events = (queueHistory || []).map(q => {
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
            } else {
                // Transform events to activity format
                events = events.map(e => ({
                    time: new Date(e.created_at).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    }),
                    event: e.message || e.event_type || 'System event',
                    type: e.event_type === 'error' ? 'warning' : 'info'
                }))
            }

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

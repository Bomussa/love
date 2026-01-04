/**
 * Realtime Connection Manager
 * يدير الاتصال المباشر مع Supabase Realtime
 * ✅ يستخدم Supabase Realtime بدلاً من SSE
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://rujwuruuosffcxazymit.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

class RealtimeConnectionManager {
    constructor() {
        this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
        this.channels = new Map()
        this.status = 'disconnected' // disconnected, connecting, connected, error
        this.listeners = new Set()
        this.reconnectAttempts = 0
        this.maxReconnectAttempts = 5
        this.reconnectDelay = 2000
    }

    /**
     * Get current connection status
     */
    getStatus() {
        return this.status
    }

    /**
     * Subscribe to status changes
     */
    onStatusChange(callback) {
        this.listeners.add(callback)
        // Immediately call with current status
        callback(this.status)
        
        return () => {
            this.listeners.delete(callback)
        }
    }

    /**
     * Notify all listeners of status change
     */
    _notifyStatusChange(newStatus) {
        this.status = newStatus
        this.listeners.forEach(listener => {
            try {
                listener(newStatus)
            } catch (err) {
                console.error('[Realtime] Error in status listener:', err)
            }
        })
    }

    /**
     * Subscribe to queue updates for a clinic
     */
    subscribeToQueue(clinicId, callbacks = {}) {
        const channelName = `queue:${clinicId}`
        
        // Check if already subscribed
        if (this.channels.has(channelName)) {
            console.log(`[Realtime] Already subscribed to ${channelName}`)
            return this.channels.get(channelName)
        }

        try {
            this._notifyStatusChange('connecting')

            const channel = this.supabase
                .channel(channelName)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'queues',
                        filter: `clinic_id=eq.${clinicId}`
                    },
                    (payload) => {
                        console.log(`[Realtime] Queue update for ${clinicId}:`, payload)
                        if (callbacks.onQueueUpdate) {
                            callbacks.onQueueUpdate(payload)
                        }
                    }
                )
                .subscribe((status) => {
                    console.log(`[Realtime] Channel ${channelName} status:`, status)
                    
                    if (status === 'SUBSCRIBED') {
                        this._notifyStatusChange('connected')
                        this.reconnectAttempts = 0
                        if (callbacks.onConnected) {
                            callbacks.onConnected()
                        }
                    } else if (status === 'CHANNEL_ERROR') {
                        this._notifyStatusChange('error')
                        if (callbacks.onError) {
                            callbacks.onError(new Error('Channel error'))
                        }
                        this._handleReconnect(clinicId, callbacks)
                    } else if (status === 'TIMED_OUT') {
                        this._notifyStatusChange('error')
                        if (callbacks.onError) {
                            callbacks.onError(new Error('Connection timed out'))
                        }
                        this._handleReconnect(clinicId, callbacks)
                    } else if (status === 'CLOSED') {
                        this._notifyStatusChange('disconnected')
                        if (callbacks.onDisconnected) {
                            callbacks.onDisconnected()
                        }
                    }
                })

            this.channels.set(channelName, channel)
            return channel
        } catch (err) {
            console.error(`[Realtime] Error subscribing to ${channelName}:`, err)
            this._notifyStatusChange('error')
            if (callbacks.onError) {
                callbacks.onError(err)
            }
            return null
        }
    }

    /**
     * Subscribe to notifications for a patient
     */
    subscribeToNotifications(patientId, callbacks = {}) {
        const channelName = `notifications:${patientId}`
        
        if (this.channels.has(channelName)) {
            console.log(`[Realtime] Already subscribed to ${channelName}`)
            return this.channels.get(channelName)
        }

        try {
            const channel = this.supabase
                .channel(channelName)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'notifications',
                        filter: `patient_id=eq.${patientId}`
                    },
                    (payload) => {
                        console.log(`[Realtime] New notification for ${patientId}:`, payload)
                        if (callbacks.onNotification) {
                            callbacks.onNotification(payload.new)
                        }
                    }
                )
                .subscribe((status) => {
                    console.log(`[Realtime] Channel ${channelName} status:`, status)
                    
                    if (status === 'SUBSCRIBED') {
                        this._notifyStatusChange('connected')
                        if (callbacks.onConnected) {
                            callbacks.onConnected()
                        }
                    }
                })

            this.channels.set(channelName, channel)
            return channel
        } catch (err) {
            console.error(`[Realtime] Error subscribing to ${channelName}:`, err)
            if (callbacks.onError) {
                callbacks.onError(err)
            }
            return null
        }
    }

    /**
     * Subscribe to PIN updates
     */
    subscribeToPINUpdates(callbacks = {}) {
        const channelName = 'pin:updates'
        
        if (this.channels.has(channelName)) {
            return this.channels.get(channelName)
        }

        try {
            const channel = this.supabase
                .channel(channelName)
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'clinics'
                    },
                    (payload) => {
                        console.log('[Realtime] PIN update:', payload)
                        if (callbacks.onPINUpdate) {
                            callbacks.onPINUpdate(payload.new)
                        }
                    }
                )
                .subscribe()

            this.channels.set(channelName, channel)
            return channel
        } catch (err) {
            console.error('[Realtime] Error subscribing to PIN updates:', err)
            return null
        }
    }

    /**
     * Unsubscribe from a channel
     */
    unsubscribe(channelName) {
        const channel = this.channels.get(channelName)
        if (channel) {
            this.supabase.removeChannel(channel)
            this.channels.delete(channelName)
            console.log(`[Realtime] Unsubscribed from ${channelName}`)
        }
    }

    /**
     * Unsubscribe from all channels
     */
    unsubscribeAll() {
        this.channels.forEach((channel, name) => {
            this.supabase.removeChannel(channel)
            console.log(`[Realtime] Unsubscribed from ${name}`)
        })
        this.channels.clear()
        this._notifyStatusChange('disconnected')
    }

    /**
     * Handle reconnection logic
     */
    _handleReconnect(clinicId, callbacks) {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[Realtime] Max reconnect attempts reached')
            this._notifyStatusChange('error')
            return
        }

        this.reconnectAttempts++
        const delay = this.reconnectDelay * this.reconnectAttempts

        console.log(`[Realtime] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

        setTimeout(() => {
            console.log('[Realtime] Attempting to reconnect...')
            this.unsubscribe(`queue:${clinicId}`)
            this.subscribeToQueue(clinicId, callbacks)
        }, delay)
    }

    /**
     * Test connection
     */
    async testConnection() {
        try {
            this._notifyStatusChange('connecting')
            
            // Try to fetch a simple query to test connection
            const { data, error } = await this.supabase
                .from('clinics')
                .select('id')
                .limit(1)

            if (error) {
                this._notifyStatusChange('error')
                return { success: false, error: error.message }
            }

            this._notifyStatusChange('connected')
            return { success: true }
        } catch (err) {
            this._notifyStatusChange('error')
            return { success: false, error: err.message }
        }
    }
}

// Export singleton instance
export const realtimeConnection = new RealtimeConnectionManager()
export default realtimeConnection

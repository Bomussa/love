/**
 * Supabase Direct Queries
 * 
 * Common database queries using Supabase client
 * No Edge Functions needed for simple CRUD operations
 */

import { supabase } from './supabase-client'

/**
 * Queue Operations
 */
export const queueQueries = {
  /**
   * Get queue status for a clinic
   */
  async getStatus(clinicId) {
    const { data, error } = await supabase
      .from('queues')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: true })
    
    if (error) throw error
    
    const waiting = data.filter(q => q.status === 'waiting')
    const inService = data.filter(q => q.status === 'in_service')
    
    return {
      waiting: waiting.length,
      inService: inService.length,
      total: data.length,
      queue: waiting
    }
  },

  /**
   * Subscribe to queue changes (Realtime)
   */
  subscribeToChanges(clinicId, callback) {
    const channel = supabase
      .channel(`queue-${clinicId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queues',
          filter: `clinic_id=eq.${clinicId}`
        },
        callback
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }
}

/**
 * Settings Operations
 */
export const settingsQueries = {
  /**
   * Get setting by type
   */
  async get(type) {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('type', type)
      .single()
    
    if (error && error.code !== 'PGRST116') throw error // PGRST116 = not found
    return data
  },

  /**
   * Update or create setting
   */
  async set(type, value) {
    const { data, error } = await supabase
      .from('settings')
      .upsert({ type, value, updated_at: new Date().toISOString() })
      .select()
      .single()
    
    if (error) throw error
    return data
  }
}

/**
 * Admin Operations
 */
export const adminQueries = {
  /**
   * Extend clinic time
   * Note: This might need RPC or Edge Function if complex logic is required
   */
  async extendTime(clinicId, minutes) {
    // Option 1: Direct update (if simple)
    const { data, error } = await supabase
      .from('clinics')
      .update({ 
        extended_time: minutes,
        updated_at: new Date().toISOString()
      })
      .eq('id', clinicId)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  /**
   * Get all clinics with PIN codes
   */
  async getClinicsWithPins() {
    const { data, error } = await supabase
      .from('clinics')
      .select('id, name, name_ar, pin_code, updated_at')
      .order('name')
    
    if (error) throw error
    return data
  }
}

/**
 * Events Operations
 */
export const eventsQueries = {
  /**
   * Log recovery event
   */
  async logRecovery(eventData) {
    const { data, error } = await supabase
      .from('events')
      .insert({
        type: 'recovery',
        data: eventData,
        created_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  /**
   * Subscribe to events (Realtime)
   */
  subscribeToEvents(callback) {
    const channel = supabase
      .channel('events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'events'
        },
        callback
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }
}

/**
 * Helper: Check if Supabase is connected
 */
export async function checkConnection() {
  try {
    const { error } = await supabase.from('clinics').select('count').limit(1)
    return !error
  } catch {
    return false
  }
}

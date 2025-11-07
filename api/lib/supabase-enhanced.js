/**
 * Supabase Client for Vercel API
 * Enhanced with helper functions for common operations
 */

import { createClient } from '@supabase/supabase-js';

/**
 * Get Supabase client instance
 * @param {Object} env - Environment variables (process.env in Vercel)
 * @returns {Object} Supabase client
 */
export function getSupabaseClient(env = process.env) {
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not found in environment');
  }

  return createClient(supabaseUrl, supabaseKey);
}

/**
 * KV-like interface for Supabase
 * يوفر نفس الـ API كـ KV Storage لكن يستخدم Supabase
 */
export class SupabaseKV {
  constructor(tableName, supabase) {
    this.tableName = tableName;
    this.supabase = supabase;
  }

  /**
   * Get value by key
   * @param {string} key - Key to retrieve
   * @param {string} type - Type of value ('json' or 'text')
   * @returns {Promise<any>} Value or null
   */
  async get(key, type = 'json') {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('value')
        .eq('key', key)
        .single();

      if (error || !data) {
        return null;
      }

      return type === 'json' ? data.value : JSON.stringify(data.value);
    } catch (error) {
      console.error(`[SupabaseKV] Get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value by key
   * @param {string} key - Key to set
   * @param {any} value - Value to store
   * @param {Object} options - Options (expirationTtl, etc.)
   * @returns {Promise<boolean>} Success status
   */
  async put(key, value, options = {}) {
    try {
      const dataToStore = typeof value === 'string' ? JSON.parse(value) : value;
      
      const insertData = {
        key,
        value: dataToStore,
        updated_at: new Date().toISOString()
      };

      if (options.expirationTtl) {
        insertData.expires_at = new Date(Date.now() + options.expirationTtl * 1000).toISOString();
      }

      const { error } = await this.supabase
        .from(this.tableName)
        .upsert(insertData, { onConflict: 'key' });

      if (error) {
        console.error(`[SupabaseKV] Put error for key ${key}:`, error);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`[SupabaseKV] Put error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete value by key
   * @param {string} key - Key to delete
   * @returns {Promise<boolean>} Success status
   */
  async delete(key) {
    try {
      const { error } = await this.supabase
        .from(this.tableName)
        .delete()
        .eq('key', key);

      if (error) {
        console.error(`[SupabaseKV] Delete error for key ${key}:`, error);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`[SupabaseKV] Delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * List all keys with prefix
   * @param {string} prefix - Key prefix
   * @returns {Promise<Array>} List of keys
   */
  async list(prefix = '') {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select('key');

      if (prefix) {
        query = query.like('key', `${prefix}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error(`[SupabaseKV] List error:`, error);
        return [];
      }

      return data.map(row => row.key);
    } catch (error) {
      console.error(`[SupabaseKV] List error:`, error);
      return [];
    }
  }
}

/**
 * Initialize KV-like stores using Supabase
 * @param {Object} env - Environment variables
 * @returns {Object} KV stores
 */
export function initializeKVStores(env = process.env) {
  const supabase = getSupabaseClient(env);

  return {
    KV_ADMIN: new SupabaseKV('kv_admin', supabase),
    KV_PINS: new SupabaseKV('kv_pins', supabase),
    KV_QUEUES: new SupabaseKV('kv_queues', supabase),
    KV_EVENTS: new SupabaseKV('kv_events', supabase),
    KV_LOCKS: new SupabaseKV('kv_locks', supabase),
    KV_CACHE: new SupabaseKV('kv_cache', supabase),
    supabase // أيضاً نرجع الـ client للاستخدام المباشر
  };
}

/**
 * Helper: Get queue data from Supabase
 */
export async function getQueueData(supabase, clinicId, date = null) {
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('queue_status')
    .select('*')
    .eq('clinic_id', clinicId)
    .gte('created_at', targetDate)
    .lt('created_at', targetDate + 'T23:59:59.999Z')
    .order('number', { ascending: true });

  if (error) {
    console.error('[getQueueData] Error:', error);
    return [];
  }

  return data || [];
}

/**
 * Helper: Get daily pins from Supabase
 */
export async function getDailyPins(supabase, date = null) {
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('daily_pins')
    .select('*')
    .eq('date', targetDate)
    .single();

  if (error || !data) {
    return null;
  }

  return data.pins;
}

/**
 * Helper: Save daily pins to Supabase
 */
export async function saveDailyPins(supabase, pins, date = null) {
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  const { error } = await supabase
    .from('daily_pins')
    .upsert({
      date: targetDate,
      pins,
      updated_at: new Date().toISOString()
    }, { onConflict: 'date' });

  if (error) {
    console.error('[saveDailyPins] Error:', error);
    return false;
  }

  return true;
}

/**
 * Helper: Log activity to Supabase
 */
export async function logActivity(supabase, type, data, expiresIn = 86400) {
  const { error } = await supabase
    .from('activity_logs')
    .insert({
      event_type: type,
      data,
      expires_at: new Date(Date.now() + expiresIn * 1000).toISOString()
    });

  if (error) {
    console.error('[logActivity] Error:', error);
    return false;
  }

  return true;
}

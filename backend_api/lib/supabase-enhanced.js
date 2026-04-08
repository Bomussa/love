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
  // Prefer Service Role Key for Server-Side operations to bypass RLS
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not found in environment');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Initialize KV-like stores using Supabase
 * NOTE: Adapted to return the raw client since we are moving away from KV tables
 * to proper Relational Tables.
 * @param {Object} env - Environment variables
 * @returns {Object} KV stores
 */
export function initializeKVStores(env = process.env) {
  const supabase = getSupabaseClient(env);

  // Return proxies that throw helpful errors if legacy KV code is hit,
  // or simple wrappers if we want to maintain compatibility (but mapped to real tables).
  // For now, we return the raw client as 'supabase' which is what we will use.

  return {
    supabase,
    // Mock KV stores to prevent crashes if I missed a spot, but logs error
    KV_ADMIN: createMockKV('admin', supabase),
    KV_PINS: createMockKV('pins', supabase),
    KV_QUEUES: createMockKV('queue', supabase),
    KV_EVENTS: createMockKV('events', supabase),
    KV_LOCKS: createMockKV('locks', supabase),
    KV_CACHE: createMockKV('cache', supabase),
  };
}

function createMockKV(name, supabase) {
  return {
    get: async (key, type = 'text') => {
      console.log(`[KV Adapter] Get ${name}:${key}`);
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', `${name}:${key}`)
          .maybeSingle();
        
        if (error || !data) return null;
        return type === 'json' ? JSON.parse(data.value) : data.value;
      } catch (e) {
        console.error(`[KV Adapter] Error getting ${name}:${key}:`, e);
        return null;
      }
    },
    put: async (key, val) => {
      console.log(`[KV Adapter] Put ${name}:${key}`);
      try {
        const value = typeof val === 'object' ? JSON.stringify(val) : String(val);
        const { error } = await supabase
          .from('settings')
          .upsert({ 
            key: `${name}:${key}`, 
            value,
            updated_at: new Date().toISOString()
          });
        
        if (error) throw error;
        return true;
      } catch (e) {
        console.error(`[KV Adapter] Error putting ${name}:${key}:`, e);
        return false;
      }
    },
    list: async (options = {}) => {
      console.log(`[KV Adapter] List ${name}`);
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('key')
          .like('key', `${name}:%`);
        
        if (error) throw error;
        return { keys: (data || []).map(d => ({ name: d.key.replace(`${name}:`, '') })) };
      } catch (e) {
        console.error(`[KV Adapter] Error listing ${name}:`, e);
        return { keys: [] };
      }
    },
    delete: async (key) => {
      console.log(`[KV Adapter] Delete ${name}:${key}`);
      try {
        const { error } = await supabase
          .from('settings')
          .delete()
          .eq('key', `${name}:${key}`);
        
        if (error) throw error;
        return true;
      } catch (e) {
        console.error(`[KV Adapter] Error deleting ${name}:${key}:`, e);
        return false;
      }
    }
  };
}

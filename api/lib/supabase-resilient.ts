/**
 * Resilient Supabase Client
 * 
 * Purpose: Wrap Supabase calls with Circuit Breaker for reliability R ≥ 0.98
 * Ensures that database failures don't cascade through the system
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getCircuitBreaker } from './circuit-breaker';

let supabaseClient: SupabaseClient | null = null;
const supabaseBreaker = getCircuitBreaker('supabase', {
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 30000,
  requestTimeout: 10000
});

/**
 * Get or create Supabase client with environment variables
 */
export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
  }

  supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: false
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'x-application': 'mmc-mms'
      }
    }
  });

  return supabaseClient;
}

/**
 * Execute Supabase query with Circuit Breaker protection
 */
export async function executeWithBreaker<T>(
  operation: (client: SupabaseClient) => Promise<T>,
  fallback?: T
): Promise<T> {
  try {
    return await supabaseBreaker.execute(async () => {
      const client = getSupabaseClient();
      return await operation(client);
    });
  } catch (error) {
    console.error('[Supabase] Circuit breaker caught error:', error);
    
    if (fallback !== undefined) {
      console.log('[Supabase] Returning fallback value');
      return fallback;
    }
    
    throw error;
  }
}

/**
 * Get circuit breaker stats for monitoring
 */
export function getSupabaseCircuitStats() {
  return supabaseBreaker.getStats();
}

/**
 * Reset circuit breaker (admin only)
 */
export function resetSupabaseCircuit() {
  supabaseBreaker.reset();
}

/**
 * Supabase API Client - Frontend Library
 * PIN System Removed as per requirements
 */
import { supabase } from './supabase-client';

class SupabaseApiClient {
  constructor() {
    this.cache = new Map();
  }
  
  // PIN system has been completely removed
  // All authentication and verification now handled through Supabase directly
}

export const supabaseApi = new SupabaseApiClient();
export default supabaseApi;

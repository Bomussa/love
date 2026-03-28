/**
 * Supabase API Client - Frontend Library
 * Updated: Direct Supabase connection for PIN logic
 * Table: pins (clinic_code, pin, is_active, expires_at)
 */
import { apiClient } from "@/lib/api/client";

class SupabaseApiClient {
  constructor() {
    this.cache = new Map();
  }

  // Fix 26: Redirect direct DB calls to API client to unify connection
  async getCurrentPin(clinicId) {
    try {
      // Using apiClient instead of direct supabase call
      const data = await apiClient.get('currentPin', { clinicId });
      
      if (data && data.success) {
        return data;
      }

      return {
        success: false,
        currentPin: null,
        totalIssued: 0,
        allPins: [],
        message: 'Could not fetch PIN'
      };
    } catch (error) {
      console.error('[supabase-api] getCurrentPin error:', error);
      throw error;
    }
  }

  async issuePin(clinicId) {
    try {
      // Fix 26: Using apiClient
      const data = await apiClient.post('issuePin', { clinicId });
      
      if (data && data.success) {
        return data;
      }

      throw new Error(data?.message || 'Failed to issue PIN');
    } catch (error) {
      console.error('[supabase-api] issuePin error:', error);
      throw error;
    }
  }

  async verifyPin(clinicId, pin) {
    try {
      // Fix 26: Using apiClient
      const data = await apiClient.post('verifyPin', { clinicId, pin });
      
      if (data && data.success) {
        return data;
      }

      return { success: false, valid: false, message: data?.message || 'Invalid PIN' };
    } catch (error) {
      console.error('[supabase-api] verifyPin error:', error);
      return { success: false, valid: false, error: error.message };
    }
  }

  async getAllPins() {
    try {
      // Fix 26: Using apiClient
      const data = await apiClient.get('allPins');
      
      if (data && data.success) {
        return data;
      }

      return { success: false, pins: [], message: data?.message || 'Failed to fetch all PINs' };
    } catch (error) {
      console.error('[supabase-api] getAllPins error:', error);
      return { success: false, pins: [], error: error.message };
    }
  }
}

export const supabaseApi = new SupabaseApiClient();
export default supabaseApi;

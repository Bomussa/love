/**
 * Supabase API Client - Frontend Library
 * Updated: Direct Supabase connection for PIN logic
 * Table: pins (clinic_code, pin, is_active, expires_at)
 */
import { supabase } from './supabase-client';

class SupabaseApiClient {
  constructor() {
    this.cache = new Map();
  }

  async getCurrentPin(clinicId) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      // 1. Get current active PIN
      const { data: current, error: currentError } = await supabase
        .from('pins')
        .select('id, clinic_code, pin, is_active, generated_at, expires_at')
        .eq('clinic_code', clinicId)
        .eq('is_active', true)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (currentError) throw currentError;

      // 2. Get all PINs issued today for this clinic
      const { data: allToday, error: allTodayError } = await supabase
        .from('pins')
        .select('pin')
        .eq('clinic_code', clinicId)
        .gte('generated_at', todayISO)
        .order('generated_at', { ascending: true });

      if (allTodayError) throw allTodayError;

      return {
        success: true,
        currentPin: current ? current.pin : null,
        pinId: current ? current.id : null,
        clinicCode: current ? current.clinic_code : clinicId,
        isActive: current ? current.is_active : false,
        generatedAt: current ? current.generated_at : null,
        expiresAt: current ? current.expires_at : null,
        totalIssued: allToday ? allToday.length : 0,
        allPins: allToday ? allToday.map((p) => p.pin) : [],
        dateKey: today.toLocaleDateString(),
      };
    } catch (error) {
      console.error('[supabase-api] getCurrentPin error:', error);
      throw error;
    }
  }

  // ❌ DEPRECATED - PIN system removed
  async issuePin(clinicId) {
    console.warn('issuePin is deprecated - PIN system removed');
    return { success: true, currentPin: null, message: 'PIN system disabled' };
  }

  // ❌ DEPRECATED - PIN system removed
  async verifyPin(clinicId, pin) {
    console.warn('verifyPin is deprecated - PIN system removed');
    return { success: true, valid: true, message: 'PIN system disabled' };
  }

  // ❌ DEPRECATED - PIN system removed
  async getAllPins() {
    console.warn('getAllPins is deprecated - PIN system removed');
    return { success: true, pins: [] };
  }
}

export const supabaseApi = new SupabaseApiClient();
export default supabaseApi;

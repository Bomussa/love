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
      const now = new Date().toISOString();

      // 1. Get current active PIN
      const { data: current, error: currentError } = await supabase
        .from('pins')
        .select('id, clinic_id, pin, created_at, valid_until, used_at')
        .eq('clinic_id', clinicId)
        .is('used_at', null)
        .gte('valid_until', now)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (currentError) throw currentError;

      // 2. Get all PINs issued today for this clinic
      const { data: allToday, error: allTodayError } = await supabase
        .from('pins')
        .select('pin')
        .eq('clinic_id', clinicId)
        .gte('created_at', todayISO)
        .order('created_at', { ascending: true });

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

  async issuePin(clinicId) {
    try {
      // توليد PIN جديد من 4 أرقام
      const newPin = Math.floor(1000 + Math.random() * 9000).toString();
      const now = new Date();
      const validUntil = new Date(now);
      validUntil.setHours(23, 59, 59, 999);

      // تعطيل جميع الـ PINs السابقة لهذه العيادة
      await supabase
        .from('pins')
        .update({ used_at: now.toISOString() })
        .eq('clinic_id', clinicId)
        .is('used_at', null);

      // إضافة PIN جديد
      const { data, error } = await supabase
        .from('pins')
        .insert([{
          clinic_id: clinicId,
          pin: newPin,
          created_at: now.toISOString(),
          valid_until: validUntil.toISOString(),
          used_at: null,
        }])
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        currentPin: data.pin,
        pinId: data.id,
        message: 'تم توليد رمز PIN جديد بنجاح',
      };
    } catch (error) {
      console.error('[supabase-api] issuePin error:', error);
      throw error;
    }
  }

  async verifyPin(clinicId, pin) {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('pins')
        .select('id, clinic_id, pin, valid_until, used_at')
        .eq('clinic_id', clinicId)
        .eq('pin', pin)
        .is('used_at', null)
        .gte('valid_until', now)
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      // التحقق من صلاحية الـ PIN
      const isValid = !!data;

      return {
        success: true,
        valid: isValid,
        message: isValid ? 'رمز PIN صحيح' : 'رمز PIN غير صحيح أو منتهي الصلاحية',
      };
    } catch (error) {
      console.error('[supabase-api] verifyPin error:', error);
      return { success: false, valid: false, error: error.message };
    }
  }

  async getAllPins() {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('pins')
        .select('id, clinic_id, pin, created_at, valid_until, used_at')
        .is('used_at', null)
        .gte('valid_until', now)
        .order('clinic_id', { ascending: true });

      if (error) throw error;

      return {
        success: true,
        pins: data.map((p) => ({
          pinId: p.id,
          currentPin: p.pin,
          clinicCode: p.clinic_id,
          isActive: true,
          generatedAt: p.created_at,
          expiresAt: p.valid_until,
        })),
      };
    } catch (error) {
      console.error('[supabase-api] getAllPins error:', error);
      return { success: false, pins: [], error: error.message };
    }
  }
}

export const supabaseApi = new SupabaseApiClient();
export default supabaseApi;

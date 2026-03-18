/**
 * Supabase API Client - Frontend Library
 * Canonical pins contract: id, clinic_id, pin, created_at, valid_until, used_at
 */
import { supabase } from './supabase-client';
import { PIN_CONTRACT_SELECT, isPinActive } from '../contracts/pin-contract';

class SupabaseApiClient {
  constructor() {
    this.cache = new Map();
  }

  async getCurrentPin(clinicId) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const nowIso = new Date().toISOString();

      const { data: current, error: currentError } = await supabase
        .from('pins')
        .select(PIN_CONTRACT_SELECT)
        .eq('clinic_id', clinicId)
        .is('used_at', null)
        .gt('valid_until', nowIso)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (currentError) throw currentError;

      const { data: allToday, error: allTodayError } = await supabase
        .from('pins')
        .select(PIN_CONTRACT_SELECT)
        .eq('clinic_id', clinicId)
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: true });

      if (allTodayError) throw allTodayError;

      const validToday = (allToday || []).filter((pin) => isPinActive(pin));

      return {
        success: true,
        currentPin: current ? current.pin : null,
        pinId: current ? current.id : null,
        clinicId,
        isActive: !!current,
        createdAt: current ? current.created_at : null,
        validUntil: current ? current.valid_until : null,
        totalIssued: validToday.length,
        allPins: validToday.map((p) => p.pin),
        dateKey: today.toLocaleDateString(),
      };
    } catch (error) {
      console.error('[supabase-api] getCurrentPin error:', error);
      throw error;
    }
  }

  async issuePin(clinicId) {
    try {
      // توليد PIN من رقمين فقط (10-99) - موحد مع باقي النظام
      const newPin = Math.floor(10 + Math.random() * 90).toString();
      const now = new Date();
      const validUntil = new Date(now);
      validUntil.setHours(23, 59, 59, 999);

      await supabase
        .from('pins')
        .update({ used_at: now.toISOString() })
        .eq('clinic_id', clinicId)
        .is('used_at', null);

      const { data, error } = await supabase
        .from('pins')
        .insert([{ clinic_id: clinicId, pin: newPin, created_at: now.toISOString(), valid_until: validUntil.toISOString(), used_at: null }])
        .select(PIN_CONTRACT_SELECT)
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
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('pins')
        .select(PIN_CONTRACT_SELECT)
        .eq('clinic_id', clinicId)
        .eq('pin', pin)
        .is('used_at', null)
        .gt('valid_until', nowIso)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      const valid = isPinActive(data, nowIso);

      return {
        success: true,
        valid,
        message: valid ? 'رمز PIN صحيح' : 'رمز PIN غير صحيح أو منتهي الصلاحية',
      };
    } catch (error) {
      console.error('[supabase-api] verifyPin error:', error);
      return { success: false, valid: false, error: error.message };
    }
  }

  async getAllPins() {
    try {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('pins')
        .select(PIN_CONTRACT_SELECT)
        .is('used_at', null)
        .gt('valid_until', nowIso)
        .order('clinic_id', { ascending: true });

      if (error) throw error;

      return {
        success: true,
        pins: (data || []).map((p) => ({
          pinId: p.id,
          currentPin: p.pin,
          clinicId: p.clinic_id,
          isActive: isPinActive(p, nowIso),
          createdAt: p.created_at,
          validUntil: p.valid_until,
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

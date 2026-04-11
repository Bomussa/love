/**
 * Supabase API Client - Frontend Library
 */
import { supabase } from './supabase-client';

class SupabaseApiClient {
  constructor() {
    this.cache = new Map();
  }

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const { data: current, error: currentError } = await supabase
        .eq('clinic_code', clinicId)
        .eq('is_active', true)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (currentError) throw currentError;

      const { data: allToday, error: allTodayError } = await supabase
        .eq('clinic_code', clinicId)
        .gte('generated_at', todayISO)
        .order('generated_at', { ascending: true });

      if (allTodayError) throw allTodayError;

      return {
        success: true,
        clinicCode: current ? current.clinic_code : clinicId,
        isActive: current ? current.is_active : false,
        generatedAt: current ? current.generated_at : null,
        expiresAt: current ? current.expires_at : null,
        totalIssued: allToday ? allToday.length : 0,
        dateKey: today.toLocaleDateString(),
      };
    } catch (error) {
      throw error;
    }
  }

    try {
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setHours(23, 59, 59, 999);

      await supabase
        .update({ is_active: false })
        .eq('clinic_code', clinicId);

      const { data, error } = await supabase
        .insert([{
          clinic_code: clinicId,
          is_active: true,
          generated_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        }])
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
      };
    } catch (error) {
      throw error;
    }
  }

    try {
      const { data, error } = await supabase
        .eq('clinic_code', clinicId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      const isValid = data && data.is_active
                           && (!data.expires_at || new Date(data.expires_at) > new Date());

      return {
        success: true,
        valid: isValid,
      };
    } catch (error) {
      return { success: false, valid: false, error: error.message };
    }
  }

    try {
      const { data, error } = await supabase
        .eq('is_active', true)
        .order('clinic_code', { ascending: true });

      if (error) throw error;

      return {
        success: true,
          clinicCode: p.clinic_code,
          isActive: p.is_active,
          generatedAt: p.generated_at,
          expiresAt: p.expires_at,
        })),
      };
    } catch (error) {
    }
  }
}

export const supabaseApi = new SupabaseApiClient();
export default supabaseApi;

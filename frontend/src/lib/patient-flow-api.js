import baseApi from './api-unified';
import { supabase } from './supabase-client';

function normalizePatientId(rawPatientId) {
  return String(rawPatientId ?? '').trim();
}

function normalizeGender(rawGender) {
  return rawGender === 'female' ? 'female' : 'male';
}

function generateTwoDigitPin() {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(1);
    crypto.getRandomValues(bytes);
    return String(10 + (bytes[0] % 90)).padStart(2, '0');
  }

  return String(Math.floor(10 + Math.random() * 90)).padStart(2, '0');
}

const api = {
  ...baseApi,

  async patientLogin(patientId, gender) {
    try {
      const normalizedPatientId = normalizePatientId(patientId);
      if (!normalizedPatientId) {
        return { success: false, error: 'PATIENT_ID_REQUIRED' };
      }

      const normalizedGender = normalizeGender(gender);
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('patient_id', normalizedPatientId)
        .single();

      if (error && error.code === 'PGRST116') {
        const { data: newUser, error: createError } = await supabase
          .from('patients')
          .insert([{ patient_id: normalizedPatientId, gender: normalizedGender, status: 'active' }])
          .select()
          .single();

        if (createError) throw createError;
        return { success: true, data: newUser };
      }

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Login Error:', error);
      return { success: false, error: error.message };
    }
  },

  async enterQueue(clinicId, patientId, isAutoEnter = true, patientName = null, examType = null) {
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc('enter_unified_queue_safe', {
        p_clinic_id: clinicId,
        p_patient_id: patientId,
        p_patient_name: patientName,
        p_exam_type: examType,
      });

      if (!rpcError && rpcResult && rpcResult.length > 0) {
        const result = rpcResult[0];
        return {
          success: true,
          id: result.id,
          display_number: result.display_number,
          status: result.status,
          alreadyExists: result.already_exists,
        };
      }

      return {
        success: false,
        error: 'ATOMIC_QUEUE_RPC_UNAVAILABLE',
        details: rpcError?.message || 'Queue RPC unavailable',
      };
    } catch (error) {
      console.error('Enter Queue Error:', error);
      return { success: false, error: error.message };
    }
  },

  async generatePIN(clinicId) {
    try {
      const pin = generateTwoDigitPin();
      const expiresAt = new Date();
      expiresAt.setHours(23, 59, 59, 999);
      const now = new Date();

      const { data, error } = await supabase
        .from('pins')
        .insert({
          clinic_id: clinicId,
          pin,
          created_at: now.toISOString(),
          valid_until: expiresAt.toISOString(),
          used_at: null,
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, pin: data.pin, expiresAt: data.valid_until };
    } catch (error) {
      console.error('Generate PIN Error:', error);
      return { success: false, error: error.message };
    }
  },

  async issuePin(clinicId) {
    try {
      const newPin = generateTwoDigitPin();
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
      console.error('[patient-flow-api] issuePin error:', error);
      return { success: false, error: error.message };
    }
  },
};

export default api;
export { api };

import api from './api-unified';
import { supabase } from './supabase-client';

const FLAG = '__doctor_login_fix__';

function normalizeDoctor(data, fallbackUsername = '') {
  if (!data || typeof data !== 'object') return null;

  const clinicId = data.clinic_id ?? data.clinicId ?? data.clinic?.id ?? null;
  const clinicName = data.clinic_name ?? data.clinicName ?? data.clinic?.name_ar ?? data.clinic?.name_en ?? null;

  return {
    ...data,
    username: data.username || fallbackUsername,
    clinic_id: clinicId,
    clinicId,
    clinic_name: clinicName,
    clinicName,
    role: data.role || 'DOCTOR',
  };
}

if (!api[FLAG]) {
  const original = api.doctorLogin?.bind(api);

  api.doctorLogin = async (username, password) => {
    const normalizedUsername = String(username || '').trim().toLowerCase();
    const result = original ? await original(normalizedUsername, password) : { success: false, error: 'doctor_login_unavailable' };

    if (result?.success && result?.data) {
      const normalized = normalizeDoctor(result.data, normalizedUsername);

      if (normalized?.clinic_id) {
        return { ...result, role: normalized.role || result.role || 'DOCTOR', data: normalized };
      }

      const { data: doctorRow } = await supabase
        .from('doctors')
        .select('id,name,username,role,clinic_id,specialty,permissions,is_active')
        .eq('username', normalizedUsername)
        .eq('is_active', true)
        .maybeSingle();

      if (doctorRow) {
        const merged = normalizeDoctor({ ...normalized, ...doctorRow }, normalizedUsername);
        return { success: true, role: merged.role || 'DOCTOR', data: merged };
      }

      return { ...result, role: normalized.role || result.role || 'DOCTOR', data: normalized };
    }

    return result;
  };

  Object.defineProperty(api, FLAG, { value: true, enumerable: false });
}

export {};

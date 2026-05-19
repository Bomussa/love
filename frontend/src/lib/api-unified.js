import { supabase } from './supabase-client';
import { initGDS } from './guaranteed-data-system';
import { getDynamicMedicalPathway } from './dynamic-pathways';

/**
 * Unified API Service - Direct Supabase Implementation
 * All patient-facing queue flows use canonical statuses only:
 * WAITING, CALLED, COMPLETED
 */

initGDS().catch((err) => console.error('❌ فشل تهيئة GDS:', err));

const CANONICAL_QUEUE_STATUSES = new Set(['waiting', 'called', 'completed']);

function normalizeQueueStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'done' || value === 'completed') return 'completed';
  if (value === 'serving' || value === 'in_progress' || value === 'in-progress') return 'called';
  if (value === 'called') return 'called';
  if (value === 'waiting') return 'waiting';
  return value;
}

function normalizeQueueRow(row) {
  if (!row) return row;
  return { ...row, status: normalizeQueueStatus(row.status) };
}

function qatarDateTime() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
}

function qatarDate() {
  return qatarDateTime().split('T')[0];
}

const api = {
  async patientLogin(patientId, gender) {
    try {
      // استخدام RPC لتسجيل الدخول بشكل آمن وذري
      const { data, error } = await supabase.rpc('patient_login_safe', {
        p_personal_id: patientId,
        p_gender: gender || 'male'
      });

      if (error) throw error;

      return {
        success: true,
        data: { 
          ...data, 
          patient_id: data.patient_id || data.personal_id || patientId,
          personal_id: patientId 
        },
      };
    } catch (error) {
      console.error('Login Error:', error);
      // Fallback to direct insert if RPC fails (backward compatibility)
      try {
        const { data, error: fetchError } = await supabase
          .from('patients')
          .select('*')
          .eq('personal_id', patientId)
          .single();

        if (fetchError && fetchError.code === 'PGRST116') {
          const { data: newUser, error: createError } = await supabase
            .from('patients')
            .insert([{ personal_id: patientId, gender: gender || 'male', status: 'active', name: `Patient ${patientId}` }])
            .select()
            .single();
          if (createError) throw createError;
          return { success: true, data: newUser };
        }
        if (fetchError) throw fetchError;
        return { success: true, data };
      } catch (fallbackError) {
        return { success: false, error: fallbackError.message };
      }
    }
  },

  getQatarDate() {
    return qatarDate();
  },

  async enterQueue(clinicId, patientId, isAutoEnter = true, patientName = null, examType = null, gender = null, militaryId = null, personalId = null) {
    try {
      // استخدام RPC القوي الذي يدعم Concurrency Lock (pg_advisory_xact_lock)
      const { data: rpcResult, error: rpcError } = await supabase.rpc('enter_queue_safe_v2', {
        p_clinic_id: clinicId,
        p_patient_id: patientId,
        p_patient_name: patientName || patientId,
        p_exam_type: examType || 'general',
        p_gender: gender || 'male',
        p_military_id: militaryId || null,
        p_personal_id: personalId || patientId,
      });

      if (rpcError) {
        console.error('enter_queue_safe_v2 RPC error:', rpcError.message);
        // محاولة استخدام النسخة القديمة إذا لم تتوفر الجديدة
        const { data: oldRpcResult, error: oldRpcError } = await supabase.rpc('enter_queue_safe', {
          p_clinic_id: clinicId,
          p_patient_id: patientId,
          p_patient_name: patientName || patientId,
          p_exam_type: examType || 'general',
          p_gender: gender || 'male',
          p_military_id: militaryId || null,
          p_personal_id: personalId || patientId,
        });
        if (oldRpcError) throw oldRpcError;
        return { success: true, ...oldRpcResult };
      }

      return {
        success: true,
        ...rpcResult,
        display_number: rpcResult.display_number || rpcResult.number,
        alreadyExists: rpcResult.status === 'ALREADY_IN_QUEUE',
      };
    } catch (error) {
      console.error('enterQueue exception:', error);
      return { success: false, error: error.message };
    }
  },

  async getQueuePosition(clinicId, patientId) {
    try {
      const today = qatarDate();
      const { data: patientEntry, error: entryError } = await supabase
        .from('unified_queue')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .eq('queue_date', today)
        .order('entered_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (entryError) throw entryError;
      if (!patientEntry) return { success: false, error: 'لم يتم العثور على المراجع في الطابور' };

      const normalizedPatientEntry = normalizeQueueRow(patientEntry);

      let currentNumber = 0;
      const { data: servingEntry } = await supabase
        .from('unified_queue')
        .select('display_number,status,called_at,completed_at')
        .eq('clinic_id', clinicId)
        .eq('queue_date', today)
        .in('status', ['called', 'in_progress', 'serving'])
        .order('called_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (servingEntry) {
        currentNumber = servingEntry.display_number;
      } else {
        const { data: lastCompleted } = await supabase
          .from('unified_queue')
          .select('display_number')
          .eq('clinic_id', clinicId)
          .eq('queue_date', today)
          .in('status', ['completed', 'done'])
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastCompleted) currentNumber = lastCompleted.display_number;
      }

      const { count, error: countError } = await supabase
        .from('unified_queue')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)
        .eq('queue_date', today)
        .eq('status', 'waiting')
        .lt('entered_at', normalizedPatientEntry.entered_at);

      if (countError) throw countError;

      return {
        success: true,
        display_number: normalizedPatientEntry.display_number,
        current_number: currentNumber,
        ahead: count || 0,
        status: normalizedPatientEntry.status,
        entered_at: normalizedPatientEntry.entered_at,
      };
    } catch (error) {
      console.error('Get Position Error:', error);
      return { success: false, error: error.message };
    }
  },

  async queueDone(clinicId, patientId) {
    try {
      const now = qatarDateTime();
      const { data, error } = await supabase
        .from('unified_queue')
        .update({ status: 'completed', completed_at: now, exam_end_time: now })
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .select();

      if (error) throw error;
      return { success: true, data: (data || []).map(normalizeQueueRow) };
    } catch (error) {
      console.error('Queue Done Error:', error);
      return { success: false, error: error.message };
    }
  },

  async getSettings() {
    try {
      const { data, error } = await supabase.from('system_settings').select('*');
      if (error) throw error;
      const settings = {};
      (data || []).forEach((s) => {
        try {
          settings[s.id] = typeof s.value === 'string' ? JSON.parse(s.value) : s.value;
        } catch {
          settings[s.id] = s.value;
        }
      });
      return { success: true, settings };
    } catch (error) {
      console.error('Get Settings Error:', error);
      return { success: false, error: error.message };
    }
  },

  async getQueueCount(clinicId) {
    try {
      const today = qatarDate();
      const { count, error } = await supabase
        .from('unified_queue')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)
        .eq('queue_date', today)
        .eq('status', 'waiting');
      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Get Queue Count Error:', error);
      return 0;
    }
  },

  async getRoute(patientId) {
    try {
      const { data, error } = await supabase
        .from('patient_routes')
        .select('*')
        .eq('patient_id', patientId)
        .single();
      if (error) throw error;
      return { success: true, route: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async createRoute(patientId, examType, gender, stations) {
    try {
      const stationsData = (stations || []).map((s, index) => ({
        id: s.id,
        name: s.name || s.nameAr,
        nameAr: s.nameAr || s.name,
        floor: s.floor,
        floorCode: s.floorCode,
        order: index + 1,
      }));

      const { data, error } = await supabase
        .from('patient_routes')
        .upsert(
          {
            patient_id: patientId,
            exam_type: examType,
            gender,
            stations: stationsData,
            updated_at: qatarDateTime(),
          },
          { onConflict: 'patient_id' },
        )
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Create Route Error:', error);
      return { success: false, error: error.message };
    }
  },

  async getClinics() {
    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('id, name, name_ar, name_en, floor, is_active, exam_duration, category, gender_constraint')
        .eq('is_active', true)
        .order('name_ar', { ascending: true });

      if (error) throw error;
      return { success: true, clinics: data || [] };
    } catch (error) {
      console.error('Get Clinics Error:', error);
      return { success: false, error: error.message, clinics: [] };
    }
  },

  async verifyPin(clinicId) {
    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('id, name, name_ar, name_en')
        .eq('id', clinicId)
        .single();

      if (error || !data) {
        return { success: false, isValid: false, error: 'Clinic not found' };
      }

      return {
        success: true,
        isValid: true,
        session: {
          clinicId: data.id,
          clinicName: data.name_ar || data.name_en || data.name || clinicId,
        },
      };
    } catch (error) {
      console.error('Verify Clinic Error:', error);
      return { success: false, isValid: false, error: error.message };
    }
  },

  async getQueueStatus(clinicId) {
    try {
      const today = qatarDate();
      const { data, error } = await supabase
        .from('unified_queue')
        .select('id,display_number,patient_name,patient_id,personal_id,military_id,status,entered_at,called_at,completed_at,exam_start_time,exam_end_time,gender,exam_type,is_vip,is_priority,is_military_committee,notes,clinic_id,queue_date')
        .eq('clinic_id', clinicId)
        .eq('queue_date', today)
        .order('display_number', { ascending: true });

      if (error) throw error;
      return { success: true, queue: (data || []).map(normalizeQueueRow) };
    } catch (error) {
      console.error('Get Queue Status Error:', error);
      return { success: false, error: error.message, queue: [] };
    }
  },

  async callNextPatient(clinicId) {
    try {
      const { data: rpcResult, error } = await supabase.rpc('call_next_patient', {
        p_clinic_id: clinicId,
        p_mark_current_done: false,
      });

      if (error) throw error;

      const num = rpcResult?.data?.display_number;
      if (num) {
        return { success: true, data: rpcResult.data, ticket: rpcResult.data };
      }
      return { success: false, error: 'No patients waiting' };
    } catch (error) {
      console.error('Call Next Patient Error:', error);
      return { success: false, error: error.message };
    }
  },

  async updateQueueStatus(clinicId, patientId, status) {
    try {
      const normalizedStatus = normalizeQueueStatus(status);
      const now = qatarDateTime();
      const updateData = { status: normalizedStatus };

      if (normalizedStatus === 'completed') {
        updateData.completed_at = now;
        updateData.exam_end_time = now;
      } else if (normalizedStatus === 'called') {
        updateData.called_at = now;
      } else if (normalizedStatus === 'waiting') {
        updateData.called_at = null;
        updateData.completed_at = null;
      }

      const { data, error } = await supabase
        .from('unified_queue')
        .update(updateData)
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .select();

      if (error) throw error;
      return { success: true, data: (data || []).map(normalizeQueueRow) };
    } catch (error) {
      console.error('Update Queue Status Error:', error);
      return { success: false, error: error.message };
    }
  },

  async createQueue(patientId, examType, gender, idempotencyKey) {
    try {
      const today = qatarDate();

      const { data: existing } = await supabase
        .from('unified_queue')
        .select('*')
        .eq('patient_id', patientId)
        .eq('queue_date', today)
        .in('status', ['waiting', 'called', 'serving', 'in_progress', 'completed', 'done'])
        .maybeSingle();

      if (existing) {
        return {
          success: true,
          data: {
            queueId: existing.id,
            number: existing.display_number,
            clinicId: existing.clinic_id,
            path: [],
          },
          alreadyInQueue: true,
        };
      }

      // استخدام RPC لإنشاء الطابور بشكل ذري
      const { data: queueId, error: rpcError } = await supabase.rpc('create_queue_atomic', {
        p_patient_id: patientId,
        p_exam_type: examType,
        p_clinic_id: null, // سيتم تحديده لاحقاً أو من المسار
        p_path: [],
        p_queue_date: today
      });

      if (rpcError) throw rpcError;

      const { data: newEntry } = await supabase
        .from('unified_queue')
        .select('*')
        .eq('id', queueId)
        .single();

      return {
        success: true,
        data: {
          queueId: newEntry.id,
          number: newEntry.display_number,
          clinicId: newEntry.clinic_id,
          path: [],
        },
      };
    } catch (error) {
      console.error('Create Queue Error:', error);
      return { success: false, error: error.message };
    }
  },
};

export default api;
export { api };


import { supabase } from './supabase-client';
import { initGDS } from './guaranteed-data-system';

/**
 * Unified API Service - Direct Supabase Implementation (V2 - Excellence Standard)
 * كافة العمليات تتم مباشرة عبر سبسبيس لضمان الاستقرار والسرعة
 *
 * ✅ نظام ضمان البيانات (GDS) - بيانات حقيقية لحظية مضمونة
 * ✅ إعادة المحاولة التلقائية
 * ✅ بدون بيانات وهمية
 */

// تهيئة نظام ضمان البيانات
initGDS().catch((err) => console.error('❌ فشل تهيئة GDS:', err));

const api = {
  // --- Patients ---
  async patientLogin(patientId, gender) {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('patient_id', patientId)
        .single();

      if (error && error.code === 'PGRST116') {
        // Patient doesn't exist, create new
        const { data: newUser, error: createError } = await supabase
          .from('patients')
          .insert([{ patient_id: patientId, gender: gender || 'male', status: 'active' }])
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

  // --- Queue ---
  async enterQueue(clinicId, patientId, isAutoEnter = true, patientName = null, examType = null) {
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc('enter_queue_safe', {
        p_clinic_id: clinicId,
        p_patient_id: patientId,
        p_patient_name: patientName,
        p_exam_type: examType,
      });

      if (!rpcError && rpcResult) {
        return { success: true, ...rpcResult };
      }

      if (rpcError) {
        console.warn('RPC failed, using fallback:', rpcError.message);
      }

      const today = new Date().toISOString().split('T')[0];
      const { data: existingEntry } = await supabase
        .from('queues')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .eq('queue_date', today)
        .in('status', ['waiting', 'called', 'in_service'])
        .limit(1)
        .maybeSingle();

      if (existingEntry) {
        return { success: true, ...existingEntry, alreadyExists: true };
      }

      const { data: lastEntry } = await supabase
        .from('queues')
        .select('queue_number_int')
        .eq('clinic_id', clinicId)
        .eq('queue_date', today)
        .order('queue_number_int', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextNumber = (lastEntry ? lastEntry.queue_number_int : 0) + 1;

      const { data, error } = await supabase
        .from('queues')
        .insert([{
          clinic_id: clinicId,
          patient_id: patientId,
          patient_name: patientName,
          exam_type: examType,
          queue_number_int: nextNumber,
          display_number: nextNumber,
          queue_number: String(nextNumber),
          status: 'waiting',
          queue_date: today,
          entered_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, ...data };
    } catch (error) {
      console.error('Enter Queue Error:', error);
      return { success: false, error: error.message };
    }
  },

  async getQueuePosition(clinicId, patientId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: patientEntry, error: entryError } = await supabase
        .from('queues')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .eq('queue_date', today)
        .order('entered_at', { ascending: false })
        .limit(1)
        .single();

      if (entryError) throw entryError;

      let currentNumber = 0;
      const { data: servingEntry } = await supabase
        .from('queues')
        .select('display_number')
        .eq('clinic_id', clinicId)
        .eq('queue_date', today)
        .in('status', ['called', 'in_service'])
        .order('called_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (servingEntry) {
        currentNumber = servingEntry.display_number;
      } else {
        const { data: lastCompleted } = await supabase
          .from('queues')
          .select('display_number')
          .eq('clinic_id', clinicId)
          .eq('queue_date', today)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastCompleted) {
          currentNumber = lastCompleted.display_number;
        }
      }

      const { count, error: countError } = await supabase
        .from('queues')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)
        .eq('queue_date', today)
        .eq('status', 'waiting')
        .lt('entered_at', patientEntry.entered_at);

      if (countError) throw countError;

      return {
        success: true,
        display_number: patientEntry.display_number,
        current_number: currentNumber,
        ahead: count || 0,
        status: patientEntry.status,
      };
    } catch (error) {
      console.error('Get Position Error:', error);
      return { success: false, error: error.message };
    }
  },

  async queueDone(clinicId, patientId, pin, skipPinCheck = false) {
    try {
      if (!skipPinCheck) {
        if (!pin) {
          return { success: false, error: 'يرجى إدخال رقم PIN' };
        }

        const now = new Date().toISOString();
        const { data: validPin, error: pinError } = await supabase
          .from('pins')
          .select('*')
          .eq('clinic_id', clinicId)
          .eq('pin', pin)
          .is('used_at', null)
          .gte('valid_until', now)
          .maybeSingle();

        if (pinError || !validPin) {
          return { success: false, error: 'رقم PIN غير صحيح أو منتهي الصلاحية' };
        }

        await supabase
          .from('pins')
          .update({ used_at: now })
          .eq('id', validPin.id);
      }

      const { data, error } = await supabase
        .from('queues')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .select();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Queue Done Error:', error);
      return { success: false, error: error.message };
    }
  },

  // --- Settings ---
  async getSettings() {
    try {
      const { data, error } = await supabase.from('system_settings').select('*');
      if (error) throw error;
      const settings = {};
      data.forEach(s => {
        try {
          settings[s.id] = JSON.parse(s.value);
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

  // --- PINs ---
  async getPinStatus() {
    try {
      const { data, error } = await supabase.from('pins').select('*').is('used_at', null);
      if (error) throw error;
      const clinics = {};
      data.forEach(p => {
        clinics[p.clinic_id || p.clinic_code] = { has_active_pin: true };
      });
      return { success: true, clinics };
    } catch (error) {
      console.error('Get Pin Status Error:', error);
      return { success: false, error: error.message };
    }
  },

  // --- Stats ---
  async getQueueCount(clinicId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { count, error } = await supabase
        .from('queues')
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
      const { data, error } = await supabase
        .from('patient_routes')
        .upsert({
          patient_id: patientId,
          exam_type: examType,
          gender: gender,
          stations: stations,
          updated_at: new Date().toISOString()
        });
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

export default api;

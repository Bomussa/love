import { supabase } from './supabase-client';

/**
 * Unified API Service - Direct Supabase Implementation
 * كافة العمليات تتم مباشرة عبر سبسبيس لضمان الاستقرار والسرعة
 */

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
  async enterQueue(clinicId, patientId, isAutoEnter = true) {
    try {
      // Get next display number
      const { data: lastEntry, error: lastError } = await supabase
        .from('queues')
        .select('display_number')
        .eq('clinic_id', clinicId)
        .order('display_number', { ascending: false })
        .limit(1);

      const nextNumber = (lastEntry && lastEntry.length > 0 ? lastEntry[0].display_number : 0) + 1;

      const { data, error } = await supabase
        .from('queues')
        .insert([{
          clinic_id: clinicId,
          patient_id: patientId,
          display_number: nextNumber,
          status: 'waiting',
          entered_at: new Date().toISOString()
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
      const { data: patientEntry, error: entryError } = await supabase
        .from('queues')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .order('entered_at', { ascending: false })
        .limit(1)
        .single();

      if (entryError) throw entryError;

      const { count, error: countError } = await supabase
        .from('queues')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)
        .eq('status', 'waiting')
        .lt('entered_at', patientEntry.entered_at);

      if (countError) throw countError;

      return {
        success: true,
        display_number: patientEntry.display_number,
        ahead: count || 0,
        status: patientEntry.status,
        entered_at: patientEntry.entered_at
      };
    } catch (error) {
      console.error('Get Position Error:', error);
      return { success: false, error: error.message };
    }
  },

  async updateQueueStatus(clinicId, patientId, newStatus) {
    try {
      const updateData = { status: newStatus };
      if (newStatus === 'serving') {
        updateData.called_at = new Date().toISOString();
      } else if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('queues')
        .update(updateData)
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .order('entered_at', { ascending: false })
        .limit(1)
        .select();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Update Queue Status Error:', error);
      return { success: false, error: error.message };
    }
  },

  async queueDone(clinicId, patientId, pin) {
    try {
      const { data, error } = await supabase
        .from('queues')
        .update({ 
          status: 'completed', 
          completed_at: new Date().toISOString() 
        })
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .eq('status', 'serving')
        .select();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async callNextPatient(clinicId, pin) {
    try {
      // 1. Complete current
      await supabase
        .from('queues')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('clinic_id', clinicId)
        .eq('status', 'serving');

      // 2. Get next
      const { data: next, error: nextError } = await supabase
        .from('queues')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('status', 'waiting')
        .order('entered_at', { ascending: true })
        .limit(1)
        .single();

      if (nextError) throw nextError;

      // 3. Update to serving
      const { data: updated, error: updateError } = await supabase
        .from('queues')
        .update({ status: 'serving', called_at: new Date().toISOString() })
        .eq('id', next.id)
        .select()
        .single();

      if (updateError) throw updateError;
      return { success: true, data: updated };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // --- Clinics & PIN ---
  async getPinStatus() {
    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('id, pin_code, pin_expires_at, is_active')
        .eq('is_active', true);

      if (error) throw error;

      // تحويل البيانات إلى صيغة { clinic_id: pin_code }
      const pins = {};
      if (data && data.length > 0) {
        data.forEach(clinic => {
          // التحقق من صلاحية البن كود
          const isExpired = clinic.pin_expires_at && new Date(clinic.pin_expires_at) < new Date();
          if (!isExpired && clinic.pin_code) {
            pins[clinic.id] = clinic.pin_code;
          }
        });
      }

      return { success: true, pins };
    } catch (error) {
      console.error('Get PIN Status Error:', error);
      return { success: false, error: error.message, pins: {} };
    }
  },

  async verifyPin(clinicId, pin) {
    // التحقق من البن كود عبر RPC أو منطق محلي إذا كان ثابتاً
    return { success: true, isValid: pin === "1234" };
  },

  async getClinics() {
    const { data, error } = await supabase.from('clinics').select('*').eq('is_active', true);
    return { success: !error, data, error };
  },

  // --- Pathway ---
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
          created_at: new Date().toISOString()
        });
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

export default api;
export { api };

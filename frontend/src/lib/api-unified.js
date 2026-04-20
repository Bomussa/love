
import { supabase } from './supabase-client';
import { initGDS } from './guaranteed-data-system';
import { getDynamicMedicalPathway } from './dynamic-pathways';

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
      // Backend uses personal_id in patients table, frontend uses patient_id
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('personal_id', patientId)
        .single();

      if (error && error.code === 'PGRST116') {
        // Patient doesn't exist, create new
        const { data: newUser, error: createError } = await supabase
          .from('patients')
          .insert([{ personal_id: patientId, gender: gender || 'male', status: 'active', name: `Patient ${patientId}` }])
          .select()
          .single();

        if (createError) throw createError;
        return { success: true, data: newUser };
      }

      if (error) throw error;
      // تحديث الجنس دائماً إذا تغيّر — يُصحح مشكلة عرض الجنس القديم
      if (data && gender && data.gender !== gender) {
        await supabase.from('patients')
          .update({ gender, updated_at: new Date().toISOString() })
          .eq('personal_id', patientId).catch(() => {});
      }
      const patId = data?.patient_id || data?.personal_id || patientId;
      return {
        success: true,
        data: { ...data, gender: gender || data.gender || 'male', patient_id: patId, personal_id: patientId }
      };
    } catch (error) {
      console.error('Login Error:', error);
      return { success: false, error: error.message };
    }
  },

  // ═══ helper: تاريخ قطر الصحيح (UTC+3) — يطابق qatar_today() في Supabase ═══
  getQatarDate() {
    return new Date(Date.now() + 3*60*60*1000).toISOString().split('T')[0];
  },

  // --- Queue ---
  async enterQueue(clinicId, patientId, isAutoEnter = true, patientName = null, examType = null, gender = null, militaryId = null, personalId = null) {
    try {
      // المصدر الوحيد: enter_queue_safe RPC — لا fallback يتجاوز الحمايات
      const { data: rpcResult, error: rpcError } = await supabase.rpc('enter_queue_safe', {
        p_clinic_id:    clinicId,
        p_patient_id:   patientId,
        p_patient_name: patientName || patientId,
        p_exam_type:    examType   || 'general',
        p_gender:       gender     || 'male',
        p_military_id:  militaryId || null,
        p_personal_id:  personalId || patientId,
      });

      if (rpcError) {
        console.error('enter_queue_safe RPC error:', rpcError.message);
        return { success: false, error: rpcError.message };
      }

      if (!rpcResult) {
        return { success: false, error: 'لا توجد استجابة من قاعدة البيانات' };
      }

      // الحالات المقبولة
      const accepted = ['OK','ALREADY_IN_QUEUE','COMPLETED_BEFORE'];
      if (!accepted.includes(rpcResult.status) && !rpcResult.success) {
        // أخطاء الحماية (عيادتين / حد يومي)
        return {
          success: false,
          error: rpcResult.error || rpcResult.status,
          status: rpcResult.status,
          active_clinic_id: rpcResult.active_clinic_id
        };
      }

      return {
        success: true,
        ...rpcResult,
        display_number: rpcResult.display_number || rpcResult.number,
        alreadyExists:  rpcResult.status === 'ALREADY_IN_QUEUE'
      };
    } catch (error) {
      console.error('enterQueue exception:', error);
      return { success: false, error: error.message };
    }
  },

  async getQueuePosition(clinicId, patientId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: patientEntry, error: entryError } = await supabase
        .from('unified_queue')
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
        .from('unified_queue')
        .select('display_number')
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
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastCompleted) {
          currentNumber = lastCompleted.display_number;
        }
      }

      const { count, error: countError } = await supabase
        .from('unified_queue')
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

  async queueDone(clinicId, patientId) {
    try {
      // PIN check removed - no authentication required for completing queue
      const { data, error } = await supabase
        .from('unified_queue')
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

  // --- Stats ---
  async getQueueCount(clinicId) {
    try {
      const today = new Date().toISOString().split('T')[0];
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
      // تحويل المحطات إلى الشكل الصحيح
      const stationsData = stations.map((s, index) => ({
        id: s.id,
        name: s.name || s.nameAr,
        nameAr: s.nameAr || s.name,
        floor: s.floor,
        floorCode: s.floorCode,
        order: index + 1,
      }));

      // استخدام upsert مع onConflict للpatient_id
      const { data, error } = await supabase
        .from('patient_routes')
        .upsert({
          patient_id: patientId,
          exam_type: examType,
          gender: gender,
          stations: stationsData,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'patient_id'
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Create Route Error:', error);
      return { success: false, error: error.message };
    }
  },

  // --- Clinics ---
  async getClinics() {
    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('id, name, name_ar, name_en, floor, pin_required')
        .order('display_order', { ascending: true });

      if (error) throw error;
      return { success: true, clinics: data || [] };
    } catch (error) {
      console.error('Get Clinics Error:', error);
      return { success: false, error: error.message, clinics: [] };
    }
  },

  async verifyPin(clinicId, pin) {
    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('id, name, name_ar, name_en, pin')
        .eq('id', clinicId)
        .single();

      if (error) {
        return { success: false, isValid: false, error: 'Clinic not found' };
      }

      if (data.pin && data.pin === pin) {
        return {
          success: true,
          isValid: true,
          session: {
            clinicId: data.id,
            clinicName: data.name_ar || data.name,
            pin: pin
          }
        };
      }

      return { success: false, isValid: false, error: 'Invalid PIN' };
    } catch (error) {
      console.error('Verify PIN Error:', error);
      return { success: false, isValid: false, error: error.message };
    }
  },

  // --- Queue Status ---
  async getQueueStatus(clinicId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('unified_queue')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('queue_date', today)
        .order('display_number', { ascending: true });

      if (error) throw error;
      return { success: true, queue: data || [] };
    } catch (error) {
      console.error('Get Queue Status Error:', error);
      return { success: false, error: error.message, queue: [] };
    }
  },

  async callNextPatient(clinicId, pin) {
    try {
      // Verify PIN first
      const pinCheck = await this.verifyPin(clinicId, pin);
      if (!pinCheck.isValid) {
        return { success: false, error: 'Invalid PIN' };
      }

      const today = new Date().toISOString().split('T')[0];

      // Find next waiting patient
      const { data: nextPatient, error: findError } = await supabase
        .from('unified_queue')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('queue_date', today)
        .eq('status', 'waiting')
        .order('display_number', { ascending: true })
        .limit(1)
        .single();

      if (findError && findError.code !== 'PGRST116') {
        return { success: false, error: findError.message };
      }

      if (!nextPatient) {
        return { success: false, error: 'No patients in queue' };
      }

      // Update to called status
      const { data, error } = await supabase
        .from('unified_queue')
        .update({ status: 'called', called_at: new Date().toISOString() })
        .eq('id', nextPatient.id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data, ticket: nextPatient };
    } catch (error) {
      console.error('Call Next Patient Error:', error);
      return { success: false, error: error.message };
    }
  },

  async updateQueueStatus(clinicId, patientId, status) {
    try {
      const updateData = { status };
      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      } else if (status === 'called' || status === 'no_show') {
        updateData.called_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('unified_queue')
        .update(updateData)
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .select();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Update Queue Status Error:', error);
      return { success: false, error: error.message };
    }
  },

  // --- Create Queue (Fixed for App.jsx compatibility) ---
  async createQueue(patientId, examType, gender, idempotencyKey) {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Check if already in queue today
      const { data: existing } = await supabase
        .from('unified_queue')
        .select('*')
        .eq('patient_id', patientId)
        .eq('queue_date', today)
        .in('status', ['waiting', 'called', 'serving', 'in_progress'])
        .maybeSingle();

      if (existing) {
        return {
          success: true,
          data: {
            queueId: existing.id,
            number: existing.display_number,
            clinicId: existing.clinic_id,
            path: []
          },
          alreadyInQueue: true
        };
      }

      // Get next display number
      const { data: lastEntry } = await supabase
        .from('unified_queue')
        .select('display_number')
        .eq('queue_date', today)
        .order('display_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextNumber = (lastEntry?.display_number || 0) + 1;

      // Get dynamic pathway for the patient
      let pathway = [];
      let firstClinicId = null;
      try {
        pathway = await getDynamicMedicalPathway(examType, gender);
        if (pathway && pathway.length > 0) {
          firstClinicId = pathway[0].id || null;
        }
      } catch (pathErr) {
        console.warn('Dynamic pathway error, continuing without route:', pathErr);
      }

      // Insert into unified_queue with first clinic
      const insertData = {
        patient_id: patientId,
        exam_type: examType,
        gender: gender,
        display_number: nextNumber,
        status: 'waiting',
        queue_date: today,
        entered_at: new Date().toISOString()
      };
      if (firstClinicId) {
        insertData.clinic_id = firstClinicId;
      }

      const { data, error } = await supabase
        .from('unified_queue')
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;
      return {
        success: true,
        data: {
          queueId: data.id,
          number: data.display_number,
          clinicId: firstClinicId,
          path: pathway
        }
      };
    } catch (error) {
      console.error('Create Queue Error:', error);
      return { success: false, error: error.message };
    }
  },

  // --- Doctor Login --- (يستخدم doctor_login RPC SECURITY DEFINER — حساسية حالة الأحرف مُعطَّلة)
  async doctorLogin(username, password) {
    try {
      const { data: result, error } = await supabase.rpc('doctor_login', {
        p_username: username,   // الـ RPC يطبق LOWER() تلقائياً في DB
        p_password: password,
      });
      if (error) throw error;
      if (result?.success && result?.data) {
        return { success: true, role: result.data.role || 'DOCTOR', data: result.data };
      }
      return { success: false, message: result?.message || 'بيانات الدخول غير صحيحة' };
    } catch (error) {
      console.error('Doctor Login RPC Error:', error);
      return { success: false, error: error.message };
    }
  },

  // --- Admin Login (Fixed) ---
  async adminLogin(username, password) {
    try {
      // Super admin check
      if (username === 'Bomussa' && password === '14490') {
        return {
          success: true,
          role: 'SUPER_ADMIN',
          data: { id: 'super_admin', username: 'Bomussa', role: 'SUPER_ADMIN' }
        };
      }

      // Try doctors table
      const { data: doctor, error: docError } = await supabase
        .from('doctors')
        .select('*')
        .eq('username', username.toLowerCase())
        .eq('is_active', true)
        .maybeSingle();

      if (doctor) {
        // Check password_hash if available, fallback to plain password
        const passwordMatch = doctor.password_hash 
          ? doctor.password_hash === password || doctor.password_hash === await (async () => {
              const encoder = new TextEncoder();
              const data = encoder.encode(password);
              const hash = await crypto.subtle.digest('SHA-256', data);
              return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
            })()
          : doctor.password === password;
        
        if (passwordMatch) {
          return { success: true, role: doctor.role || 'DOCTOR', data: doctor };
        }
      }

      return { success: false, message: 'Invalid credentials' };
    } catch (error) {
      console.error('Admin Login Error:', error);
      return { success: false, error: error.message };
    }
  }
};

export default api;

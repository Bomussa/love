/**
 * Supabase API Client - Frontend Library
 * Updated: Direct Supabase connection for PIN logic
 * Table: pins (clinic_code, pin, is_active, expires_at)
 */
import { supabase } from './supabase-client'

class SupabaseApiClient {
    constructor() {
        this.cache = new Map()
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
                allPins: allToday ? allToday.map(p => p.pin) : [],
                dateKey: today.toLocaleDateString()
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
            const expiresAt = new Date(now);
            expiresAt.setHours(23, 59, 59, 999);
            
            // تعطيل جميع الـ PINs السابقة لهذه العيادة
            await supabase
                .from('pins')
                .update({ is_active: false })
                .eq('clinic_code', clinicId);

            // إضافة PIN جديد
            const { data, error } = await supabase
                .from('pins')
                .insert([{
                    clinic_code: clinicId,
                    pin: newPin,
                    is_active: true,
                    generated_at: now.toISOString(),
                    expires_at: expiresAt.toISOString()
                }])
                .select()
                .single();

            if (error) throw error;

            return {
                success: true,
                currentPin: data.pin,
                pinId: data.id,
                message: 'تم توليد رمز PIN جديد بنجاح'
            };
        } catch (error) {
            console.error('[supabase-api] issuePin error:', error);
            throw error;
        }
    }

    async verifyPin(clinicId, pin) {
        try {
            const { data, error } = await supabase
                .from('pins')
                .select('id, clinic_code, pin, is_active, expires_at')
                .eq('clinic_code', clinicId)
                .eq('pin', pin)
                .eq('is_active', true)
                .limit(1)
                .maybeSingle();

            if (error) throw error;

            // التحقق من صلاحية الـ PIN
            const isValid = data && data.is_active && 
                           (!data.expires_at || new Date(data.expires_at) > new Date());

            return {
                success: true,
                valid: isValid,
                message: isValid ? 'رمز PIN صحيح' : 'رمز PIN غير صحيح أو منتهي الصلاحية'
            };
        } catch (error) {
            console.error('[supabase-api] verifyPin error:', error);
            return { success: false, valid: false, error: error.message };
        }
    }

    async getAllPins() {
        try {
            const { data, error } = await supabase
                .from('pins')
                .select('id, clinic_code, pin, is_active, generated_at, expires_at')
                .eq('is_active', true)
                .order('clinic_code', { ascending: true });

            if (error) throw error;

            return {
                success: true,
                pins: data.map(p => ({
                    pinId: p.id,
                    currentPin: p.pin,
                    clinicCode: p.clinic_code,
                    isActive: p.is_active,
                    generatedAt: p.generated_at,
                    expiresAt: p.expires_at
                }))
            };
        } catch (error) {
            console.error('[supabase-api] getAllPins error:', error);
            return { success: false, pins: [], error: error.message };
        }
    }

    // ==================== Queue Management ====================

    /**
     * Get or create queue entry for a patient in a clinic
     * @param {string} patientId - Patient ID (military or personal number)
     * @param {string} clinicId - Clinic ID
     * @param {string} patientName - Patient name
     * @param {string} examType - Exam type
     * @returns {Promise<Object>} Queue entry with position
     */
    async getOrCreateQueueEntry(patientId, clinicId, patientName, examType) {
        try {
            // Check if patient already has an active queue entry for this clinic
            const { data: existing, error: existingError } = await supabase
                .from('queue')
                .select('*')
                .eq('patient_id', patientId)
                .eq('clinic_id', clinicId)
                .in('status', ['waiting', 'called'])
                .maybeSingle();

            if (existingError && existingError.code !== 'PGRST116') {
                throw existingError;
            }

            // If exists, return it
            if (existing) {
                return {
                    success: true,
                    queueEntry: existing,
                    isNew: false
                };
            }

            // Get the last position in this clinic
            const { data: lastEntry, error: lastError } = await supabase
                .from('queue')
                .select('position')
                .eq('clinic_id', clinicId)
                .order('position', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (lastError && lastError.code !== 'PGRST116') {
                throw lastError;
            }

            const nextPosition = (lastEntry?.position || 0) + 1;

            // Create new queue entry
            const { data: newEntry, error: insertError } = await supabase
                .from('queue')
                .insert({
                    patient_id: patientId,
                    patient_name: patientName || patientId,
                    clinic_id: clinicId,
                    exam_type: examType,
                    position: nextPosition,
                    status: 'waiting',
                    entered_at: new Date().toISOString()
                })
                .select()
                .single();

            if (insertError) throw insertError;

            return {
                success: true,
                queueEntry: newEntry,
                isNew: true
            };
        } catch (error) {
            console.error('[supabase-api] getOrCreateQueueEntry error:', error);
            throw error;
        }
    }

    /**
     * Get queue entry for a patient
     * @param {string} patientId - Patient ID
     * @param {string} clinicId - Clinic ID
     * @returns {Promise<Object|null>} Queue entry or null
     */
    async getQueueEntry(patientId, clinicId) {
        try {
            const { data, error } = await supabase
                .from('queue')
                .select('*')
                .eq('patient_id', patientId)
                .eq('clinic_id', clinicId)
                .in('status', ['waiting', 'called'])
                .maybeSingle();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            return data;
        } catch (error) {
            console.error('[supabase-api] getQueueEntry error:', error);
            return null;
        }
    }

    /**
     * Get queue status for a clinic
     * @param {string} clinicId - Clinic ID
     * @returns {Promise<Object>} Queue status with counts
     */
    async getQueueStatus(clinicId) {
        try {
            // Get waiting count
            const { count: waitingCount, error: waitingError } = await supabase
                .from('queue')
                .select('*', { count: 'exact', head: true })
                .eq('clinic_id', clinicId)
                .eq('status', 'waiting');

            if (waitingError) throw waitingError;

            // Get current (called) patient
            const { data: currentPatient, error: currentError } = await supabase
                .from('queue')
                .select('*')
                .eq('clinic_id', clinicId)
                .eq('status', 'called')
                .order('called_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (currentError && currentError.code !== 'PGRST116') {
                throw currentError;
            }

            return {
                success: true,
                clinicId,
                waiting: waitingCount || 0,
                current: currentPatient ? currentPatient.position : 0,
                currentPatient: currentPatient
            };
        } catch (error) {
            console.error('[supabase-api] getQueueStatus error:', error);
            throw error;
        }
    }

    /**
     * Get patient position in queue
     * @param {string} patientId - Patient ID
     * @param {string} clinicId - Clinic ID
     * @returns {Promise<Object>} Position info
     */
    async getPatientPosition(patientId, clinicId) {
        try {
            const entry = await this.getQueueEntry(patientId, clinicId);
            
            if (!entry) {
                return {
                    success: false,
                    found: false,
                    message: 'لم يتم العثور على المريض في الطابور'
                };
            }

            // Count patients ahead
            const { count: ahead, error: aheadError } = await supabase
                .from('queue')
                .select('*', { count: 'exact', head: true })
                .eq('clinic_id', clinicId)
                .eq('status', 'waiting')
                .lt('position', entry.position);

            if (aheadError) throw aheadError;

            return {
                success: true,
                found: true,
                position: entry.position,
                ahead: ahead || 0,
                status: entry.status,
                enteredAt: entry.entered_at
            };
        } catch (error) {
            console.error('[supabase-api] getPatientPosition error:', error);
            throw error;
        }
    }

    /**
     * Calculate clinic weights based on queue load
     * @param {Array<string>} clinicIds - Array of clinic IDs
     * @returns {Promise<Array>} Sorted clinics by weight (least busy first)
     */
    async calculateClinicWeights(clinicIds) {
        try {
            const weights = [];

            for (const clinicId of clinicIds) {
                const { count, error } = await supabase
                    .from('queue')
                    .select('*', { count: 'exact', head: true })
                    .eq('clinic_id', clinicId)
                    .eq('status', 'waiting');

                if (error) throw error;

                // Weight calculation: higher weight = less busy
                const waitingCount = count || 0;
                const weight = 100 - waitingCount;

                weights.push({
                    clinicId,
                    weight,
                    waitingCount
                });
            }

            // Sort by weight descending (least busy first)
            weights.sort((a, b) => b.weight - a.weight);

            return weights;
        } catch (error) {
            console.error('[supabase-api] calculateClinicWeights error:', error);
            throw error;
        }
    }
}

export const supabaseApi = new SupabaseApiClient()
export default supabaseApi

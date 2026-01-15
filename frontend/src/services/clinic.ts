import { supabase } from '../lib/supabase';
import clinics from '../../config/clinics.json';

export interface Clinic {
  id: string;
  name: string;
  floor: string;
  pinCode: string;
  weight: number;
}

export interface QueueStatus {
  clinicId: string;
  clinicName: string;
  currentNumber: number | null;
  waitingCount: number;
  status: 'open' | 'closed' | 'busy';
  floor: string;
  pinCode: string;
}

/**
 * الحصول على قائمة جميع العيادات مع PIN Code
 */
export function getAllClinics(): Clinic[] {
  return Object.values(clinics) as Clinic[];
}

/**
 * الحصول على عيادة محددة بواسطة ID
 */
export function getClinicById(id: string): Clinic | null {
  return (clinics as Record<string, Clinic>)[id] || null;
}

/**
 * التحقق من صحة PIN Code للعيادة
 */
export function verifyClinicPinCode(clinicId: string, pinCode: string): boolean {
  const clinic = getClinicById(clinicId);
  return clinic ? clinic.pinCode === pinCode : false;
}

/**
 * الحصول على حالة الطابور لعيادة محددة
 */
export async function getClinicQueueStatus(clinicId: string): Promise<QueueStatus | null> {
  const clinic = getClinicById(clinicId);
  if (!clinic) return null;

  try {
    const { data, error } = await supabase
      .from('queue_status')
      .select('current_number, waiting_count, status')
      .eq('clinic_id', clinicId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    return {
      clinicId: clinic.id,
      clinicName: clinic.name,
      currentNumber: data?.current_number || null,
      waitingCount: data?.waiting_count || 0,
      status: data?.status || 'open',
      floor: clinic.floor,
      pinCode: clinic.pinCode,
    };
  } catch (err) {
    console.error('Error fetching queue status:', err);
    return {
      clinicId: clinic.id,
      clinicName: clinic.name,
      currentNumber: null,
      waitingCount: 0,
      status: 'open',
      floor: clinic.floor,
      pinCode: clinic.pinCode,
    };
  }
}

/**
 * الحصول على حالة جميع العيادات
 */
export async function getAllClinicsQueueStatus(): Promise<QueueStatus[]> {
  const allClinics = getAllClinics();
  const statuses = await Promise.all(
    allClinics.map(clinic => getClinicQueueStatus(clinic.id))
  );
  return statuses.filter((s): s is QueueStatus => s !== null);
}

/**
 * تحديث حالة العيادة بعد إدخال PIN Code
 */
export async function completePatientInClinic(
  clinicId: string,
  patientId: string
): Promise<boolean> {
  try {
    // تحديث حالة المريض - تم الانتهاء
    const { error: updateError } = await supabase
      .from('patient_visits')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('patient_id', patientId)
      .eq('clinic_id', clinicId)
      .eq('status', 'in_progress');

    if (updateError) throw updateError;

    // الحصول على المريض التالي في الطابور
    const { data: nextPatient, error: fetchError } = await supabase
      .from('patient_visits')
      .select('patient_id, patient_number')
      .eq('clinic_id', clinicId)
      .eq('status', 'waiting')
      .order('patient_number', { ascending: true })
      .limit(1)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

    // تحديث حالة المريض التالي - قيد المعالجة
    if (nextPatient) {
      const { error: nextError } = await supabase
        .from('patient_visits')
        .update({ status: 'in_progress' })
        .eq('patient_id', nextPatient.patient_id)
        .eq('clinic_id', clinicId);

      if (nextError) throw nextError;
    }

    return true;
  } catch (err) {
    console.error('Error completing patient visit:', err);
    return false;
  }
}

/**
 * الحصول على المريض الحالي في العيادة
 */
export async function getCurrentPatientInClinic(clinicId: string) {
  try {
    const { data, error } = await supabase
      .from('patient_visits')
      .select('patient_id, patient_number, patient_name')
      .eq('clinic_id', clinicId)
      .eq('status', 'in_progress')
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (err) {
    console.error('Error fetching current patient:', err);
    return null;
  }
}

/**
 * الحصول على قائمة انتظار العيادة
 */
export async function getClinicWaitingList(clinicId: string) {
  try {
    const { data, error } = await supabase
      .from('patient_visits')
      .select('patient_id, patient_number, patient_name, status')
      .eq('clinic_id', clinicId)
      .in('status', ['waiting', 'in_progress'])
      .order('patient_number', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching waiting list:', err);
    return [];
  }
}

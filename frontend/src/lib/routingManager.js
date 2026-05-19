// lib/routingManager.js - مدير التوجيه الديناميكي مع الأوزان والسعة
import { supabase } from './supabase-client.js';
import { getSystemConfig } from './settings.js';

async function fetchClinicLoadMap(clinicIds) {
  const { data, error } = await supabase
    .from('clinic_load')
    .select('clinic_id, current_called, current_in, distributed_today, total_served_today, efficiency_score, updated_at')
    .in('clinic_id', clinicIds);

  if (error) throw error;

  return new Map((data || []).map((row) => [row.clinic_id, row]));
}

export async function pickClinicForNextStep(examType, gender, currentStep = 1) {
  try {
    const { data: routeRows, error: routeError } = await supabase
      .from('exam_route_templates')
      .select('step_order, estimated_duration_minutes, clinic:clinics!inner(id, name, capacity, status)')
      .eq('exam_type', examType)
      .eq('gender', gender)
      .eq('step_order', currentStep)
      .eq('clinics.status', 'open');

    if (routeError) throw routeError;

    const availableClinics = (routeRows || []).map((row) => ({
      id: row.clinic.id,
      name: row.clinic.name,
      capacity: row.clinic.capacity,
      estimated_duration_minutes: row.estimated_duration_minutes,
    }));

    if (availableClinics.length === 0) return null;

    const clinicIds = availableClinics.map((c) => c.id);
    const loadMap = await fetchClinicLoadMap(clinicIds);
    const maxDistributed = Math.max(...Array.from(loadMap.values()).map((l) => l.distributed_today || 0), 1);

    const scoredClinics = availableClinics.map((clinic) => {
      const loadInfo = loadMap.get(clinic.id) || {};
      const currentLoad = (loadInfo.current_called || 0) + (loadInfo.current_in || 0);
      const distributedToday = loadInfo.distributed_today || 0;
      const capacity = clinic.capacity || 6;
      const loadRatio = currentLoad / capacity;
      const efficiencyScore = parseFloat(loadInfo.efficiency_score ?? 1);

      const score = (loadRatio * 0.7) + ((distributedToday / maxDistributed) * 0.2) + ((1 - efficiencyScore) * 0.1);

      return {
        id: clinic.id,
        name: clinic.name,
        loadRatio,
        distributedToday,
        capacity,
        currentLoad,
        efficiencyScore,
        score,
      };
    });

    scoredClinics.sort((a, b) => {
      if (a.currentLoad >= a.capacity && b.currentLoad < b.capacity) return 1;
      if (b.currentLoad >= b.capacity && a.currentLoad < a.capacity) return -1;
      return a.score - b.score;
    });

    return scoredClinics[0]?.id || null;
  } catch {
    return null;
  }
}

export async function markDistributed(clinicId) {
  try {
    const now = new Date().toISOString();
    const today = new Date().toISOString().slice(0, 10);

    const { data: existing, error: loadReadError } = await supabase
      .from('clinic_load')
      .select('distributed_today')
      .eq('clinic_id', clinicId)
      .maybeSingle();
    if (loadReadError) throw loadReadError;

    const { error: loadWriteError } = await supabase
      .from('clinic_load')
      .upsert({
        clinic_id: clinicId,
        current_called: 0,
        current_in: 0,
        distributed_today: (existing?.distributed_today || 0) + 1,
        updated_at: now,
      }, { onConflict: 'clinic_id' });
    if (loadWriteError) throw loadWriteError;

    const { data: statExisting, error: statReadError } = await supabase
      .from('daily_clinic_stats')
      .select('total_patients')
      .eq('clinic_id', clinicId)
      .eq('date', today)
      .maybeSingle();
    if (statReadError) throw statReadError;

    const { error: statWriteError } = await supabase
      .from('daily_clinic_stats')
      .upsert({
        clinic_id: clinicId,
        date: today,
        total_patients: (statExisting?.total_patients || 0) + 1,
      }, { onConflict: 'clinic_id,date' });
    if (statWriteError) throw statWriteError;

    return true;
  } catch {
    return false;
  }
}

export async function getExamRoute(examType, gender) {
  try {
    const { data, error } = await supabase
      .from('exam_route_templates')
      .select('step_order, clinic_id, is_required, estimated_duration_minutes, clinic:clinics!inner(name, floor)')
      .eq('exam_type', examType)
      .eq('gender', gender)
      .order('step_order', { ascending: true });

    if (error) throw error;

    return (data || []).map((row) => ({
      stepOrder: row.step_order,
      clinicId: row.clinic_id,
      clinicName: row.clinic.name,
      floor: row.clinic.floor,
      isRequired: row.is_required,
      estimatedDuration: row.estimated_duration_minutes,
    }));
  } catch {
    return [];
  }
}

export async function createPatientRoute(patientId, examType, gender) {
  try {
    const routeTemplate = await getExamRoute(examType, gender);
    if (routeTemplate.length === 0) return false;

    const { error: deleteError } = await supabase.from('patient_routes').delete().eq('patient_id', patientId);
    if (deleteError) throw deleteError;

    const payload = routeTemplate.map((step) => ({
      patient_id: patientId,
      exam_type: examType,
      gender,
      step_order: step.stepOrder,
      clinic_id: step.clinicId,
      status: step.stepOrder === 1 ? 'active' : 'pending',
    }));

    const { error: insertError } = await supabase.from('patient_routes').insert(payload);
    if (insertError) throw insertError;

    return true;
  } catch {
    return false;
  }
}

export async function moveToNextStep(patientId) {
  try {
    const { data: currentStepRows, error: currentError } = await supabase
      .from('patient_routes')
      .select('id, step_order, clinic_id, exam_type, gender')
      .eq('patient_id', patientId)
      .eq('status', 'active')
      .order('step_order', { ascending: true })
      .limit(1);

    if (currentError) throw currentError;
    if (!currentStepRows?.length) return null;

    const current = currentStepRows[0];
    const now = new Date().toISOString();

    const { error: doneError } = await supabase
      .from('patient_routes')
      .update({ status: 'done', completed_at: now, updated_at: now })
      .eq('id', current.id);
    if (doneError) throw doneError;

    const { data: nextRows, error: nextError } = await supabase
      .from('patient_routes')
      .select('id, step_order, clinic_id')
      .eq('patient_id', patientId)
      .eq('status', 'pending')
      .gt('step_order', current.step_order)
      .order('step_order', { ascending: true })
      .limit(1);
    if (nextError) throw nextError;

    if (!nextRows?.length) {
      await supabase.rpc('create_notification', {
        p_type: 'route_complete',
        p_patient_id: patientId,
        p_clinic_id: null,
        p_payload: {},
      });
      return { completed: true, message: 'تم إنهاء جميع الفحوصات المطلوبة' };
    }

    const next = nextRows[0];
    const { error: activateError } = await supabase
      .from('patient_routes')
      .update({ status: 'active', started_at: now, updated_at: now })
      .eq('id', next.id);
    if (activateError) throw activateError;

    const { data: clinicInfo, error: clinicError } = await supabase
      .from('clinics')
      .select('name, floor')
      .eq('id', next.clinic_id)
      .maybeSingle();
    if (clinicError) throw clinicError;

    return {
      completed: false,
      nextStep: {
        stepOrder: next.step_order,
        clinicId: next.clinic_id,
        clinicName: clinicInfo?.name,
        floor: clinicInfo?.floor,
      },
    };
  } catch {
    return null;
  }
}

export async function getPatientRouteStatus(patientId) {
  try {
    const { data, error } = await supabase
      .from('patient_routes')
      .select('step_order, clinic_id, status, started_at, completed_at, exam_type, gender, clinic:clinics!inner(name, floor)')
      .eq('patient_id', patientId)
      .order('step_order', { ascending: true });
    if (error) throw error;

    if (!data?.length) return { exists: false, steps: [] };

    const steps = data.map((row) => ({
      stepOrder: row.step_order,
      clinicId: row.clinic_id,
      clinicName: row.clinic.name,
      floor: row.clinic.floor,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at,
    }));

    const activeStep = steps.find((s) => s.status === 'active');
    const completedSteps = steps.filter((s) => s.status === 'done').length;
    const totalSteps = steps.length;

    return {
      exists: true,
      examType: data[0].exam_type,
      gender: data[0].gender,
      steps,
      activeStep,
      progress: Math.round((completedSteps / totalSteps) * 100),
      completedSteps,
      totalSteps,
      isComplete: completedSteps === totalSteps,
    };
  } catch (error) {
    return { exists: false, steps: [], error: error.message };
  }
}

export async function getDistributionStats() {
  try {
    const { data: clinics, error: clinicsError } = await supabase
      .from('clinics')
      .select('id, name, capacity, status')
      .order('name', { ascending: true });
    if (clinicsError) throw clinicsError;

    const loadMap = await fetchClinicLoadMap((clinics || []).map((c) => c.id));

    return (clinics || []).map((clinic) => {
      const load = loadMap.get(clinic.id) || {};
      const currentCalled = load.current_called || 0;
      const currentIn = load.current_in || 0;
      const capacity = clinic.capacity || 1;

      return {
        clinicId: clinic.id,
        name: clinic.name,
        capacity: clinic.capacity,
        status: clinic.status,
        currentCalled,
        currentIn,
        currentTotal: currentCalled + currentIn,
        distributedToday: load.distributed_today || 0,
        totalServedToday: load.total_served_today || 0,
        loadRatio: (currentCalled + currentIn) / capacity,
        efficiencyScore: parseFloat(load.efficiency_score ?? 1),
        lastUpdated: load.updated_at,
      };
    });
  } catch {
    return [];
  }
}

export default {
  pickClinicForNextStep,
  markDistributed,
  getExamRoute,
  createPatientRoute,
  moveToNextStep,
  getPatientRouteStatus,
  getDistributionStats,
  getSystemConfig,
};

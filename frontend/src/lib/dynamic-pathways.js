import { supabase } from './supabase-client';

const examTypeMap = {
  recruitment: 'تجنيد', promotion: 'ترفيع', transfer: 'نقل', referral: 'تحويل',
  contract: 'تجديد التعاقد', aviation: 'طيران سنوي', cooks: 'طباخين', courses: 'دورات', general: 'تجنيد',
};

function toCode(item) {
  if (!item) return null;
  if (typeof item === 'string') return item.trim() || null;
  return String(item.code || item.clinic_code || item.clinicCode || item.id || '').trim() || null;
}

function floorLabel(value) {
  const floor = String(value || '').trim();
  if (!floor) return '';
  if (floor === 'M' || floor.includes('الميزانين')) return 'الميزانين';
  if (floor.startsWith('الطابق')) return floor;
  return `الطابق ${floor}`;
}

async function routeCodesFromDb(examType) {
  if (!supabase) return [];
  const keys = [String(examType || '').trim(), examTypeMap[String(examType || '').trim()]].filter(Boolean);
  for (const key of keys) {
    const { data, error } = await supabase
      .from('routes')
      .select('clinics, is_active, order_sequence')
      .eq('exam_type', key)
      .eq('is_active', true)
      .order('order_sequence', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    const codes = Array.isArray(data?.clinics) ? data.clinics.map(toCode).filter(Boolean) : [];
    if (codes.length) return codes;
  }
  return [];
}

async function loadActiveClinics() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('clinics')
    .select('id, name, name_ar, name_en, floor, code, is_active')
    .eq('is_active', true);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function buildStations(codes) {
  const clinics = await loadActiveClinics();
  const byIdentifier = new Map();
  clinics.forEach((clinic) => {
    if (clinic?.id) byIdentifier.set(String(clinic.id), clinic);
    if (clinic?.code) byIdentifier.set(String(clinic.code), clinic);
  });

  const missing = codes.filter((code) => !byIdentifier.has(String(code)));
  if (missing.length) throw new Error(`ROUTE_CLINICS_UNRESOLVED:${missing.join(',')}`);

  return codes.map((code, index) => {
    const clinic = byIdentifier.get(String(code));
    return {
      id: clinic.id,
      code: clinic.code || code,
      name: clinic.name_en || clinic.name,
      nameAr: clinic.name_ar || clinic.name,
      floorCode: clinic.floor,
      floor: floorLabel(clinic.floor),
      order: index + 1,
      status: index === 0 ? 'ready' : 'locked',
    };
  });
}

export async function getDynamicMedicalPathway(examType, gender = 'male') {
  void gender;
  const codes = await routeCodesFromDb(examType);
  if (!codes.length) return [];
  return buildStations(codes);
}

export async function enrichStationsWithClinicData(stations) {
  if (!Array.isArray(stations) || !supabase) return stations;
  const clinics = await loadActiveClinics();
  const byIdentifier = new Map();
  clinics.forEach((clinic) => {
    if (clinic?.id) byIdentifier.set(String(clinic.id), clinic);
    if (clinic?.code) byIdentifier.set(String(clinic.code), clinic);
  });

  return stations.map((station) => {
    const clinic = byIdentifier.get(String(station.code || station.id));
    if (!clinic) return station;
    return {
      ...station,
      id: clinic.id,
      name: clinic.name_en || clinic.name,
      nameAr: clinic.name_ar || clinic.name,
      floorCode: clinic.floor,
      floor: floorLabel(clinic.floor),
    };
  });
}

export default getDynamicMedicalPathway;

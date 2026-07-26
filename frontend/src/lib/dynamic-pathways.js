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

async function clinicByCode(code) {
  if (!supabase || !code) return null;
  for (const field of ['id', 'code']) {
    const { data, error } = await supabase
      .from('clinics')
      .select('id, name, name_ar, name_en, floor, code, is_active')
      .eq(field, code)
      .eq('is_active', true)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  return null;
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

async function queueLoad(clinicId) {
  if (!supabase || !clinicId) return 0;
  const today = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { count, error } = await supabase
    .from('unified_queue')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .eq('queue_date', today)
    .in('status', ['waiting', 'called', 'in_progress', 'serving']);
  if (error) throw error;
  return Number(count || 0);
}

function floorRank(floorCode) {
  const floor = String(floorCode || '').trim();
  if (floor === 'M' || floor.includes('الميزانين')) return 1;
  if (floor === 'G' || floor.includes('الأرضي')) return 2;
  if (floor === '1' || floor.includes('الأول')) return 3;
  if (floor === '2' || floor.includes('الثاني')) return 4;
  if (floor === '3' || floor.includes('الثالث')) return 5;
  return 99;
}

async function buildStations(codes) {
  const clinics = [];
  for (const code of codes) {
    const clinic = await clinicByCode(code);
    if (!clinic) continue;
    clinics.push({
      id: clinic.id,
      code: clinic.code || code,
      name: clinic.name_en || clinic.name,
      nameAr: clinic.name_ar || clinic.name,
      floorCode: clinic.floor,
      floor: floorLabel(clinic.floor),
    });
  }
  const withLoad = await Promise.all(clinics.map(async (clinic) => ({ ...clinic, load: await queueLoad(clinic.id) })));
  return withLoad.sort((a, b) => (a.load - b.load) || (floorRank(a.floorCode) - floorRank(b.floorCode))).map((clinic, index) => ({
    id: clinic.id,
    code: clinic.code,
    name: clinic.name,
    nameAr: clinic.nameAr,
    floor: clinic.floor,
    floorCode: clinic.floorCode,
    order: index + 1,
    status: index === 0 ? 'ready' : 'locked',
  }));
}

export async function getDynamicMedicalPathway(examType, gender = 'male') {
  void gender;
  const codes = await routeCodesFromDb(examType);
  if (!codes.length) return [];
  return buildStations(codes);
}

export async function enrichStationsWithClinicData(stations) {
  if (!Array.isArray(stations) || !supabase) return stations;
  const out = [];
  for (const station of stations) {
    const clinic = await clinicByCode(station.code || station.id);
    out.push(clinic ? {
      ...station,
      id: clinic.id,
      name: clinic.name_en || clinic.name,
      nameAr: clinic.name_ar || clinic.name,
      floorCode: clinic.floor,
      floor: floorLabel(clinic.floor),
    } : station);
  }
  return out;
}

export default getDynamicMedicalPathway;
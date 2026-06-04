import { supabase } from './supabase-client';
import routeMap from '../../config/routeMap.json';

const examTypeMap = {
  recruitment: 'تجنيد', promotion: 'ترفيع', transfer: 'نقل', referral: 'تحويل',
  contract: 'تجديد التعاقد', aviation: 'طيران سنوي', cooks: 'طباخين', courses: 'دورات', general: 'تجنيد',
};

function examKey(examType, gender) {
  const key = examTypeMap[String(examType || '').trim()] || String(examType || '').trim();
  if (gender === 'female' && routeMap['نساء/عام']?.F) return 'نساء/عام';
  return key || (gender === 'female' ? 'نساء/عام' : 'تجنيد');
}

function toCode(item) {
  if (!item) return null;
  if (typeof item === 'string') return item.trim() || null;
  return String(item.code || item.clinic_code || item.clinicCode || item.id || '').trim() || null;
}

async function clinicByCode(code) {
  if (!supabase || !code) return null;
  for (const field of ['id', 'code']) {
    const { data } = await supabase.from('clinics').select('id, name, name_ar, name_en, floor, code, is_active').eq(field, code).eq('is_active', true).maybeSingle();
    if (data) return data;
  }
  return null;
}

async function routeCodesFromDb(examType) {
  if (!supabase) return [];
  const keys = [String(examType || '').trim(), examTypeMap[String(examType || '').trim()]].filter(Boolean);
  for (const key of keys) {
    const { data } = await supabase.from('routes').select('clinics, is_active').eq('exam_type', key).eq('is_active', true).maybeSingle();
    const codes = Array.isArray(data?.clinics) ? data.clinics.map(toCode).filter(Boolean) : [];
    if (codes.length) return codes;
  }
  return [];
}

function routeCodesFromMap(examType, gender) {
  const key = examKey(examType, gender);
  const raw = routeMap[key];
  const codes = Array.isArray(raw) ? raw : Array.isArray(raw?.[gender === 'female' ? 'F' : 'M']) ? raw[gender === 'female' ? 'F' : 'M'] : [];
  return codes.map(toCode).filter(Boolean);
}

async function queueLoad(clinicId) {
  if (!supabase || !clinicId) return 0;
  const today = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { count } = await supabase.from('unified_queue').select('*', { count: 'exact', head: true }).eq('clinic_id', clinicId).eq('queue_date', today).in('status', ['waiting', 'called', 'in_progress', 'serving']);
  return Number(count || 0);
}

function floorRank(floorCode) {
  return ({ M: 1, G: 2, 1: 3, 2: 4, 3: 5 }[String(floorCode || '').trim()] || 99);
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
      floor: clinic.floor === 'M' ? 'الميزانين' : `الطابق ${clinic.floor}`,
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
  const dbCodes = await routeCodesFromDb(examType);
  const codes = dbCodes.length ? dbCodes : routeCodesFromMap(examType, gender);
  if (!codes.length) return [];
  return buildStations(codes);
}

export async function enrichStationsWithClinicData(stations) {
  if (!Array.isArray(stations) || !supabase) return stations;
  const out = [];
  for (const station of stations) {
    const clinic = await clinicByCode(station.code || station.id);
    out.push(clinic ? { ...station, id: clinic.id, name: clinic.name_en || clinic.name, nameAr: clinic.name_ar || clinic.name, floorCode: clinic.floor, floor: clinic.floor === 'M' ? 'الميزانين' : `الطابق ${clinic.floor}` } : station);
  }
  return out;
}

export default getDynamicMedicalPathway;

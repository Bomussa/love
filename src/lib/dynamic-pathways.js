import { supabase } from './supabase-client'

const examTypeMap = {
  recruitment: 'تجنيد',
  promotion: 'ترفيع',
  transfer: 'نقل',
  referral: 'تحويل',
  contract: 'تجديد التعاقد',
  aviation: 'طيران سنوي',
  cooks: 'طباخين',
  courses: 'دورات',
  general: 'ترفيع',
}

async function fetchRouteFromDatabase(examType) {
  if (!supabase) return null
  const queryTypes = [examType, examTypeMap[examType]].filter(Boolean)
  for (const queryType of queryTypes) {
    const { data, error } = await supabase
      .from('routes')
      .select('clinics, route_name, exam_type, is_active')
      .eq('exam_type', queryType)
      .eq('is_active', true)
      .maybeSingle()
    if (!error && data?.clinics && Array.isArray(data.clinics) && data.clinics.length > 0) return data
  }
  return null
}

async function fetchClinicByCode(code) {
  if (!supabase) return null
  const cleaned = String(code || '').trim()
  if (!cleaned) return null

  const byId = await supabase
    .from('clinics')
    .select('id, name, name_ar, name_en, floor, code, is_active')
    .eq('id', cleaned)
    .eq('is_active', true)
    .maybeSingle()
  if (byId.data) return byId.data

  const byCode = await supabase
    .from('clinics')
    .select('id, name, name_ar, name_en, floor, code, is_active')
    .eq('code', cleaned)
    .eq('is_active', true)
    .maybeSingle()
  return byCode.data || null
}

async function mapClinicCodes(codes) {
  if (!Array.isArray(codes) || codes.length === 0) return []
  const clinics = []
  for (const code of codes) {
    const clinic = await fetchClinicByCode(code)
    if (!clinic) continue
    clinics.push({
      id: clinic.id,
      name: clinic.name_en || clinic.name,
      nameAr: clinic.name_ar || clinic.name,
      floor: clinic.floor === 'M' ? 'الميزانين' : `الطابق ${clinic.floor}`,
      floorCode: clinic.floor,
      code: clinic.code || code,
    })
  }
  return clinics
}

async function fetchClinicWeights(clinicIds) {
  const weights = Object.fromEntries((clinicIds || []).map((id) => [id, 0]))
  if (!supabase || !clinicIds?.length) return weights
  const today = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split('T')[0]
  await Promise.all(clinicIds.map(async (clinicId) => {
    const { count, error } = await supabase
      .from('unified_queue')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .eq('queue_date', today)
      .eq('status', 'waiting')
    if (!error && typeof count === 'number') weights[clinicId] = count
  }))
  return weights
}

function sortClinicsByWeight(clinics, weights) {
  return [...clinics]
    .map((clinic) => ({ ...clinic, weight: weights[clinic.id] || 0 }))
    .sort((a, b) => {
      if (a.weight !== b.weight) return a.weight - b.weight
      const order = { M: 1, G: 2, 1: 3, 2: 4, 3: 5 }
      return (order[a.floorCode] || 3) - (order[b.floorCode] || 3)
    })
    .map((clinic, index) => ({
      ...clinic,
      order: index + 1,
      status: index === 0 ? 'ready' : 'locked',
    }))
}

export async function getDynamicMedicalPathway(examType) {
  const dbRoute = await fetchRouteFromDatabase(examType)
  if (!dbRoute) return []
  const clinics = await mapClinicCodes(dbRoute.clinics || [])
  if (!clinics.length) return []
  const weights = await fetchClinicWeights(clinics.map((clinic) => clinic.id))
  return sortClinicsByWeight(clinics, weights)
}

export async function enrichStationsWithClinicData(stations) {
  if (!Array.isArray(stations) || !supabase) return stations
  const enriched = []
  for (const station of stations) {
    const code = station.code || station.id
    const byId = await supabase
      .from('clinics')
      .select('id, name, name_ar, name_en, floor, code, is_active')
      .eq('id', code)
      .eq('is_active', true)
      .maybeSingle()
    const byCode = byId.data ? null : await supabase
      .from('clinics')
      .select('id, name, name_ar, name_en, floor, code, is_active')
      .eq('code', code)
      .eq('is_active', true)
      .maybeSingle()
    const clinic = byId.data || byCode?.data || null
    enriched.push(clinic ? {
      ...station,
      id: clinic.id,
      name: clinic.name_en || clinic.name,
      nameAr: clinic.name_ar || clinic.name,
      floor: clinic.floor === 'M' ? 'الميزانين' : `الطابق ${clinic.floor}`,
      floorCode: clinic.floor,
      code: clinic.code || code,
    } : station)
  }
  return enriched
}

export default getDynamicMedicalPathway
/**
 * المسارات الديناميكية - محسّن للحساب الصحيح والعمل التلقائي
 * Dynamic Medical Pathways - Optimized for correct calculation and automatic operation
 */

import { supabase } from './supabase-client';

// Cache for config files
let routeMap = null;
let clinicsData = null;

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
};

async function loadConfigFiles() {
  if (!routeMap) {
    try {
      const response = await fetch('/config/routeMap.json');
      if (response.ok) {
        routeMap = await response.json();
      }
    } catch (e) {
      console.warn('[DynamicPathways] Failed to load routeMap.json:', e.message);
      routeMap = {};
    }
  }

  if (!clinicsData) {
    try {
      const response = await fetch('/config/clinics.json');
      if (response.ok) {
        clinicsData = await response.json();
      }
    } catch (e) {
      console.warn('[DynamicPathways] Failed to load clinics.json:', e.message);
      clinicsData = {};
    }
  }

  return { routeMap, clinicsData };
}

async function mapClinicCodes(codes, useDatabase = true, localClinicsData = {}) {
  if (!codes || codes.length === 0) return [];
  
  // Fetch all clinics at once if using database to avoid multiple calls
  let dbClinicsMap = new Map();
  if (useDatabase && supabase) {
    try {
      const { data } = await supabase
        .from('clinics')
        .select('id, name, name_ar, name_en, floor, code')
        .eq('is_active', true);
      
      if (data) {
        data.forEach(c => {
          dbClinicsMap.set(c.id, c);
          if (c.code) dbClinicsMap.set(c.code, c);
        });
      }
    } catch (err) {
      console.warn('[DynamicPathways] Failed to fetch all clinics:', err.message);
    }
  }

  const mappedClinics = [];
  for (const code of codes) {
    let clinic = localClinicsData[code] || dbClinicsMap.get(code);

    if (!clinic) {
      console.warn(`[DynamicPathways] Clinic ${code} not found`);
      continue;
    }

    mappedClinics.push({
      id: clinic.id,
      name: clinic.name_en || clinic.name,
      nameAr: clinic.name_ar || clinic.nameAr || clinic.name,
      floor: clinic.floor === 'M' ? 'الميزانين' : `الطابق ${clinic.floor}`,
      floorCode: clinic.floor,
      code: clinic.code || code,
    });
  }

  return mappedClinics;
}

async function fetchClinicWeights(clinicIds) {
  const weights = {};
  clinicIds.forEach(id => { weights[id] = 0; });

  if (!supabase || clinicIds.length === 0) return weights;

  try {
    const today = new Date().toISOString().split('T')[0];
    // Optimized: Fetch counts for all clinics in one query
    const { data, error } = await supabase
      .from('unified_queue')
      .select('clinic_id')
      .eq('queue_date', today)
      .eq('status', 'waiting')
      .in('clinic_id', clinicIds);

    if (!error && data) {
      data.forEach(row => {
        weights[row.clinic_id] = (weights[row.clinic_id] || 0) + 1;
      });
    }
  } catch (err) {
    console.warn('[DynamicPathways] Failed to fetch clinic weights:', err.message);
  }

  return weights;
}

function sortClinicsByWeight(clinics, weights) {
  const clinicsWithWeights = clinics.map(clinic => ({
    ...clinic,
    weight: weights[clinic.id] || 0,
  }));

  clinicsWithWeights.sort((a, b) => {
    if (a.weight !== b.weight) return a.weight - b.weight;
    const floorOrder = { M: 1, G: 2, 1: 3, 2: 4, 3: 5 };
    const floorA = floorOrder[a.floorCode] || 3;
    const floorB = floorOrder[b.floorCode] || 3;
    return floorA - floorB;
  });

  return clinicsWithWeights;
}

async function fetchRouteFromDatabase(examType) {
  if (!supabase) return null;

  try {
    const typesToTry = [examType, examTypeMap[examType]].filter(Boolean);
    const { data, error } = await supabase
      .from('routes')
      .select('clinics, route_name, exam_type')
      .in('exam_type', typesToTry)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (err) {
    console.warn('[DynamicPathways] Failed to fetch route:', err.message);
    return null;
  }
}

export async function getDynamicMedicalPathway(examType, gender) {
  console.log(`[DynamicPathways] Loading pathway: examType=${examType}, gender=${gender}`);
  
  try {
    const { routeMap: currentRouteMap, clinicsData: currentClinicsData } = await loadConfigFiles();
    const dbRoute = await fetchRouteFromDatabase(examType);

    let clinics = [];
    if (dbRoute?.clinics?.length > 0) {
      clinics = await mapClinicCodes(dbRoute.clinics, true, currentClinicsData);
    }

    if (clinics.length === 0) {
      const arabicExamType = examTypeMap[examType] || examType;
      const route = currentRouteMap[arabicExamType];

      if (route) {
        let codes = [];
        if (typeof route === 'object' && !Array.isArray(route)) {
          const genderKey = gender === 'female' ? 'F' : 'M';
          codes = route[genderKey] || route.M || [];
        } else if (Array.isArray(route)) {
          codes = route;
        }
        clinics = await mapClinicCodes(codes, true, currentClinicsData);
      }
    }

    if (clinics.length === 0) return [];

    const clinicIds = clinics.map(c => c.id);
    const weights = await fetchClinicWeights(clinicIds);
    const sortedClinics = sortClinicsByWeight(clinics, weights);

    return sortedClinics.map((clinic, index) => ({
      ...clinic,
      order: index + 1,
      status: index === 0 ? 'ready' : 'locked',
    }));
  } catch (err) {
    console.error('[DynamicPathways] Critical error:', err);
    return [];
  }
}

export function enrichStationsWithClinicData(stations) {
  if (!stations || !Array.isArray(stations)) return stations;
  return stations.map(station => {
    const clinicCode = station.code || station.id?.toUpperCase();
    const clinic = clinicsData?.[clinicCode];
    if (clinic) {
      return {
        ...station,
        name: clinic.name,
        nameAr: clinic.nameAr || station.nameAr || station.name,
        floor: clinic.floor === 'M' ? 'الميزانين' : `الطابق ${clinic.floor}`,
        floorCode: clinic.floor,
      };
    }
    return station;
  });
}

export default getDynamicMedicalPathway;

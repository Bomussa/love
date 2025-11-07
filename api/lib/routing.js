import { getSupabaseClient } from "./supabase-enhanced.js";
const supabase = getSupabaseClient(process.env);

/**
 * Dynamic Routing System with Weighted Load Balancing
 * نظام المسارات الديناميكية حسب الأوزان
 */

// import { createEnv } from './storage.js'; // Removed - using Supabase

// تعريف المسارات حسب نوع الفحص والجنس
export const ROUTE_MAP = {
  'recruitment': {
    male: ['vitals', 'lab', 'xray', 'ecg', 'audio', 'eyes', 'internal', 'ent', 'surgery', 'dental', 'psychiatry', 'derma', 'bones'],
    female: ['vitals', 'lab', 'xray', 'ecg', 'audio', 'eyes', 'internal', 'ent', 'surgery', 'dental', 'psychiatry', 'derma']
  },
  'promotion': {
    male: ['vitals', 'lab', 'xray', 'ecg', 'eyes', 'internal', 'ent', 'surgery'],
    female: ['vitals', 'lab', 'xray', 'ecg', 'eyes', 'internal', 'ent', 'surgery']
  },
  'transfer': {
    male: ['vitals', 'lab', 'xray', 'internal', 'surgery'],
    female: ['vitals', 'lab', 'xray', 'internal', 'surgery']
  },
  'conversion': {
    male: ['vitals', 'lab', 'internal'],
    female: ['vitals', 'lab', 'internal']
  },
  'courses': {
    male: ['vitals', 'lab', 'internal', 'eyes'],
    female: ['vitals', 'lab', 'internal', 'eyes']
  },
  'cooks': {
    male: ['vitals', 'lab', 'xray', 'internal', 'derma'],
    female: ['vitals', 'lab', 'xray', 'internal', 'derma']
  },
  'aviation': {
    male: ['vitals', 'lab', 'xray', 'ecg', 'audio', 'eyes', 'internal', 'ent', 'psychiatry'],
    female: ['vitals', 'lab', 'xray', 'ecg', 'audio', 'eyes', 'internal', 'ent', 'psychiatry']
  },
  'renewal': {
    male: ['vitals', 'lab', 'internal'],
    female: ['vitals', 'lab', 'internal']
  }
};

// معلومات العيادات
export const CLINICS = {
  'vitals': { id: 'vitals', name: 'القياسات الحيوية', nameEn: 'Vital Signs', floor: '2', weight: 1.0 },
  'lab': { id: 'lab', name: 'المختبر', nameEn: 'Laboratory', floor: 'M', weight: 1.2 },
  'xray': { id: 'xray', name: 'الأشعة', nameEn: 'X-Ray', floor: 'M', weight: 1.5 },
  'ecg': { id: 'ecg', name: 'تخطيط القلب', nameEn: 'ECG', floor: '2', weight: 1.0 },
  'audio': { id: 'audio', name: 'قياس السمع', nameEn: 'Audiometry', floor: '2', weight: 1.0 },
  'eyes': { id: 'eyes', name: 'العيون', nameEn: 'Ophthalmology', floor: '2', weight: 1.3 },
  'internal': { id: 'internal', name: 'الباطنية', nameEn: 'Internal Medicine', floor: '2', weight: 1.8 },
  'ent': { id: 'ent', name: 'أنف وأذن وحنجرة', nameEn: 'ENT', floor: '2', weight: 1.4 },
  'surgery': { id: 'surgery', name: 'الجراحة العامة', nameEn: 'General Surgery', floor: '2', weight: 1.6 },
  'dental': { id: 'dental', name: 'الأسنان', nameEn: 'Dental', floor: '2', weight: 1.3 },
  'psychiatry': { id: 'psychiatry', name: 'الطب النفسي', nameEn: 'Psychiatry', floor: '2', weight: 1.5 },
  'derma': { id: 'derma', name: 'الجلدية', nameEn: 'Dermatology', floor: '3', weight: 1.2 },
  'bones': { id: 'bones', name: 'العظام', nameEn: 'Orthopedics', floor: '2', weight: 1.4 }
};

/**
 * حساب الوزن الديناميكي للعيادة بناءً على عدد المنتظرين
 */
export async function calculateClinicWeight(clinicId) {
  // Get queue length from Supabase
  const { data: queueData, error } = await supabase
    .from('queue')
    .select('id', { count: 'exact' })
    .eq('clinic_id', clinicId)
    .eq('status', 'waiting');
  
  const queueLength = queueData?.length || 0;
  
  const baseWeight = CLINICS[clinicId]?.weight || 1.0;
  
  // الوزن الديناميكي = الوزن الأساسي × (1 + عدد المنتظرين × 0.1)
  const dynamicWeight = baseWeight * (1 + queueLength * 0.1);
  
  return {
    clinicId,
    baseWeight,
    queueLength,
    dynamicWeight,
    priority: 1 / dynamicWeight // الأولوية عكسية (الوزن الأقل = أولوية أعلى)
  };
}

/**
 * ترتيب المسار بناءً على الأوزان الديناميكية
 */
export async function optimizeRoute(clinics) {
  const weights = await Promise.all(
    clinics.map(clinicId => calculateClinicWeight(clinicId))
  );
  
  // ترتيب حسب الأولوية (الوزن الأقل أولاً)
  weights.sort((a, b) => b.priority - a.priority);
  
  return weights.map(w => w.clinicId);
}

/**
 * إنشاء مسار محسّن للمريض
 */
export async function createOptimizedRoute(examType, gender) {
  const genderKey = gender === 'male' || gender === 'M' ? 'male' : 'female';
  const basePath = ROUTE_MAP[examType]?.[genderKey];
  
  if (!basePath) {
    throw new Error('Invalid exam type or gender');
  }
  
  // تحسين المسار بناءً على الأوزان
  const optimizedPath = await optimizeRoute(basePath);
  
  return {
    examType,
    gender: genderKey,
    originalPath: basePath,
    optimizedPath,
    stations: optimizedPath.map((clinicId, index) => ({
      id: clinicId,
      name: CLINICS[clinicId].name,
      nameEn: CLINICS[clinicId].nameEn,
      floor: CLINICS[clinicId].floor,
      order: index + 1,
      status: index === 0 ? 'ready' : 'locked'
    }))
  };
}

/**
 * الحصول على العيادة التالية في المسار
 */
export function getNextClinic(route, currentClinicId) {
  const currentIndex = route.stations.findIndex(s => s.id === currentClinicId);
  
  if (currentIndex === -1) {
    return null;
  }
  
  if (currentIndex + 1 >= route.stations.length) {
    return { done: true, message: 'All clinics completed' };
  }
  
  return route.stations[currentIndex + 1];
}

/**
 * تحديث حالة العيادة في المسار
 */
export function updateClinicStatus(route, clinicId, status) {
  const clinic = route.stations.find(s => s.id === clinicId);
  
  if (!clinic) {
    throw new Error('Clinic not found in route');
  }
  
  clinic.status = status;
  clinic.completedAt = new Date().toISOString();
  
  // فتح العيادة التالية
  const currentIndex = route.stations.findIndex(s => s.id === clinicId);
  if (currentIndex + 1 < route.stations.length) {
    route.stations[currentIndex + 1].status = 'ready';
  }
  
  return route;
}

/**
 * الحصول على إحصائيات المسارات
 */
export async function getRouteStatistics() {
  const stats = {};
  
  for (const [clinicId, clinic] of Object.entries(CLINICS)) {
    const weight = await calculateClinicWeight(clinicId);
    stats[clinicId] = {
      ...clinic,
      ...weight
    };
  }
  
  return stats;
}


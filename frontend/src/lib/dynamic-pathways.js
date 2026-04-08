/**
 * Dynamic Medical Pathways - Optimized v7.0
 * ✅ Instant pathway loading
 * ✅ Minimal API calls
 * ✅ Aggressive caching
 * ✅ Unified clinic codes matching backend routing.js
 *
 * @description يوفر مسارات طبية ديناميكية بناءً على نوع الفحص والجنس
 * @author MiniMax Agent
 * @date 2026-04-08
 */

import { supabase } from './supabase-client';

// In-memory cache with TTL
const cache = {
  clinics: null,
  routes: null,
  timestamp: 0,
  TTL: 300000 // 5 minutes
};

/**
 * Hardcoded route map for instant loading
 * يستخدم أكواد العيادات الموحدة من routing.js
 *
 * @description خريطة المسارات حسب نوع الفحص والجنس
 * - recruitment: فحص التجنيد (9 عيادات للذكور، 10 للإناث)
 * - promotion: فحص الترفيع
 * - transfer: فحص النقل
 * - referral: فحص التحويل
 * - contract: تجديد التعاقد
 * - aviation: فحص الطيران
 * - cooks: فحص الطباخين
 * - courses: الدورات
 */
const ROUTE_MAP = {
  // فحص التجنيد - أطول مسار (9 عيادات للذكور)
  recruitment: {
    male: ['vitals', 'lab', 'xray', 'eyes', 'internal', 'surgery', 'ent', 'psychiatry', 'dental'],
    female: ['vitals', 'lab', 'xray', 'ent', 'surgery', 'bones', 'psychiatry', 'dental', 'internal', 'eyes', 'derma'],
  },
  // فحص الترفيع والنقل والتحويل وتجديد التعاقد - نفس المسار
  promotion: {
    male: ['vitals', 'lab', 'xray', 'eyes', 'internal', 'surgery', 'ent', 'psychiatry', 'dental'],
    female: ['vitals', 'lab', 'xray', 'ent', 'surgery', 'bones', 'psychiatry', 'dental', 'internal', 'eyes', 'derma'],
  },
  transfer: {
    male: ['vitals', 'lab', 'xray', 'eyes', 'internal', 'surgery', 'ent', 'psychiatry', 'dental'],
    female: ['vitals', 'lab', 'xray', 'ent', 'surgery', 'bones', 'psychiatry', 'dental', 'internal', 'eyes', 'derma'],
  },
  referral: {
    male: ['vitals', 'lab', 'xray', 'eyes', 'internal', 'surgery', 'ent', 'psychiatry', 'dental'],
    female: ['vitals', 'lab', 'xray', 'ent', 'surgery', 'bones', 'psychiatry', 'dental', 'internal', 'eyes', 'derma'],
  },
  contract: {
    male: ['vitals', 'lab', 'xray', 'eyes', 'internal', 'surgery', 'ent', 'psychiatry', 'dental'],
    female: ['vitals', 'lab', 'xray', 'ent', 'surgery', 'bones', 'psychiatry', 'dental', 'internal', 'eyes', 'derma'],
  },
  // فحص الطيران السنوي
  aviation: {
    male: ['vitals', 'lab', 'xray', 'ecg', 'audio', 'eyes', 'internal', 'ent', 'psychiatry'],
    female: ['vitals', 'lab', 'xray', 'ecg', 'audio', 'eyes', 'internal', 'ent', 'psychiatry'],
  },
  // فحص الطباخين - مسار مختصر
  cooks: {
    male: ['vitals', 'lab', 'xray', 'internal', 'derma'],
    female: ['vitals', 'lab', 'xray', 'internal', 'derma'],
  },
  // الدورات الداخلية والخارجية
  courses: {
    male: ['vitals', 'lab', 'eyes', 'surgery', 'internal'],
    female: ['vitals', 'lab', 'eyes', 'surgery', 'internal'],
  },
};

/**
 * Hardcoded clinic mapping for instant loading
 * معلومات العيادات الموحدة - تتطابق مع routing.js
 *
 * @description خريطة معلومات العيادات مع الأوزان للحمل المتوازن
 */
const CLINIC_MAP = {
  // القياسات الحيوية - الطابق 2
  vitals: {
    id: 'vitals',
    name_ar: 'القياسات الحيوية',
    name_en: 'Vital Signs',
    floor: '2',
    floorName_ar: 'الطابق الثاني',
    weight: 1.0
  },
  // المختبر - الميزانين
  lab: {
    id: 'lab',
    name_ar: 'المختبر',
    name_en: 'Laboratory',
    floor: 'M',
    floorName_ar: 'الميزانين',
    weight: 1.2
  },
  // الأشعة - الميزانين
  xray: {
    id: 'xray',
    name_ar: 'الأشعة',
    name_en: 'X-Ray',
    floor: 'M',
    floorName_ar: 'الميزانين',
    weight: 1.5
  },
  // تخطيط القلب - الطابق 2
  ecg: {
    id: 'ecg',
    name_ar: 'تخطيط القلب',
    name_en: 'ECG',
    floor: '2',
    floorName_ar: 'الطابق الثاني',
    weight: 1.0
  },
  // قياس السمع - الطابق 2
  audio: {
    id: 'audio',
    name_ar: 'قياس السمع',
    name_en: 'Audiometry',
    floor: '2',
    floorName_ar: 'الطابق الثاني',
    weight: 1.0
  },
  // العيون - الطابق 2
  eyes: {
    id: 'eyes',
    name_ar: 'العيون',
    name_en: 'Ophthalmology',
    floor: '2',
    floorName_ar: 'الطابق الثاني',
    weight: 1.3
  },
  // الباطنية - الطابق 2
  internal: {
    id: 'internal',
    name_ar: 'الباطنية',
    name_en: 'Internal Medicine',
    floor: '2',
    floorName_ar: 'الطابق الثاني',
    weight: 1.8
  },
  // الأنف والأذن والحنجرة - الطابق 2
  ent: {
    id: 'ent',
    name_ar: 'أنف وأذن وحنجرة',
    name_en: 'ENT',
    floor: '2',
    floorName_ar: 'الطابق الثاني',
    weight: 1.4
  },
  // الجراحة العامة - الطابق 2
  surgery: {
    id: 'surgery',
    name_ar: 'الجراحة العامة',
    name_en: 'General Surgery',
    floor: '2',
    floorName_ar: 'الطابق الثاني',
    weight: 1.6
  },
  // العظام والمفاصل - الطابق 2
  bones: {
    id: 'bones',
    name_ar: 'العظام والمفاصل',
    name_en: 'Orthopedics',
    floor: '2',
    floorName_ar: 'الطابق الثاني',
    weight: 1.4
  },
  // الأسنان - الطابق 2
  dental: {
    id: 'dental',
    name_ar: 'الأسنان',
    name_en: 'Dental',
    floor: '2',
    floorName_ar: 'الطابق الثاني',
    weight: 1.3
  },
  // الطب النفسي - الطابق 2
  psychiatry: {
    id: 'psychiatry',
    name_ar: 'الطب النفسي',
    name_en: 'Psychiatry',
    floor: '2',
    floorName_ar: 'الطابق الثاني',
    weight: 1.5
  },
  // الجلدية - الطابق 3
  derma: {
    id: 'derma',
    name_ar: 'الجلدية',
    name_en: 'Dermatology',
    floor: '3',
    floorName_ar: 'الطابق الثالث',
    weight: 1.2
  },
};

/**
 * Get path instantly based on exam type and gender
 *
 * @param {string} examType - نوع الفحص (recruitment, promotion, etc.)
 * @param {string} gender - الجنس (male/female)
 * @returns {string[]} مصفوفة أكواد العيادات
 */
function getPathInstant(examType, gender = 'male') {
  const genderKey = gender === 'female' ? 'female' : 'male';
  const pathData = ROUTE_MAP[examType];

  if (!pathData) {
    // Fallback to recruitment if exam type not found
    return ROUTE_MAP.recruitment.male;
  }

  return [...(pathData[genderKey] || pathData.male)];
}

// Get clinic info instantly
function getClinicInstant(clinicId) {
  return CLINIC_MAP[clinicId] || { id: clinicId, name_ar: clinicId, name_en: clinicId, floor: 0 };
}

// Map clinic codes to clinic objects instantly
function mapClinicCodesInstant(codes) {
  if (!codes || codes.length === 0) return [];
  return codes.map(code => getClinicInstant(code));
}

/**
 * Main export - Get dynamic medical pathway instantly
 *
 * @param {string} examType - نوع الفحص (recruitment, promotion, etc.)
 * @param {string} gender - الجنس (male/female)
 * @returns {Object} كائن يحتوي على المسار والعيادات
 *
 * @description دالة رئيسية لإرجاع مسار الفحص مع معلومات العيادات
 */
export async function getDynamicMedicalPathway(examType, gender = 'male') {
  try {
    // Return instant pathway without any async calls
    const path = getPathInstant(examType, gender);
    const clinics = mapClinicCodesInstant(path);

    return {
      success: true,
      path,
      clinics,
      examType,
      gender,
      totalSteps: clinics.length,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    console.error('[getDynamicMedicalPathway] Error:', err);
    return {
      success: false,
      error: err.message,
      path: [],
      clinics: []
    };
  }
}

// Async version for updates (with caching)
export async function getDynamicMedicalPathwayAsync(examType, gender = 'male') {
  try {
    // Check cache first
    const now = Date.now();
    if (cache.clinics && cache.routes && (now - cache.timestamp) < cache.TTL) {
      const path = getPathInstant(examType, gender);
      const clinics = path.map(code => cache.clinics[code] || getClinicInstant(code));
      return {
        success: true,
        path,
        clinics,
        examType,
        gender,
        totalSteps: clinics.length,
        cached: true
      };
    }

    // Update cache from Supabase if needed
    if (supabase) {
      const { data: clinicsData } = await supabase
        .from('clinics')
        .select('id, name_ar, name_en, floor, code')
        .eq('is_active', true);

      if (clinicsData) {
        cache.clinics = {};
        clinicsData.forEach(c => {
          cache.clinics[c.id] = c;
          if (c.code) cache.clinics[c.code] = c;
        });
        cache.timestamp = now;
      }
    }

    // Return pathway with updated cache
    const path = getPathInstant(examType, gender);
    const clinics = path.map(code => cache.clinics?.[code] || getClinicInstant(code));

    return {
      success: true,
      path,
      clinics,
      examType,
      gender,
      totalSteps: clinics.length,
      cached: false
    };
  } catch (err) {
    console.error('[getDynamicMedicalPathwayAsync] Error:', err);
    // Fallback to instant pathway
    const path = getPathInstant(examType, gender);
    const clinics = mapClinicCodesInstant(path);
    return {
      success: true,
      path,
      clinics,
      examType,
      gender,
      totalSteps: clinics.length,
      fallback: true
    };
  }
}

// Preload cache on app start
export async function preloadPathwayCache() {
  try {
    if (supabase) {
      const { data } = await supabase
        .from('clinics')
        .select('id, name_ar, name_en, floor, code')
        .eq('is_active', true);

      if (data) {
        cache.clinics = {};
        data.forEach(c => {
          cache.clinics[c.id] = c;
          if (c.code) cache.clinics[c.code] = c;
        });
        cache.timestamp = Date.now();
      }
    }
  } catch (err) {
    console.warn('[preloadPathwayCache] Error:', err.message);
  }
}

// Export utility functions
export { getPathInstant, getClinicInstant, mapClinicCodesInstant };

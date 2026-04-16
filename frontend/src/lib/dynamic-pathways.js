/**
 * المسارات الديناميكية - محسّن للحساب الصحيح والعمل التلقائي
 * Dynamic Medical Pathways - Optimized for correct calculation and automatic operation
 *
 * ✅ الترتيب حسب الوزن (الأقل ازدحاماً أولاً) عند بداية المسار فقط
 * ✅ جلب البيانات من Supabase أولاً ثم Fallback للملفات المحلية
 * ✅ دعم جميع أنواع الفحوصات الطبية
 *
 * @module dynamic-pathways
 * @author MiniMax Agent
 * @date 2026-04-03
 */

import { supabase } from './supabase-client';

// Cache for config files
let routeMap = null;
let clinicsData = null;

/**
 * تحويل examType من الإنجليزية إلى العربية
 * @param {string} examType - نوع الفحص بالإنجليزية
 * @returns {string} - نوع الفحص بالعربية
 */
const examTypeMap = {
  recruitment: 'تجنيد',
  promotion: 'ترفيع',
  transfer: 'نقل',
  referral: 'تحويل',
  contract: 'تجديد التعاقد',
  aviation: 'طيران سنوي',
  cooks: 'طباخين',
  courses: 'دورات',
  general: 'ترفيع', // الفحص العام = ترفيع
};

/**
 * تحميل ملفات الإعداد من /config
 * @returns {Promise<{routeMap: Object, clinicsData: Object}>}
 */
async function loadConfigFiles() {
  if (!routeMap) {
    try {
      const response = await fetch('/config/routeMap.json');
      if (response.ok) {
        routeMap = await response.json();
        console.log('[DynamicPathways] تم تحميل routeMap بنجاح');
      }
    } catch (e) {
      console.warn('[DynamicPathways] فشل تحميل routeMap.json:', e.message);
      routeMap = {};
    }
  }

  if (!clinicsData) {
    try {
      const response = await fetch('/config/clinics.json');
      if (response.ok) {
        clinicsData = await response.json();
        console.log('[DynamicPathways] تم تحميل clinicsData بنجاح');
      }
    } catch (e) {
      console.warn('[DynamicPathways] فشل تحميل clinics.json:', e.message);
      clinicsData = {};
    }
  }

  return { routeMap, clinicsData };
}

/**
 * تحويل رموز العيادات إلى كائنات كاملة
 * @param {string[]} codes - مصفوفة رموز العيادات
 * @param {boolean} useDatabase - استخدام قاعدة البيانات
 * @param {Object} localClinicsData - البيانات المحلية للعيادات
 * @returns {Promise<Object[]>} - مصفوفة كائنات العيادات
 */
async function mapClinicCodes(codes, useDatabase = true, localClinicsData = {}) {
  const mappedClinics = [];

  for (const code of codes) {
    let clinic = localClinicsData[code];

    // إذا لم توجد العيادة في الملف المحلي، نحاول جلبها من قاعدة البيانات
    if (!clinic && useDatabase && supabase) {
      try {
        // محاولة الجلب باستخدام id
        let { data: dbClinic } = await supabase
          .from('clinics')
          .select('id, name, name_ar, name_en, floor, code')
          .eq('id', code)
          .eq('is_active', true)
          .single();

        // إذا لم ينجح، نجرب البحث بالـ code
        if (!dbClinic) {
          const { data: dbClinicByCode } = await supabase
            .from('clinics')
            .select('id, name, name_ar, name_en, floor, code')
            .eq('code', code)
            .eq('is_active', true)
            .single();
          dbClinic = dbClinicByCode;
        }

        if (dbClinic) {
          clinic = {
            id: dbClinic.id,
            name: dbClinic.name_en || dbClinic.name,
            nameAr: dbClinic.name_ar || dbClinic.name,
            floor: dbClinic.floor,
            code: dbClinic.code || code,
          };
        }
      } catch (err) {
        console.warn(`[DynamicPathways] فشل جلب العيادة ${code} من قاعدة البيانات:`, err.message);
      }
    }

    if (!clinic) {
      console.warn(`[DynamicPathways] العيادة ${code} غير موجودة`);
      continue;
    }

    mappedClinics.push({
      id: clinic.id,
      name: clinic.name,
      nameAr: clinic.nameAr || clinic.name,
      floor: clinic.floor === 'M' ? 'الميزانين' : `الطابق ${clinic.floor}`,
      floorCode: clinic.floor,
      code: clinic.code || code,
    });
  }

  return mappedClinics;
}

/**
 * جلب أوزان العيادات (عدد المنتظرين) من Supabase
 * @param {string[]} clinicIds - مصفوفة معرفات العيادات
 * @returns {Promise<Object>} - كائن بأوزان العيادات
 */
async function fetchClinicWeights(clinicIds) {
  const weights = {};

  // تهيئة جميع الأوزان بـ 0
  clinicIds.forEach((id) => {
    weights[id] = 0;
  });

  if (!supabase || clinicIds.length === 0) {
    return weights;
  }

  try {
    const today = new Date().toISOString().split('T')[0];

    // جلب عدد المنتظرين لكل عيادة
    const promises = clinicIds.map(async (clinicId) => {
      try {
        // Try unified_queue first, fallback to queues
        let { count, error } = await supabase
          .from('unified_queue')
          .select('*', { count: 'exact', head: true })
          .eq('clinic_id', clinicId)
          .eq('queue_date', today)
          .eq('status', 'waiting');

        if (error || count === null) {
          const { data: fallbackData } = await supabase
            .from('queues')
            .select('id', { count: 'exact' })
            .eq('clinic_id', clinicId)
            .eq('queue_date', today)
            .eq('status', 'waiting');
          count = fallbackData?.length || 0;
        }

        if (count !== null) {
          weights[clinicId] = count;
        }
      } catch (err) {
        //_keep default weight of 0
      }
    });

    await Promise.all(promises);
  } catch (err) {
    console.warn('[DynamicPathways] فشل جلب أوزان العيادات:', err.message);
  }

  return weights;
}

/**
 * ترتيب العيادات حسب الأوزان (الأقل ازدحاماً أولاً)
 * @param {Object[]} clinics - مصفوفة العيادات
 * @param {Object} weights - كائن الأوزان
 * @returns {Object[]} - العيادات مرتبة
 */
function sortClinicsByWeight(clinics, weights) {
  // إضافة الوزن لكل عيادة
  const clinicsWithWeights = clinics.map((clinic) => ({
    ...clinic,
    weight: weights[clinic.id] || 0,
  }));

  // ترتيب حسب الوزن أولاً (الفارغة أولاً)
  clinicsWithWeights.sort((a, b) => {
    // الترتيب الأساسي: حسب الوزن (الأقل ازدحاماً أولاً)
    if (a.weight !== b.weight) {
      return a.weight - b.weight;
    }

    // إذا كان الوزن متساوي، نرتب حسب الطابق (الأقرب أولاً)
    const floorOrder = { M: 1, G: 2, 1: 3, 2: 4, 3: 5 };
    const floorA = floorOrder[a.floorCode] || 3;
    const floorB = floorOrder[b.floorCode] || 3;
    return floorA - floorB;
  });

  return clinicsWithWeights;
}

/**
 * جلب المسار الطبي من قاعدة البيانات (routes table)
 * @param {string} examType - نوع الفحص
 * @returns {Promise<Object|null>} - بيانات المسار أو null
 */
async function fetchRouteFromDatabase(examType) {
  if (!supabase) {
    console.warn('[DynamicPathways] Supabase غير متاح');
    return null;
  }

  try {
    // محاولة الجلب بالنوع الإنجليزي
    let { data: dbRoute, error } = await supabase
      .from('routes')
      .select('clinics, route_name, exam_type')
      .eq('exam_type', examType)
      .eq('is_active', true)
      .single();

    // إذا لم ينجح، نجرب النوع العربي
    if (!dbRoute && examTypeMap[examType]) {
      const arabicType = examTypeMap[examType];
      const { data: dbRouteArabic } = await supabase
        .from('routes')
        .select('clinics, route_name, exam_type')
        .eq('exam_type', arabicType)
        .eq('is_active', true)
        .single();
      dbRoute = dbRouteArabic;
    }

    if (error) {
      console.warn('[DynamicPathways] خطأ في جلب المسار من قاعدة البيانات:', error.message);
      return null;
    }

    if (dbRoute && dbRoute.clinics && Array.isArray(dbRoute.clinics) && dbRoute.clinics.length > 0) {
      console.log('[DynamicPathways] تم جلب المسار من قاعدة البيانات:', dbRoute.route_name);
      return dbRoute;
    }

    return null;
  } catch (err) {
    console.warn('[DynamicPathways] فشل جلب المسار من قاعدة البيانات:', err.message);
    return null;
  }
}

/**
 * الحصول على المسار الطبي حسب نوع الفحص والجنس
 * يجلب الترتيب من قاعدة البيانات أولاً (routes table) مع حساب الأوزان الصحيح
 * الترتيب حسب الوزن عند بداية المسار فقط
 *
 * @param {string} examType - نوع الفحص (recruitment, promotion, transfer, etc.)
 * @param {string} gender - الجنس (male, female)
 * @returns {Promise<Object[]>} - مصفوفة العيادات في المسار مع حالتها
 *
 * @example
 * const pathway = await getDynamicMedicalPathway('recruitment', 'male');
 * // Returns: [{ id: 'clinic-1', name: 'Eye', nameAr: 'العيون', floor: 'الطابق 1', status: 'ready' }, ...]
 */
export async function getDynamicMedicalPathway(examType, gender) {
  console.log(`[DynamicPathways] جلب المسار: examType=${examType}, gender=${gender}`);

  // تحميل ملفات الإعداد
  const { routeMap: currentRouteMap, clinicsData: currentClinicsData } = await loadConfigFiles();

  // محاولة جلب المسار من قاعدة البيانات أولاً
  const dbRoute = await fetchRouteFromDatabase(examType);

  let clinics = [];

  if (dbRoute && dbRoute.clinics && dbRoute.clinics.length > 0) {
    // تحويل رموز العيادات إلى كائنات
    clinics = await mapClinicCodes(dbRoute.clinics, true, currentClinicsData);
  }

  // إذا فشل جلب المسار من قاعدة البيانات، استخدم الملف المحلي
  if (clinics.length === 0) {
    console.log('[DynamicPathways] استخدام الملف المحلي كـ Fallback');

    const arabicExamType = examTypeMap[examType] || examType;
    const route = currentRouteMap[arabicExamType];

    if (!route) {
      console.warn('[DynamicPathways] لا يوجد مسار للنوع:', arabicExamType);
      return [];
    }

    // الحصول على رموز العيادات
    let codes = [];
    if (typeof route === 'object' && !Array.isArray(route)) {
      const genderKey = gender === 'female' ? 'F' : 'M';
      codes = route[genderKey] || route.M || [];
    } else if (Array.isArray(route)) {
      codes = route;
    }

    if (codes.length === 0) {
      console.warn('[DynamicPathways] لا توجد عيادات في المسار');
      return [];
    }

    // تحويل الرموز إلى كائنات عيادات
    clinics = await mapClinicCodes(codes, true, currentClinicsData);
  }

  if (clinics.length === 0) {
    console.warn('[DynamicPathways] فشل تحويل رموز العيادات');
    return [];
  }

  // جلب الأوزان الحقيقية (عدد المنتظرين في كل عيادة)
  const clinicIds = clinics.map((c) => c.id);
  const weights = await fetchClinicWeights(clinicIds);

  // ترتيب العيادات حسب الوزن (الأقل ازدحاماً أولاً)
  const sortedClinics = sortClinicsByWeight(clinics, weights);

  // إضافة الترتيب النهائي لكل عيادة
  const result = sortedClinics.map((clinic, index) => ({
    ...clinic,
    order: index + 1,
    status: index === 0 ? 'ready' : 'locked',
  }));

  console.log(`[DynamicPathways] تم جلب ${result.length} عيادة في المسار`);
  return result;
}

/**
 * تحديث أسماء العيادات من البيانات المحفوظة لضمان عرض الأسماء الصحيحة
 * @param {Object[]} stations - مصفوفة المحطات
 * @returns {Object[]} - المحطات المحدثة
 */
export async function enrichStationsWithClinicData(stations) {
  if (!stations || !Array.isArray(stations)) return stations;

  // Ensure clinicsData is loaded
  if (!clinicsData) {
    await loadConfigFiles();
  }

  return stations.map((station) => {
    // البحث عن العيادة في clinicsData باستخدام id أو code
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

// تصدير افتراضي
export default getDynamicMedicalPathway;

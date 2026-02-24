// ✅ المسارات الديناميكية - محسّن للحساب الصحيح والعمل التلقائي
// الترتيب حسب الوزن (الأقل ازدحاماً أولاً) عند بداية المسار فقط
// ✅ إصلاح: استخدام fetch بدلاً من assert لأن assert قد لا يعمل في جميع المتصفحات
let routeMap = null;
let clinicsData = null;

// تحميل البيانات بشكل ديناميكي
async function loadConfigFiles() {
  if (!routeMap) {
    try {
      const response = await fetch('/config/routeMap.json');
      routeMap = await response.json();
    } catch (e) {
      console.warn('Failed to load routeMap.json, using fallback');
      routeMap = {};
    }
  }
  if (!clinicsData) {
    try {
      const response = await fetch('/config/clinics.json');
      clinicsData = await response.json();
    } catch (e) {
      console.warn('Failed to load clinics.json, using fallback');
      clinicsData = {};
    }
  }
  return { routeMap, clinicsData };
}
import { supabase } from './supabase-client';
import { queueQueries } from './supabase-queries';

// ✅ تحويل رموز العيادات إلى كائنات كاملة - مع دعم قاعدة البيانات
async function mapClinicCodes(codes, useDatabase = true, localClinicsData = {}) {
  const mappedClinics = [];

  for (const code of codes) {
    let clinic = localClinicsData[code];

    // إذا لم توجد العيادة في الملف المحلي، نحاول جلبها من قاعدة البيانات
    if (!clinic && useDatabase && supabase) {
      try {
        const { data: dbClinic } = await supabase
          .from('clinics')
          .select('id, name, name_ar, name_en, floor')
          .eq('id', code)
          .eq('is_active', true)
          .single();

        if (dbClinic) {
          clinic = {
            id: dbClinic.id,
            name: dbClinic.name_en || dbClinic.name,
            nameAr: dbClinic.name_ar || dbClinic.name,
            floor: dbClinic.floor,
          };
        }
      } catch (err) {
        console.warn(`Failed to fetch clinic ${code} from database:`, err);
      }
    }

    if (!clinic) {
      console.warn(`Clinic code ${code} not found`);
      continue;
    }

    mappedClinics.push({
      id: clinic.id,
      name: clinic.name,
      nameAr: clinic.nameAr || clinic.name,
      floor: clinic.floor === 'M' ? 'الميزانين' : `الطابق ${clinic.floor}`,
      floorCode: clinic.floor,
      code,
    });
  }

  return mappedClinics;
}

// جلب أوزان العيادات (عدد المنتظرين) من API
async function fetchClinicWeights(clinicIds) {
  const weights = {};

  // Initialize all weights to 0 first
  clinicIds.forEach((id) => {
    weights[id] = 0;
  });

  try {
    const today = new Date().toISOString().split('T')[0];

    // جلب عدد المنتظرين لكل عيادة من unified_queue
    if (supabase) {
      const promises = clinicIds.map(async (clinicId) => {
        try {
          const { count, error } = await supabase
            .from('unified_queue')
            .select('*', { count: 'exact', head: true })
            .eq('clinic_id', clinicId)
            .eq('queue_date', today)
            .eq('status', 'waiting');

          if (!error && count !== null) {
            weights[clinicId] = count;
          }
        } catch (err) {
          // Keep default weight of 0
        }
      });

      await Promise.all(promises);
    }
  } catch (err) {
    console.warn('Failed to fetch clinic weights:', err);
  }

  return weights;
}

// ✅ ترتيب العيادات حسب الأوزان (الأقل ازدحاماً أولاً)
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
    const floorOrder = {
      M: 1, G: 2, 1: 3, 2: 4, 3: 5,
    };
    const floorA = floorOrder[a.floorCode] || 3;
    const floorB = floorOrder[b.floorCode] || 3;
    return floorA - floorB;
  });

  return clinicsWithWeights;
}

// ✅ الحصول على المسار الطبي حسب نوع الفحص والجنس
// يجلب الترتيب من قاعدة البيانات أولاً (routes table) مع حساب الأوزان الصحيح
// ✅ الترتيب حسب الوزن عند بداية المسار فقط
export async function getDynamicMedicalPathway(examType, gender) {
  console.log('[getDynamicMedicalPathway] بدء جلب المسار:', examType, gender);

  // ✅ إصلاح: تحميل ملفات الإعداد أولاً
  const { routeMap: rm, clinicsData: cd } = await loadConfigFiles();
  const currentRouteMap = rm || routeMap || {};
  const currentClinicsData = cd || clinicsData || {};

  // تحويل examType من الإنجليزية إلى العربية
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

  const arabicExamType = examTypeMap[examType] || examType;

  // ✅ محاولة جلب المسار من قاعدة البيانات أولاً
  try {
    if (!supabase) {
      console.warn('[getDynamicMedicalPathway] Supabase غير متاح');
    } else {
      const { data: dbRoute, error } = await supabase
        .from('routes')
        .select('clinics, route_name')
        .eq('exam_type', examType)
        .eq('is_active', true)
        .single();

      if (error) {
        console.warn('[getDynamicMedicalPathway] خطأ في جلب المسار:', error.message);
      }

      if (dbRoute && dbRoute.clinics && Array.isArray(dbRoute.clinics) && dbRoute.clinics.length > 0) {
        console.log('[getDynamicMedicalPathway] تم جلب المسار من قاعدة البيانات:', dbRoute.route_name, dbRoute.clinics);

        // تحويل رموز العيادات إلى كائنات
        const clinics = await mapClinicCodes(dbRoute.clinics, true);

        if (clinics.length > 0) {
          // ✅ جلب الأوزان الحقيقية (عدد المنتظرين في كل عيادة)
          const clinicIds = clinics.map((c) => c.id);
          let weights = {};
          try {
            weights = await fetchClinicWeights(clinicIds);
            console.log('[getDynamicMedicalPathway] أوزان العيادات:', weights);
          } catch (err) {
            clinicIds.forEach((id) => { weights[id] = 0; });
          }

          // ✅ ترتيب العيادات حسب الوزن (الأقل ازدحاماً أولاً)
          const sortedClinics = sortClinicsByWeight(clinics, weights);

          // إضافة الترتيب النهائي لكل عيادة
          const result = sortedClinics.map((clinic, index) => ({
            ...clinic,
            order: index + 1,
            status: index === 0 ? 'ready' : 'locked',
          }));

          console.log(
            '[getDynamicMedicalPathway] المسار النهائي (مرتب حسب الوزن):',
            result.map((c) => `${c.nameAr}(${c.weight})`).join(' → '),
          );
          return result;
        }
      }
    }
  } catch (err) {
    console.warn('[getDynamicMedicalPathway] فشل جلب المسار من قاعدة البيانات:', err);
  }

  // ✅ Fallback: استخدام الملف المحلي
  console.log('[getDynamicMedicalPathway] استخدام الملف المحلي للمسار:', arabicExamType);
  const route = currentRouteMap[arabicExamType];

  if (!route) {
    console.warn('[getDynamicMedicalPathway] لا يوجد مسار للنوع:', arabicExamType);
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
    console.warn('[getDynamicMedicalPathway] لا توجد عيادات في المسار');
    return [];
  }

  // تحويل الرموز إلى كائنات عيادات
  const clinics = await mapClinicCodes(codes, true, currentClinicsData);

  if (clinics.length === 0) {
    console.warn('[getDynamicMedicalPathway] فشل تحويل رموز العيادات');
    return [];
  }

  // ✅ جلب الأوزان الحقيقية
  const clinicIds = clinics.map((c) => c.id);
  let weights = {};

  try {
    weights = await fetchClinicWeights(clinicIds);
    console.log('[getDynamicMedicalPathway] أوزان العيادات (محلي):', weights);
  } catch (err) {
    clinicIds.forEach((id) => { weights[id] = 0; });
  }

  // ✅ ترتيب العيادات حسب الوزن (الأقل ازدحاماً أولاً)
  const sortedClinics = sortClinicsByWeight(clinics, weights);

  // إضافة الترتيب النهائي لكل عيادة
  const result = sortedClinics.map((clinic, index) => ({
    ...clinic,
    order: index + 1,
    status: index === 0 ? 'ready' : 'locked',
  }));

  console.log(
    '[getDynamicMedicalPathway] المسار النهائي (محلي - مرتب حسب الوزن):',
    result.map((c) => `${c.nameAr}(${c.weight})`).join(' → '),
  );
  return result;
}

// تحديث أسماء العيادات من البيانات المحفوظة لضمان عرض الأسماء الصحيحة
export function enrichStationsWithClinicData(stations) {
  if (!stations || !Array.isArray(stations)) return stations;

  return stations.map((station) => {
    // البحث عن العيادة في clinicsData باستخدام id أو code
    const clinicCode = station.code || station.id?.toUpperCase();
    const clinic = clinicsData[clinicCode];

    if (clinic) {
      return {
        ...station,
        name: clinic.name, // الاسم الإنجليزي
        nameAr: clinic.nameAr || station.nameAr || station.name, // الاسم العربي
        floor: clinic.floor === 'M' ? 'الميزانين' : `الطابق ${clinic.floor}`,
        floorCode: clinic.floor,
      };
    }

    return station;
  });
}

export default getDynamicMedicalPathway;

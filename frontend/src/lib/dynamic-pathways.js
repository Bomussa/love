// ✅ المسارات الديناميكية - محسّن للحساب الصحيح والعمل التلقائي
import routeMap from '../../config/routeMap.json' assert { type: 'json' }
import clinicsData from '../../config/clinics.json' assert { type: 'json' }
import { queueQueries } from './supabase-queries'

// ✅ تحويل رموز العيادات إلى كائنات كاملة - مع دعم قاعدة البيانات
async function mapClinicCodes(codes, useDatabase = true) {
  const mappedClinics = [];
  
  for (const code of codes) {
    let clinic = clinicsData[code];
    
    // إذا لم توجد العيادة في الملف المحلي، نحاول جلبها من قاعدة البيانات
    if (!clinic && useDatabase && window.supabase) {
      try {
        const { data: dbClinic } = await window.supabase
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
            floor: dbClinic.floor
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
      code: code
    });
  }
  
  return mappedClinics;
}

// جلب أوزان العيادات (عدد المنتظرين) من API
async function fetchClinicWeights(clinicIds) {
  const weights = {}
  
  // Initialize all weights to 0 first
  clinicIds.forEach(id => {
    weights[id] = 0
  })
  
  try {
    const promises = clinicIds.map(async (clinicId) => {
      try {
        const status = await queueQueries.getStatus(clinicId)
        weights[clinicId] = status.waiting || 0
      } catch (err) {
        // Keep default weight of 0
        
      }
    })
    
    await Promise.all(promises)
  } catch (err) {
    
  }
  
  return weights
}

// ترتيب العيادات حسب الأوزان مع احترام قيود الطوابق
function sortClinicsByWeight(clinics, weights) {
  // إضافة الوزن لكل عيادة
  const clinicsWithWeights = clinics.map(clinic => ({
    ...clinic,
    weight: weights[clinic.id] || 0
  }))
  
  // ترتيب حسب الوزن أولاً (الفارغة أولاً)
  clinicsWithWeights.sort((a, b) => {
    // الترتيب الأساسي: حسب الوزن
    if (a.weight !== b.weight) {
      return a.weight - b.weight
    }
    
    // إذا كان الوزن متساوي، نرتب حسب الطابق
    const floorOrder = { 'M': 1, 'G': 2, '2': 3, '3': 4 }
    const floorA = floorOrder[a.floorCode] || 3
    const floorB = floorOrder[b.floorCode] || 3
    return floorA - floorB
  })
  
  return clinicsWithWeights
}

// ✅ الحصول على المسار الطبي حسب نوع الفحص والجنس
// يجلب الترتيب من قاعدة البيانات أولاً (routes table) مع حساب الأوزان الصحيح
export async function getDynamicMedicalPathway(examType, gender) {
  console.log('[getDynamicMedicalPathway] بدء جلب المسار:', examType, gender);
  
  // تحويل examType من الإنجليزية إلى العربية
  const examTypeMap = {
    'recruitment': 'تجنيد',
    'promotion': 'ترفيع',
    'transfer': 'نقل',
    'referral': 'تحويل',
    'contract': 'تجديد التعاقد',
    'aviation': 'طيران سنوي',
    'cooks': 'طباخين',
    'courses': 'دورات',
    'general': 'ترفيع' // الفحص العام = ترفيع
  }
  
  const arabicExamType = examTypeMap[examType] || examType;
  
  // ✅ محاولة جلب المسار من قاعدة البيانات أولاً
  try {
    if (!window.supabase) {
      console.warn('[getDynamicMedicalPathway] Supabase غير متاح');
    } else {
      const { data: dbRoute, error } = await window.supabase
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
        
        // استخدام الترتيب من قاعدة البيانات
        const clinics = await mapClinicCodes(dbRoute.clinics, true);
        
        if (clinics.length > 0) {
          // إضافة الأوزان للعرض (عدد المنتظرين)
          const clinicIds = clinics.map(c => c.id);
          let weights = {};
          try {
            weights = await fetchClinicWeights(clinicIds);
          } catch (err) {
            clinicIds.forEach(id => { weights[id] = 0; });
          }
          
          // إضافة الوزن والترتيب لكل عيادة
          const result = clinics.map((clinic, index) => ({
            ...clinic,
            weight: weights[clinic.id] || 0,
            order: index + 1,
            status: index === 0 ? 'ready' : 'locked'
          }));
          
          console.log('[getDynamicMedicalPathway] المسار النهائي:', result.length, 'عيادة');
          return result;
        }
      }
    }
  } catch (err) {
    console.warn('[getDynamicMedicalPathway] فشل جلب المسار من قاعدة البيانات:', err);
  }
  
  // ✅ Fallback: استخدام الملف المحلي
  console.log('[getDynamicMedicalPathway] استخدام الملف المحلي للمسار:', arabicExamType);
  const route = routeMap[arabicExamType];
  
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
  const clinics = await mapClinicCodes(codes, true);
  
  if (clinics.length === 0) {
    console.warn('[getDynamicMedicalPathway] فشل تحويل رموز العيادات');
    return [];
  }
  
  // إضافة الأوزان للعرض
  const clinicIds = clinics.map(c => c.id);
  let weights = {};
  
  try {
    weights = await fetchClinicWeights(clinicIds);
  } catch (err) {
    clinicIds.forEach(id => { weights[id] = 0; });
  }
  
  // إضافة الوزن والترتيب لكل عيادة
  const result = clinics.map((clinic, index) => ({
    ...clinic,
    weight: weights[clinic.id] || 0,
    order: index + 1,
    status: index === 0 ? 'ready' : 'locked'
  }));
  
  console.log('[getDynamicMedicalPathway] المسار النهائي (محلي):', result.length, 'عيادة');
  return result;
}

// تحديث أسماء العيادات من البيانات المحفوظة لضمان عرض الأسماء الصحيحة
export function enrichStationsWithClinicData(stations) {
  if (!stations || !Array.isArray(stations)) return stations
  
  return stations.map(station => {
    // البحث عن العيادة في clinicsData باستخدام id أو code
    const clinicCode = station.code || station.id?.toUpperCase()
    const clinic = clinicsData[clinicCode]
    
    if (clinic) {
      return {
        ...station,
        name: clinic.name, // الاسم الإنجليزي
        nameAr: clinic.nameAr || station.nameAr || station.name, // الاسم العربي
        floor: clinic.floor === 'M' ? 'الميزانين' : `الطابق ${clinic.floor}`,
        floorCode: clinic.floor
      }
    }
    
    return station
  })
}

export default getDynamicMedicalPathway


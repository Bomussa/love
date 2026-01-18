// المسارات الديناميكية - تعمل sync ثم تعيد// ديناميك المسارات
import routeMap from '../../config/routeMap.json' assert { type: 'json' }
import clinicsData from '../../config/clinics.json' assert { type: 'json' }
import { queueQueries } from './supabase-queries'

// تحويل رموز العيادات إلى كائنات كاملة
function mapClinicCodes(codes) {
  return codes.map(code => {
    const clinic = clinicsData[code]
    if (!clinic) {

      return null
    }
    
    return {
      id: clinic.id,
      name: clinic.name,
      nameAr: clinic.nameAr || clinic.name,
      floor: clinic.floor === 'M' ? 'الميزانين' : `الطابق ${clinic.floor}`,
      floorCode: clinic.floor,
      code: code
    }
  }).filter(Boolean)
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

// الحصول على المسار الطبي حسب نوع الفحص والجنس
// ✅ الآن يجلب الترتيب من قاعدة البيانات أولاً (routes table)
export async function getDynamicMedicalPathway(examType, gender) {
  // تحويل examType من الإنجليزية إلى العربية
  const examTypeMap = {
    'recruitment': 'تجنيد',
    'promotion': 'ترفيع',
    'transfer': 'نقل',
    'referral': 'تحويل',
    'contract': 'تجديد التعاقد',
    'aviation': 'طيران سنوي',
    'cooks': 'طباخين',
    'courses': 'دورات'
  }
  
  const arabicExamType = examTypeMap[examType] || examType
  
  // ✅ محاولة جلب المسار من قاعدة البيانات أولاً
  try {
    const { data: dbRoute, error } = await window.supabase
      ?.from('routes')
      .select('clinics')
      .eq('exam_type', examType)
      .eq('is_active', true)
      .single()
    
    if (dbRoute && dbRoute.clinics && Array.isArray(dbRoute.clinics) && dbRoute.clinics.length > 0) {
      // استخدام الترتيب من قاعدة البيانات
      const clinics = mapClinicCodes(dbRoute.clinics)
      if (clinics.length > 0) {
        // إضافة الأوزان للعرض فقط (بدون إعادة ترتيب)
        const clinicIds = clinics.map(c => c.id)
        let weights = {}
        try {
          weights = await fetchClinicWeights(clinicIds)
        } catch (err) {
          clinicIds.forEach(id => { weights[id] = 0 })
        }
        
        // إضافة الوزن لكل عيادة بدون إعادة ترتيب
        return clinics.map(clinic => ({
          ...clinic,
          weight: weights[clinic.id] || 0
        }))
      }
    }
  } catch (err) {
    console.warn('Failed to fetch route from database, using local config:', err)
  }
  
  // ✅ Fallback: استخدام الملف المحلي
  const route = routeMap[arabicExamType]
  
  if (!route) {
    return []
  }
  
  // الحصول على رموز العيادات
  let codes = []
  if (typeof route === 'object' && !Array.isArray(route)) {
    const genderKey = gender === 'female' ? 'F' : 'M'
    codes = route[genderKey] || route.M || []
  } else if (Array.isArray(route)) {
    codes = route
  }
  
  if (codes.length === 0) {
    return []
  }
  
  // تحويل الرموز إلى كائنات عيادات
  const clinics = mapClinicCodes(codes)
  
  if (clinics.length === 0) {
    return []
  }
  
  // إضافة الأوزان للعرض فقط (بدون إعادة ترتيب)
  const clinicIds = clinics.map(c => c.id)
  let weights = {}
  
  try {
    weights = await fetchClinicWeights(clinicIds)
  } catch (err) {
    clinicIds.forEach(id => { weights[id] = 0 })
  }
  
  // إضافة الوزن لكل عيادة بدون إعادة ترتيب
  return clinics.map(clinic => ({
    ...clinic,
    weight: weights[clinic.id] || 0
  }))
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


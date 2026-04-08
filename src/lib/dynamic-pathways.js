/**
 * Dynamic Medical Pathways - Database-Driven v8.0
 * ✅ All data from Supabase (NO hardcoded routes/clinics)
 * ✅ Aggressive caching for performance
 * ✅ Automatic fallback handling
 *
 * @description يوفر مسارات طبية ديناميكية بناءً على نوع الفحص والجنس
 * @description مصدر البيانات الوحيد: قاعدة بيانات Supabase
 * @author MiniMax Agent
 * @date 2026-04-08 (Updated: All data now from database)
 */

import { supabase } from './supabase-client';

// In-memory cache with TTL - NOW INCLUDES ROUTES FROM DATABASE
const cache = {
  clinics: null,        // من جدول clinics
  routes: null,          // من جدول exam_routes
  timestamp: 0,
  TTL: 300000            // 5 minutes
};

/**
 * Load exam routes from Supabase database
 * يقرأ المسارات من جدول exam_routes في قاعدة البيانات
 */
async function loadRoutesFromDatabase() {
  try {
    const { data, error } = await supabase
      .from('exam_routes')
      .select('*');
    
    if (error) {
      console.error('[loadRoutesFromDatabase] Error:', error);
      return null;
    }
    
    // Convert array to map for easy lookup
    const routesMap = {};
    data.forEach(route => {
      routesMap[route.exam_type] = route.routes;
    });
    
    console.log('[loadRoutesFromDatabase] Loaded', Object.keys(routesMap).length, 'exam routes');
    return routesMap;
  } catch (err) {
    console.error('[loadRoutesFromDatabase] Exception:', err);
    return null;
  }
}

/**
 * Load clinics from Supabase database
 * يقرأ العيادات من جدول clinics في قاعدة البيانات
 */
async function loadClinicsFromDatabase() {
  try {
    const { data, error } = await supabase
      .from('clinics')
      .select('*')
      .eq('is_active', true);
    
    if (error) {
      console.error('[loadClinicsFromDatabase] Error:', error);
      return null;
    }
    
    // Convert array to map for easy lookup
    const clinicsMap = {};
    data.forEach(clinic => {
      clinicsMap[clinic.id] = clinic;
      // Also map by code if available
      if (clinic.code) clinicsMap[clinic.code] = clinic;
    });
    
    console.log('[loadClinicsFromDatabase] Loaded', Object.keys(clinicsMap).length, 'clinics');
    return clinicsMap;
  } catch (err) {
    console.error('[loadClinicsFromDatabase] Exception:', err);
    return null;
  }
}

/**
 * Ensure cache is loaded
 * يضمن تحميل الـ cache من قاعدة البيانات
 */
async function ensureCacheLoaded() {
  const now = Date.now();
  
  // Check if cache is still valid
  if (cache.routes && cache.clinics && (now - cache.timestamp) < cache.TTL) {
    return true;
  }
  
  // Load fresh data from database
  console.log('[ensureCacheLoaded] Loading fresh data from database...');
  const [routes, clinics] = await Promise.all([
    loadRoutesFromDatabase(),
    loadClinicsFromDatabase()
  ]);
  
  if (routes && clinics) {
    cache.routes = routes;
    cache.clinics = clinics;
    cache.timestamp = now;
    return true;
  }
  
  return false;
}

/**
 * Get path from database/cache
 * @param {string} examType - نوع الفحص
 * @param {string} gender - الجنس
 * @returns {Promise<string[]>} مصفوفة أكواد العيادات
 */
async function getPathFromDatabase(examType, gender = 'male') {
  await ensureCacheLoaded();
  
  const genderKey = gender === 'female' ? 'female' : 'male';
  const routeData = cache.routes?.[examType];
  
  if (!routeData) {
    console.warn(`[getPathFromDatabase] No route found for ${examType}, falling back to recruitment`);
    // Fallback to recruitment as default
    const fallbackRoute = cache.routes?.['recruitment'];
    return fallbackRoute?.[genderKey]?.path || [];
  }
  
  return routeData[genderKey]?.path || routeData.male?.path || [];
}

/**
 * Map clinic codes to clinic objects from database
 * @param {string[]} codes - مصفوفة أكواد العيادات
 * @returns {Promise<Object[]>} مصفوفة معلومات العيادات
 */
async function mapClinicCodesFromDatabase(codes) {
  await ensureCacheLoaded();
  
  if (!codes || codes.length === 0) return [];
  
  return codes.map(code => {
    const clinic = cache.clinics?.[code];
    if (clinic) {
      return clinic;
    }
    
    // Fallback if clinic not found
    console.warn(`[mapClinicCodesFromDatabase] Clinic ${code} not found in database`);
    return {
      id: code,
      name_ar: code,
      name_en: code,
      floor: 'غير محدد',
      weight: 1.0
    };
  });
}

/**
 * Main export - Get dynamic medical pathway from database
 *
 * @param {string} examType - نوع الفحص (recruitment, promotion, etc.)
 * @param {string} gender - الجنس (male/female)
 * @returns {Promise<Object>} كائن يحتوي على المسار والعيادات
 *
 * @description دالة رئيسية لإرجاع مسار الفحص مع معلومات العيادات من قاعدة البيانات
 */
export async function getDynamicMedicalPathway(examType, gender = 'male') {
  try {
    // Get path from database
    const path = await getPathFromDatabase(examType, gender);
    
    if (!path || path.length === 0) {
      console.error('[getDynamicMedicalPathway] No path found for', examType, gender);
      return {
        success: false,
        error: 'No medical pathway found for this exam type',
        path: [],
        clinics: []
      };
    }
    
    // Map clinic codes to clinic objects
    const clinics = await mapClinicCodesFromDatabase(path);
    
    console.log('[getDynamicMedicalPathway] Success:', examType, gender, '→', path.length, 'clinics');
    
    return {
      success: true,
      path,
      clinics,
      examType,
      gender,
      totalSteps: clinics.length,
      timestamp: new Date().toISOString(),
      source: 'database'
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

/**
 * Preload cache on app start
 * يقوم بتحميل الـ cache عند بدء التطبيق
 */
export async function preloadPathwayCache() {
  try {
    console.log('[preloadPathwayCache] Preloading data from database...');
    await ensureCacheLoaded();
    console.log('[preloadPathwayCache] Cache preloaded successfully');
    return true;
  } catch (err) {
    console.error('[preloadPathwayCache] Error:', err.message);
    return false;
  }
}

// Export for compatibility (deprecated - will use async versions)
export async function getDynamicMedicalPathwayAsync(examType, gender = 'male') {
  return getDynamicMedicalPathway(examType, gender);
}

// Export utility function for getting single clinic info
export async function getClinicInfo(clinicId) {
  await ensureCacheLoaded();
  return cache.clinics?.[clinicId] || {
    id: clinicId,
    name_ar: clinicId,
    name_en: clinicId,
    floor: 'غير محدد',
    weight: 1.0
  };
}

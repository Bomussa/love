/**
 * Dynamic Medical Pathways - Optimized v6.0
 * ✅ Instant pathway loading
 * ✅ Minimal API calls
 * ✅ Aggressive caching
 */

import { supabase } from './supabase-client';

// In-memory cache with TTL
const cache = {
  clinics: null,
  routes: null,
  timestamp: 0,
  TTL: 300000 // 5 minutes
};

// Hardcoded route map for instant loading
const ROUTE_MAP = {
  recruitment: ['LAB','XR','BIO','EYE','INT','SUR','ENT','PSY','DNT','DER'],
  promotion:   ['LAB','XR','BIO','EYE','INT','SUR','ENT','PSY','DNT','DER'],
  transfer:    ['LAB','XR','BIO','EYE','INT','SUR','ENT','PSY','DNT','DER'],
  referral:    ['LAB','XR','BIO','EYE','INT','SUR','ENT','PSY','DNT','DER'],
  contract:    ['LAB','XR','BIO','EYE','INT','SUR','ENT','PSY','DNT','DER'],
  aviation:    ['LAB','EYE','INT','ENT','ECG','AUD'],
  cooks:       ['LAB','INT','ENT','SUR'],
  courses:     ['LAB','EYE','SUR','INT'],
};

// Hardcoded clinic mapping for instant loading
const CLINIC_MAP = {
  'LAB': { id: 'LAB', name_ar: 'المختبر', name_en: 'Laboratory', floor: 1 },
  'XR': { id: 'XR', name_ar: 'الأشعات', name_en: 'X-Ray', floor: 2 },
  'BIO': { id: 'BIO', name_ar: 'الأحياء', name_en: 'Biology', floor: 1 },
  'EYE': { id: 'EYE', name_ar: 'العيون', name_en: 'Ophthalmology', floor: 3 },
  'INT': { id: 'INT', name_ar: 'الباطنية', name_en: 'Internal Medicine', floor: 2 },
  'SUR': { id: 'SUR', name_ar: 'الجراحة', name_en: 'Surgery', floor: 3 },
  'ENT': { id: 'ENT', name_ar: 'الأنف والأذن', name_en: 'ENT', floor: 2 },
  'PSY': { id: 'PSY', name_ar: 'الأمراض النفسية', name_en: 'Psychiatry', floor: 4 },
  'DNT': { id: 'DNT', name_ar: 'الأسنان', name_en: 'Dentistry', floor: 1 },
  'DER': { id: 'DER', name_ar: 'الجلدية', name_en: 'Dermatology', floor: 2 },
  'ECG': { id: 'ECG', name_ar: 'القلب', name_en: 'Cardiology', floor: 3 },
  'AUD': { id: 'AUD', name_ar: 'السمعيات', name_en: 'Audiology', floor: 2 },
};

// Get path instantly
function getPathInstant(examType) {
  const path = ROUTE_MAP[examType] || ROUTE_MAP.recruitment;
  return [...path];
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

// Main export - instant pathway
export async function getDynamicMedicalPathway(examType, gender = 'male') {
  try {
    // Return instant pathway without any async calls
    const path = getPathInstant(examType);
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
      const path = cache.routes[examType] || getPathInstant(examType);
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
    const path = getPathInstant(examType);
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
    const path = getPathInstant(examType);
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

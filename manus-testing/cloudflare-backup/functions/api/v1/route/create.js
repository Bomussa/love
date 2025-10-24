// Create and save patient route with dynamic clinic ordering
// POST /api/v1/route/create
// Body: { patientId, examType, gender }

import { jsonResponse, corsResponse, validateRequiredFields, checkKVAvailability } from '../../../_shared/utils.js';

// Route templates based on exam type
const ROUTE_MAP = {
  'دورات': ['LAB', 'EYE', 'SUR', 'INT'],
  'تجنيد': ['LAB', 'XR', 'BIO', 'EYE', 'INT', 'SUR', 'ENT', 'PSY', 'DNT', 'DER'],
  'ترفيع': ['LAB', 'XR', 'BIO', 'EYE', 'INT', 'SUR', 'ENT', 'PSY', 'DNT', 'DER'],
  'نقل': ['LAB', 'XR', 'BIO', 'EYE', 'INT', 'SUR', 'ENT', 'PSY', 'DNT', 'DER'],
  'تحويل': ['LAB', 'XR', 'BIO', 'EYE', 'INT', 'SUR', 'ENT', 'PSY', 'DNT', 'DER'],
  'تجديد التعاقد': ['LAB', 'XR', 'BIO', 'EYE', 'INT', 'SUR', 'ENT', 'PSY', 'DNT', 'DER'],
  'طيران سنوي': ['LAB', 'EYE', 'INT', 'ENT', 'ECG', 'AUD'],
  'طباخين': ['LAB', 'INT', 'ENT', 'SUR'],
  'recruitment': ['LAB', 'XR', 'BIO', 'EYE', 'INT', 'SUR', 'ENT', 'PSY', 'DNT', 'DER'],
  'promotion': ['LAB', 'XR', 'BIO', 'EYE', 'INT', 'SUR', 'ENT', 'PSY', 'DNT', 'DER'],
  'transfer': ['LAB', 'XR', 'BIO', 'EYE', 'INT', 'SUR', 'ENT', 'PSY', 'DNT', 'DER'],
  'referral': ['LAB', 'XR', 'BIO', 'EYE', 'INT', 'SUR', 'ENT', 'PSY', 'DNT', 'DER'],
  'contract': ['LAB', 'XR', 'BIO', 'EYE', 'INT', 'SUR', 'ENT', 'PSY', 'DNT', 'DER'],
  'aviation': ['LAB', 'EYE', 'INT', 'ENT', 'ECG', 'AUD'],
  'cooks': ['LAB', 'INT', 'ENT', 'SUR'],
  'courses': ['LAB', 'EYE', 'SUR', 'INT']
};

// Clinics that should remain fixed at the beginning (not reordered)
const FIXED_CLINICS = ['LAB', 'XR', 'BIO'];

// Fetch clinic weights (number of waiting patients) from KV
async function fetchClinicWeights(env, clinicIds) {
  const weights = {};
  const kv = env.KV_QUEUES;
  
  if (!kv) {
    // If KV not available, return zero weights
    clinicIds.forEach(id => weights[id] = 0);
    return weights;
  }
  
  try {
    // Fetch queue status for each clinic
    for (const clinicId of clinicIds) {
      try {
        const listKey = `queue:list:${clinicId.toLowerCase()}`;
        const queueList = await kv.get(listKey, 'json');
        
        if (queueList && Array.isArray(queueList)) {
          // Count only waiting patients (not called or done)
          weights[clinicId] = queueList.filter(item => 
            item.status === 'WAITING' || !item.status
          ).length;
        } else {
          weights[clinicId] = 0;
        }
      } catch (err) {
        weights[clinicId] = 0;
      }
    }
  } catch (err) {
    console.error('Failed to fetch clinic weights:', err);
    clinicIds.forEach(id => weights[id] = 0);
  }
  
  return weights;
}

// Sort clinics by weight (empty clinics first)
function sortClinicsByWeight(clinics, weights) {
  // Separate fixed and flexible clinics
  const fixed = [];
  const flexible = [];
  
  for (const clinic of clinics) {
    if (FIXED_CLINICS.includes(clinic)) {
      fixed.push(clinic);
    } else {
      flexible.push(clinic);
    }
  }
  
  // Sort flexible clinics by weight (ascending - empty first)
  flexible.sort((a, b) => {
    const weightA = weights[a] || 0;
    const weightB = weights[b] || 0;
    return weightA - weightB;
  });
  
  // Combine: fixed clinics first, then sorted flexible clinics
  return [...fixed, ...flexible];
}

// Get base route template for exam type
function getBaseRoute(examType) {
  return ROUTE_MAP[examType] || ROUTE_MAP['تجنيد'];
}

export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }
  
  try {
    const body = await request.json();
    const { patientId, examType, gender, stations } = body;
    
    // Validate required fields
    const validationError = validateRequiredFields(body, ['patientId', 'examType']);
    if (validationError) {
      return jsonResponse(validationError, 400);
    }
    
    // Check KV availability
    const kvError = checkKVAvailability(env.KV_ADMIN, 'KV_ADMIN');
    if (kvError) {
      return jsonResponse(kvError, 500);
    }
    
    const kv = env.KV_ADMIN;
    const routeKey = `route:${patientId}`;
    
    // Check if route already exists (sticky route)
    const existingRoute = await kv.get(routeKey, 'json');
    
    if (existingRoute) {
      // Return existing route without modification
      return jsonResponse({
        success: true,
        route: existingRoute,
        sticky: true,
        message: 'Route already exists and remains unchanged'
      });
    }
    
    // Create new dynamic route
    let dynamicStations;
    
    if (stations && Array.isArray(stations) && stations.length > 0) {
      // If stations provided, use them (backward compatibility)
      dynamicStations = stations;
    } else {
      // Generate dynamic route based on exam type and current clinic loads
      const baseRoute = getBaseRoute(examType);
      
      // Fetch current clinic weights
      const weights = await fetchClinicWeights(env, baseRoute);
      
      // Sort clinics by weight (empty first)
      dynamicStations = sortClinicsByWeight(baseRoute, weights);
      
      console.log(`[Route Create] Dynamic route for ${patientId}:`, {
        examType,
        baseRoute,
        weights,
        dynamicStations
      });
    }
    
    // Create route object
    const route = {
      patientId,
      examType,
      gender: gender || 'male',
      stations: dynamicStations,
      currentStep: 0,
      createdAt: new Date().toISOString(),
      status: 'active',
      dynamic: true,
      weights: await fetchClinicWeights(env, dynamicStations) // Store weights for reference
    };
    
    // Save route to KV (sticky - won't change)
    await kv.put(routeKey, JSON.stringify(route), {
      expirationTtl: 86400 // 24 hours
    });
    
    return jsonResponse({
      success: true,
      route: route,
      message: 'Dynamic route created successfully'
    });
    
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
}

// Handle OPTIONS for CORS
export async function onRequestOptions() {
  return corsResponse(['POST', 'OPTIONS']);
}


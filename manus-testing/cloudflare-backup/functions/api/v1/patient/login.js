// Patient Login - Dynamic weighted path calculation
 * MIGRATED TO SUPABASE
// POST /api/v1/patient/login
// Body: { patientId, gender, examType }

import { jsonResponse, corsResponse } from '../../../_shared/utils.js';

// Exam types with their clinic lists
const EXAM_TYPES = {
  recruitment: ['vitals', 'lab', 'xray', 'ecg', 'audio', 'eyes', 'internal', 'ent', 'surgery', 'dental', 'psychiatry', 'derma', 'bones'],
  cooks: ['vitals', 'lab', 'xray', 'internal'],
  drivers: ['vitals', 'eyes', 'audio', 'internal', 'psychiatry'],
  periodic: ['vitals', 'lab', 'xray', 'ecg', 'internal'],
  specialized: ['vitals', 'lab', 'internal'] // Can be customized
};

/**
 * Calculate dynamic path based on clinic weights (waiting counts)
 */
async function calculateDynamicPath(env, clinicList) {
  const weights = [];
  
  // Get waiting count for each clinic
  for (const clinic of clinicList) {
    const counterKey = `counter:${clinic}`;
    const counters = await env.KV_QUEUES.get(counterKey, 'json');
    
    const waiting = counters 
      ? (counters.entered - counters.exited) 
      : 0;
    
    weights.push({
      clinic: clinic,
      waiting: waiting
    });
  }
  
  // Sort by waiting count (ascending - least busy first)
  weights.sort((a, b) => a.waiting - b.waiting);
  
  // Return sorted clinic list
  return weights.map(w => w.clinic);
}

export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }
  
  try {
    const body = await request.json();
    const { patientId, gender, examType = 'recruitment' } = body;
    
    // Validate input
    if (!patientId || !gender) {
      return jsonResponse({
        success: false,
        error: 'Missing required fields: patientId and gender'
      }, 400);
    }
    
    // Validate patientId format (2-12 digits)
    if (!/^\d{2,12}$/.test(patientId)) {
      return jsonResponse({
        success: false,
        error: 'Invalid patientId format. Must be 2-12 digits.'
      }, 400);
    }
    
    // Validate gender
    if (!['male', 'female'].includes(gender)) {
      return jsonResponse({
        success: false,
        error: 'Invalid gender. Must be "male" or "female".'
      }, 400);
    }
    
    // Validate exam type
    if (!EXAM_TYPES[examType]) {
      return jsonResponse({
        success: false,
        error: `Invalid exam type. Must be one of: ${Object.keys(EXAM_TYPES).join(', ')}`
      }, 400);
    }
    
    // Check if path already exists
    const pathKey = `path:${patientId}`;
    let existingPath = null;
    
    if (env.KV_ADMIN) {
      existingPath = await env.KV_ADMIN.get(pathKey, 'json');
    }
    
    if (existingPath) {
      // Path already exists, return it
      return jsonResponse({
        success: true,
        existing: true,
        patientId: patientId,
        gender: gender,
        examType: existingPath.examType || examType,
        route: existingPath.route,
        first_clinic: existingPath.current_clinic, // إضافة first_clinic للتوافق مع Frontend
        current_clinic: existingPath.current_clinic,
        current_index: existingPath.current_index,
        status: existingPath.status,
        message: 'Patient already registered. Returning existing path.'
      });
    }
    
    // ============================================================
    // CALCULATE DYNAMIC PATH BASED ON WEIGHTS
    // ============================================================
    
    const clinicList = EXAM_TYPES[examType];
    const dynamicRoute = await calculateDynamicPath(env, clinicList);
    
    // Create path data
    const pathData = {
      patientId: patientId,
      gender: gender,
      examType: examType,
      route: dynamicRoute,
      current_clinic: dynamicRoute[0],
      current_index: 0,
      status: 'IN_PROGRESS',
      created_at: new Date().toISOString(),
      progress: [],
      weights_calculated: true,
      original_clinic_list: clinicList
    };
    
    // Save path to KV_ADMIN
    if (env.KV_ADMIN) {
      await env.KV_ADMIN.put(pathKey, JSON.stringify(pathData), {
        expirationTtl: 86400 // 24 hours
      });
    }
    
    // ============================================================
    // AUTO-ENTER FIRST CLINIC
    // ============================================================
    
    const firstClinic = dynamicRoute[0];
    const now = new Date();
    const entryTime = now.toISOString();
    
    // Get clinic counters
    const counterKey = `counter:${firstClinic}`;
    let counters = await env.KV_QUEUES.get(counterKey, 'json') || {
      clinic: firstClinic,
      entered: 0,
      exited: 0,
      reset_at: entryTime
    };
    
    // Increment entered counter
    counters.entered += 1;
    const assignedNumber = counters.entered;
    
    // Save counters
    await env.KV_QUEUES.put(counterKey, JSON.stringify(counters), {
      expirationTtl: 86400
    });
    
    // Save user entry
    const userKey = `queue:user:${firstClinic}:${patientId}`;
    const userEntry = {
      number: assignedNumber,
      status: 'WAITING',
      entered_at: entryTime,
      clinic: firstClinic,
      user: patientId,
      auto_entered: true
    };
    
    await env.KV_QUEUES.put(userKey, JSON.stringify(userEntry), {
      expirationTtl: 86400
    });
    
    // Calculate waiting count
    const waiting = counters.entered - counters.exited;
    
    // ============================================================
    // CREATE NOTIFICATION
    // ============================================================
    
    const notification = {
      type: 'REGISTRATION_COMPLETE',
      patientId: patientId,
      first_clinic: firstClinic,
      queue_number: assignedNumber,
      timestamp: entryTime,
      message: `تم التسجيل بنجاح. توجه إلى ${firstClinic} - رقمك: ${assignedNumber}`
    };
    
    await env.KV_EVENTS.put(
      `event:notification:${patientId}:${Date.now()}`,
      JSON.stringify(notification),
      { expirationTtl: 3600 }
    );
    
    // Return success response
    return jsonResponse({
      success: true,
      patientId: patientId,
      gender: gender,
      examType: examType,
      route: dynamicRoute,
      first_clinic: firstClinic,
      queue_number: assignedNumber,
      waiting_count: waiting,
      total_clinics: dynamicRoute.length,
      notification: {
        title: 'تم التسجيل بنجاح',
        message: `توجه إلى ${firstClinic}`,
        queue_number: assignedNumber,
        clinic: firstClinic
      },
      weights_calculated: true,
      message: 'Registration successful. Dynamic path calculated based on clinic loads.'
    });
    
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
}

export async function onRequestOptions() {
  return corsResponse(['POST', 'OPTIONS']);
}


// Dynamic Path Choose - Sticky per exam
// Supports both GET and POST methods
// POST /api/v1/path/choose with body: { patientId, examType, gender }

import { jsonResponse, validateRequiredFields, checkKVAvailability } from '../../../_shared/utils.js';

// Exam type to clinics mapping
const EXAM_ROUTES = {
  'recruitment': ['vitals', 'lab', 'xray', 'ecg', 'audio', 'eyes', 'internal', 'ent', 'surgery', 'dental', 'psychiatry', 'derma', 'bones'],
  'transfer': ['vitals', 'lab', 'xray', 'internal', 'ent', 'surgery'],
  'promotion': ['vitals', 'lab', 'xray', 'ecg', 'eyes', 'internal'],
  'conversion': ['vitals', 'lab', 'xray', 'internal'],
  'courses': ['vitals', 'lab', 'xray'],
  'cooks': ['vitals', 'lab', 'xray', 'derma'],
  'aviation': ['vitals', 'lab', 'xray', 'ecg', 'audio', 'eyes', 'internal'],
  'contract_renewal': ['vitals', 'lab', 'xray', 'internal']
};

// Default route if exam type not found
const DEFAULT_ROUTE = ['vitals', 'lab', 'xray', 'internal'];

export async function onRequest(context) {
  const { request, env } = context;
  
  try {
    let patientId, examType, gender;
    
    // Support both GET and POST
    if (request.method === 'GET') {
      const url = new URL(request.url);
      patientId = url.searchParams.get('patientId') || url.searchParams.get('user');
      examType = url.searchParams.get('examType') || url.searchParams.get('exam');
      gender = url.searchParams.get('gender') || 'male';
    } else if (request.method === 'POST') {
      const body = await request.json();
      patientId = body.patientId || body.user;
      examType = body.examType || body.exam;
      gender = body.gender || 'male';
      
      // Validate required fields
      const validationError = validateRequiredFields(
        { patientId, examType }, 
        ['patientId', 'examType']
      );
      if (validationError) {
        return jsonResponse(validationError, 400);
      }
    } else {
      return jsonResponse({
        success: false,
        error: 'Method not allowed. Use GET or POST.'
      }, 405);
    }
    
    // Check KV availability
    const kvError = checkKVAvailability(env.KV_ADMIN, 'KV_ADMIN');
    if (kvError) {
      return jsonResponse(kvError, 500);
    }
    
    // Check if path already exists (Sticky)
    const pathKey = `path:${patientId}:${examType}`;
    const existingPath = await env.KV_ADMIN.get(pathKey, { type: 'json' });
    
    if (existingPath && existingPath.route) {
      return jsonResponse({
        success: true,
        sticky: true,
        route: existingPath.route,
        patientId: patientId,
        examType: examType,
        gender: gender,
        created_at: existingPath.created_at
      });
    }
    
    // Determine route based on exam type
    let route = EXAM_ROUTES[examType] || DEFAULT_ROUTE;
    
    // Create path data
    const pathData = {
      patientId: patientId,
      examType: examType,
      gender: gender,
      route: route,
      created_at: new Date().toISOString(),
      sticky: true
    };
    
    // Save path (Sticky for 24 hours)
    await env.KV_ADMIN.put(pathKey, JSON.stringify(pathData), {
      expirationTtl: 86400 // 24 hours
    });
    
    return jsonResponse({
      success: true,
      sticky: true,
      route: route,
      patientId: patientId,
      examType: examType,
      gender: gender,
      created_at: pathData.created_at
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
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}


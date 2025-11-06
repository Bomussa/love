/**
 * Path Choose Endpoint
 * POST /api/v1/path/choose
 */

import { createEnv } from '../../lib/storage.js';
import { validateGender } from '../../lib/helpers.js';

// Define exam paths
const EXAM_PATHS = {
  'recruitment': {
    male: ['vitals', 'lab', 'xray', 'ecg', 'audio', 'eyes', 'internal', 'ent', 'surgery', 'dental'],
    female: ['vitals', 'lab', 'xray', 'ecg', 'audio', 'eyes', 'internal', 'ent', 'surgery']
  },
  'promotion': {
    male: ['vitals', 'lab', 'xray', 'ecg', 'eyes', 'internal'],
    female: ['vitals', 'lab', 'xray', 'ecg', 'eyes', 'internal']
  },
  'transfer': {
    male: ['vitals', 'lab', 'xray', 'internal'],
    female: ['vitals', 'lab', 'xray', 'internal']
  },
  'conversion': {
    male: ['vitals', 'lab', 'internal'],
    female: ['vitals', 'lab', 'internal']
  },
  'courses': {
    male: ['vitals', 'lab', 'internal'],
    female: ['vitals', 'lab', 'internal']
  },
  'cooks': {
    male: ['vitals', 'lab', 'xray', 'internal', 'derma'],
    female: ['vitals', 'lab', 'xray', 'internal', 'derma']
  },
  'aviation': {
    male: ['vitals', 'lab', 'xray', 'ecg', 'audio', 'eyes', 'internal', 'ent', 'psychiatry'],
    female: ['vitals', 'lab', 'xray', 'ecg', 'audio', 'eyes', 'internal', 'ent', 'psychiatry']
  },
  'renewal': {
    male: ['vitals', 'lab', 'internal'],
    female: ['vitals', 'lab', 'internal']
  }
};

export default async function handler(req, res) {
  try {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    const { sessionId, examType, patientId, gender } = req.body;

    if (!sessionId || !examType) {
      return res.status(400).json({
        success: false,
        error: 'Missing sessionId or examType'
      });
    }

    const env = createEnv();
    
    // Get patient data
    const patientData = await env.KV_CACHE.get(`patient:${sessionId}`, { type: 'json' });
    
    if (!patientData) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Get path for exam type and gender
    const genderKey = patientData.gender || gender;
    const path = EXAM_PATHS[examType]?.[genderKey];

    if (!path) {
      return res.status(400).json({
        success: false,
        error: 'Invalid exam type or gender'
      });
    }

    // Update patient data with path
    patientData.examType = examType;
    patientData.path = path;
    patientData.currentClinicIndex = 0;
    patientData.completedClinics = [];
    patientData.pathChosenAt = new Date().toISOString();

    await env.KV_CACHE.put(
      `patient:${sessionId}`,
      JSON.stringify(patientData),
      { expirationTtl: 86400 }
    );

    return res.status(200).json({
      success: true,
      data: {
        sessionId,
        examType,
        path,
        currentClinic: path[0],
        totalClinics: path.length
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}


  } catch (error) {
    console.error('Error in api/v1/path/choose.js:', error);
    return res.status(500).json({ success: false, error: error.message });
  }

/**
 * Vercel Serverless Function: /api/v1/patients/login
 * 
 * Purpose: Patient login/registration endpoint
 * Connects directly to Supabase for patient authentication
 * 
 * FIXED: Changed 'patient_id' to 'id' to match database schema
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// CORS configuration
const ALLOWED_ORIGINS = [
  'https://mmc-mms.com',
  'https://www.mmc-mms.com',
  'http://localhost:3000',
  'http://localhost:5173',
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin as string;
  
  // CORS: Set headers if origin is allowed
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(204).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', allowed: ['POST', 'OPTIONS'] });
  }

  // Get Supabase credentials from environment
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      success: false,
      error: 'Server configuration error: Supabase credentials not found'
    });
  }

  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { patientId, gender } = req.body;

    if (!patientId || !gender) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: patientId and gender'
      });
    }

    // Check if patient exists (FIXED: using 'id' instead of 'patient_id')
    const { data: existing, error: checkError } = await supabase
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Check patient error:', checkError);
      return res.status(500).json({
        success: false,
        error: 'Database error while checking patient'
      });
    }

    if (existing) {
      // Update existing patient (FIXED: using 'id' instead of 'patient_id')
      const { data, error } = await supabase
        .from('patients')
        .update({ gender, last_active: new Date().toISOString() })
        .eq('id', patientId)
        .select()
        .single();

      if (error) {
        console.error('Update patient error:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to update patient'
        });
      }

      return res.status(200).json({
        success: true,
        data: data,
        message: 'تم تسجيل الدخول بنجاح'
      });
    } else {
      // Create new patient (FIXED: using 'id' instead of 'patient_id')
      const { data, error } = await supabase
        .from('patients')
        .insert({ id: patientId, gender })
        .select()
        .single();

      if (error) {
        console.error('Create patient error:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to create patient'
        });
      }

      return res.status(201).json({
        success: true,
        data: data,
        message: 'تم إنشاء حساب جديد بنجاح'
      });
    }
  } catch (error) {
    console.error('Patient login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

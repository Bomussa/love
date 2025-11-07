/**
 * API Endpoint: GET /api/v1/queue/clinics
 * Description: Fetch list of all clinics from Supabase
 * Returns: Array of clinic objects with id, name_ar, name_en, is_open, current_number
 */

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only GET requests are accepted'
    });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase credentials');
      return res.status(500).json({ 
        error: 'Server configuration error',
        message: 'Missing database credentials'
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all clinics from database
    const { data: clinics, error } = await supabase
      .from('clinics')
      .select('id, clinic_id, name_ar, name_en, is_open, current_number, daily_pin')
      .order('clinic_id', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ 
        error: 'Database error',
        message: error.message
      });
    }

    // Return clinics data
    return res.status(200).json({
      success: true,
      data: clinics || [],
      count: clinics?.length || 0
    });

  } catch (error) {
    console.error('Unexpected error in /api/v1/queue/clinics:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
}

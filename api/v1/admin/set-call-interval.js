/**
 * Admin Set Call Interval Endpoint
 * POST /api/v1/admin/set-call-interval
 */

import SupabaseClient, { getSupabaseClient } from '../../../api/lib/supabase.js';
import { jsonResponse, corsResponse, validateRequiredFields } from '../../../_shared/utils.js';

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
    const { clinic, interval_minutes } = req.body;
    
    // Validate required fields
    if (!clinic || interval_minutes === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing clinic or interval_minutes'
      });
    }

    const { updateSettings } = SupabaseClient;
    const supabase = getSupabaseClient(process.env); // Use process.env for Vercel environment

    // 1. Save interval setting to the 'settings' table
    const key = `queue_interval_${clinic}`;
    const value = { interval_minutes: interval_minutes };
    
    await updateSettings(supabase, key, value, 'admin');

    return res.status(200).json({
      success: true,
      clinic: clinic,
      interval_minutes: interval_minutes,
      message: `Call interval set to ${interval_minutes} minutes`
    });
    
  } catch (error) {
    console.error('Error in api/v1/admin/set-call-interval.js:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
}

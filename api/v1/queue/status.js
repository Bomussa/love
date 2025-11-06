/**
 * Queue Status Endpoint
 * GET /api/v1/queue/status?clinic=lab
 */

import { getSupabaseClient, getActiveQueues, getSettings } from '../../lib/supabase.js';

export default async function handler(req, res) {
  try {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    const { clinic } = req.query;
    
    if (!clinic) {
      return res.status(400).json({
        success: false,
        error: 'Missing clinic parameter'
      });
    }

    const supabase = getSupabaseClient(process.env); // Use process.env for Vercel environment

    // 1. Get active queue list
    const queueData = await getActiveQueues(supabase, clinic);

    // 2. Get current serving patient (from settings or a dedicated table)
    // Assuming 'current_serving' is stored in the 'settings' table or derived from the queue.
    // The original KV logic used a separate status key. We will use the 'settings' table for simplicity
    // and to maintain the original structure of fetching a 'status' object.
    const status = await getSettings(supabase, `queue_status_${clinic}`);
    const currentServing = status ? status.value.current : null;

    return res.status(200).json({
      success: true,
      clinic: clinic,
      list: queueData,
      current_serving: currentServing,
      // The original KV logic had 'served' list, which is not easily replicated here.
      // We will omit it for now and focus on core functionality.
      // served: status.served,
      count: queueData.length
    });

  } catch (error) {
    console.error('Error in api/v1/queue/status.js:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

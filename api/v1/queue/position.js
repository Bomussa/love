// MIGRATED TO SUPABASE
// Real-time Queue Position Verification
// GET /api/v1/queue/position?clinic=xxx&user=yyy
// Returns accurate, real-time position in queue

import { jsonResponse, corsResponse } from '../../../_shared/utils.js';
import supabase from '../../../lib/supabase.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  
  try {
    const url = new URL(request.url);
    const clinic = url.searchParams.get('clinic');
    const user = url.searchParams.get('user');
    
    if (!clinic || !user) {
      return jsonResponse({
        success: false,
        error: 'clinic and user required'
      }, 400);
    }
    
    // 1. Get Supabase client
    const client = supabase.getSupabaseClient(env);

    // 2. Get user's queue entry
    // The original logic used a separate KV key for the user's entry (userQueue).
    // The new logic will use the 'queue' table with filters.
    // The 'user' parameter in the URL is likely the patient_id in the 'queue' table.
    const { data: userQueue, error: userError } = await client
      .from('queue')
      .select('status')
      .eq('clinic_id', clinic)
      .eq('patient_id', user)
      .limit(1)
      .single();

    if (userError && userError.code !== 'PGRST116') { // PGRST116 means no rows found
      console.error('Supabase Error (userQueue):', userError);
      throw new Error('Database query failed for user entry.');
    }

    if (!userQueue) {
      return jsonResponse({
        success: false,
        error: 'User not in queue'
      }, 404);
    }
    
    // If already done, return completed status
    if (userQueue.status === 'completed') { // Assuming 'DONE' maps to 'completed'
      return jsonResponse({
        success: true,
        status: 'DONE',
        display_number: -1,
        ahead: 0,
        total_waiting: 0,
        message: 'Examination completed'
      });
    }
    
    // 3. Get queue list for the clinic
    // The original logic fetched a single KV value which was an array of all entries.
    // The new logic fetches all 'waiting' and 'called' entries from the 'queue' table.
    const { data: queueList, error: listError } = await client
      .from('queue')
      .select('patient_id, status, entered_at')
      .eq('clinic_id', clinic)
      .in('status', ['waiting', 'called']) // Assuming 'WAITING'/'IN_SERVICE' map to 'waiting'/'called'
      .order('entered_at', { ascending: true }); // Sorting by entered_at (entry time) as in original KV logic

    if (listError) {
      console.error('Supabase Error (queueList):', listError);
      throw new Error('Database query failed for queue list.');
    }
    
    // Get only WAITING patients
    // The original logic filtered for 'WAITING'. Since the DB query already filters for 'waiting' and 'called',
    // we need to replicate the original logic's intent which was to find position among WAITING.
    // The original KV list was sorted by entered_at implicitly by the KV key/list structure, then explicitly sorted.
    // The DB query is sorted by entered_at.

    // Filter to get only 'waiting' status (equivalent to original 'WAITING' status)
    const waitingPatients = queueList.filter(item => item.status === 'waiting');
    
    // Find user position in waiting list
    const myIndex = waitingPatients.findIndex(item => item.patient_id === user);
    
    // If not found in waiting list, check if in service
    if (myIndex === -1) {
      // Check if the user is currently 'called' (equivalent to original 'IN_SERVICE')
      if (userQueue.status === 'called') {
        return jsonResponse({
          success: true,
          status: 'IN_SERVICE',
          display_number: 0,
          ahead: 0,
          total_waiting: waitingPatients.length,
          message: 'Currently in service'
        });
      }
      
      // If not waiting, not in service, and not done (checked earlier), something is wrong.
      // The original code returned 'DONE' here, which is a safe fallback.
      return jsonResponse({
        success: true,
        status: 'DONE',
        display_number: -1,
        ahead: 0,
        total_waiting: 0,
        message: 'Not found in active queue'
      });
    }
    
    // Position is index + 1 (1-based)
    const myPosition = myIndex + 1;
    
    // Calculate how many are ahead (0-based)
    const ahead = myIndex;
    
    // Determine display number:
    // -1 = Done (انتهى)
    // 0 = Currently being served (داخل العيادة)
    // 1+ = Waiting (في الانتظار)
    let displayNumber;
    if (ahead === 0) {
      // First in queue = currently being served or next
      displayNumber = 0;
    } else {
      // Waiting = show actual position number (2, 3, 4, ...)
      displayNumber = myPosition;
    }
    
    // Estimate waiting time (average 5 minutes per patient)
    const estimatedMinutes = ahead * 5;
    
    return jsonResponse({
      success: true,
      clinic: clinic,
      user: user,
      status: ahead === 0 ? 'NEXT' : 'WAITING',
      display_number: displayNumber,
      ahead: ahead,
      total_waiting: waitingPatients.length,
      estimated_wait_minutes: estimatedMinutes,
      verified_at: new Date().toISOString(),
      verification_method: 'real_time_supabase_check'
    });
    
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

// Handle OPTIONS for CORS
export async function onRequestOptions() {
  return corsResponse(['GET', 'OPTIONS']);
}


  } catch (error) {
    console.error('Error in api/v1/queue/position.js:', error);
    return res.status(500).json({ success: false, error: error.message });
  }

// MIGRATED TO SUPABASE
// Queue Call - Call next patient in queue
// POST /api/v1/queue/call
// Body: { clinic }
import { jsonResponse, validateRequiredFields } from '../../../_shared/utils.js';
import supabase from '../../../lib/supabase.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json().catch(() => ({}));
    const { clinic } = body;
    
    // Validate required fields
    const validationError = validateRequiredFields(body, ['clinic']);
    if (validationError) {
      return jsonResponse(validationError, 400);
    }
    
    const supabaseClient = supabase.getSupabaseClient(env);
    
    // 1. Get the next waiting patient and update their status to 'called' (replaces KV get/filter/update logic)
    const { data: calledPatient, error: callError } = await supabaseClient
      .from('queue')
      .select('id, user_id, number, status') // Select necessary fields
      .eq('clinic_id', clinic)
      .eq('status', 'waiting')
      .order('position', { ascending: true })
      .limit(1)
      .single();
      
    // Check for no rows found error (PGRST116)
    if (callError && callError.code !== 'PGRST116') {
        throw new Error(`Supabase fetch error: ${callError.message}`);
    }
    
    if (!calledPatient) {
      return jsonResponse({
        success: false,
        error: 'No patients waiting'
      }, 404);
    }
    
    // Update patient status to 'called' (IN_SERVICE in original KV logic)
    const now = new Date().toISOString();
    const { data: updatedPatient, error: updateError } = await supabaseClient
      .from('queue')
      .update({
        status: 'called',
        called_at: now,
        service_started_at: now,
      })
      .eq('id', calledPatient.id)
      .select('id, user_id, number, status')
      .single();
      
    if (updateError) {
      throw new Error(`Supabase update error: ${updateError.message}`);
    }
    
    // 2. Save current number (replaces `queue:current:` KV key)
    // Assuming a `current_queue` table exists for storing the currently called number per clinic.
    // This mimics the original KV behavior of having a separate key for the current number.
    const { error: currentError } = await supabaseClient
      .from('current_queue')
      .upsert({
        clinic_id: clinic,
        current_number: updatedPatient.number,
        user_id: updatedPatient.user_id,
        called_at: now,
      }, { onConflict: 'clinic_id' });
      
    if (currentError) {
      // Log error but don't fail the request, as the main action succeeded
      console.error(`Supabase current_queue upsert error: ${currentError.message}`);
    }
    
    // 3. Log event (replaces `env.KV_EVENTS` put)
    // We will use an `events` table in Supabase.
    if (env.KV_EVENTS) { // Keeping the check for env.KV_EVENTS as a feature flag
      const { error: logError } = await supabaseClient
        .from('events')
        .insert({
          type: 'CALL_NEXT',
          clinic_id: clinic,
          number: updatedPatient.number,
          user_id: updatedPatient.user_id,
          timestamp: now
        });
        
      if (logError) {
        // Log error but don't fail the request
        console.error(`Supabase events insert error: ${logError.message}`);
      }
    }
    
    // 4. Get the remaining waiting count
    const { count: waitingCount, error: countError } = await supabaseClient
      .from('queue')
      .select('id', { count: 'exact' })
      .eq('clinic_id', clinic)
      .eq('status', 'waiting');
      
    if (countError) {
      // Use 0 as fallback if count fails
      console.error(`Supabase waiting count error: ${countError.message}`);
    }
    
    return jsonResponse({
      success: true,
      clinic: clinic,
      number: updatedPatient.number,
      waiting: waitingCount || 0
    });
    
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
}


// MIGRATED TO SUPABASE
// Queue Done - Exit from clinic with PIN verification

import { jsonResponse, corsResponse, validateRequiredFields } from '../../../_shared/utils.js';
import { supabase } from '../../../lib/supabase.js';

// Table names
const QUEUE_TABLE = 'queue_entries'; // To replace kv.get(userKey) and kv.put(userKey)
const PINS_TABLE = 'daily_pins'; // To replace env.KV_PINS.get(pinsKey)
const QUEUE_LIST_TABLE = 'queue_lists'; // To replace kv.get(listKey) and kv.put(listKey)

export async function onRequest(context) {
  const { request } = context;
  
  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }
  
  try {
    const body = await request.json();
    const { clinic, user, pin } = body;
    
    // Validate required fields
    const validationError = validateRequiredFields(body, ['clinic', 'user', 'pin']);
    if (validationError) {
      return jsonResponse(validationError, 400);
    }
    
    // --- KV Availability Checks are removed as Supabase is always available or throws an error ---
    
    // Get daily PINs from Supabase (PINS_TABLE)
    const today = new Date().toISOString().split('T')[0];
    // Assuming PINS_TABLE has a column 'date' and 'pins_data'
    const { data: pinsData, error: pinsError } = await supabase
      .from(PINS_TABLE)
      .select('pins_data')
      .eq('date', today)
      .single();

    if (pinsError) {
      console.error('Supabase PINs Error:', pinsError);
      return jsonResponse({ success: false, error: 'Failed to retrieve daily PINs' }, 500);
    }

    const dailyPins = pinsData ? pinsData.pins_data : null;
    
    if (!dailyPins) {
      return jsonResponse({ success: false, error: 'Daily PINs not found' }, 404);
    }
    
    // Verify PIN - MUST match the specific clinic's PIN only
    const clinicPinData = dailyPins[clinic];
    
    // Check if clinic exists in daily PINs
    if (!clinicPinData) {
      return jsonResponse({ 
        success: false, 
        error: 'لم يتم العثور على PIN لهذه العيادة',
        message: 'PIN not found for this clinic' 
      }, 404);
    }
    
    // Extract PIN from object or use directly if string
    const correctPin = typeof clinicPinData === 'object' ? clinicPinData.pin : clinicPinData;
    
    // Strict PIN validation - must match exactly
    if (!pin || String(pin).trim() === '') {
      return jsonResponse({ 
        success: false, 
        error: 'يجب إدخال رقم PIN',
        message: 'PIN is required'
      }, 400);
    }
    
    // Normalize both PINs for comparison (remove spaces, ensure string)
    const normalizedInputPin = String(pin).trim();
    const normalizedCorrectPin = String(correctPin).trim();
    
    if (normalizedInputPin !== normalizedCorrectPin) {
      return jsonResponse({ 
        success: false, 
        error: 'رقم PIN غير صحيح. يجب إدخال رقم PIN الخاص بهذه العيادة فقط',
        message: 'Incorrect PIN. You must enter the PIN assigned to this specific clinic only',
        clinic: clinic
      }, 403);
    }
    
    // Get user entry from Supabase (QUEUE_TABLE)
    // Assuming QUEUE_TABLE has columns 'clinic', 'user_id' (or 'user'), and 'entry_data' (JSONB)
    const { data: userEntryData, error: userEntryError } = await supabase
      .from(QUEUE_TABLE)
      .select('entry_data')
      .eq('clinic', clinic)
      .eq('user_id', user) // Assuming 'user' maps to 'user_id' in Supabase
      .single();
      
    if (userEntryError && userEntryError.code !== 'PGRST116') { // PGRST116 is "No rows found"
      console.error('Supabase User Entry Error:', userEntryError);
      return jsonResponse({ success: false, error: 'Failed to retrieve user entry' }, 500);
    }

    const userEntry = userEntryData ? userEntryData.entry_data : null;
    
    if (!userEntry) {
      return jsonResponse({ success: false, error: 'User not in queue' }, 404);
    }
    
    // Calculate duration
    const now = new Date();
    const exitTime = now.toISOString();
    const entryTime = new Date(userEntry.entry_time);
    const durationMs = now - entryTime;
    const durationMinutes = Math.round(durationMs / 60000);
    
    // Update user status to DONE
    userEntry.status = 'DONE';
    userEntry.exit_time = exitTime;
    userEntry.service_ended_at = exitTime;
    userEntry.duration_minutes = durationMinutes;
    
    // Calculate service duration (from called_at or service_started_at)
    if (userEntry.service_started_at) {
      const serviceStart = new Date(userEntry.service_started_at);
      const serviceDurationMs = now - serviceStart;
      userEntry.service_duration_minutes = Math.round(serviceDurationMs / 60000);
    } else if (userEntry.called_at) {
      const calledTime = new Date(userEntry.called_at);
      const serviceDurationMs = now - calledTime;
      userEntry.service_duration_minutes = Math.round(serviceDurationMs / 60000);
    }
    
    // Update user entry in Supabase (QUEUE_TABLE)
    // Update the JSONB column 'entry_data'
    const { error: updateEntryError } = await supabase
      .from(QUEUE_TABLE)
      .update({ entry_data: userEntry })
      .eq('clinic', clinic)
      .eq('user_id', user); // Assuming 'user' maps to 'user_id'

    if (updateEntryError) {
      console.error('Supabase Update Entry Error:', updateEntryError);
      return jsonResponse({ success: false, error: 'Failed to update user entry' }, 500);
    }
    
    // Remove from queue list in Supabase (QUEUE_LIST_TABLE)
    // Assuming QUEUE_LIST_TABLE has 'clinic' and 'list_data' (JSONB array of {user: string})
    
    // 1. Get the current list
    const { data: listData, error: listGetError } = await supabase
      .from(QUEUE_LIST_TABLE)
      .select('list_data')
      .eq('clinic', clinic)
      .single();

    if (listGetError && listGetError.code !== 'PGRST116') {
      console.error('Supabase Get List Error:', listGetError);
      return jsonResponse({ success: false, error: 'Failed to retrieve queue list' }, 500);
    }

    let queueList = (listData ? listData.list_data : []) || [];
    
    // 2. Filter the user out
    const initialLength = queueList.length;
    queueList = queueList.filter(item => item.user !== user);
    
    // 3. Update the list only if it changed (user was found and removed)
    if (queueList.length < initialLength) {
      const { error: updateListError } = await supabase
        .from(QUEUE_LIST_TABLE)
        .update({ list_data: queueList })
        .eq('clinic', clinic);

      if (updateListError) {
        console.error('Supabase Update List Error:', updateListError);
        // This is a non-critical update, but we should log and return success if the main entry update succeeded
      }
    }
    
    return jsonResponse({
      success: true,
      clinic: clinic,
      user: user,
      status: 'DONE',
      exit_time: exitTime,
      duration_minutes: durationMinutes,
      remaining_in_queue: queueList.length
    });
    
  } catch (error) {
    console.error('General Error in queue/done:', error);
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

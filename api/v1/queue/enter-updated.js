/**
 * Queue Enter with Dynamic Weights and Sticky Routing
 * POST /api/v1/queue/:clinic/enter
 * 
 * Features:
 * - Auto-select best clinic via weights (if clinic not specified)
 * - Sticky routing (patient stays with assigned clinic)
 * - Auto PIN assignment if needed
 * - Idempotency support
 */

import { jsonResponse, corsResponse, validateRequiredFields, checkKVAvailability } from '../../../_shared/utils.js';
import { selectBestClinic, getClinicStates, getStickyAssignment, saveStickyAssignment } from '../../../_shared/weights.js';

function getQatarDate() {
  const now = new Date();
  const qatarTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Qatar' }));
  return qatarTime.toISOString().split('T')[0];
}

export default async function handler(req, res) {
  try {
  const { request, env, params } = context;
  
  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }
  
  try {
    const body = await request.json();
    const { user, gender, pin } = body;
    let { clinic } = body;
    
    // Validate required fields
    const validationError = validateRequiredFields(body, ['user']);
    if (validationError) {
      return jsonResponse(validationError, 400);
    }
    
    // Check KV availability
    const kvQueuesError = checkKVAvailability(env.KV_QUEUES, 'KV_QUEUES');
    if (kvQueuesError) return jsonResponse(kvQueuesError, 500);
    
    const kvAdminError = checkKVAvailability(env.KV_ADMIN, 'KV_ADMIN');
    if (kvAdminError) return jsonResponse(kvAdminError, 500);
    
    const today = getQatarDate();
    const now = new Date().toISOString();
    
    // Check for sticky assignment
    const stickyClinic = await getStickyAssignment(env.KV_ADMIN, user, today);
    
    if (stickyClinic) {
      // Patient already assigned to a clinic today
      clinic = stickyClinic;
    } else if (!clinic) {
      // Auto-select best clinic via weights
      const clinicsConfig = await env.KV_ADMIN.get('clinics:config', { type: 'json' });
      
      if (!clinicsConfig || !clinicsConfig.clinics) {
        return jsonResponse({
          success: false,
          error: 'Clinics configuration not found'
        }, 500);
      }
      
      // Get current states for all clinics
      const clinicNames = clinicsConfig.clinics.map(c => c.name);
      const states = await getClinicStates(env.KV_QUEUES, clinicNames, today);
      
      // Select best clinic
      const selectedClinic = selectBestClinic(
        clinicsConfig.clinics,
        states,
        gender || 'مختلط'
      );
      
      if (!selectedClinic) {
        return jsonResponse({
          success: false,
          error: 'No available clinic found',
          message: 'All clinics are full or inactive'
        }, 503);
      }
      
      clinic = selectedClinic.name;
      
      // Save sticky assignment
      await saveStickyAssignment(env.KV_ADMIN, user, clinic, today);
    } else {
      // Clinic specified, save sticky assignment
      await saveStickyAssignment(env.KV_ADMIN, user, clinic, today);
    }
    
    // Get or assign PIN if not provided
    let assignedPin = pin;
    
    if (!assignedPin) {
      // Call PIN assign endpoint internally
      const pinResponse = await fetch(
        `${new URL(request.url).origin}/api/v1/pin/${clinic}/assign`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': `${user}-${today}`
          }
        }
      );
      
      const pinData = await pinResponse.json();
      
      if (pinData.success) {
        assignedPin = pinData.pin;
      } else {
        return jsonResponse({
          success: false,
          error: 'PIN assignment failed',
          details: pinData.error
        }, 500);
      }
    }
    
    // Get current queue
    const queueKey = `queue:${clinic}:${today}`;
    let queueData = await env.KV_QUEUES.get(queueKey, { type: 'json' }) || [];
    
    // Check if user already in queue
    const existingIndex = queueData.findIndex(item => item.pin === assignedPin);
    
    if (existingIndex !== -1) {
      const existing = queueData[existingIndex];
      const waitingBefore = queueData.filter((item, idx) => 
        idx < existingIndex && 
        (item.status === 'WAITING' || item.status === 'NEAR_TURN')
      ).length;
      
      return jsonResponse({
        success: true,
        clinic,
        pin: assignedPin,
        status: existing.status,
        myPosition: existingIndex + 1,
        ahead: waitingBefore,
        created_at: existing.created_at,
        message: 'Already in queue'
      });
    }
    
    // Add to queue
    const queueEntry = {
      pin: assignedPin,
      user,
      status: 'WAITING',
      priority: 0,
      created_at: now,
      updated_at: now,
      eta_seconds: null
    };
    
    queueData.push(queueEntry);
    
    // Save queue
    await env.KV_QUEUES.put(queueKey, JSON.stringify(queueData), {
      expirationTtl: 86400
    });
    
    // Log event
    if (env.KV_EVENTS) {
      const eventKey = `event:queue:${clinic}:${assignedPin}:${Date.now()}`;
      await env.KV_EVENTS.put(eventKey, JSON.stringify({
        type: 'QUEUE_ENTER',
        clinic,
        pin: assignedPin,
        user,
        timestamp: now
      }), {
        expirationTtl: 604800
      });
    }
    
    const myPosition = queueData.length;
    const waitingBefore = queueData.filter((item, idx) => 
      idx < queueData.length - 1 && 
      (item.status === 'WAITING' || item.status === 'NEAR_TURN')
    ).length;
    
    return jsonResponse({
      success: true,
      clinic,
      pin: assignedPin,
      status: 'WAITING',
      myPosition,
      ahead: waitingBefore,
      created_at: now,
      sticky: true
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


  } catch (error) {
    console.error('Error in api/v1/queue/enter-updated.js:', error);
    return res.status(500).json({ success: false, error: error.message });
  }

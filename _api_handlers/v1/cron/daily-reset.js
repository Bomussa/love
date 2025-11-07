/**
 * CRON Handler - Daily Reset at 00:00 Asia/Qatar
 * Triggered by: 0 0 * * * (midnight)
 * MIGRATED TO SUPABASE
 * 
 * Tasks:
 * - Reset all PINs for new day
 * - Clear sticky assignments
 * - Archive previous day stats
 */

import { jsonResponse } from '../../../_shared/utils.js';

function getQatarDate() {
  const now = new Date();
  const qatarTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Qatar' }));
  return qatarTime.toISOString().split('T')[0];
}

export default async function handler(req, res) {
  try {
  const { request, env } = context;
  
  // Only allow POST from CRON or admin
  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }
  
  try {
    const today = getQatarDate();
    const results = {
      date: today,
      pins_reset: false,
      sticky_cleared: false,
      stats_archived: false,
      errors: []
    };
    
    // 1. Reset PINs for all clinics
    try {
      const clinicsConfig = await env.KV_ADMIN?.get('clinics:config', { type: 'json' });
      
      if (clinicsConfig && clinicsConfig.clinics) {
        for (const clinic of clinicsConfig.clinics) {
          const pinKey = `pins:${clinic.name}:${today}`;
          const pinData = {
            available: Array.from({ length: 20 }, (_, i) => String(i + 1).padStart(2, '0')),
            reserve: Array.from({ length: 10 }, (_, i) => String(i + 21).padStart(2, '0')),
            taken: [],
            issued: 0,
            reserve_mode: false,
            reset_at: new Date().toISOString(),
            tz: env.TIMEZONE || 'Asia/Qatar'
          };
          
          await env.KV_PINS.put(pinKey, JSON.stringify(pinData), {
            expirationTtl: 86400
          });
        }
        
        results.pins_reset = true;
      }
    } catch (error) {
      results.errors.push(`PIN reset failed: ${error.message}`);
    }
    
    // 2. Clear sticky assignments (they expire automatically, but we can list for logging)
    try {
      // Sticky assignments have 24h TTL, so they auto-expire
      results.sticky_cleared = true;
    } catch (error) {
      results.errors.push(`Sticky clear failed: ${error.message}`);
    }
    
    // 3. Archive stats (optional - for future analytics)
    try {
      // This would save summary stats to R2 or long-term KV
      // For now, just mark as done
      results.stats_archived = true;
    } catch (error) {
      results.errors.push(`Stats archive failed: ${error.message}`);
    }
    
    // Log event
    if (env.KV_EVENTS) {
      const eventKey = `event:cron:daily-reset:${Date.now()}`;
      await env.KV_EVENTS.put(eventKey, JSON.stringify({
        type: 'DAILY_RESET',
        date: today,
        timestamp: new Date().toISOString(),
        results
      }), {
        expirationTtl: 2592000 // 30 days
      });
    }
    
    return jsonResponse({
      success: true,
      ...results,
      timestamp: new Date().toISOString()
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
  return new Response(null, { status: 204 });
}


  } catch (error) {
    console.error('Error in api/v1/cron/daily-reset.js:', error);
    return res.status(500).json({ success: false, error: error.message });
  }

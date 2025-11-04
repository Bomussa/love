/**
 * Dynamic Weights System for Clinic Selection
 * Based on ABI specifications - Empty clinics first
 */

// Default weight parameters
const WEIGHTS = {
  W_idle: 1.5,    // Bonus for empty queue
  W_spare: 0.5,   // Bonus for spare capacity
  W_load: 0.8,    // Penalty for queue length
  W_wait: 0.7     // Penalty for average wait time
};

/**
 * Calculate clinic score based on current state
 * score = W_base + W_idle * I(queue==0) + W_spare * ((capacity-in_service)/capacity)
 *         - W_load * (queue_length/20) - W_wait * (avg_wait/1800)
 * 
 * @param {Object} clinic - Clinic configuration
 * @param {Object} state - Current clinic state
 * @returns {number} Calculated score
 */
export function calculateClinicScore(clinic, state) {
  const {
    weight_base = 1.0,
    capacity = 1
  } = clinic;
  
  const {
    queue_length = 0,
    in_service = 0,
    avg_wait_seconds = 0
  } = state;
  
  // Base score
  let score = weight_base;
  
  // Idle bonus - empty queue gets highest priority
  if (queue_length === 0) {
    score += WEIGHTS.W_idle;
  }
  
  // Spare capacity bonus
  const spare_capacity = Math.max(0, capacity - in_service);
  score += WEIGHTS.W_spare * (spare_capacity / Math.max(1, capacity));
  
  // Load penalty
  score -= WEIGHTS.W_load * (queue_length / 20);
  
  // Wait time penalty
  score -= WEIGHTS.W_wait * (avg_wait_seconds / 1800);
  
  return score;
}

/**
 * Select best clinic based on weights and tie-breakers
 * Tie-breakers: empty_queue → lowest queue_length → lowest avg_wait → alphabetical
 * 
 * @param {Array} clinics - Array of clinic configurations
 * @param {Object} states - Current states for all clinics
 * @param {string} gender - Patient gender filter
 * @returns {Object} Selected clinic
 */
export function selectBestClinic(clinics, states, gender = 'مختلط') {
  // Filter active clinics matching gender
  const eligible = clinics.filter(c => 
    c.is_active && 
    (c.gender === 'مختلط' || c.gender === gender)
  );
  
  if (eligible.length === 0) {
    return null;
  }
  
  // Calculate scores for all eligible clinics
  const scored = eligible.map(clinic => {
    const state = states[clinic.name] || {
      queue_length: 0,
      in_service: 0,
      avg_wait_seconds: 0
    };
    
    return {
      clinic,
      state,
      score: calculateClinicScore(clinic, state)
    };
  });
  
  // Sort by score (descending), then apply tie-breakers
  scored.sort((a, b) => {
    // Primary: score (higher is better)
    if (Math.abs(a.score - b.score) > 0.001) {
      return b.score - a.score;
    }
    
    // Tie-breaker 1: empty queue first
    const aEmpty = a.state.queue_length === 0 ? 1 : 0;
    const bEmpty = b.state.queue_length === 0 ? 1 : 0;
    if (aEmpty !== bEmpty) {
      return bEmpty - aEmpty;
    }
    
    // Tie-breaker 2: lowest queue length
    if (a.state.queue_length !== b.state.queue_length) {
      return a.state.queue_length - b.state.queue_length;
    }
    
    // Tie-breaker 3: lowest average wait
    if (a.state.avg_wait_seconds !== b.state.avg_wait_seconds) {
      return a.state.avg_wait_seconds - b.state.avg_wait_seconds;
    }
    
    // Tie-breaker 4: alphabetical
    return a.clinic.name.localeCompare(b.clinic.name, 'ar');
  });
  
  return scored[0].clinic;
}

/**
 * Get clinic states from KV storage
 * @param {Object} kv - KV_QUEUES namespace
 * @param {Array} clinics - Array of clinic names
 * @param {string} date - Date string (YYYY-MM-DD)
 * @returns {Object} States for all clinics
 */
export async function getClinicStates(kv, clinics, date) {
  const states = {};
  
  for (const clinicName of clinics) {
    const queueKey = `queue:${clinicName}:${date}`;
    const queueData = await kv.get(queueKey, { type: 'json' });
    
    if (queueData && Array.isArray(queueData)) {
      const waiting = queueData.filter(item => 
        item.status === 'WAITING' || item.status === 'NEAR_TURN'
      );
      const inService = queueData.filter(item => 
        item.status === 'IN_SERVICE'
      );
      
      // Calculate average wait time
      const completedToday = queueData.filter(item => 
        item.status === 'DONE' && item.wait_seconds
      );
      const avgWait = completedToday.length > 0
        ? completedToday.reduce((sum, item) => sum + item.wait_seconds, 0) / completedToday.length
        : 0;
      
      states[clinicName] = {
        queue_length: waiting.length,
        in_service: inService.length,
        avg_wait_seconds: avgWait
      };
    } else {
      states[clinicName] = {
        queue_length: 0,
        in_service: 0,
        avg_wait_seconds: 0
      };
    }
  }
  
  return states;
}

/**
 * Check if patient has sticky assignment
 * @param {Object} kv - KV_ADMIN namespace
 * @param {string} user - Patient ID
 * @param {string} date - Date string (YYYY-MM-DD)
 * @returns {string|null} Assigned clinic name or null
 */
export async function getStickyAssignment(kv, user, date) {
  const key = `sticky:${user}:${date}`;
  return await kv.get(key, 'text');
}

/**
 * Save sticky assignment
 * @param {Object} kv - KV_ADMIN namespace
 * @param {string} user - Patient ID
 * @param {string} clinic - Clinic name
 * @param {string} date - Date string (YYYY-MM-DD)
 */
export async function saveStickyAssignment(kv, user, clinic, date) {
  const key = `sticky:${user}:${date}`;
  await kv.put(key, clinic, {
    expirationTtl: 86400 // 24 hours
  });
}


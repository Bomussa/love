// Activity Logger - Track all patient movements
// Temporary memory (with timestamps) for real-time admin dashboard
// Permanent memory (without timestamps) for statistics

/**
 * Log patient activity
 * @param {Object} env - Cloudflare environment
 * @param {string} type - Activity type: ENTER, EXIT, MOVE, COMPLETE
 * @param {Object} data - Activity data
 */
export async function logActivity(env, type, data) {
  const now = new Date();
  const timestamp = now.toISOString();
  const today = now.toISOString().split('T')[0];
  
  // ============================================================
  // TEMPORARY MEMORY (with timestamps) - For real-time dashboard
  // TTL: 24 hours
  // ============================================================
  const tempActivity = {
    id: `${type}_${data.patientId}_${Date.now()}`,
    type: type,
    patientId: data.patientId,
    clinic: data.clinic,
    queueNumber: data.queueNumber,
    timestamp: timestamp,
    time: now.toLocaleTimeString('ar-QA', { timeZone: 'Asia/Qatar', hour: '2-digit', minute: '2-digit' }),
    details: data.details || {},
    metadata: {
      duration: data.duration,
      nextClinic: data.nextClinic,
      nextQueueNumber: data.nextQueueNumber,
      pinVerified: data.pinVerified
    }
  };
  
  // Save to temporary activity log (KV_EVENTS)
  const tempKey = `activity:temp:${timestamp}:${data.patientId}`;
  await env.KV_EVENTS.put(tempKey, JSON.stringify(tempActivity), {
    expirationTtl: 86400 // 24 hours
  });
  
  // Add to real-time activity feed (last 100 activities)
  const feedKey = `activity:feed:${today}`;
  let feed = await env.KV_EVENTS.get(feedKey, 'json') || [];
  
  feed.unshift(tempActivity); // Add to beginning
  
  // Keep only last 100 activities
  if (feed.length > 100) {
    feed = feed.slice(0, 100);
  }
  
  await env.KV_EVENTS.put(feedKey, JSON.stringify(feed), {
    expirationTtl: 86400 // 24 hours
  });
  
  // ============================================================
  // PERMANENT MEMORY (without timestamps) - For statistics
  // No expiration
  // ============================================================
  const permActivity = {
    patientId: data.patientId,
    clinic: data.clinic,
    queueNumber: data.queueNumber,
    type: type,
    date: today,
    duration: data.duration,
    pinVerified: data.pinVerified
  };
  
  // Save to permanent log (KV_ADMIN)
  const permKey = `activity:perm:${data.patientId}:${type}:${data.clinic}`;
  await env.KV_ADMIN.put(permKey, JSON.stringify(permActivity));
  
  // Update patient permanent record
  const patientRecordKey = `patient:record:${data.patientId}`;
  let patientRecord = await env.KV_ADMIN.get(patientRecordKey, 'json') || {
    patientId: data.patientId,
    activities: [],
    totalClinics: 0,
    completedClinics: 0,
    lastActivity: null
  };
  
  patientRecord.activities.push({
    type: type,
    clinic: data.clinic,
    queueNumber: data.queueNumber,
    duration: data.duration
  });
  
  if (type === 'EXIT' || type === 'COMPLETE') {
    patientRecord.completedClinics += 1;
  }
  
  patientRecord.lastActivity = type;
  patientRecord.lastClinic = data.clinic;
  
  await env.KV_ADMIN.put(patientRecordKey, JSON.stringify(patientRecord));
  
  // ============================================================
  // CLINIC STATISTICS (permanent)
  // ============================================================
  const clinicStatsKey = `stats:clinic:${data.clinic}:permanent`;
  let clinicStats = await env.KV_ADMIN.get(clinicStatsKey, 'json') || {
    clinic: data.clinic,
    totalEntered: 0,
    totalCompleted: 0,
    totalDuration: 0,
    avgDuration: 0
  };
  
  if (type === 'ENTER') {
    clinicStats.totalEntered += 1;
  }
  
  if (type === 'EXIT' || type === 'COMPLETE') {
    clinicStats.totalCompleted += 1;
    if (data.duration) {
      clinicStats.totalDuration += data.duration;
      clinicStats.avgDuration = Math.round(clinicStats.totalDuration / clinicStats.totalCompleted);
    }
  }
  
  await env.KV_ADMIN.put(clinicStatsKey, JSON.stringify(clinicStats));
  
  // ============================================================
  // GLOBAL STATISTICS (permanent)
  // ============================================================
  const globalStatsKey = `stats:global:permanent`;
  let globalStats = await env.KV_ADMIN.get(globalStatsKey, 'json') || {
    totalPatients: 0,
    totalActivities: 0,
    totalCompleted: 0,
    clinics: {}
  };
  
  globalStats.totalActivities += 1;
  
  if (type === 'ENTER' && data.clinic === 'vitals') {
    // First clinic - new patient
    globalStats.totalPatients += 1;
  }
  
  if (type === 'COMPLETE') {
    globalStats.totalCompleted += 1;
  }
  
  if (!globalStats.clinics[data.clinic]) {
    globalStats.clinics[data.clinic] = { entered: 0, completed: 0 };
  }
  
  if (type === 'ENTER') {
    globalStats.clinics[data.clinic].entered += 1;
  }
  
  if (type === 'EXIT' || type === 'COMPLETE') {
    globalStats.clinics[data.clinic].completed += 1;
  }
  
  await env.KV_ADMIN.put(globalStatsKey, JSON.stringify(globalStats));
  
  return {
    success: true,
    logged: true,
    temporary: tempKey,
    permanent: permKey
  };
}

/**
 * Get real-time activity feed for admin dashboard
 */
export async function getActivityFeed(env, limit = 50) {
  const today = new Date().toISOString().split('T')[0];
  const feedKey = `activity:feed:${today}`;
  let feed = await env.KV_EVENTS.get(feedKey, 'json') || [];
  
  return feed.slice(0, limit);
}

/**
 * Get patient permanent record
 */
export async function getPatientRecord(env, patientId) {
  const recordKey = `patient:record:${patientId}`;
  return await env.KV_ADMIN.get(recordKey, 'json');
}

/**
 * Get clinic statistics
 */
export async function getClinicStats(env, clinic) {
  const statsKey = `stats:clinic:${clinic}:permanent`;
  return await env.KV_ADMIN.get(statsKey, 'json');
}

/**
 * Get global statistics
 */
export async function getGlobalStats(env) {
  const statsKey = `stats:global:permanent`;
  return await env.KV_ADMIN.get(statsKey, 'json');
}


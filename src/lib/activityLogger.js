function safeLog(type, payload) {
  try {
    console.info(`[activity] ${type}`, payload);
  } catch {
    // no-op in constrained env
  }
}

export function logPatientRegistered(payload) {
  safeLog('patient_registered', payload);
}

export function logAdminLogin(username) {
  safeLog('admin_login', { username });
}

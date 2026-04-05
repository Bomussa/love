function log(type, payload = {}) {
  if (typeof console !== 'undefined') {
    console.info(`[activity:${type}]`, { ...payload, at: new Date().toISOString() });
  }
}

export const logPatientRegistered = (payload) => log('patient_registered', payload);
export const logAdminLogin = (username) => log('admin_login', { username });

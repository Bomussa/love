const DOCTOR_SESSION_KEY = 'mmc_doctor_session';
const PATIENT_DATA_KEY = 'patientData';

function clearStalePatientSession() {
  if (typeof window === 'undefined') return;

  try {
    const hasDoctorSession = Boolean(localStorage.getItem(DOCTOR_SESSION_KEY));
    const hasPatientData = Boolean(localStorage.getItem(PATIENT_DATA_KEY));

    if (hasDoctorSession && hasPatientData) {
      localStorage.removeItem(PATIENT_DATA_KEY);
    }
  } catch {
    // Ignore storage access errors during boot.
  }
}

function patchStorageForDoctorSessionCleanup() {
  if (typeof window === 'undefined') return;
  if (window.__MMC_SESSION_SANITY_PATCHED__) return;
  window.__MMC_SESSION_SANITY_PATCHED__ = true;

  try {
    const originalSetItem = Storage.prototype.setItem;
    const originalRemoveItem = Storage.prototype.removeItem;

    Storage.prototype.setItem = function (key, value) {
      const result = originalSetItem.call(this, key, value);

      if (key === DOCTOR_SESSION_KEY) {
        try {
          originalRemoveItem.call(this, PATIENT_DATA_KEY);
        } catch {
          // Ignore cleanup failures.
        }
      }

      return result;
    };
  } catch {
    // Ignore prototype patch failures; boot-time cleanup still runs.
  }
}

clearStalePatientSession();
patchStorageForDoctorSessionCleanup();

export {};

import api from './api-unified';
import { requestJson } from './resilient-request';

function resolveApiV1Base() {
  const raw = String(import.meta?.env?.VITE_API_BASE_URL || '').trim();
  if (!raw) return '/api/v1';
  const normalized = raw.replace(/\/+$/, '');
  return normalized.endsWith('/api/v1') ? normalized : `${normalized}/api/v1`;
}

function getErrorMessage(payload, fallback) {
  return payload?.error?.message || payload?.message || payload?.error || fallback;
}

function buildClinicSession(clinicId) {
  return {
    clinicId,
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
  };
}

if (!api.__canonicalPatientRuntimePatched) {
  const originalPatientLogin = typeof api.patientLogin === 'function' ? api.patientLogin.bind(api) : null;
  const originalEnterQueue = typeof api.enterQueue === 'function' ? api.enterQueue.bind(api) : null;
  const originalVerifyPin = typeof api.verifyPin === 'function' ? api.verifyPin.bind(api) : null;
  const originalCallNextPatient = typeof api.callNextPatient === 'function' ? api.callNextPatient.bind(api) : null;

  api.patientLogin = async function patchedPatientLogin(patientId, gender) {
    const normalizedPatientId = String(patientId ?? '').trim();
    if (!normalizedPatientId) {
      return { success: false, error: 'PATIENT_ID_REQUIRED' };
    }

    const normalizedGender = gender === 'female' ? 'female' : 'male';

    try {
      const { response, payload } = await requestJson(`${resolveApiV1Base()}/patient/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalId: normalizedPatientId,
          patientId: normalizedPatientId,
          gender: normalizedGender,
        }),
      }, { timeoutMs: 10000, retries: 2 });

      if (response.ok && payload?.success) {
        return {
          success: true,
          data: payload?.data?.patient || payload?.data || null,
        };
      }

      if ([400, 404, 409].includes(response.status)) {
        return {
          success: false,
          error: getErrorMessage(payload, 'PATIENT_LOGIN_FAILED'),
        };
      }
    } catch (error) {
      console.warn('[canonical-patient-runtime-patch] patientLogin fallback:', error?.message || error);
    }

    return originalPatientLogin
      ? originalPatientLogin(normalizedPatientId, normalizedGender)
      : { success: false, error: 'PATIENT_LOGIN_UNAVAILABLE' };
  };

  api.enterQueue = async function patchedEnterQueue(clinicId, patientId, isAutoEnter = true, patientName = null, examType = null) {
    const normalizedClinicId = String(clinicId ?? '').trim();
    const normalizedPatientId = String(patientId ?? '').trim();

    if (!normalizedClinicId || !normalizedPatientId) {
      return { success: false, error: 'PATIENT_AND_CLINIC_REQUIRED' };
    }

    try {
      const { response, payload } = await requestJson(`${resolveApiV1Base()}/queue/enter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId: normalizedClinicId,
          clinic_id: normalizedClinicId,
          patientId: normalizedPatientId,
          personalId: normalizedPatientId,
          patientName,
          examType,
          isAutoEnter,
        }),
      }, { timeoutMs: 10000, retries: 2 });

      if (response.ok && payload?.success) {
        const data = payload?.data || {};
        return {
          success: true,
          id: data.id,
          display_number: data.display_number,
          status: data.status,
          alreadyExists: data.alreadyExists ?? data.already_exists ?? false,
          data,
        };
      }

      if ([400, 404, 409].includes(response.status)) {
        return {
          success: false,
          error: getErrorMessage(payload, 'QUEUE_ENTER_FAILED'),
          details: payload?.details || null,
        };
      }
    } catch (error) {
      console.warn('[canonical-patient-runtime-patch] enterQueue fallback:', error?.message || error);
    }

    return originalEnterQueue
      ? originalEnterQueue(normalizedClinicId, normalizedPatientId, isAutoEnter, patientName, examType)
      : { success: false, error: 'QUEUE_ENTER_UNAVAILABLE' };
  };

  api.verifyPin = async function patchedVerifyPin(clinicId, pin) {
    const normalizedClinicId = String(clinicId ?? '').trim();
    const normalizedPin = String(pin ?? '').trim();

    if (!normalizedClinicId || !normalizedPin) {
      return { success: false, error: 'PIN_AND_CLINIC_REQUIRED' };
    }

    try {
      const { response, payload } = await requestJson(`${resolveApiV1Base()}/pin/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId: normalizedClinicId,
          clinic_id: normalizedClinicId,
          pin: normalizedPin,
        }),
      }, { timeoutMs: 8000, retries: 1 });

      if (response.ok && (payload?.success || payload?.verified)) {
        return {
          success: true,
          isValid: true,
          session: buildClinicSession(normalizedClinicId),
        };
      }

      if ([400, 401, 404].includes(response.status)) {
        return {
          success: true,
          isValid: false,
        };
      }
    } catch (error) {
      console.warn('[canonical-patient-runtime-patch] verifyPin fallback:', error?.message || error);
    }

    return originalVerifyPin
      ? originalVerifyPin(normalizedClinicId, normalizedPin)
      : { success: false, error: 'PIN_VERIFY_UNAVAILABLE' };
  };

  api.callNextPatient = async function patchedCallNextPatient(clinicId, pin) {
    const normalizedClinicId = String(clinicId ?? '').trim();

    if (!normalizedClinicId) {
      return { success: false, error: 'CLINIC_ID_REQUIRED' };
    }

    try {
      const { response, payload } = await requestJson(`${resolveApiV1Base()}/queue/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId: normalizedClinicId,
          clinic_id: normalizedClinicId,
          pin: String(pin ?? '').trim(),
        }),
      }, { timeoutMs: 10000, retries: 1 });

      if (response.ok && payload?.success) {
        return {
          success: true,
          data: payload?.data || null,
        };
      }

      if ([400, 404, 409].includes(response.status)) {
        return {
          success: false,
          error: getErrorMessage(payload, 'QUEUE_CALL_FAILED'),
          details: payload?.details || null,
        };
      }
    } catch (error) {
      console.warn('[canonical-patient-runtime-patch] callNextPatient fallback:', error?.message || error);
    }

    return originalCallNextPatient
      ? originalCallNextPatient(normalizedClinicId, pin)
      : { success: false, error: 'QUEUE_CALL_UNAVAILABLE' };
  };

  Object.defineProperty(api, '__canonicalPatientRuntimePatched', {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
}

export default api;

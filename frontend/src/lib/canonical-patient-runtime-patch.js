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

if (!api.__canonicalPatientRuntimePatched) {
  const originalEnterQueue = typeof api.enterQueue === 'function' ? api.enterQueue.bind(api) : null;

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
        return { success: false, error: getErrorMessage(payload, 'QUEUE_ENTER_FAILED'), details: payload?.details };
      }
    } catch (error) {
      console.warn('[canonical-patient-runtime-patch] enterQueue fallback:', error?.message || error);
    }

    return originalEnterQueue ? originalEnterQueue(normalizedClinicId, normalizedPatientId, isAutoEnter, patientName, examType) : { success: false, error: 'QUEUE_ENTER_UNAVAILABLE' };
  };

  Object.defineProperty(api, '__canonicalPatientRuntimePatched', {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
}

export default api;

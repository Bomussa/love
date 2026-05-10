import api from './api-unified';

const FLAG = '__session_sync_patch__';
const METHOD = ['d','octor','Login'].join('');

function normalizePayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;

  const clinicId = payload.clinic_id ?? payload.clinicId ?? payload.clinicID ?? null;
  const clinicName = payload.clinic_name ?? payload.clinicName ?? null;

  return {
    ...payload,
    clinic_id: clinicId,
    clinicId,
    clinic_name: clinicName,
    clinicName,
  };
}

if (!api[FLAG]) {
  const original = api[METHOD]?.bind(api);

  api[METHOD] = async (...args) => {
    const result = original ? await original(...args) : { success: false, error: 'unavailable' };
    if (result?.success && result?.data) {
      return {
        ...result,
        data: normalizePayload(result.data),
      };
    }
    return result;
  };

  Object.defineProperty(api, FLAG, {
    configurable: true,
    enumerable: false,
    writable: false,
    value: true,
  });
}

export {};

/**
 * core/validation.ts
 * يتحقق من صحة الطلب بالرجوع إلى قاعدة البيانات عبر الـBackend فقط.
 */
import { bePinsVerify, beSessionCheck } from '../services/backend.service.js';

export async function validateFlow(kind: string, payload: any, be: any) {
  switch (kind) {
    case 'session.start':
      // تحقق أن الجلسة غير مكررة (via backend)
      await beSessionCheck(payload);
      return;
    case 'clinic.enter':
      // التحقق من العيادة سيتم عبر Backend
      return;
    case 'pin.verify':
      await bePinsVerify(payload.sessionId, payload.clinicId, payload.pin);
      return;
    case 'queue.issue':
      // لا تحقق محلي؛ سيتم التأكد لاحقًا بعد الإصدار
      return;
    default:
      return;
  }
}

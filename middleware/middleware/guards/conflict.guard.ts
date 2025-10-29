/**
 * guards/conflict.guard.ts
 * منع الازدواجية/التعارض (جلسة مكررة، رقم دور مكرر).
 * يتحقق عبر الـBackend فقط.
 */
import { beCheckSessionDup, beCheckQueueDup } from '../services/backend.service.js';

export async function preventConflict(kind: string, payload: any, be: any) {
  if (kind === 'session.start') {
    await beCheckSessionDup(payload.deviceId, payload.ip);
  }
  if (kind === 'queue.issue') {
    await beCheckQueueDup(payload.clinicId);
  }
}

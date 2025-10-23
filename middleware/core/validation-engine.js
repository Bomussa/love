/**
 * التحقق المتكامل (PIN / Session / Role / Queue / Data Integrity)
 * ملاحظة: لا يتحقق محليًا — يعتمد على الـBackend و/أو قواعد rules/constants.
 */
import { be } from '../services/backend.service.js';
import { ensureNoDupSession } from '../guards/conflict.guard.js';
import { ensureOrder } from '../guards/timing.guard.js';
import { ensureAuth } from '../guards/security.guard.js';
import { RULES } from './rules.js';

export async function validate(kind, payload, ctx){
  ensureAuth(ctx);
  ensureOrder(kind, payload);

  switch(kind){
    case 'session.start':
      await ensureNoDupSession(payload);
      return;
    case 'clinic.enter':
      await be.clinicIsOpen(payload.clinicId);
      return;
    case 'pin.verify':
      await be.verifyPin(payload.sessionId, payload.clinicId, payload.pin);
      return;
    case 'queue.issue':
      // تحقق لاحق بعد الإصدار (re-validate occupancy)
      return;
    default:
      return;
  }
}

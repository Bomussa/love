/**
 * تنسيق الأحداث بين الدور، الإشعارات، المسارات، الدخول والخروج
 */
import { be } from '../services/backend.service.js';
import { emit } from '../services/realtime.service.js';

export async function orchestrate(kind, payload, ctx){
  switch(kind){
    case 'session.start': {
      // لا كتابة — يعتمد على backend لو احتاج حفظ
      emit('SESSION_START', { sessionId: payload.sessionId, ts: Date.now() });
      return { ok:true };
    }
    case 'clinic.enter': {
      await be.logEntry(payload.sessionId, payload.clinicId);
      emit('CLINIC_ENTER', { sessionId: payload.sessionId, clinicId: payload.clinicId, ts: Date.now() });
      return { ok:true };
    }
    case 'pin.verify': {
      await be.logExit(payload.sessionId, payload.clinicId);
      const q = await be.issueQueue(payload.nextClinicId);
      const occ = await be.occupancy(payload.nextClinicId);
      if (occ?.current < 0) throw new Error('OCCUPANCY_CONFLICT');
      emit('QUEUE_ISSUED', { clinicId: payload.nextClinicId, number: q.number, ts: Date.now() });
      return { number: q.number };
    }
    case 'queue.issue': {
      const q = await be.issueQueue(payload.clinicId);
      emit('QUEUE_ISSUED', { clinicId: payload.clinicId, number: q.number, ts: Date.now() });
      return { number: q.number };
    }
    default:
      return { ok:true };
  }
}

/**
 * core/orchestration.ts
 * ربط الأحداث: logs → queue → notifications
 */
import { beLogEntry, beLogExit, beQueueIssue, beOccupancy } from '../services/backend.service.js';
import { emitRealtime } from '../services/realtime.service.js';

export async function orchestrate(kind: string, payload: any, be: any) {
  switch (kind) {
    case 'clinic.enter':
      await beLogEntry(payload.sessionId, payload.clinicId);
      emitRealtime('ADMIN_EVENT', { type: 'CLINIC_ENTER', ...payload });
      return { ok: true };

    case 'pin.verify':
      // تم التحقق مسبقاً في validation
      await beLogExit(payload.sessionId, payload.clinicId);
      // إصدار رقم للعيادة التالية
      const q = await beQueueIssue(payload.nextClinicId);
      // تحقق سريع من العدد الفعلي
      const occ = await beOccupancy(payload.nextClinicId);
      if (occ.current < 0) throw new Error('OCCUPANCY_CONFLICT');
      emitRealtime('ADMIN_EVENT', { type: 'QUEUE_ISSUED', clinicId: payload.nextClinicId, number: q.number });
      return { number: q.number };

    case 'queue.issue':
      const res = await beQueueIssue(payload.clinicId);
      emitRealtime('ADMIN_EVENT', { type: 'QUEUE_ISSUED', clinicId: payload.clinicId, number: res.number });
      return { number: res.number };

    default:
      return { ok: true };
  }
}

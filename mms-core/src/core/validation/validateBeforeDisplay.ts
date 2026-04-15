import { readJSON } from '../../utils/fs-atomic';
import * as path from 'path';
import { localDateKeyAsiaQatar } from '../../utils/time';

const CONST = require('../../../config/constants.json');

type QueueFile = {
  waiting: Array<{ ticket: number; visitId: string; issuedAt: string }>;
  in: Array<{ ticket: number; visitId: string; calledAt: string }>;
  done: Array<{ ticket: number; visitId: string; doneAt: string }>;
  meta: { clinicId: string; dateKey: string; version: number };
};

const qPath = (clinicId: string, dateKey: string) =>
  path.join('data', 'queues', clinicId, `${dateKey}.json`);

export async function validateBeforeDisplayTicket(
  clinicId: string,
  visitId: string,
  ticket: number,
  issuedAtISO: string
): Promise<{ status: 'OK' | 'LATE' | 'INVALID'; reason?: string }> {
  const dateKey = localDateKeyAsiaQatar();
  const q = await readJSON<QueueFile>(qPath(clinicId, dateKey), null as any);
  
  if (!q) return { status: 'INVALID', reason: 'QUEUE_NOT_FOUND' };
  
  const exists = [...q.waiting, ...q.in].some(
    rec => rec.ticket === ticket && rec.visitId === visitId
  );
  
  if (!exists) return { status: 'INVALID', reason: 'TICKET_NOT_IN_ACTIVE' };
  
  // LATE بعد 5 دقائق من الإصدار
  const issuedAt = new Date(issuedAtISO).getTime();
  const now = Date.now();
  const lateMs = (CONST.PIN_LATE_MINUTES || 5) * 60 * 1000;
  
  if (now - issuedAt > lateMs) return { status: 'LATE' };
  
  return { status: 'OK' };
}


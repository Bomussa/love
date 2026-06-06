import * as path from 'path';
import { writeAtomicJSON, readJSON } from '../utils/fs-atomic.js';
import { localDateKeyAsiaQatar, nowISO } from '../utils/time.js';
import { appendAudit } from '../utils/logger.js';

import CONST from "../../config/constants.json" with { type: "json" };

type QueueFile = {
  meta: { clinicId:string; dateKey:string; version:number; };
  nextCallTicket: number;
  waiting: Array<{ ticket:number; visitId:string; issuedAt:string }>;
  called: Array<{ ticket:number; visitId:string; calledAt:string }>;
  completed: Array<{ ticket:number; visitId:string; completedAt:string }>;
};

const filePath = (clinicId:string, dateKey:string) => path.join('data','queues',clinicId, `${dateKey}.json`);

export async function assignTicket(clinicId:string, visitId:string, issuedAt?:string) {
  const day = localDateKeyAsiaQatar();
  const file = filePath(clinicId, day);
  const q = await readJSON<QueueFile>(file, { meta:{clinicId, dateKey:day, version:2}, nextCallTicket:1, waiting:[], called:[], completed:[] });
  const ticket = (q.waiting.length + q.called.length + q.completed.length) + 1;
  q.waiting.push({ ticket, visitId, issuedAt: issuedAt || nowISO() });
  await writeAtomicJSON(file, q);
  await appendAudit(`queue.assigned clinic=${clinicId} visit=${visitId} ticket=${ticket}`);
  return { ticket, clinicId, dateKey: day, floorHint: undefined };
}

export async function markDone(clinicId:string, visitId:string, ticket:number) {
  const day = localDateKeyAsiaQatar();
  const file = filePath(clinicId, day);
  const q = await readJSON<QueueFile>(file, { meta:{clinicId, dateKey:day, version:2}, nextCallTicket:1, waiting:[], called:[], completed:[] });

  const calledIdx = q.called.findIndex((x: { ticket: number; visitId: string; }) => x.ticket===ticket && x.visitId===visitId);
  if (calledIdx >= 0) {
    const [rec] = q.called.splice(calledIdx,1);
    q.completed.push({ ticket: rec.ticket, visitId: rec.visitId, completedAt: nowISO() });
  } else {
    const wIdx = q.waiting.findIndex((x: { ticket: number; visitId: string; }) => x.ticket===ticket && x.visitId===visitId);
    if (wIdx < 0) throw new Error('TICKET_NOT_FOUND');
    const [rec] = q.waiting.splice(wIdx,1);
    q.completed.push({ ticket: rec.ticket, visitId: rec.visitId, completedAt: nowISO() });
  }
  await writeAtomicJSON(file, q);
  await appendAudit(`queue.completed clinic=${clinicId} visit=${visitId} ticket=${ticket}`);
  return { ok:true };
}

export async function clinicCallSchedulerTick(clinicId:string) {
  const day = localDateKeyAsiaQatar();
  const file = filePath(clinicId, day);
  const q = await readJSON<QueueFile>(file, { meta:{clinicId, dateKey:day, version:2}, nextCallTicket:1, waiting:[], called:[], completed:[] });

  if (q.waiting.length > 0) {
    const rec = q.waiting.shift()!;
    q.called.push({ ticket: rec.ticket, visitId: rec.visitId, calledAt: nowISO() });
    q.nextCallTicket = rec.ticket + 1;
    await appendAudit(`clinic.call clinic=${clinicId} ticket=${rec.ticket}`);
  }
  await writeAtomicJSON(file, q);
}
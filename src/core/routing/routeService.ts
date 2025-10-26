import * as path from 'path';
import { writeAtomicJSON, readJSON } from '../../utils/fs-atomic.js';
import { localDateKeyAsiaQatar, nowISO } from '../../utils/time.js';
import { appendAudit } from '../../utils/logger.js';

import ROUTE_MAP from "../../../config/routeMap.json" assert { type: "json" };
import CLINICS from "../../../config/clinics.json" assert { type: "json" };

type RouteFile = {
  visitId: string;
  examType: string;
  gender?: 'M'|'F';
  route: Array<{ clinicId: string; assigned?: { ticket:number; dateKey:string; issuedAt:string }, status?: 'OK'|'LATE'|'INVALID', assignedAt?: string }>;
  createdAt: string;
};

const filePath = (visitId:string) => path.join('data','routes', `${visitId}.json`);

export async function createRoute(visitId:string, examType:string, gender?:'M'|'F') {
  const steps: string[] = Array.isArray((ROUTE_MAP as any)[examType]) ? (ROUTE_MAP as any)[examType] as string[] :
    // للحالات الخاصة (نساء)
    (gender === 'F' && (ROUTE_MAP as any)['نساء/عام']?.F) ? (ROUTE_MAP as any)['نساء/عام']?.F as string[] : ((ROUTE_MAP as any)['نساء/عام']?.M || []) as string[];
  const route: RouteFile = {
    visitId, examType, gender,
    route: steps.map(c=>({ clinicId:c })),
    createdAt: nowISO()
  };
  await writeAtomicJSON(filePath(visitId), route);
  await appendAudit(`route.assigned visit=${visitId} exam=${examType} steps=${steps.join(',')}`);
  return route;
}

export async function assignFirstClinicTicket(visitId:string, assignFn:(cid:string)=>Promise<{ticket:number;dateKey:string;}>) {
  const rf = await readJSON<RouteFile>(filePath(visitId), null as any);
  if (!rf) throw new Error('ROUTE_NOT_FOUND');
  const first = rf.route[0];
  if (!first) throw new Error('ROUTE_EMPTY');
  if (first.assigned) throw new Error('ALREADY_ASSIGNED');

  const { ticket, dateKey } = await assignFn(first.clinicId);
  first.assigned = { ticket, dateKey, issuedAt: nowISO() };
  await writeAtomicJSON(filePath(visitId), rf);
  await appendAudit(`route.ticket.assigned visit=${visitId} clinic=${first.clinicId} ticket=${ticket}`);
  return { ...first, floorHint: (CLINICS as any)[first.clinicId].floor };
}

export async function getRoute(visitId:string) {
  const rf = await readJSON<RouteFile>(filePath(visitId), null as any);
  if (!rf) throw new Error('ROUTE_NOT_FOUND');
  return rf;
}

export async function markClinicDone(visitId:string, clinicId:string) {
  const rf = await readJSON<RouteFile>(filePath(visitId), null as any);
  if (!rf) throw new Error('ROUTE_NOT_FOUND');
  const clinic = rf.route.find((x: { clinicId: string; }) => x.clinicId === clinicId);
  if (!clinic) throw new Error('CLINIC_NOT_IN_ROUTE');
  clinic.status = 'OK';
  await writeAtomicJSON(filePath(visitId), rf);
  await appendAudit(`route.clinic.done visit=${visitId} clinic=${clinicId}`);
  return { ok:true };
}

export async function getNextClinic(visitId:string) {
  const rf = await readJSON<RouteFile>(filePath(visitId), null as any);
  if (!rf) throw new Error('ROUTE_NOT_FOUND');
  const next = rf.route.find((x: { status?: string; }) => !x.status);
  if (!next) return { done: true };
  return { clinicId: next.clinicId, floorHint: (CLINICS as any)[next.clinicId].floor };
}

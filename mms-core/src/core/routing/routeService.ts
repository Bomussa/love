import * as path from 'path';
import { writeAtomicJSON, readJSON } from '../../utils/fs-atomic';
import { nowISO } from '../../utils/time';
import { appendAudit } from '../../utils/logger';

const ROUTE_MAP = require('../../../config/routeMap.json');

type RouteFile = {
  visitId: string;
  examType: string;
  gender?: 'M' | 'F';
  route: Array<{
    clinicId: string;
    assigned?: { ticket: number; dateKey: string; issuedAt: string };
    status?: 'OK' | 'LATE' | 'INVALID';
    assignedAt?: string;
  }>;
  createdAt: string;
};

const filePath = (visitId: string) => path.join('data', 'routes', `${visitId}.json`);

export async function createRoute(
  visitId: string,
  examType: string,
  gender?: 'M' | 'F'
): Promise<RouteFile> {
  let steps: string[] = [];
  
  if (Array.isArray(ROUTE_MAP[examType])) {
    steps = ROUTE_MAP[examType];
  } else if (examType === 'نساء/عام' && ROUTE_MAP['نساء/عام']) {
    steps = gender === 'F' ? ROUTE_MAP['نساء/عام'].F : ROUTE_MAP['نساء/عام'].M;
  } else {
    steps = [];
  }
  
  const route: RouteFile = {
    visitId,
    examType,
    gender,
    route: steps.map(c => ({ clinicId: c })),
    createdAt: nowISO()
  };
  
  await writeAtomicJSON(filePath(visitId), route);
  await appendAudit(`route.assigned visit=${visitId} exam=${examType} steps=${steps.join(',')}`);
  
  return route;
}

export async function assignFirstClinicTicket(
  visitId: string,
  assignFn: (cid: string) => Promise<{ ticket: number; dateKey: string }>
): Promise<RouteFile> {
  const rf = await readJSON<RouteFile>(filePath(visitId), null as any);
  if (!rf) throw new Error('ROUTE_NOT_FOUND');
  
  const first = rf.route[0];
  if (!first) throw new Error('EMPTY_ROUTE');
  
  if (!first.assigned) {
    const t = await assignFn(first.clinicId);
    first.assigned = { ...t, issuedAt: nowISO() };
    first.assignedAt = nowISO();
    await writeAtomicJSON(filePath(visitId), rf);
  }
  
  return rf;
}

export async function completeStepAndAssignNext(
  visitId: string,
  currentClinicId: string,
  nextAssign: (cid: string) => Promise<{ ticket: number; dateKey: string }>
): Promise<RouteFile> {
  const rf = await readJSON<RouteFile>(filePath(visitId), null as any);
  if (!rf) throw new Error('ROUTE_NOT_FOUND');
  
  const idx = rf.route.findIndex(s => s.clinicId === currentClinicId);
  if (idx < 0) throw new Error('CLINIC_NOT_IN_ROUTE');
  
  const next = rf.route[idx + 1];
  if (next && !next.assigned) {
    const t = await nextAssign(next.clinicId);
    next.assigned = { ...t, issuedAt: nowISO() };
    next.assignedAt = nowISO();
    await appendAudit(`route.unlocked visit=${visitId} next=${next.clinicId} ticket=${t.ticket}`);
  }
  
  await writeAtomicJSON(filePath(visitId), rf);
  return rf;
}

export async function getRoute(visitId: string): Promise<RouteFile | null> {
  return await readJSON<RouteFile | null>(filePath(visitId), null);
}


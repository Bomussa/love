import { appendAudit } from '../../utils/logger';

const CONST = require('../../../config/constants.json');

type NoticeType = 'START_HINT' | 'NEAR_TURN' | 'YOUR_TURN' | 'STEP_DONE_NEXT';

type Notice = {
  type: NoticeType;
  visitId: string;
  clinicId?: string;
  ahead?: number;
  ttl: number;
  at: string;
};

const listeners = new Set<(n: Notice) => void>();

export function onNotice(fn: (n: Notice) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function pushClientNotice(n: Notice): Promise<void> {
  for (const fn of listeners) {
    fn(n);
  }
  await appendAudit(
    `notice.sent type=${n.type} visit=${n.visitId} clinic=${n.clinicId || ''} ttl=${n.ttl}`
  );
}

export function mapQueueEventsToNotices(evt: {
  type: string;
  ahead?: number;
  visitId?: string;
  clinicId?: string;
}): void {
  if (!evt || !evt.type) return;
  
  if (evt.type === 'queue.near' && (evt.ahead || 0) === (CONST.NOTIFY_NEAR_AHEAD || 3)) {
    pushClientNotice({
      type: 'NEAR_TURN',
      visitId: evt.visitId!,
      clinicId: evt.clinicId,
      ttl: CONST.NOTICE_TTL_SECONDS,
      at: new Date().toISOString()
    });
  }
  
  if (evt.type === 'queue.updated' && (evt.ahead || 999) === 0) {
    pushClientNotice({
      type: 'YOUR_TURN',
      visitId: evt.visitId!,
      clinicId: evt.clinicId,
      ttl: CONST.NOTICE_TTL_SECONDS,
      at: new Date().toISOString()
    });
  }
}


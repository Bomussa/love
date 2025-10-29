import { Router } from 'express';
import { assignTicket, markDone, getQueueStatus } from '../../core/queueManager';
import { validateBeforeDisplayTicket } from '../../core/validation/validateBeforeDisplay';
import { pushClientNotice } from '../../core/notifications/notificationService';

export const queueRouter = Router();

/** يضع المراجع في طابور العيادة */
queueRouter.post('/enter', async (req, res) => {
  try {
    const { clinicId, visitId } = req.body || {};
    if (!clinicId || !visitId) {
      return res.status(400).json({ ok: false, error: 'clinicId, visitId required' });
    }
    
    const assigned = await assignTicket(clinicId, visitId);
    
    // ZFD
    const check = await validateBeforeDisplayTicket(
      clinicId,
      visitId,
      assigned.ticket,
      new Date().toISOString()
    );
    
    if (check.status !== 'OK') {
      return res.status(409).json({ ok: false, error: 'INVALID_TICKET', check });
    }
    
    pushClientNotice({
      type: 'START_HINT',
      visitId,
      clinicId,
      ttl: 30,
      at: new Date().toISOString()
    });
    
    res.json({ ok: true, ...assigned, status: check.status });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/** يُعلِم بأن الخطوة الحالية انتهت */
queueRouter.post('/complete', async (req, res) => {
  try {
    const { clinicId, visitId, ticket } = req.body || {};
    if (!clinicId || !visitId || !ticket) {
      return res.status(400).json({ ok: false, error: 'clinicId, visitId, ticket required' });
    }
    
    await markDone(clinicId, visitId, Number(ticket));
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

/** الحصول على حالة الطابور */
queueRouter.get('/status/:clinicId', async (req, res) => {
  try {
    const { clinicId } = req.params;
    const status = await getQueueStatus(clinicId);
    res.json({ ok: true, status });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});


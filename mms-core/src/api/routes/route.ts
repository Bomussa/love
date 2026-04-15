import { Router } from 'express';
import { createRoute, assignFirstClinicTicket, completeStepAndAssignNext, getRoute } from '../../core/routing/routeService';
import { assignTicket } from '../../core/queueManager';
import { validateBeforeDisplayTicket } from '../../core/validation/validateBeforeDisplay';

export const routeRouter = Router();

/** عند التسجيل: يبني مسار ثابت ويخصّص تذكرة للعيادة الأولى فقط */
routeRouter.post('/assign', async (req, res) => {
  try {
    const { visitId, examType, gender } = req.body || {};
    const rf = await createRoute(visitId, examType, gender);
    const withFirst = await assignFirstClinicTicket(visitId, (cid) => assignTicket(cid, visitId));
    const first = withFirst.route[0];
    
    const check = await validateBeforeDisplayTicket(
      first.clinicId,
      visitId,
      first.assigned!.ticket,
      first.assigned!.issuedAt
    );
    
    if (check.status !== 'OK') {
      return res.status(409).json({ ok: false, error: 'INVALID_TICKET', check, route: withFirst });
    }
    
    res.json({ ok: true, route: withFirst });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

/** فتح الخطوة التالية بعد إكمال الحالية */
routeRouter.post('/next', async (req, res) => {
  try {
    const { visitId, currentClinicId } = req.body || {};
    const rf = await completeStepAndAssignNext(visitId, currentClinicId, (cid) =>
      assignTicket(cid, visitId)
    );
    res.json({ ok: true, route: rf });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

/** الحصول على المسار الكامل */
routeRouter.get('/:visitId', async (req, res) => {
  const rf = await getRoute(req.params.visitId);
  if (!rf) return res.status(404).json({ ok: false, error: 'ROUTE_NOT_FOUND' });
  res.json({ ok: true, route: rf });
});


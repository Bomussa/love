import { Router } from 'express';
import { issueNextPin, verifyPinOrThrow } from '../../core/pinService';
import { validateBeforeDisplayTicket } from '../../core/validation/validateBeforeDisplay';

export const pinRouter = Router();

/**
 * يصدر PIN للعيادة المحددة (رقمين 01..20) لليوم الخدمي.
 */
pinRouter.post('/issue', async (req, res) => {
  try {
    const { clinicId, visitId } = req.body || {};
    if (!clinicId) return res.status(400).json({ ok: false, error: 'clinicId required' });
    
    const { pin, dateKey } = await issueNextPin(clinicId);
    
    // تحقق ZFD قبل العرض إن توفرت معلومات المسار
    if (visitId) {
      const check = await validateBeforeDisplayTicket(
        clinicId,
        visitId,
        Number(pin),
        new Date().toISOString()
      );
      if (check.status !== 'OK') {
        return res.status(409).json({ ok: false, error: 'INVALID_TICKET', check });
      }
    }
    
    res.json({ ok: true, pin, dateKey });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/** يتحقق من صحة PIN */
pinRouter.post('/validate', async (req, res) => {
  try {
    const { clinicId, dateKey, pin } = req.body || {};
    await verifyPinOrThrow(clinicId, dateKey, pin);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message });
  }
});


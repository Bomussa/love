// pages/api/queue/call-next.js - واجهة API لاستدعاء المراجع التالي
import { callNextPatient, expireNoShows } from '../../../lib/queueManager.js';
import { isWorkingHours } from '../../../lib/settings.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { clinicId, force = false } = req.body;

    if (!clinicId) {
      return res.status(400).json({
        success: false,
        error: 'Clinic ID is required'
      });
    }

    const clinicIdNum = parseInt(clinicId, 10);
    
    if (isNaN(clinicIdNum)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid clinic ID'
      });
    }

    // التحقق من ساعات العمل (إلا في حالة الإجبار)
    if (!force) {
      const workingHours = await isWorkingHours();
      if (!workingHours) {
        return res.status(400).json({
          success: false,
          error: 'Outside working hours',
          message: 'خارج ساعات العمل'
        });
      }
    }

    // معالجة المراجعين الذين انتهت مهلتهم أولاً
    const expiredCount = await expireNoShows(clinicIdNum);
    
    // استدعاء المراجع التالي
    const result = await callNextPatient(clinicIdNum);

    return res.json({
      success: result.success,
      clinicId: clinicIdNum,
      expiredNoShows: expiredCount,
      callResult: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in call-next API:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}

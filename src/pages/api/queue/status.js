// pages/api/queue/status.js - واجهة API لعرض حالة الكيو لحظياً
import { getQueueDetails, getQueueSnapshot } from '../../../lib/queueManager.js';
import { getDistributionStats } from '../../../lib/routingManager.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { clinicId, detailed = 'false' } = req.query;

    if (!clinicId) {
      // جلب إحصائيات جميع العيادات
      const distributionStats = await getDistributionStats();
      
      return res.json({
        success: true,
        type: 'all_clinics',
        data: distributionStats,
        timestamp: new Date().toISOString()
      });
    }

    const clinicIdNum = parseInt(clinicId, 10);
    
    if (isNaN(clinicIdNum)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid clinic ID'
      });
    }

    if (detailed === 'true') {
      // جلب تفاصيل الكيو مع قائمة المراجعين
      const queueDetails = await getQueueDetails(clinicIdNum);
      
      return res.json({
        success: true,
        type: 'detailed',
        clinicId: clinicIdNum,
        data: queueDetails,
        timestamp: new Date().toISOString()
      });
    } else {
      // جلب لقطة سريعة للكيو
      const snapshot = await getQueueSnapshot(clinicIdNum);
      
      return res.json({
        success: true,
        type: 'snapshot',
        clinicId: clinicIdNum,
        data: snapshot,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    // console.error('Error in queue status API:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}

// تصدير معلومات الواجهة للتوثيق
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

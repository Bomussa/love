// pages/api/queue/complete.js - واجهة API لإنهاء الفحص والانتقال للعيادة التالية
import { routeToNextClinic, processClinicCode } from '../../../lib/workflow.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { patientId, clinicId, clinicCode, action = 'complete' } = req.body;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        error: 'Patient ID is required'
      });
    }

    if (action === 'process_code') {
      // معالجة رمز العيادة المدخل من المراجع
      if (!clinicCode) {
        return res.status(400).json({
          success: false,
          error: 'Clinic code is required'
        });
      }

      const result = await processClinicCode(clinicCode, patientId);
      
      return res.json({
        success: result.success,
        action: result.action,
        patientId,
        clinicCode,
        result,
        timestamp: new Date().toISOString()
      });

    } else if (action === 'complete') {
      // إنهاء الفحص والانتقال للعيادة التالية
      if (!clinicId) {
        return res.status(400).json({
          success: false,
          error: 'Clinic ID is required for completion'
        });
      }

      const clinicIdNum = parseInt(clinicId, 10);
      
      if (isNaN(clinicIdNum)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid clinic ID'
        });
      }

      const result = await routeToNextClinic(patientId, clinicIdNum);
      
      return res.json({
        success: result.success,
        patientId,
        clinicId: clinicIdNum,
        completed: result.completed,
        nextClinic: result.nextClinic,
        message: result.message,
        timestamp: new Date().toISOString()
      });

    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Use "complete" or "process_code"'
      });
    }

  } catch (error) {
    console.error('Error in complete API:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}

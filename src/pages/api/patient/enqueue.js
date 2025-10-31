// pages/api/patient/enqueue.js - واجهة API لإضافة مراجع جديد للنظام
import { enqueuePatient, getPatientStatus, handleEmergency } from '../../../lib/workflow.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      // إضافة مراجع جديد
      const { patientId, examType, gender, priority = 0, emergencyCode } = req.body;

      if (!patientId || !examType || !gender) {
        return res.status(400).json({
          success: false,
          error: 'Patient ID, exam type, and gender are required'
        });
      }

      // معالجة حالة الطوارئ إذا تم إدخال رمز الطوارئ
      if (emergencyCode) {
        const emergencyResult = await handleEmergency(patientId, emergencyCode);
        if (!emergencyResult.success) {
          return res.status(400).json(emergencyResult);
        }
      }

      const result = await enqueuePatient({
        patientId,
        examType,
        gender,
        priority: emergencyCode ? 3 : priority // أولوية قصوى للطوارئ
      });

      return res.json({
        success: result.success,
        patientId,
        examType,
        gender,
        priority: emergencyCode ? 3 : priority,
        emergency: !!emergencyCode,
        result,
        timestamp: new Date().toISOString()
      });

    } else if (req.method === 'GET') {
      // جلب حالة مراجع موجود
      const { patientId } = req.query;

      if (!patientId) {
        return res.status(400).json({
          success: false,
          error: 'Patient ID is required'
        });
      }

      const status = await getPatientStatus(patientId);

      return res.json({
        success: status.exists,
        patientId,
        status,
        timestamp: new Date().toISOString()
      });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Error in patient enqueue API:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}

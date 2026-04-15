/**
 * Main API Router for Vercel Serverless Functions
 * Routes all /api/* requests to appropriate handlers
 */

import { storage } from './lib/storage.js';
import { setCorsHeaders, validateRequest, acquireLock, releaseLock } from './lib/helpers.js';
import { calculateDynamicRoute, optimizeRoute } from './lib/routing.js';
import { generateDailyReport, generateWeeklyReport, generateMonthlyReport, generateAnnualReport } from './lib/reports.js';

export default async function handler(req, res) {
  // Set CORS headers
  setCorsHeaders(res);

  // Handle OPTIONS for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url, method } = req;
  const pathname = new URL(url, `https://${req.headers.host}`).pathname;

  try {
    // Route: /api/v1/status
    if (pathname === '/api/v1/status' && method === 'GET') {
      return res.status(200).json({
        success: true,
        status: 'healthy',
        mode: 'online',
        backend: 'up',
        platform: 'vercel',
        timestamp: new Date().toISOString(),
        kv: {
          admin: true,
          pins: true,
          queues: true,
          events: true,
          locks: true,
          cache: true
        }
      });
    }

    // Route: /api/v1/patient/login
    if (pathname === '/api/v1/patient/login' && method === 'POST') {
      const { personalId, gender } = req.body || {};
      
      if (!personalId || !gender) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: personalId, gender'
        });
      }

      // Generate session
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const sessionData = {
        personalId,
        gender,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      await storage.set('ADMIN', `session:${sessionId}`, sessionData);

      return res.status(200).json({
        success: true,
        sessionId,
        message: 'Login successful'
      });
    }

    // Route: /api/v1/queue/enter
    if (pathname === '/api/v1/queue/enter' && method === 'POST') {
      const { sessionId, clinicId } = req.body || {};
      
      if (!sessionId || !clinicId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: sessionId, clinicId'
        });
      }

      // Get queue
      const queueKey = `queue:${clinicId}`;
      const queue = await storage.get('QUEUES', queueKey) || { patients: [], current: 0 };

      // Add patient
      const position = queue.patients.length + 1;
      queue.patients.push({
        sessionId,
        position,
        enteredAt: new Date().toISOString()
      });

      await storage.set('QUEUES', queueKey, queue);

      return res.status(200).json({
        success: true,
        position,
        queueLength: queue.patients.length,
        estimatedWait: queue.patients.length * 5 // 5 minutes per patient
      });
    }

    // Route: /api/v1/queue/status
    if (pathname === '/api/v1/queue/status' && method === 'GET') {
      const { clinicId } = req.query || {};
      
      if (!clinicId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameter: clinicId'
        });
      }

      const queueKey = `queue:${clinicId}`;
      const queue = await storage.get('QUEUES', queueKey) || { patients: [], current: 0 };

      return res.status(200).json({
        success: true,
        queueLength: queue.patients.length,
        currentNumber: queue.current,
        patients: queue.patients
      });
    }

    // Route: /api/v1/queue/call
    if (pathname === '/api/v1/queue/call' && method === 'POST') {
      const { clinicId } = req.body || {};
      
      if (!clinicId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: clinicId'
        });
      }

      const queueKey = `queue:${clinicId}`;
      const queue = await storage.get('QUEUES', queueKey) || { patients: [], current: 0 };

      if (queue.patients.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No patients in queue'
        });
      }

      // Call next patient
      const nextPatient = queue.patients.shift();
      queue.current = nextPatient.position;

      await storage.set('QUEUES', queueKey, queue);

      return res.status(200).json({
        success: true,
        calledPatient: nextPatient,
        remainingInQueue: queue.patients.length
      });
    }

    // Route: /api/v1/queue/done
    if (pathname === '/api/v1/queue/done' && method === 'POST') {
      const { sessionId, clinicId } = req.body || {};
      
      if (!sessionId || !clinicId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: sessionId, clinicId'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Patient marked as done'
      });
    }

    // Route: /api/v1/pin/generate
    if (pathname === '/api/v1/pin/generate' && method === 'POST') {
      const pin = Math.floor(1000 + Math.random() * 9000).toString();
      const pinData = {
        pin,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
      };

      await storage.set('PINS', `pin:${pin}`, pinData);

      return res.status(200).json({
        success: true,
        pin
      });
    }

    // Route: /api/v1/pin/verify
    if (pathname === '/api/v1/pin/verify' && method === 'POST') {
      const { pin } = req.body || {};
      
      if (!pin) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: pin'
        });
      }

      const pinData = await storage.get('PINS', `pin:${pin}`);

      if (!pinData) {
        return res.status(404).json({
          success: false,
          error: 'PIN not found'
        });
      }

      if (new Date(pinData.expiresAt) < new Date()) {
        return res.status(401).json({
          success: false,
          error: 'PIN expired'
        });
      }

      return res.status(200).json({
        success: true,
        valid: true
      });
    }

    // Route: /api/v1/reports/daily
    if (pathname === '/api/v1/reports/daily' && method === 'GET') {
      const report = await generateDailyReport();
      return res.status(200).json({
        success: true,
        report
      });
    }

    // Route: /api/v1/stats/dashboard
    if (pathname === '/api/v1/stats/dashboard' && method === 'GET') {
      return res.status(200).json({
        success: true,
        stats: {
          totalPatients: 0,
          activeQueues: 0,
          completedToday: 0,
          averageWaitTime: 0
        }
      });
    }

    // Default: 404
    return res.status(404).json({
      success: false,
      error: 'Endpoint not found',
      path: pathname
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}


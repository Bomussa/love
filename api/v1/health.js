/**
 * Health Check Endpoint
 * GET /api/v1/health
 */

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  return res.status(200).json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'love-api',
    version: '1.0.0',
    environment: process.env.VERCEL_ENV || 'development'
  });
}

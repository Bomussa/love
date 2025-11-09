/**
 * Health check endpoint
 * GET /api/v1/health
 */
export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'love-api',
    version: '1.0.0'
  });
}

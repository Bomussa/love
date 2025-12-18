/**
 * Maintenance Status API Endpoint
 * نقطة نهاية حالة الصيانة
 * 
 * Returns maintenance status for the system
 */

export default function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Return maintenance status
  // maintenance_active: false means system is operational
  return res.status(200).json({
    maintenance_active: false,
    message: 'النظام يعمل بشكل طبيعي',
    message_en: 'System is operational',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
}

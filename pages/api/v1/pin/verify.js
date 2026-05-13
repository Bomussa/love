/**
 * Legacy PIN verification endpoint.
 * PIN-based clinic access is deprecated and disabled.
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.status(410).json({
    success: false,
    code: 'PIN_SYSTEM_REMOVED',
    message: 'Clinic PIN verification has been removed from the system.',
  });
}

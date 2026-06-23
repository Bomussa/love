const PATIENT_EF = 'https://rujwuruuosffcxazymit.supabase.co/functions/v1/patient-login';

export const config = { api: { bodyParser: false } };

async function rawBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => { resolve(data); });
    req.on('error', () => { resolve('{}'); });
  });
}

function normalizePayload(payload) {
  const body = payload && typeof payload === 'object' ? payload : {};
  const patientId = String(
    body.personalId ||
    body.personal_id ||
    body.patientId ||
    body.patient_id ||
    body.militaryId ||
    body.military_id ||
    ''
  ).trim();

  const gender = String(body.gender || 'male').trim() || 'male';

  return {
    ...body,
    patientId,
    personalId: patientId,
    personal_id: patientId,
    patient_id: patientId,
    militaryId: patientId,
    military_id: patientId,
    gender,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Version');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const raw = await rawBody(req);
    const payload = raw ? JSON.parse(raw) : {};
    const r = await fetch(PATIENT_EF, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalizePayload(payload)),
    });
    const text = await r.text();
    res.setHeader('Content-Type', 'application/json');
    res.status(r.status).send(text);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

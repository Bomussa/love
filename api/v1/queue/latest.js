const ALLOW = ['https://mmc-mms.com','https://www.mmc-mms.com'];
function cors(res, origin){ if(ALLOW.includes(origin||'')) res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary','Origin'); }

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req,res){
  cors(res, req.headers.origin);
  if(!SUPABASE_URL || !SUPABASE_KEY){
    return res.status(500).json({ok:false, error:'Supabase env missing'});
  }
  try{
    const u = new URL('/rest/v1/queue', SUPABASE_URL);
    u.searchParams.set('select','id,patient_id,patient_name,clinic_id,exam_type,status,position,entered_at');
    u.searchParams.set('order','entered_at.desc');
    const r = await fetch(u, { headers:{ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Accept:'application/json', Range:'0-9' } });
    const data = await r.json();
    res.status(200).json({ ok:true, items: Array.isArray(data)?data:[] });
  }catch(e){
    res.status(500).json({ ok:false, error: e.message || String(e) });
  }
}
